package main

import (
	"log"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"gorm.io/gorm"
)

// demoOrgIDs 演示用组织机构 ID（院系/专业/年级/班级）。
type demoOrgIDs struct {
	DeptID  uint
	MajorID uint
	GradeID uint
	ClassID uint
}

const (
	seedDeptCode  = "SEED_CS"
	seedDeptName  = "信息工程学院"
	seedMajorCode = "SEED_SE"
	seedMajorName = "软件工程"
	seedGradeName = "2024级"
	seedGradeYear = 2024
	seedClassName = "软工2401班"
)

// seedDemoOrg 幂等创建演示用院系/专业/年级/班级，供评审账号数据范围与测试学生挂靠。
func seedDemoOrg(db *gorm.DB) (demoOrgIDs, error) {
	var ids demoOrgIDs

	dept, err := ensureDepartment(db, seedDeptCode, seedDeptName)
	if err != nil {
		return ids, err
	}
	ids.DeptID = dept.ID

	major, err := ensureMajor(db, ids.DeptID, seedMajorCode, seedMajorName)
	if err != nil {
		return ids, err
	}
	ids.MajorID = major.ID

	grade, err := ensureGrade(db, seedGradeName, seedGradeYear)
	if err != nil {
		return ids, err
	}
	ids.GradeID = grade.ID

	class, err := ensureClass(db, ids.DeptID, ids.MajorID, ids.GradeID, seedClassName)
	if err != nil {
		return ids, err
	}
	ids.ClassID = class.ID

	log.Printf("演示组织机构就绪: %s / %s / %s / %s", seedDeptName, seedMajorName, seedGradeName, seedClassName)
	return ids, nil
}

func ensureDepartment(db *gorm.DB, code, name string) (*model.Department, error) {
	var d model.Department
	err := db.Where("code = ?", code).First(&d).Error
	if err == nil {
		return &d, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	d = model.Department{Name: name, Code: code}
	if err := db.Create(&d).Error; err != nil {
		return nil, err
	}
	log.Printf("已创建演示院系: %s", name)
	return &d, nil
}

func ensureMajor(db *gorm.DB, deptID uint, code, name string) (*model.Major, error) {
	var m model.Major
	err := db.Where("dept_id = ? AND code = ?", deptID, code).First(&m).Error
	if err == nil {
		return &m, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	m = model.Major{DeptID: deptID, Name: name, Code: code}
	if err := db.Create(&m).Error; err != nil {
		return nil, err
	}
	log.Printf("已创建演示专业: %s", name)
	return &m, nil
}

func ensureGrade(db *gorm.DB, name string, year int) (*model.Grade, error) {
	var g model.Grade
	err := db.Where("year = ?", year).First(&g).Error
	if err == nil {
		return &g, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	g = model.Grade{Name: name, Year: year}
	if err := db.Create(&g).Error; err != nil {
		return nil, err
	}
	log.Printf("已创建演示年级: %s", name)
	return &g, nil
}

func ensureClass(db *gorm.DB, deptID, majorID, gradeID uint, name string) (*model.Class, error) {
	var c model.Class
	err := db.Where("dept_id = ? AND name = ?", deptID, name).First(&c).Error
	if err == nil {
		return &c, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	c = model.Class{
		DeptID:  deptID,
		MajorID: majorID,
		GradeID: gradeID,
		Name:    name,
	}
	if err := db.Create(&c).Error; err != nil {
		return nil, err
	}
	log.Printf("已创建演示班级: %s", name)
	return &c, nil
}

// linkStudentToDemoOrg 仅在测试学生“尚未归属任何班级”时挂到演示班级。
// 注意：这里只做首次挂靠，绝不覆盖管理员后续在界面上手动调整的院系/专业/班级，
// 否则重复执行 seed 会把学生强行拉回演示班级，造成数据范围（评审可见性）混乱。
func linkStudentToDemoOrg(db *gorm.DB, studentNo string, org demoOrgIDs) error {
	var stu model.Student
	if err := db.Where("student_no = ?", studentNo).First(&stu).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	// 已有班级归属（无论是否为演示班级）则保留现状，避免覆盖人工设置。
	if stu.ClassID != 0 {
		log.Printf("测试学生 %s 已归属班级(class_id=%d)，跳过演示班级挂靠", studentNo, stu.ClassID)
		return nil
	}
	updates := map[string]any{
		"dept_id":  org.DeptID,
		"major_id": org.MajorID,
		"class_id": org.ClassID,
	}
	if err := db.Model(&stu).Updates(updates).Error; err != nil {
		return err
	}
	log.Printf("已将测试学生 %s 首次挂靠到演示班级: %s", studentNo, seedClassName)
	return nil
}
