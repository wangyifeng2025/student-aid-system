package service

import "testing"

func TestNeedsLowIncomeProof(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		types string
		want  bool
	}{
		{name: "empty", types: "", want: false},
		{name: "orphan only", types: "orphan", want: false},
		{name: "low income", types: "low_income", want: true},
		{name: "low income margin", types: "low_income_margin", want: true},
		{name: "other low income", types: "other_low_income", want: true},
		{name: "extreme poverty", types: "extreme_poverty", want: true},
		{name: "mixed with orphan", types: "orphan,low_income", want: true},
		{name: "poverty without low income", types: "poverty,poverty_unstable", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := needsLowIncomeProof(tc.types); got != tc.want {
				t.Fatalf("needsLowIncomeProof(%q) = %v, want %v", tc.types, got, tc.want)
			}
		})
	}
}

func TestIsSignatureFileName(t *testing.T) {
	t.Parallel()
	if !isSignatureFileName(studentSignatureFile) {
		t.Fatal("student signature should be treated as signature")
	}
	if !isSignatureFileName(commitmentHandwritingFile) {
		t.Fatal("commitment handwriting should be treated as signature")
	}
	if isSignatureFileName("dibao.jpg") {
		t.Fatal("proof material should not be treated as signature")
	}
}
