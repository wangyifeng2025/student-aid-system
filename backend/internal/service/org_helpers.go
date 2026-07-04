package service

import "github.com/wangyifeng2025/student-aid-system/internal/repository"

// buildOrgNameMaps 预加载院系/专业/班级的 ID -> 名称映射，供列表展示按 ID 解析名称。
// 返回 (deptNames, majorNames, classNames)。
func buildOrgNameMaps(orgRepo *repository.OrgRepository) (map[uint]string, map[uint]string, map[uint]string, error) {
	depts, err := orgRepo.ListDepartments()
	if err != nil {
		return nil, nil, nil, err
	}
	deptNames := make(map[uint]string, len(depts))
	for i := range depts {
		deptNames[depts[i].ID] = depts[i].Name
	}
	majors, err := orgRepo.ListMajors(0)
	if err != nil {
		return nil, nil, nil, err
	}
	majorNames := make(map[uint]string, len(majors))
	for i := range majors {
		majorNames[majors[i].ID] = majors[i].Name
	}
	classes, err := orgRepo.ListClasses(repository.ClassFilter{})
	if err != nil {
		return nil, nil, nil, err
	}
	classNames := make(map[uint]string, len(classes))
	for i := range classes {
		classNames[classes[i].ID] = classes[i].Name
	}
	return deptNames, majorNames, classNames, nil
}
