package service

import (
	"testing"

	"github.com/wangyifeng2025/student-aid-system/internal/model"
)

func TestRecognitionDocxFilename(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		stu  *model.Student
		want string
	}{
		{name: "nil student", stu: nil, want: "申请人-困难认定申请表.docx"},
		{name: "empty name", stu: &model.Student{Name: "  "}, want: "申请人-困难认定申请表.docx"},
		{name: "applicant name", stu: &model.Student{Name: "王某某"}, want: "王某某-困难认定申请表.docx"},
		{name: "strip path chars", stu: &model.Student{Name: "王/某\\某"}, want: "王_某_某-困难认定申请表.docx"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := recognitionDocxFilename(tc.stu); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}
