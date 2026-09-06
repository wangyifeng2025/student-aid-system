package service

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// 归档内每张表存为 data/<table>.jsonl：第一行是表头（列名 + 列类型），
// 其后每行一个 JSON 对象表示一行数据。列类型随包携带，使恢复不依赖目标库现有 schema。

type backupColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type backupTableHeader struct {
	Table   string         `json:"table"`
	Columns []backupColumn `json:"columns"`
}

// bytesKey 标记以 base64 编码的二进制值，区别于普通字符串。
const bytesKey = "$b64"

// pgMaxBindParams PostgreSQL 单条语句的绑定参数上限是 65535，留出余量分批。
const pgMaxBindParams = 60000

// maxRowsPerInsert 单条 INSERT 的行数上限，避免超长 SQL 占用过多内存。
const maxRowsPerInsert = 500

// tableNamesFromModels 按 model.AllModels() 的顺序返回表名。
func tableNamesFromModels(db *gorm.DB) ([]string, error) {
	models := model.AllModels()
	names := make([]string, 0, len(models))
	for _, m := range models {
		stmt := &gorm.Statement{DB: db}
		if err := stmt.Parse(m); err != nil {
			return nil, err
		}
		names = append(names, stmt.Schema.Table)
	}
	return names, nil
}

// quoteIdent 按驱动给标识符加引号。表名来自模型定义，不含用户输入。
func quoteIdent(driver, name string) string {
	if driver == "mysql" {
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	}
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// dumpTable 把整表数据以 JSONL 写入 w，返回行数。
func dumpTable(db *gorm.DB, driver, table string, w io.Writer) (int64, error) {
	// ORDER BY 1 按首列（各表均为自增 id）排序，保证归档内容稳定可比对。
	rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s ORDER BY 1", quoteIdent(driver, table))).Rows()
	if err != nil {
		return 0, fmt.Errorf("读取表 %s 失败: %w", table, err)
	}
	defer rows.Close()

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return 0, err
	}
	cols := make([]backupColumn, len(colTypes))
	for i, ct := range colTypes {
		cols[i] = backupColumn{Name: ct.Name(), Type: ct.DatabaseTypeName()}
	}

	enc := json.NewEncoder(w)
	if err := enc.Encode(backupTableHeader{Table: table, Columns: cols}); err != nil {
		return 0, err
	}

	holders := make([]any, len(cols))
	scan := make([]any, len(cols))
	for i := range holders {
		scan[i] = &holders[i]
	}

	var count int64
	record := make(map[string]any, len(cols))
	for rows.Next() {
		if err := rows.Scan(scan...); err != nil {
			return 0, fmt.Errorf("扫描表 %s 失败: %w", table, err)
		}
		clear(record)
		for i, c := range cols {
			record[c.Name] = encodeDumpValue(holders[i])
		}
		if err := enc.Encode(record); err != nil {
			return 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	return count, nil
}

// encodeDumpValue 把驱动返回值转成可 JSON 序列化的形式。
func encodeDumpValue(v any) any {
	switch x := v.(type) {
	case nil:
		return nil
	case []byte:
		return map[string]string{bytesKey: base64.StdEncoding.EncodeToString(x)}
	case time.Time:
		return x.Format(time.RFC3339Nano)
	default:
		return v
	}
}

// tableColumns 返回目标库中该表的列名集合，用于过滤归档里已废弃的列。
func tableColumns(db *gorm.DB, driver, table string) (map[string]struct{}, error) {
	rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s LIMIT 0", quoteIdent(driver, table))).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	out := make(map[string]struct{}, len(names))
	for _, n := range names {
		out[n] = struct{}{}
	}
	return out, nil
}

// insertRows 按批把行写入表。cols 已按目标表实际存在的列过滤过。
func insertRows(tx *gorm.DB, driver, table string, cols []backupColumn, rows [][]any) error {
	if len(rows) == 0 || len(cols) == 0 {
		return nil
	}
	quoted := make([]string, len(cols))
	for i, c := range cols {
		quoted[i] = quoteIdent(driver, c.Name)
	}
	rowHolder := "(" + strings.TrimSuffix(strings.Repeat("?,", len(cols)), ",") + ")"
	prefix := fmt.Sprintf("INSERT INTO %s (%s) VALUES ",
		quoteIdent(driver, table), strings.Join(quoted, ","))

	batch := pgMaxBindParams / len(cols)
	if batch > maxRowsPerInsert {
		batch = maxRowsPerInsert
	}
	if batch < 1 {
		batch = 1
	}

	for start := 0; start < len(rows); start += batch {
		end := min(start+batch, len(rows))
		chunk := rows[start:end]

		args := make([]any, 0, len(chunk)*len(cols))
		for _, r := range chunk {
			args = append(args, r...)
		}
		sql := prefix + strings.TrimSuffix(strings.Repeat(rowHolder+",", len(chunk)), ",")
		if err := tx.Exec(sql, args...).Error; err != nil {
			return fmt.Errorf("写入表 %s 失败: %w", table, err)
		}
	}
	return nil
}

// decodeRestoreValue 依据归档记录的列类型，把 JSON 值还原为驱动可接受的 Go 值。
func decodeRestoreValue(raw any, dbType string) (any, error) {
	if raw == nil {
		return nil, nil
	}

	normalized := strings.ToUpper(strings.TrimSpace(dbType))
	// 数组/自定义类型统一按文本回填，交给数据库解析。
	if m, ok := raw.(map[string]any); ok {
		s, ok := m[bytesKey].(string)
		if !ok {
			// 未知的对象形态（如 json/jsonb 列）原样序列化为文本。
			b, err := json.Marshal(m)
			if err != nil {
				return nil, err
			}
			return string(b), nil
		}
		decoded, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return nil, err
		}
		if isBinaryType(normalized) {
			return decoded, nil
		}
		raw = string(decoded)
	}

	switch {
	case isBoolType(normalized):
		return toBool(raw)
	case isIntType(normalized):
		return toInt64(raw)
	case isFloatType(normalized):
		return toFloat64(raw)
	case isTimeType(normalized):
		return toTime(raw)
	case isBinaryType(normalized):
		return []byte(toStringValue(raw)), nil
	default:
		return toStringValue(raw), nil
	}
}

func isBoolType(t string) bool {
	return t == "BOOL" || t == "BOOLEAN" || t == "TINYINT(1)" || t == "BIT"
}

func isIntType(t string) bool {
	switch t {
	case "INT2", "INT4", "INT8", "SMALLINT", "INTEGER", "INT", "BIGINT",
		"SERIAL", "BIGSERIAL", "SMALLSERIAL", "MEDIUMINT", "TINYINT",
		"UNSIGNED BIGINT", "UNSIGNED INT":
		return true
	}
	return false
}

func isFloatType(t string) bool {
	switch t {
	case "FLOAT4", "FLOAT8", "REAL", "DOUBLE", "DOUBLE PRECISION",
		"NUMERIC", "DECIMAL", "FLOAT":
		return true
	}
	return false
}

func isTimeType(t string) bool {
	switch t {
	case "TIMESTAMP", "TIMESTAMPTZ", "DATE", "DATETIME",
		"TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITHOUT TIME ZONE":
		return true
	}
	return false
}

func isBinaryType(t string) bool {
	switch t {
	case "BYTEA", "BLOB", "LONGBLOB", "MEDIUMBLOB", "TINYBLOB", "VARBINARY", "BINARY":
		return true
	}
	return false
}

func toStringValue(raw any) string {
	switch x := raw.(type) {
	case string:
		return x
	case json.Number:
		return x.String()
	case bool:
		return strconv.FormatBool(x)
	default:
		return fmt.Sprint(x)
	}
}

func toBool(raw any) (any, error) {
	switch x := raw.(type) {
	case bool:
		return x, nil
	case json.Number:
		return x.String() != "0", nil
	case string:
		return strconv.ParseBool(x)
	}
	return nil, fmt.Errorf("无法解析布尔值: %v", raw)
}

func toInt64(raw any) (any, error) {
	switch x := raw.(type) {
	case json.Number:
		n, err := x.Int64()
		if err == nil {
			return n, nil
		}
		f, ferr := x.Float64()
		if ferr != nil {
			return nil, err
		}
		return int64(f), nil
	case bool:
		if x {
			return int64(1), nil
		}
		return int64(0), nil
	case string:
		if x == "" {
			return nil, nil
		}
		return strconv.ParseInt(x, 10, 64)
	}
	return nil, fmt.Errorf("无法解析整数: %v", raw)
}

func toFloat64(raw any) (any, error) {
	switch x := raw.(type) {
	case json.Number:
		return x.Float64()
	case string:
		if x == "" {
			return nil, nil
		}
		return strconv.ParseFloat(x, 64)
	}
	return nil, fmt.Errorf("无法解析浮点数: %v", raw)
}

// timeLayouts 覆盖归档写出的 RFC3339 以及少数驱动可能给出的其它格式。
var timeLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02 15:04:05.999999999 -0700 MST",
	"2006-01-02 15:04:05.999999",
	"2006-01-02 15:04:05",
	"2006-01-02",
}

func toTime(raw any) (any, error) {
	s := toStringValue(raw)
	if s == "" {
		return nil, nil
	}
	for _, layout := range timeLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return nil, fmt.Errorf("无法解析时间: %s", s)
}

// sortTablesByDependency 让被引用的表排在引用它的表之前，
// 使恢复时可以顺序写入而不触发外键约束。
func sortTablesByDependency(db *gorm.DB, driver string, tables []string) []string {
	deps, err := foreignKeyDeps(db, driver)
	if err != nil || len(deps) == 0 {
		return tables
	}
	return orderByDeps(tables, deps)
}

// orderByDeps 对 tables 做拓扑排序，deps 为 child -> {parent}。
// 同一「就绪批次」内保持 tables 的原始顺序，保证结果稳定。
func orderByDeps(tables []string, deps map[string]map[string]struct{}) []string {
	// 仅保留 tables 内部的依赖，忽略自引用与外部表。
	pending := make(map[string]map[string]struct{}, len(tables))
	for _, t := range tables {
		pending[t] = map[string]struct{}{}
	}
	for child, parents := range deps {
		if _, ok := pending[child]; !ok {
			continue
		}
		for parent := range parents {
			if parent == child {
				continue
			}
			if _, ok := pending[parent]; !ok {
				continue
			}
			pending[child][parent] = struct{}{}
		}
	}

	done := make(map[string]struct{}, len(tables))
	out := make([]string, 0, len(tables))
	for len(out) < len(tables) {
		progressed := false
		for _, t := range tables {
			if _, ok := done[t]; ok {
				continue
			}
			ready := true
			for parent := range pending[t] {
				if _, ok := done[parent]; !ok {
					ready = false
					break
				}
			}
			if !ready {
				continue
			}
			done[t] = struct{}{}
			out = append(out, t)
			progressed = true
		}
		if !progressed {
			// 存在环（本项目 schema 无环）：剩余表按原顺序追加，交由数据库报错。
			for _, t := range tables {
				if _, ok := done[t]; !ok {
					out = append(out, t)
				}
			}
			break
		}
	}
	return out
}

// foreignKeyDeps 返回 child -> {parent} 的外键依赖表。
func foreignKeyDeps(db *gorm.DB, driver string) (map[string]map[string]struct{}, error) {
	type edge struct {
		Child  string
		Parent string
	}
	var edges []edge

	switch driver {
	case "mysql":
		err := db.Raw(`
			SELECT TABLE_NAME AS child, REFERENCED_TABLE_NAME AS parent
			FROM information_schema.KEY_COLUMN_USAGE
			WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`).
			Scan(&edges).Error
		if err != nil {
			return nil, err
		}
	default:
		err := db.Raw(`
			SELECT c.conrelid::regclass::text AS child,
			       c.confrelid::regclass::text AS parent
			FROM pg_constraint c
			JOIN pg_class t ON t.oid = c.conrelid
			JOIN pg_namespace n ON n.oid = t.relnamespace
			WHERE c.contype = 'f' AND n.nspname = current_schema()`).
			Scan(&edges).Error
		if err != nil {
			return nil, err
		}
	}

	out := make(map[string]map[string]struct{})
	for _, e := range edges {
		child := strings.Trim(e.Child, `"`)
		parent := strings.Trim(e.Parent, `"`)
		if out[child] == nil {
			out[child] = map[string]struct{}{}
		}
		out[child][parent] = struct{}{}
	}
	return out, nil
}

// truncateAll 一次性清空所有表。整批 TRUNCATE 可绕开表间外键顺序问题。
func truncateAll(tx *gorm.DB, driver string, tables []string) error {
	if len(tables) == 0 {
		return nil
	}
	quoted := make([]string, len(tables))
	for i, t := range tables {
		quoted[i] = quoteIdent(driver, t)
	}
	list := strings.Join(quoted, ",")

	if driver == "mysql" {
		if err := tx.Exec("SET FOREIGN_KEY_CHECKS = 0").Error; err != nil {
			return err
		}
		for _, t := range quoted {
			if err := tx.Exec("TRUNCATE TABLE " + t).Error; err != nil {
				return err
			}
		}
		return tx.Exec("SET FOREIGN_KEY_CHECKS = 1").Error
	}
	return tx.Exec("TRUNCATE TABLE " + list + " RESTART IDENTITY CASCADE").Error
}

// resetSequences 把自增序列推到当前最大 id 之后，避免恢复后新增记录主键冲突。
func resetSequences(tx *gorm.DB, driver string, tables []string) error {
	if driver == "mysql" {
		// MySQL 的 AUTO_INCREMENT 在写入显式主键后会自动前移，无需处理。
		return nil
	}
	for _, t := range tables {
		// 联结表（如 advisor_classes）没有 id 列，直接对其调用
		// pg_get_serial_sequence 会报错，所以先判断列是否存在。
		var hasID bool
		if err := tx.Raw(`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema() AND table_name = ? AND column_name = 'id'
			)`, t).Scan(&hasID).Error; err != nil {
			return err
		}
		if !hasID {
			continue
		}

		var seq sql.NullString
		if err := tx.Raw("SELECT pg_get_serial_sequence(?, 'id')", t).Scan(&seq).Error; err != nil {
			return err
		}
		// id 不是自增列（无关联序列）时跳过。
		if !seq.Valid || seq.String == "" {
			continue
		}
		stmt := fmt.Sprintf(
			"SELECT setval(?, COALESCE((SELECT MAX(id) FROM %s), 0) + 1, false)",
			quoteIdent(driver, t),
		)
		if err := tx.Exec(stmt, seq.String).Error; err != nil {
			return err
		}
	}
	return nil
}
