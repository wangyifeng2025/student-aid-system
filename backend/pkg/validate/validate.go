// Package validate 提供业务通用的字段校验（与前端 zod 规则对齐）。
package validate

import (
	"regexp"
	"strconv"
	"strings"
)

var phoneRe = regexp.MustCompile(`^1[3-9]\d{9}$`)

// Phone 校验中国大陆手机号（11 位）。
func Phone(s string) bool {
	return phoneRe.MatchString(s)
}

// 18 位身份证加权因子与校验码表（GB 11643-1999）。
var idCardWeights = [17]int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
var idCardCheckCodes = [11]byte{'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'}

// IDCard 校验 18 位居民身份证号（含校验码）。
func IDCard(s string) bool {
	s = strings.ToUpper(strings.TrimSpace(s))
	if len(s) != 18 {
		return false
	}
	sum := 0
	for i := 0; i < 17; i++ {
		n, err := strconv.Atoi(string(s[i]))
		if err != nil {
			return false
		}
		sum += n * idCardWeights[i]
	}
	return s[17] == idCardCheckCodes[sum%11]
}
