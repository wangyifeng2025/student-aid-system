package dto

// AdvisorRequest 新建/修改班主任。
type AdvisorRequest struct {
	DeptID   uint   `json:"dept_id"`
	StaffNo  string `json:"staff_no"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	ClassIDs []uint `json:"class_ids"`
}

// AdvisorClassItem 班主任名下的班级。
type AdvisorClassItem struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// AdvisorResponse 班主任详情/列表项。
type AdvisorResponse struct {
	ID              uint               `json:"id"`
	DeptID          uint               `json:"dept_id"`
	DeptName        string             `json:"dept_name"`
	StaffNo         string             `json:"staff_no"`
	Name            string             `json:"name"`
	Phone           string             `json:"phone"`
	UserID          *uint              `json:"user_id,omitempty"`
	Username        string             `json:"username,omitempty"`
	InitialPassword string             `json:"initial_password,omitempty"`
	Classes         []AdvisorClassItem `json:"classes"`
}
