package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/password"
	"gorm.io/gorm"
)

type reviewerSeed struct {
	Username string
	Password string
	RealName string
	Role     model.Role
	DeptID   *uint
}

var demoReviewers = []reviewerSeed{
	{
		Username: "advisor01",
		Password: "advisor123",
		RealName: "王老师",
		Role:     model.RoleClassAdvisor,
	},
	{
		Username: "dept01",
		Password: "dept123",
		RealName: "李经办",
		Role:     model.RoleDepartment,
	},
	{
		Username: "aidcenter01",
		Password: "aid123",
		RealName: "张资助",
		Role:     model.RoleAidCenter,
	},
}

// seedDemoReviewers 幂等创建班主任/教学系/资助中心测试账号，并绑定数据范围。
func seedDemoReviewers(db *gorm.DB, org demoOrgIDs) error {
	for i := range demoReviewers {
		spec := demoReviewers[i]
		switch spec.Role {
		case model.RoleClassAdvisor:
			spec.DeptID = &org.DeptID
		case model.RoleDepartment:
			spec.DeptID = &org.DeptID
		}
		user, created, err := ensureUser(db, spec)
		if err != nil {
			return err
		}
		if created {
			log.Printf("已创建评审测试账号: username=%s password=%s role=%s",
				spec.Username, spec.Password, spec.Role)
		} else {
			log.Printf("评审测试账号 %s 已存在，跳过创建", spec.Username)
		}
		if spec.Role == model.RoleClassAdvisor {
			if err := setClassAdvisor(db, org.ClassID, user.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

func ensureUser(db *gorm.DB, spec reviewerSeed) (*model.User, bool, error) {
	var user model.User
	err := db.Where("username = ?", spec.Username).First(&user).Error
	if err == nil {
		// 已存在时补全数据范围（便于重复执行 seed）。
		updates := map[string]any{}
		if spec.DeptID != nil && (user.DeptID == nil || *user.DeptID != *spec.DeptID) {
			updates["dept_id"] = *spec.DeptID
		}
		if len(updates) > 0 {
			if err := db.Model(&user).Updates(updates).Error; err != nil {
				return nil, false, err
			}
		}
		return &user, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, false, err
	}

	hash, err := password.Hash(spec.Password)
	if err != nil {
		return nil, false, err
	}
	user = model.User{
		Username:     spec.Username,
		PasswordHash: hash,
		RealName:     spec.RealName,
		Role:         spec.Role,
		DeptID:       spec.DeptID,
		Status:       1,
	}
	if err := db.Create(&user).Error; err != nil {
		return nil, false, err
	}
	return &user, true, nil
}

func setClassAdvisor(db *gorm.DB, classID, advisorUserID uint) error {
	var class model.Class
	if err := db.First(&class, classID).Error; err != nil {
		return err
	}
	if class.AdvisorID == nil || *class.AdvisorID != advisorUserID {
		advisorID := advisorUserID
		if err := db.Model(&class).Update("advisor_id", advisorID).Error; err != nil {
			return err
		}
		log.Printf("已将 %s 设为 %s 的班主任", demoReviewers[0].RealName, seedClassName)
	}
	return ensureAdvisorClassLink(db, advisorUserID, class.DeptID, classID)
}

func ensureAdvisorClassLink(db *gorm.DB, userID, deptID, classID uint) error {
	var a model.Advisor
	err := db.Where("user_id = ?", userID).First(&a).Error
	if err == gorm.ErrRecordNotFound {
		var u model.User
		if err := db.First(&u, userID).Error; err != nil {
			return err
		}
		staffNo := strings.TrimSpace(u.Username)
		if staffNo == "" {
			staffNo = fmt.Sprintf("U%d", u.ID)
		}
		name := strings.TrimSpace(u.RealName)
		if name == "" {
			name = staffNo
		}
		a = model.Advisor{DeptID: deptID, StaffNo: staffNo, Name: name, Phone: u.Phone, UserID: &userID}
		if err := db.Create(&a).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	var n int64
	if err := db.Model(&model.AdvisorClass{}).Where("advisor_id = ? AND class_id = ?", a.ID, classID).Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		if err := db.Create(&model.AdvisorClass{AdvisorID: a.ID, ClassID: classID}).Error; err != nil {
			return err
		}
	}
	return db.Where("class_id = ? AND advisor_id <> ?", classID, a.ID).Delete(&model.AdvisorClass{}).Error
}
