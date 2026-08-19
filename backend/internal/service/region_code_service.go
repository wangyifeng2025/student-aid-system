package service

import (
	"bytes"
	"encoding/json"
	"strings"
	"unicode"

	"github.com/wangyifeng2025/student-aid-system/internal/dto"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/regiondata"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
	"gorm.io/gorm"
)

// RegionCodeService 行政区划代码维护与身份证前 6 位地址解析。
type RegionCodeService struct {
	repo *repository.RegionCodeRepository
}

func NewRegionCodeService(db *gorm.DB) *RegionCodeService {
	return &RegionCodeService{repo: repository.NewRegionCodeRepository(db)}
}

func (s *RegionCodeService) List(f repository.RegionCodeFilter) ([]dto.RegionCodeResponse, error) {
	items, err := s.repo.List(f)
	if err != nil {
		return nil, err
	}
	codes := make([]string, 0, len(items))
	for i := range items {
		codes = append(codes, items[i].Code)
	}
	counts, err := s.repo.ChildCounts(codes)
	if err != nil {
		return nil, err
	}
	out := make([]dto.RegionCodeResponse, 0, len(items))
	for i := range items {
		out = append(out, dto.ToRegionCodeResponse(&items[i], counts[items[i].Code]))
	}
	return out, nil
}

func (s *RegionCodeService) Get(code string) (*dto.RegionCodeResponse, error) {
	code, err := normalizeRegionCode(code)
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindByCode(code)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	n, err := s.repo.CountChildren(item.Code)
	if err != nil {
		return nil, err
	}
	resp := dto.ToRegionCodeResponse(item, n)
	return &resp, nil
}

func (s *RegionCodeService) Create(req *dto.RegionCodeRequest) (*dto.RegionCodeResponse, error) {
	item, err := s.buildRegionCode(req.Code, req.Name, req.Type, req.ParentCode, req.Level, req.Sort)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByCode(item.Code); err == nil {
		return nil, ErrDuplicate
	} else if !repository.IsNotFound(err) {
		return nil, err
	}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	resp := dto.ToRegionCodeResponse(item, 0)
	return &resp, nil
}

func (s *RegionCodeService) Update(code string, req *dto.RegionCodeUpdateRequest) (*dto.RegionCodeResponse, error) {
	code, err := normalizeRegionCode(code)
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindByCode(code)
	if repository.IsNotFound(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	level := req.Level
	if level == 0 {
		level = item.Level
	}
	updated, err := s.buildRegionCode(item.Code, req.Name, req.Type, req.ParentCode, level, req.Sort)
	if err != nil {
		return nil, err
	}
	item.Name = updated.Name
	item.Type = updated.Type
	item.ParentCode = updated.ParentCode
	item.Level = updated.Level
	item.IDPrefix = updated.IDPrefix
	item.Sort = updated.Sort
	if err := s.repo.Save(item); err != nil {
		return nil, err
	}
	n, err := s.repo.CountChildren(item.Code)
	if err != nil {
		return nil, err
	}
	resp := dto.ToRegionCodeResponse(item, n)
	return &resp, nil
}

func (s *RegionCodeService) Delete(code string) error {
	code, err := normalizeRegionCode(code)
	if err != nil {
		return err
	}
	if _, err := s.repo.FindByCode(code); repository.IsNotFound(err) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	n, err := s.repo.CountChildren(code)
	if err != nil {
		return err
	}
	if n > 0 {
		return ErrInUse
	}
	if err := s.repo.DeleteByCode(code); err != nil {
		if repository.IsNotFound(err) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *RegionCodeService) Lookup(q string) (*dto.RegionLookupResponse, error) {
	prefix := extractIDPrefix(q)
	if len(prefix) != 6 {
		return nil, NewValidationError("请输入 18 位身份证号或 6 位行政区划代码")
	}
	var matched *model.RegionCode
	for _, key := range []string{prefix, prefix[:4] + "00", prefix[:2] + "0000"} {
		item, err := s.repo.FindByIDPrefix(key)
		if repository.IsNotFound(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		matched = item
		break
	}
	if matched == nil {
		return nil, ErrNotFound
	}
	chain, err := s.ancestorsInclusive(matched)
	if err != nil {
		return nil, err
	}
	resp := dto.RegionLookupResponse{
		IDPrefix:     prefix,
		MatchedCode:  matched.Code,
		MatchedName:  matched.Name,
		MatchedLevel: matched.Level,
	}
	names := make([]string, 0, 3)
	for i := range chain {
		b := dto.ToRegionBrief(&chain[i])
		switch chain[i].Level {
		case 1:
			resp.Province = &b
		case 2:
			resp.City = &b
		case 3:
			resp.District = &b
		}
		names = append(names, chain[i].Name)
	}
	resp.FullName = strings.Join(names, "")
	return &resp, nil
}

func (s *RegionCodeService) ImportJSON(raw []byte) (*dto.RegionImportResult, error) {
	items, skipped := parseRegionTree(raw)
	if len(items) == 0 && skipped == 0 {
		return nil, NewValidationError("未解析到有效的行政区划节点")
	}
	created, updated := 0, 0
	for i := range items {
		wasNew, err := s.repo.UpsertByCode(&items[i])
		if err != nil {
			return nil, err
		}
		if wasNew {
			created++
		} else {
			updated++
		}
	}
	return &dto.RegionImportResult{Created: created, Updated: updated, Skipped: skipped}, nil
}

func (s *RegionCodeService) ImportDefault() (*dto.RegionImportResult, error) {
	return s.ImportJSON(regiondata.DefaultJSON)
}

func (s *RegionCodeService) buildRegionCode(code, name, typ, parent string, level, sort int) (*model.RegionCode, error) {
	code, err := normalizeRegionCode(code)
	if err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, NewValidationError("区划名称不能为空")
	}
	if level < 1 || level > 3 {
		return nil, NewValidationError("区划级别须为 1（省级）、2（地市）或 3（区县）")
	}
	parent = strings.TrimSpace(parent)
	if parent != "" {
		var pErr error
		parent, pErr = normalizeRegionCode(parent)
		if pErr != nil {
			return nil, pErr
		}
		if parent == code {
			return nil, NewValidationError("上级区划不能是自身")
		}
		p, err := s.repo.FindByCode(parent)
		if repository.IsNotFound(err) {
			return nil, ErrInvalidRef
		}
		if err != nil {
			return nil, err
		}
		if p.Level >= level {
			return nil, NewValidationError("上级区划的级别必须低于当前级别")
		}
	} else if level != 1 {
		return nil, NewValidationError("非省级区划必须指定上级")
	}
	return &model.RegionCode{
		Code:       code,
		Name:       name,
		Level:      level,
		Type:       strings.TrimSpace(typ),
		ParentCode: parent,
		IDPrefix:   code[:6],
		Sort:       sort,
	}, nil
}

func (s *RegionCodeService) ancestorsInclusive(item *model.RegionCode) ([]model.RegionCode, error) {
	chain := []model.RegionCode{*item}
	cur := item
	for cur.ParentCode != "" {
		p, err := s.repo.FindByCode(cur.ParentCode)
		if repository.IsNotFound(err) {
			break
		}
		if err != nil {
			return nil, err
		}
		chain = append([]model.RegionCode{*p}, chain...)
		cur = p
	}
	return chain, nil
}

type regionTreeNode struct {
	Code     string           `json:"code"`
	Name     *string          `json:"name"`
	Level    int              `json:"level"`
	Type     string           `json:"type"`
	Children []regionTreeNode `json:"children"`
}

type regionTreeWrap struct {
	Data regionTreeNode `json:"data"`
}

func parseRegionTree(raw []byte) (items []model.RegionCode, skipped int) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return nil, 0
	}
	if raw[0] == '[' {
		var arr []regionTreeNode
		if err := json.Unmarshal(raw, &arr); err != nil {
			return nil, 0
		}
		return flattenRegionNodes(arr, "", 0)
	}
	var wrap regionTreeWrap
	root := regionTreeNode{}
	if json.Unmarshal(raw, &wrap) == nil && (wrap.Data.Code != "" || len(wrap.Data.Children) > 0) {
		root = wrap.Data
	} else if err := json.Unmarshal(raw, &root); err != nil {
		return nil, 0
	}
	if root.Code == "00" || root.Name == nil || strings.TrimSpace(ptrString(root.Name)) == "" {
		return flattenRegionNodes(root.Children, "", 0)
	}
	return flattenRegionNodes([]regionTreeNode{root}, "", 0)
}

func flattenRegionNodes(nodes []regionTreeNode, parent string, startSort int) ([]model.RegionCode, int) {
	var items []model.RegionCode
	skipped := 0
	for i, n := range nodes {
		name := strings.TrimSpace(ptrString(n.Name))
		code, err := normalizeRegionCode(n.Code)
		if err != nil || name == "" {
			skipped++
			childItems, childSkip := flattenRegionNodes(n.Children, parent, 0)
			items = append(items, childItems...)
			skipped += childSkip
			continue
		}
		level := n.Level
		if level == 0 {
			level = inferRegionLevel(code)
		}
		if level < 1 || level > 3 {
			skipped++
			childItems, childSkip := flattenRegionNodes(n.Children, parent, 0)
			items = append(items, childItems...)
			skipped += childSkip
			continue
		}
		typ := strings.TrimSpace(n.Type)
		if typ == "" {
			typ = inferRegionType(name, level)
		}
		items = append(items, model.RegionCode{
			Code:       code,
			Name:       name,
			Level:      level,
			Type:       typ,
			ParentCode: parent,
			IDPrefix:   code[:6],
			Sort:       startSort + i,
		})
		childItems, childSkip := flattenRegionNodes(n.Children, code, 0)
		items = append(items, childItems...)
		skipped += childSkip
	}
	return items, skipped
}

// inferRegionLevel 按 12 位区划码（6 位码会先补零）推断级别：
// 省级 xx0000、地市 xxxx00、其余为区县。
func inferRegionLevel(code12 string) int {
	if len(code12) < 6 {
		return 0
	}
	prefix := code12[:6]
	switch {
	case prefix[2:] == "0000":
		return 1
	case prefix[4:] == "00":
		return 2
	default:
		return 3
	}
}

func inferRegionType(name string, level int) string {
	switch level {
	case 1:
		switch {
		case strings.HasSuffix(name, "特别行政区"):
			return "特别行政区"
		case strings.HasSuffix(name, "自治区"):
			return "自治区"
		case strings.HasSuffix(name, "市"):
			return "直辖市"
		default:
			return "省"
		}
	case 2:
		switch {
		case strings.HasSuffix(name, "自治州"):
			return "自治州"
		case strings.HasSuffix(name, "盟"):
			return "盟"
		case strings.HasSuffix(name, "地区"):
			return "地区"
		default:
			return "地级市"
		}
	default:
		switch {
		case strings.HasSuffix(name, "自治县"):
			return "自治县"
		case strings.HasSuffix(name, "林区"):
			return "林区"
		case strings.HasSuffix(name, "区"):
			return "市辖区"
		case strings.HasSuffix(name, "市"):
			return "县级市"
		default:
			return "县"
		}
	}
}

func ptrString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func normalizeRegionCode(code string) (string, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return "", NewValidationError("区划代码不能为空")
	}
	if !isAllDigits(code) {
		return "", NewValidationError("区划代码须为 6 位或 12 位数字")
	}
	switch len(code) {
	case 6:
		return code + "000000", nil
	case 12:
		return code, nil
	default:
		return "", NewValidationError("区划代码须为 6 位或 12 位数字")
	}
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func extractIDPrefix(q string) string {
	var b strings.Builder
	for _, r := range q {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	switch {
	case len(digits) >= 6:
		return digits[:6]
	case len(digits) == 4:
		return digits + "00"
	case len(digits) == 2:
		return digits + "0000"
	default:
		return digits
	}
}
