package main

import (
	"log"

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
	ClassID  *uint
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
			spec.ClassID = &org.ClassID
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
		if spec.ClassID != nil && (user.ClassID == nil || *user.ClassID != *spec.ClassID) {
			updates["class_id"] = *spec.ClassID
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
		ClassID:      spec.ClassID,
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
	if class.AdvisorID != nil && *class.AdvisorID == advisorUserID {
		return nil
	}
	advisorID := advisorUserID
	if err := db.Model(&class).Update("advisor_id", advisorID).Error; err != nil {
		return err
	}
	log.Printf("已将 %s 设为 %s 的班主任", demoReviewers[0].RealName, seedClassName)
	return nil
}
