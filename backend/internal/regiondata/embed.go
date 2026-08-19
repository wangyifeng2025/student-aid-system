package regiondata

import _ "embed"

// DefaultJSON 内置全国行政区划树（12 位统计用区划码，与身份证前 6 位对应）。
//
//go:embed region_codes.json
var DefaultJSON []byte
