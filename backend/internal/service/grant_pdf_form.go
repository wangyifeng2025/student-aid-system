package service

import (
	"fmt"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

// 版式对齐《贵州省高等学校国家助学金申请表》docx：A4 纵向，列宽取自模板 tblGrid（twip → mm）。
const (
	grantPdfMarginL = 17.5
	grantPdfMarginT = 15.0
	grantPdfMarginB = 10.0
	grantPdfFont    = 9.0
	grantPdfTitle   = 16.0
	grantPdfLine    = 4.2
)

// grantGridTwips 与模板 w:tblGrid 一致，合计 9918 twip（约 174.9mm）。
var grantGridTwips = []int{704, 1134, 1134, 142, 1134, 142, 992, 1276, 1371, 1889}

type grantFormData struct {
	StudentName     string
	Gender          string
	Birth           string
	Nation          string
	PoliticalStatus string
	EnrollTime      string
	StudentNo       string
	Grade           string
	IDCard          string
	Phone           string
	SchoolUnit      string
	Household       string
	FamilyPop       string
	MonthlyIncome   string
	PerCapita       string
	IncomeSource    string
	Address         string
	PostalCode      string
	Members         []grantMemberLine
	Reason          string
	DeptOpinion     string
	CollegeOpinion  string
}

type grantMemberLine struct {
	Name     string
	Age      string
	Relation string
	Work     string
}

type grantCell struct {
	w     float64
	text  string
	align string // C 或 L；空则居中
	top   bool
}

func grantColMM() []float64 {
	cols := make([]float64, len(grantGridTwips))
	for i, tw := range grantGridTwips {
		cols[i] = float64(tw) * 25.4 / 1440
	}
	return cols
}

func grantSpan(cols []float64, start, n int) float64 {
	sum := 0.0
	for i := 0; i < n; i++ {
		sum += cols[start+i]
	}
	return sum
}

func grantTwipMM(tw int) float64 {
	return float64(tw) * 25.4 / 1440
}

func buildGrantFormData(
	a *model.GrantApplication,
	stu *model.Student,
	schoolUnit, gradeName string,
	labels labelMaps,
) grantFormData {
	members := make([]grantMemberLine, grantFamilyMemberMaxRows)
	if a != nil {
		limit := len(a.FamilyMembers)
		if limit > grantFamilyMemberMaxRows {
			limit = grantFamilyMemberMaxRows
		}
		for i := 0; i < limit; i++ {
			m := a.FamilyMembers[i]
			members[i] = grantMemberLine{
				Name:     strings.TrimSpace(m.Name),
				Age:      ageStr(m.Age),
				Relation: labels.label("relation", m.Relation),
				Work:     strings.TrimSpace(m.WorkUnit),
			}
		}
	}
	d := grantFormData{Members: members, Household: "□城镇      □农村"}
	if a == nil {
		return d
	}
	d.StudentName = studentName(stu)
	d.Gender = genderLabel(studentGender(stu))
	d.Birth = studentBirth(stu)
	d.Nation = labels.label("nation", studentNation(stu))
	d.PoliticalStatus = labels.label("political_status", studentPolitical(stu))
	d.EnrollTime = studentEnroll(stu)
	d.StudentNo = studentNo(stu)
	d.Grade = gradeName
	d.IDCard = studentIDCard(stu)
	d.Phone = a.Phone
	d.SchoolUnit = schoolUnit
	d.Household = grantHouseholdPDF(a.HouseholdType)
	d.FamilyPop = fmt.Sprintf("%d人", a.FamilyPopulation)
	d.MonthlyIncome = fmt.Sprintf("%.0f元", a.MonthlyIncome)
	d.PerCapita = fmt.Sprintf("%.0f元", a.PerCapitaMonthlyIncome)
	d.IncomeSource = labels.label("income_source", a.IncomeSource)
	d.Address = a.Address
	d.PostalCode = a.PostalCode
	d.Reason = strings.TrimSpace(a.Reason)
	d.DeptOpinion = grantReviewOpinion(a.Reviews, model.LevelDepartment)
	d.CollegeOpinion = grantReviewOpinion(a.Reviews, model.LevelCollege)
	return d
}

func grantHouseholdPDF(t model.HouseholdType) string {
	switch t {
	case model.HouseholdUrban:
		return "■城镇      □农村"
	case model.HouseholdRural:
		return "□城镇      ■农村"
	default:
		return "□城镇      □农村"
	}
}

func grantPDFFilename(stu *model.Student) string {
	name := "申请人"
	if stu != nil {
		if n := strings.TrimSpace(stu.Name); n != "" {
			name = n
		}
	}
	return sanitizeDownloadName(name) + "-国家助学金申请表.pdf"
}

// renderOfficialGrantForm 按官方申请表表格绘制一页 PDF。
func renderOfficialGrantForm(pdf *fpdf.Fpdf, font string, d grantFormData) {
	cols := grantColMM()
	contentW := 0.0
	for _, c := range cols {
		contentW += c
	}
	pdf.SetLeftMargin(grantPdfMarginL)
	pdf.SetRightMargin(grantPdfMarginL)
	pdf.SetX(grantPdfMarginL)

	pdf.SetFont(font, "", grantPdfTitle)
	pdf.CellFormat(contentW, 8, "贵州省高等学校国家助学金申请表", "", 1, "C", false, 0, "")
	pdf.Ln(1.5)

	labelW := cols[0]
	photoW := cols[9]
	x := grantPdfMarginL
	y := pdf.GetY()

	personalH := []float64{grantTwipMM(567), grantTwipMM(567), grantTwipMM(567), grantTwipMM(567), grantTwipMM(514)}
	personal := [][]grantCell{
		{
			{w: cols[1], text: "姓名"},
			{w: grantSpan(cols, 2, 2), text: d.StudentName},
			{w: cols[4], text: "性别"},
			{w: grantSpan(cols, 5, 2), text: d.Gender},
			{w: cols[7], text: "出生年月"},
			{w: cols[8], text: d.Birth},
		},
		{
			{w: cols[1], text: "民族"},
			{w: grantSpan(cols, 2, 2), text: d.Nation},
			{w: cols[4], text: "政治面貌"},
			{w: grantSpan(cols, 5, 2), text: d.PoliticalStatus},
			{w: cols[7], text: "入学时间"},
			{w: cols[8], text: d.EnrollTime},
		},
		{
			{w: cols[1], text: "学号"},
			{w: grantSpan(cols, 2, 5), text: d.StudentNo},
			{w: cols[7], text: "所在年级"},
			{w: cols[8], text: d.Grade},
		},
		{
			{w: cols[1], text: "身份证号码"},
			{w: grantSpan(cols, 2, 5), text: d.IDCard},
			{w: cols[7], text: "联系电话"},
			{w: cols[8], text: d.Phone},
		},
		{
			{w: grantSpan(cols, 1, 8), text: d.SchoolUnit},
		},
	}
	personalTotal := 0.0
	for _, h := range personalH {
		personalTotal += h
	}
	drawGrantVLabel(pdf, font, x, y, labelW, personalTotal, "本人情况")
	drawGrantBox(pdf, font, x+contentW-photoW, y, photoW, personalTotal, "", "C", false)
	drawGrantRows(pdf, font, x+labelW, y, personal, personalH)
	y += personalTotal

	econH := []float64{grantTwipMM(567), grantTwipMM(567), grantTwipMM(567)}
	econ := [][]grantCell{
		{
			{w: cols[1], text: "家庭户口"},
			{w: grantSpan(cols, 2, 6), text: d.Household},
			{w: cols[8], text: "家庭总人数"},
			{w: cols[9], text: d.FamilyPop},
		},
		{
			{w: cols[1], text: "家庭月总收入"},
			{w: grantSpan(cols, 2, 2), text: d.MonthlyIncome},
			{w: grantSpan(cols, 4, 3), text: "人均月收入"},
			{w: cols[7], text: d.PerCapita},
			{w: cols[8], text: "收入来源"},
			{w: cols[9], text: d.IncomeSource},
		},
		{
			{w: cols[1], text: "家庭住址"},
			{w: grantSpan(cols, 2, 6), text: d.Address, align: "L"},
			{w: cols[8], text: "邮政编码"},
			{w: cols[9], text: d.PostalCode},
		},
	}
	econTotal := econH[0] + econH[1] + econH[2]
	drawGrantVLabel(pdf, font, x, y, labelW, econTotal, "家庭经济情况")
	drawGrantRows(pdf, font, x+labelW, y, econ, econH)
	y += econTotal

	memberH := grantTwipMM(340)
	memberRowH := 7.0
	memberTotal := memberH + memberRowH*float64(len(d.Members))
	drawGrantVLabel(pdf, font, x, y, labelW, memberTotal, "家庭成员情况")
	header := []grantCell{
		{w: cols[1], text: "姓名"},
		{w: cols[2], text: "年龄"},
		{w: grantSpan(cols, 3, 3), text: "与本人关系"},
		{w: grantSpan(cols, 6, 4), text: "工作或学习单位"},
	}
	drawGrantRow(pdf, font, x+labelW, y, memberH, header)
	y += memberH
	for _, m := range d.Members {
		row := []grantCell{
			{w: cols[1], text: m.Name},
			{w: cols[2], text: m.Age},
			{w: grantSpan(cols, 3, 3), text: m.Relation},
			{w: grantSpan(cols, 6, 4), text: m.Work, align: "L"},
		}
		drawGrantRow(pdf, font, x+labelW, y, memberRowH, row)
		y += memberRowH
	}

	y = drawGrantBlock(pdf, font, x, y, contentW, grantTwipMM(2185),
		"申请理由（150字左右）：", d.Reason,
		"申请人签名：                   年     月     日")
	deptLine := "院系审核意见：" + d.DeptOpinion
	if d.DeptOpinion != "" {
		deptLine += " "
	}
	deptLine += "教学系领导签署意见、盖章"
	y = drawGrantBlock(pdf, font, x, y, contentW, grantTwipMM(1825),
		deptLine, "",
		"（公章）                     年     月     日")
	drawGrantBlock(pdf, font, x, y, contentW, grantTwipMM(1966),
		"学院审核意见："+d.CollegeOpinion, "",
		"（公章）                     年     月     日")
}

func drawGrantRows(pdf *fpdf.Fpdf, font string, x, y float64, rows [][]grantCell, heights []float64) {
	for i, row := range rows {
		drawGrantRow(pdf, font, x, y, heights[i], row)
		y += heights[i]
	}
}

func drawGrantRow(pdf *fpdf.Fpdf, font string, x, y, h float64, cells []grantCell) {
	for _, c := range cells {
		align := c.align
		if align == "" {
			align = "C"
		}
		drawGrantBox(pdf, font, x, y, c.w, h, c.text, align, c.top)
		x += c.w
	}
}

func drawGrantVLabel(pdf *fpdf.Fpdf, font string, x, y, w, h float64, label string) {
	pdf.Rect(x, y, w, h, "D")
	pdf.SetFont(font, "", 8)
	runes := []rune(label)
	lineH := 3.5
	block := float64(len(runes)) * lineH
	ty := y + (h-block)/2
	if ty < y {
		ty = y
	}
	for _, r := range runes {
		pdf.SetXY(x, ty)
		pdf.CellFormat(w, lineH, string(r), "", 0, "C", false, 0, "")
		ty += lineH
	}
}

func drawGrantBox(pdf *fpdf.Fpdf, font string, x, y, w, h float64, text, align string, top bool) {
	pdf.SetFont(font, "", grantPdfFont)
	pdf.Rect(x, y, w, h, "D")
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	padX := 1.0
	avail := w - padX*2
	if avail < 2 {
		avail = w
		padX = 0
	}
	lines := pdf.SplitText(text, avail)
	if len(lines) == 0 {
		lines = []string{text}
	}
	block := float64(len(lines)) * grantPdfLine
	ty := y + 1.0
	if !top {
		ty = y + (h-block)/2
		if ty < y+0.4 {
			ty = y + 0.4
		}
	}
	for _, line := range lines {
		pdf.SetXY(x+padX, ty)
		pdf.CellFormat(avail, grantPdfLine, line, "", 0, align, false, 0, "")
		ty += grantPdfLine
	}
}

// drawGrantBlock 画通栏：首行说明、正文，页脚靠右（签名或公章日期）。返回区块底部 Y。
func drawGrantBlock(pdf *fpdf.Fpdf, font string, x, y, w, h float64, head, body, foot string) float64 {
	pdf.SetFont(font, "", grantPdfFont)
	pdf.Rect(x, y, w, h, "D")
	padX := 1.6
	avail := w - padX*2
	ty := y + 1.4
	if head != "" {
		for _, line := range pdf.SplitText(head, avail) {
			pdf.SetXY(x+padX, ty)
			pdf.CellFormat(avail, grantPdfLine, line, "", 0, "L", false, 0, "")
			ty += grantPdfLine
		}
	}
	if strings.TrimSpace(body) != "" {
		ty += 1.2
		for _, line := range pdf.SplitText(body, avail) {
			if ty+grantPdfLine > y+h-8 {
				break
			}
			pdf.SetXY(x+padX, ty)
			pdf.CellFormat(avail, grantPdfLine, line, "", 0, "L", false, 0, "")
			ty += grantPdfLine
		}
	}
	if foot != "" {
		pdf.SetXY(x+padX, y+h-6)
		pdf.CellFormat(avail, grantPdfLine, foot, "", 0, "R", false, 0, "")
	}
	return y + h
}
