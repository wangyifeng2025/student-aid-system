package dto

// DashboardKPI 工作台指标卡。
type DashboardKPI struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value int64  `json:"value"`
	Hint  string `json:"hint"`
}

// DashboardItem 工作台待办 / 最近动态条目。
type DashboardItem struct {
	ID          uint   `json:"id"`
	Kind        string `json:"kind"` // recognition | grant
	StudentName string `json:"student_name"`
	StudentNo   string `json:"student_no"`
	ClassName   string `json:"class_name"`
	Status      string `json:"status"`
	Title       string `json:"title"`
}

// DashboardOverview 按当前用户角色与数据范围汇总的工作台数据。
type DashboardOverview struct {
	Year           int                     `json:"year"`
	Role           string                  `json:"role"`
	DataScope      string                  `json:"data_scope"`
	ScopeLabel     string                  `json:"scope_label"`
	DeptName       string                  `json:"dept_name"`
	ClassName      string                  `json:"class_name"`
	KPIs           []DashboardKPI          `json:"kpis"`
	Todos          []DashboardItem         `json:"todos"`
	Recents        []DashboardItem         `json:"recents"`
	ReviewProgress []DashboardDeptProgress `json:"review_progress,omitempty"`
}

// DashboardClassProgress 一个班级的认定待审人数。
type DashboardClassProgress struct {
	ClassID        uint   `json:"class_id"`
	ClassName      string `json:"class_name"`
	PendingClass   int64  `json:"pending_class"`
	PendingDept    int64  `json:"pending_dept"`
	PendingCollege int64  `json:"pending_college"`
	Total          int64  `json:"total"`
}

// DashboardDeptProgress 一个院系的认定待审人数，Classes 为该系下仍有待审的班级。
type DashboardDeptProgress struct {
	DeptID         uint                     `json:"dept_id"`
	DeptName       string                   `json:"dept_name"`
	PendingClass   int64                    `json:"pending_class"`
	PendingDept    int64                    `json:"pending_dept"`
	PendingCollege int64                    `json:"pending_college"`
	Total          int64                    `json:"total"`
	Classes        []DashboardClassProgress `json:"classes"`
}
