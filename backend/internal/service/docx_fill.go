package service

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const docxDocumentXML = "word/document.xml"

var (
	// wtRe 捕获 <w:t> 的开标签和文本：group1=<w:t...>, group2=文本内容
	wtRe        = regexp.MustCompile(`(<w:t[^>]*>)([^<]*)</w:t>`)
	paragraphRe = regexp.MustCompile(`(?s)<w:p[ >].*?</w:p>`)
	phRe        = regexp.MustCompile(`\{[a-zA-Z0-9_]+\}`)
)

// fillDocxTemplate 读取 docx 模板，在 word/document.xml 中替换 {key} 占位符后返回新 docx。
//
// 替换前会先调用 normalizeDocxTextRuns 把被 Word 拆分到多个 <w:t> 的占位符
// （如 {M2_NA}{ME} → {M2_NAME}）合并回第一个 <w:t>，避免字符串匹配失败。
func fillDocxTemplate(templateBytes []byte, replacements map[string]string) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(templateBytes), int64(len(templateBytes)))
	if err != nil {
		return nil, fmt.Errorf("读取 docx 模板失败: %w", err)
	}

	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	foundDocument := false

	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}

		if f.Name == docxDocumentXML {
			foundDocument = true
			xml := string(data)
			xml = normalizeDocxTextRuns(xml)
			for key, value := range replacements {
				xml = strings.ReplaceAll(xml, "{"+key+"}", escapeDocxXML(value))
			}
			data = []byte(xml)
		}

		w, err := zw.CreateHeader(&f.FileHeader)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(data); err != nil {
			return nil, err
		}
	}

	if !foundDocument {
		return nil, fmt.Errorf("docx 模板缺少 %s", docxDocumentXML)
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// normalizeDocxTextRuns 在每个 <w:p> 段落内合并 <w:t> 文本节点，
// 把被拆分到多个 run 的占位符（{...}）恢复完整。
//
// Word/WPS 编辑后常把 {M2_NAME} 拆成 <w:t>{M2_NA</w:t><w:t>ME}</w:t>，
// 导致 strings.ReplaceAll 匹配不到。本函数把同段落的 <w:t> 文本拼接到
// 第一个 <w:t>（保留其开标签属性），其余 <w:t> 清空。
func normalizeDocxTextRuns(xml string) string {
	return paragraphRe.ReplaceAllStringFunc(xml, func(p string) string {
		matches := wtRe.FindAllStringSubmatch(p, -1)
		if len(matches) < 2 {
			return p
		}
		var joined strings.Builder
		for _, m := range matches {
			joined.WriteString(m[2]) // 文本内容
		}
		joinedText := joined.String()
		// 没有占位符片段就不动
		if !strings.Contains(joinedText, "{") {
			return p
		}
		// 第一个 <w:t> 放合并文本，其余清空
		idx := 0
		return wtRe.ReplaceAllStringFunc(p, func(match string) string {
			sub := wtRe.FindStringSubmatch(match)
			openTag := sub[1] // <w:t...> 开标签
			idx++
			if idx == 1 {
				// 合并后的文本若含空格，确保 xml:space="preserve"
				if strings.Contains(joinedText, " ") && !strings.Contains(openTag, "xml:space") {
					openTag = strings.TrimSuffix(openTag, ">") + ` xml:space="preserve">`
				}
				return openTag + joinedText + "</w:t>"
			}
			return openTag + "</w:t>"
		})
	})
}

func escapeDocxXML(s string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&apos;",
	)
	return replacer.Replace(s)
}
