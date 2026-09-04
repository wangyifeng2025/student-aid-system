package service

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/internal/repository"
)

// 版式常量：列宽与 assets/templates/recognition_application.docx 的表格保持一致（A4 纵向，单位 mm）。
const (
	pdfMarginL   = 15.0
	pdfContentW  = 180.0
	pdfSecW      = 10.0 // 左侧栏目名列（基本情况 / 家庭成员情况 …）
	pdfBodyW     = pdfContentW - pdfSecW
	pdfFontSmall = 8.0
	pdfFontBody  = 9.0
	pdfFontTitle = 15.0
	pdfLineH     = 4.4
	pdfRowH      = 7.5 // 单行最小行高
	pdfCellPadX  = 1.2
	pdfCellPadY  = 1.0
)

// recognitionFormSchool 表头「学校」默认值（可在 export.school_name 覆盖）。
const recognitionFormSchool = "黔西南民族职业技术学院"

// specialGroupFormLabels 与《家庭经济困难学生认定申请表（2024年）》勾选顺序一致。
var specialGroupFormLabels = []struct {
	code model.SpecialGroupType
	name string
}{
	{model.SGPoverty, "脱贫家庭学生"},
	{model.SGPovertyUnstable, "脱贫不稳定家庭学生"},
	{model.SGMarginal, "边缘易致贫家庭学生"},
	{model.SGSuddenDifficulty, "突发严重困难家庭学生"},
	{model.SGLowIncome, "低保家庭学生"},
	{model.SGLowIncomeMargin, "低保边缘家庭学生"},
	{model.SGExtremePoverty, "特困救助供养学生"},
	{model.SGRigidExpenditure, "刚性支出困难家庭学生"},
	{model.SGOtherLowIncome, "其他低收入学生"},
	{model.SGOrphan, "孤儿"},
	{model.SGNoGuardian, "事实无人抚养儿童"},
	{model.SGDisabledStudent, "残疾学生"},
	{model.SGDisabledParent, "残疾人子女"},
	{model.SGMartyrChild, "烈士子女"},
	{model.SGPovertyRelocation, "异地扶贫搬迁"},
}

type recognitionFormData struct {
	School        string
	Dept          string
	Major         string
	Grade         string
	Class         string
	StudentName   string
	Gender        string
	Birth         string
	NativePlace   string
	IDCard        string
	FamilyPop     string
	Phone         string
	Address       string
	PostalCode    string
	GuardianPhone string
	Members       []model.FamilyMember
	SpecialSet    map[string]bool
	PerCapita     string
	Natural       string
	Sudden        string
	WeakLabor     string
	Unemployment  string
	Debt          string
	OtherInfo     string
	Labels        labelMaps
}

type pdfWriter struct {
	pdf  *fpdf.Fpdf
	font string
}

// cellSpec 表格中的一格。文本超出 width 时自动折行，行数决定该行高度。
// runs 非空时按富文本渲染（用于给填写值加下划线），此时忽略 text。
type cellSpec struct {
	width float64
	text  string
	runs  [][]textRun // 每个元素为一逻辑行
	align string      // L / C / R
	top   bool        // true 时文本贴顶，否则在格内垂直居中
}

// textRun 一段行内文本。underline 为真时在其下方画横线（对应模板中的填写横线），
// minWidth 保证短填写值也有统一长度的横线。
type textRun struct {
	text      string
	underline bool
	minWidth  float64
}

func pdfCell(width float64, text string) cellSpec {
	return cellSpec{width: width, text: text, align: "C"}
}

func pdfCellLeft(width float64, text string) cellSpec {
	return cellSpec{width: width, text: text, align: "L"}
}

func pdfCellTop(width float64, text string) cellSpec {
	return cellSpec{width: width, text: text, align: "L", top: true}
}

func pdfCellRuns(width float64, lines [][]textRun) cellSpec {
	return cellSpec{width: width, runs: lines, align: "L", top: true}
}

func labelRun(text string) textRun {
	return textRun{text: text}
}

// filledRun 带下划线的填写值。
func filledRun(text string, minWidth float64) textRun {
	return textRun{text: text, underline: true, minWidth: minWidth}
}

func schoolNameForExport(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.Export.SchoolName) != "" {
		return strings.TrimSpace(cfg.Export.SchoolName)
	}
	return recognitionFormSchool
}

func buildRecognitionFormData(
	cfg *config.Config,
	a *model.RecognitionApplication,
	stu *model.Student,
	dept, major, grade, class string,
	labels labelMaps,
) recognitionFormData {
	specialSet := map[string]bool{}
	for _, p := range strings.Split(a.SpecialTypes, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			specialSet[p] = true
		}
	}
	d := recognitionFormData{
		School:        schoolNameForExport(cfg),
		Dept:          dept,
		Major:         major,
		Grade:         grade,
		Class:         class,
		NativePlace:   a.NativePlace,
		IDCard:        a.IDCard,
		FamilyPop:     fmt.Sprintf("%d人", a.FamilyPopulation),
		Phone:         a.Phone,
		Address:       a.Address,
		PostalCode:    a.PostalCode,
		GuardianPhone: a.GuardianPhone,
		Members:       a.FamilyMembers,
		SpecialSet:    specialSet,
		PerCapita:     fmt.Sprintf("%.0f", a.PerCapitaAnnualIncome),
		Natural:       orNone(a.NaturalDisaster),
		Sudden:        orNone(a.SuddenAccident),
		WeakLabor:     orNone(a.WeakLabor),
		Unemployment:  orNone(a.Unemployment),
		Debt:          orNone(a.Debt),
		OtherInfo:     orNone(a.OtherInfo),
		Labels:        labels,
	}
	if stu != nil {
		d.StudentName = stu.Name
		d.Gender = genderLabel(stu.Gender)
		if stu.Birth != nil {
			d.Birth = stu.Birth.Format("2006年01月")
		}
		if d.IDCard == "" {
			d.IDCard = stu.IDCard
		}
	}
	return d
}

// renderOfficialRecognitionForm 按《家庭经济困难学生认定申请表》版式生成 PDF。
func renderOfficialRecognitionForm(
	pdf *fpdf.Fpdf,
	font string,
	cfg *config.Config,
	a *model.RecognitionApplication,
	stu *model.Student,
	dept, major, grade, class string,
	labels labelMaps,
	signature []byte,
) {
	data := buildRecognitionFormData(cfg, a, stu, dept, major, grade, class, labels)
	w := &pdfWriter{pdf: pdf, font: font}

	pdf.SetLeftMargin(pdfMarginL)
	pdf.SetRightMargin(pdfMarginL)
	pdf.SetX(pdfMarginL)

	w.setFont(pdfFontTitle, "")
	pdf.CellFormat(pdfContentW, 9, "家庭经济困难学生认定申请表", "", 1, "C", false, 0, "")
	pdf.Ln(1)

	w.setFont(pdfFontBody, "")
	w.writeLines(fmt.Sprintf(
		"学校：%s    院系：%s    专业：%s    年级：%s    班级：%s",
		data.School, data.Dept, data.Major, data.Grade, data.Class,
	), pdfContentW, "L")
	pdf.Ln(1)

	renderBasicInfoTable(w, data)
	renderContactTable(w, data)
	renderFamilyMembersTable(w, data)
	renderSpecialGroupSection(w, data)
	renderImpactSection(w, data)
	renderCommitmentSection(w, signature)
	renderFormFootnotes(w)
}

func renderBasicInfoTable(w *pdfWriter, d recognitionFormData) {
	w.drawSection("基本情况", [][]cellSpec{
		{
			pdfCell(14, "姓  名"), pdfCell(30, d.StudentName),
			pdfCell(13, "性  别"), pdfCell(14, d.Gender),
			pdfCell(22, "出生年月"), pdfCell(30, d.Birth),
			pdfCell(14, "籍  贯"), pdfCell(pdfBodyW-14-30-13-14-22-30-14, d.NativePlace),
		},
		{
			pdfCell(24, "身份证号码"), pdfCell(50, d.IDCard),
			pdfCell(20, "家庭人口"), pdfCell(16, d.FamilyPop),
			pdfCell(22, "手机号码"), pdfCell(pdfBodyW-24-50-20-16-22, d.Phone),
		},
	}, pdfRowH, pdfFontBody)
}

func renderContactTable(w *pdfWriter, d recognitionFormData) {
	w.drawSection("家庭通讯信息", [][]cellSpec{
		{pdfCell(28, "详细通讯地址"), pdfCellLeft(pdfBodyW-28, d.Address)},
		{
			pdfCell(24, "邮政编码"), pdfCell(30, d.PostalCode),
			pdfCell(30, "家长手机号码"), pdfCell(pdfBodyW-24-30-30, d.GuardianPhone),
		},
	}, pdfRowH, pdfFontBody)
}

func renderFamilyMembersTable(w *pdfWriter, d recognitionFormData) {
	cols := []float64{18, 12, 20, 48, 18, 20, pdfBodyW - 18 - 12 - 20 - 48 - 18 - 20}
	rows := [][]cellSpec{{
		pdfCell(cols[0], "姓名"),
		pdfCell(cols[1], "年龄"),
		pdfCell(cols[2], "与学生关系"),
		pdfCell(cols[3], "工作（学习）单位"),
		pdfCell(cols[4], "职业"),
		pdfCell(cols[5], "年收入（元）"),
		pdfCell(cols[6], "健康状况"),
	}}

	members := make([]model.FamilyMember, familyMemberMaxRows)
	copy(members, d.Members)
	for _, m := range members {
		income := ""
		if m.AnnualIncome > 0 {
			income = fmt.Sprintf("%.0f", m.AnnualIncome)
		}
		rows = append(rows, []cellSpec{
			pdfCell(cols[0], m.Name),
			pdfCell(cols[1], ageStr(m.Age)),
			pdfCell(cols[2], d.Labels.label("relation", m.Relation)),
			pdfCellLeft(cols[3], m.WorkUnit),
			pdfCell(cols[4], d.Labels.label("occupation", m.Occupation)),
			pdfCell(cols[5], income),
			pdfCell(cols[6], d.Labels.label("health_status", m.Health)),
		})
	}
	w.drawSection("家庭成员情况", rows, pdfRowH, pdfFontSmall)
}

func renderSpecialGroupSection(w *pdfWriter, d recognitionFormData) {
	parts := make([]string, 0, len(specialGroupFormLabels))
	for _, item := range specialGroupFormLabels {
		parts = append(parts, specialGroupCheckbox(item.name, d.SpecialSet[string(item.code)]))
	}
	w.drawSection("特殊群体类型", [][]cellSpec{
		{pdfCellTop(pdfBodyW, strings.Join(parts, "；")+"。")},
	}, pdfRowH*3, pdfFontSmall)
}

func renderImpactSection(w *pdfWriter, d recognitionFormData) {
	// 填写值统一加下划线，短值按 fillW 补足横线长度。
	const fillW = 28.0
	lines := [][]textRun{
		{labelRun("家庭人均年收入："), filledRun(d.PerCapita, fillW), labelRun("元。")},
		{labelRun("家庭遭受自然灾害情况："), filledRun(d.Natural, fillW), labelRun("。")},
		{labelRun("家庭遭受突发意外事件："), filledRun(d.Sudden, fillW), labelRun("。")},
		{labelRun("家庭成员因残疾、年迈而劳动能力弱情况："), filledRun(d.WeakLabor, fillW), labelRun("。")},
		{labelRun("家庭成员失业情况："), filledRun(d.Unemployment, fillW), labelRun("。")},
		{labelRun("家庭欠债情况："), filledRun(d.Debt, fillW), labelRun("。")},
		{labelRun("其他情况："), filledRun(d.OtherInfo, fillW), labelRun("。")},
	}
	w.drawSection("影响家庭经济状况有关信息", [][]cellSpec{
		{pdfCellRuns(pdfBodyW, lines)},
	}, pdfRowH*4, pdfFontBody)
}

func renderCommitmentSection(w *pdfWriter, signature []byte) {
	const (
		promiseW = 92.0
		signLblW = 28.0
	)
	signW := pdfBodyW - promiseW - signLblW

	signText := "（未签字）"
	if len(signature) > 0 {
		signText = ""
	}

	top := w.pdf.GetY()
	bottom := w.drawSection("个人承诺", [][]cellSpec{{
		pdfCellTop(promiseW, "承诺内容：\n\n"+commitmentPrintText),
		pdfCell(signLblW, "学生本人(或监护人)签字"),
		pdfCell(signW, signText),
	}}, pdfRowH*4, pdfFontBody)

	if len(signature) > 0 {
		x := pdfMarginL + pdfSecW + promiseW + signLblW
		w.drawImage("student_signature", x+2, top+2, signW-4, bottom-top-4, signature)
	}
}

func renderFormFootnotes(w *pdfWriter) {
	w.pdf.Ln(1.5)
	w.setFont(pdfFontSmall, "")
	notes := "注：1.本表用于家庭经济困难学生认定，可复印。\n" +
		"2.学校、院系、专业、年级、班级可根据实际情况选择性填写。\n" +
		"3.承诺内容需本人手工填写「本人承诺以上所填写资料真实，如有虚假，愿承担相应责任。」\n" +
		"4.本表除个人承诺及签字外，其余内容均需电脑打印。"
	w.writeLines(notes, pdfContentW, "L")
}

func specialGroupCheckbox(name string, yes bool) string {
	// 用实心/空心方块代替 ☑☐，避免字体缺字显示为空白。
	// 按官方表式：只在「是」上打勾，「否」恒为空方框。
	if yes {
		return name + "：■是 □否"
	}
	return name + "：□是 □否"
}

func ageStr(age int) string {
	if age <= 0 {
		return ""
	}
	return fmt.Sprintf("%d", age)
}

// ===== 表格绘制 =====

func (w *pdfWriter) setFont(size float64, style string) {
	w.pdf.SetFont(w.font, style, size)
}

// drawSection 画一个区块：左侧栏目名 + 右侧若干行。各行高度按内容折行后自动撑开，
// 区块高度不足以放下竖排栏目名时，差额补到最后一行。返回区块底部 Y。
func (w *pdfWriter) drawSection(label string, rows [][]cellSpec, minRowH, fontSize float64) float64 {
	w.setFont(fontSize, "")
	heights := make([]float64, len(rows))
	total := 0.0
	for i, row := range rows {
		heights[i] = w.rowHeight(row, minRowH)
		total += heights[i]
	}
	if labelH := w.labelHeight(label); labelH > total && len(heights) > 0 {
		heights[len(heights)-1] += labelH - total
		total = labelH
	}

	// 手动定位绘制不会触发自动分页，这里自行判断，避免区块画到页面外。
	top := w.pdf.GetY()
	_, pageH := w.pdf.GetPageSize()
	_, marginT, _, marginB := w.pdf.GetMargins()
	if top+total > pageH-marginB {
		w.pdf.AddPage()
		top = marginT
		w.pdf.SetXY(pdfMarginL, top)
	}

	w.drawSectionLabel(top, total, label)

	w.setFont(fontSize, "")
	y := top
	for i, row := range rows {
		w.drawRow(pdfMarginL+pdfSecW, y, heights[i], row)
		y += heights[i]
	}
	w.pdf.SetXY(pdfMarginL, top+total)
	return top + total
}

// rowHeight 返回一行所需高度：取各格折行后所需高度与 minH 的较大者。
func (w *pdfWriter) rowHeight(cells []cellSpec, minH float64) float64 {
	h := minH
	for _, c := range cells {
		avail := c.width - pdfCellPadX*2
		n := len(w.wrapLines(c.text, avail))
		if len(c.runs) > 0 {
			n = len(w.wrapRunLines(c.runs, avail))
		}
		if need := float64(n)*pdfLineH + pdfCellPadY*2; need > h {
			h = need
		}
	}
	return h
}

// drawRow 画一行：逐格描边并写入折行后的文本。
func (w *pdfWriter) drawRow(x, y, height float64, cells []cellSpec) {
	for _, c := range cells {
		w.pdf.Rect(x, y, c.width, height, "D")
		avail := c.width - pdfCellPadX*2

		if len(c.runs) > 0 {
			lines := w.wrapRunLines(c.runs, avail)
			ty := y + pdfCellPadY
			if !c.top {
				ty = y + (height-float64(len(lines))*pdfLineH)/2
			}
			for _, line := range lines {
				w.drawRunLine(x+pdfCellPadX, ty, line)
				ty += pdfLineH
			}
			x += c.width
			continue
		}

		lines := w.wrapLines(c.text, avail)
		ty := y + pdfCellPadY
		if !c.top {
			ty = y + (height-float64(len(lines))*pdfLineH)/2
		}
		for _, line := range lines {
			w.pdf.SetXY(x+pdfCellPadX, ty)
			w.pdf.CellFormat(avail, pdfLineH, line, "", 0, c.align, false, 0, "")
			ty += pdfLineH
		}
		x += c.width
	}
}

// drawRunLine 从 (x, y) 起输出一行富文本，underline 片段下方补横线。
func (w *pdfWriter) drawRunLine(x, y float64, line []textRun) {
	_, fontSize := w.pdf.GetFontSize()
	underlineY := y + pdfLineH*0.5 + fontSize*0.3 + 0.55
	prevLW := w.pdf.GetLineWidth()

	for _, run := range line {
		width := w.runWidth(run)
		if run.text != "" {
			w.pdf.SetXY(x, y)
			w.pdf.CellFormat(width, pdfLineH, run.text, "", 0, "C", false, 0, "")
		}
		if run.underline {
			w.pdf.SetLineWidth(0.2)
			w.pdf.Line(x, underlineY, x+width, underlineY)
			w.pdf.SetLineWidth(prevLW)
		}
		x += width
	}
}

// runWidth 片段占位宽度：下划线片段不短于 minWidth，保证横线长度统一。
func (w *pdfWriter) runWidth(run textRun) float64 {
	width := w.pdf.GetStringWidth(run.text)
	if run.minWidth > width {
		return run.minWidth
	}
	return width
}

// wrapRunLines 把富文本逻辑行按可用宽度折成显示行。
func (w *pdfWriter) wrapRunLines(lines [][]textRun, avail float64) [][]textRun {
	var out [][]textRun
	for _, line := range lines {
		out = append(out, w.wrapRunLine(line, avail)...)
	}
	if len(out) == 0 {
		return [][]textRun{nil}
	}
	return out
}

// wrapRunLine 折一逻辑行：下划线片段能整段放下时不拆，放不下才按普通文本断行。
func (w *pdfWriter) wrapRunLine(line []textRun, avail float64) [][]textRun {
	var (
		out  [][]textRun
		cur  []textRun
		curW float64
	)
	flush := func() {
		out = append(out, cur)
		cur = nil
		curW = 0
	}
	push := func(run textRun, width float64) {
		cur = append(cur, run)
		curW += width
	}

	for _, run := range line {
		if run.underline {
			if width := w.runWidth(run); width <= avail {
				if curW+width > avail && curW > 0 {
					flush()
				}
				push(run, width)
				continue
			}
		}
		for _, seg := range breakSegments(run.text) {
			segW := w.pdf.GetStringWidth(seg)
			if segW > avail {
				for _, r := range seg {
					rw := w.pdf.GetStringWidth(string(r))
					if curW+rw > avail && curW > 0 {
						flush()
					}
					push(textRun{text: string(r), underline: run.underline}, rw)
				}
				continue
			}
			if curW+segW > avail && curW > 0 {
				flush()
				if seg == " " {
					continue
				}
			}
			push(textRun{text: seg, underline: run.underline}, segW)
		}
	}
	if len(cur) > 0 {
		flush()
	}
	if len(out) == 0 {
		return [][]textRun{nil}
	}
	return out
}

func (w *pdfWriter) labelHeight(label string) float64 {
	w.setFont(pdfFontSmall, "")
	lines := w.wrapLines(label, pdfSecW-pdfCellPadX*2)
	return float64(len(lines))*pdfLineH + pdfCellPadY*2
}

// drawSectionLabel 画左侧栏目名：窄列内逐行折行，整体垂直居中。
func (w *pdfWriter) drawSectionLabel(y, height float64, label string) {
	w.pdf.Rect(pdfMarginL, y, pdfSecW, height, "D")
	w.setFont(pdfFontSmall, "")
	avail := pdfSecW - pdfCellPadX*2
	lines := w.wrapLines(label, avail)
	ty := y + (height-float64(len(lines))*pdfLineH)/2
	for _, line := range lines {
		w.pdf.SetXY(pdfMarginL+pdfCellPadX, ty)
		w.pdf.CellFormat(avail, pdfLineH, line, "", 0, "C", false, 0, "")
		ty += pdfLineH
	}
}

// writeLines 在页面左边距按 avail 宽度输出折行文本（表格外的标题行、注释等）。
func (w *pdfWriter) writeLines(text string, avail float64, align string) {
	y := w.pdf.GetY()
	for _, line := range w.wrapLines(text, avail) {
		w.pdf.SetXY(pdfMarginL, y)
		w.pdf.CellFormat(avail, pdfLineH, line, "", 0, align, false, 0, "")
		y += pdfLineH
	}
	w.pdf.SetXY(pdfMarginL, y)
}

// ===== 折行 =====

// wrapLines 按可用宽度折行，保留文本中的显式换行。
func (w *pdfWriter) wrapLines(text string, avail float64) []string {
	var out []string
	for _, para := range strings.Split(text, "\n") {
		out = append(out, w.wrapParagraph(para, avail)...)
	}
	if len(out) == 0 {
		return []string{""}
	}
	return out
}

// wrapParagraph 折一个自然段：中文逐字断行，西文与数字尽量整词不拆；
// 单词本身超宽时按字符硬断，保证任何内容都不会画出格子外。
func (w *pdfWriter) wrapParagraph(para string, avail float64) []string {
	if para == "" {
		return []string{""}
	}
	if avail <= 0 || w.pdf.GetStringWidth(para) <= avail {
		return []string{para}
	}

	var (
		lines []string
		cur   strings.Builder
		curW  float64
	)
	flush := func() {
		lines = append(lines, strings.TrimRight(cur.String(), " "))
		cur.Reset()
		curW = 0
	}
	appendRune := func(r rune, rw float64) {
		if curW+rw > avail && curW > 0 {
			flush()
		}
		cur.WriteRune(r)
		curW += rw
	}

	for _, seg := range breakSegments(para) {
		segW := w.pdf.GetStringWidth(seg)
		if segW > avail {
			for _, r := range seg {
				appendRune(r, w.pdf.GetStringWidth(string(r)))
			}
			continue
		}
		if curW+segW > avail && curW > 0 {
			flush()
			if seg == " " {
				continue
			}
		}
		cur.WriteString(seg)
		curW += segW
	}
	if cur.Len() > 0 {
		flush()
	}
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}

// breakSegments 把文本切成可断行的片段：中日韩字符与全角标点各自成段，
// 空格独立成段，连续的西文/数字算作一个整词。
func breakSegments(s string) []string {
	var (
		segs []string
		word strings.Builder
	)
	flushWord := func() {
		if word.Len() > 0 {
			segs = append(segs, word.String())
			word.Reset()
		}
	}
	for _, r := range s {
		switch {
		case r == ' ':
			flushWord()
			segs = append(segs, " ")
		case isWideRune(r):
			flushWord()
			segs = append(segs, string(r))
		default:
			word.WriteRune(r)
		}
	}
	flushWord()
	return segs
}

// isWideRune 判断是否为可在其后断行的全角字符（汉字、全角标点等）。
func isWideRune(r rune) bool {
	switch {
	case r >= 0x2E80 && r <= 0x9FFF: // CJK 部首、标点、汉字
		return true
	case r >= 0xF900 && r <= 0xFAFF: // CJK 兼容汉字
		return true
	case r >= 0xFE30 && r <= 0xFE4F: // CJK 兼容形式
		return true
	case r >= 0xFF00 && r <= 0xFF60: // 全角 ASCII 与标点
		return true
	case r >= 0xFFE0 && r <= 0xFFE6: // 全角货币符号等
		return true
	}
	return false
}

// ===== 图片 =====

// drawImage 在 (x, y) 起的 maxW×maxH 方框内等比居中绘制图片。
func (w *pdfWriter) drawImage(name string, x, y, maxW, maxH float64, data []byte) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return
	}
	imgType := strings.ToUpper(format)
	if imgType == "JPEG" {
		imgType = "JPG"
	}
	opt := fpdf.ImageOptions{ImageType: imgType}
	if info := w.pdf.RegisterImageOptionsReader(name, opt, bytes.NewReader(data)); info == nil || w.pdf.Err() {
		w.pdf.ClearError()
		return
	}
	iw, ih := float64(cfg.Width), float64(cfg.Height)
	scale := maxW / iw
	if ih*scale > maxH {
		scale = maxH / ih
	}
	dw, dh := iw*scale, ih*scale
	w.pdf.ImageOptions(name, x+(maxW-dw)/2, y+(maxH-dh)/2, dw, dh, false, opt, 0, "")
}

func resolveStudentOrgNames(orgRepo *repository.OrgRepository, stu *model.Student) (dept, major, grade, class string) {
	if stu == nil {
		return
	}
	if d, err := orgRepo.FindDepartment(stu.DeptID); err == nil {
		dept = d.Name
	}
	if m, err := orgRepo.FindMajor(stu.MajorID); err == nil {
		major = m.Name
	}
	if c, err := orgRepo.FindClass(stu.ClassID); err == nil {
		class = c.Name
		if g, gErr := orgRepo.FindGrade(c.GradeID); gErr == nil {
			grade = g.Name
		}
	}
	return dept, major, grade, class
}
