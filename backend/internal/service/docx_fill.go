package service

import (
	"archive/zip"
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"regexp"
	"strconv"
	"strings"
)

const docxDocumentXML = "word/document.xml"
const docxContentTypes = "[Content_Types].xml"
const docxDocumentRels = "word/_rels/document.xml.rels"

var (
	// wtRe 捕获 <w:t> 的开标签和文本：group1=<w:t...>, group2=文本内容
	wtRe        = regexp.MustCompile(`(<w:t[^>]*>)([^<]*)</w:t>`)
	paragraphRe = regexp.MustCompile(`(?s)<w:p[ >].*?</w:p>`)
	rIDRe       = regexp.MustCompile(`Id="rId(\d+)"`)
)

// docxImage 待嵌入 docx 的图片（占位符 {Key} 将被替换为 inline 图）。
type docxImage struct {
	Key      string // 不含花括号，如 student_signature
	Data     []byte
	FileName string // 如 student_signature.png
}

// fillDocxTemplate 读取 docx 模板，在 word/document.xml 中替换 {key} 占位符后返回新 docx。
func fillDocxTemplate(templateBytes []byte, replacements map[string]string) ([]byte, error) {
	return fillDocxTemplateWithImages(templateBytes, replacements, nil)
}

// fillDocxTemplateWithImages 在文本替换基础上，把 images 中的占位符换成嵌入图片。
func fillDocxTemplateWithImages(
	templateBytes []byte,
	replacements map[string]string,
	images []docxImage,
) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(templateBytes), int64(len(templateBytes)))
	if err != nil {
		return nil, fmt.Errorf("读取 docx 模板失败: %w", err)
	}

	files := make(map[string][]byte, len(zr.File))
	order := make([]string, 0, len(zr.File))
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
		files[f.Name] = data
		order = append(order, f.Name)
	}

	docXML, ok := files[docxDocumentXML]
	if !ok {
		return nil, fmt.Errorf("docx 模板缺少 %s", docxDocumentXML)
	}

	xml := string(docXML)
	xml = normalizeDocxTextRuns(xml)

	skipText := make(map[string]bool, len(images))
	for _, img := range images {
		if len(img.Data) > 0 && img.Key != "" {
			skipText[img.Key] = true
		}
	}
	for key, value := range replacements {
		if skipText[key] {
			continue
		}
		xml = strings.ReplaceAll(xml, "{"+key+"}", escapeDocxXML(value))
	}

	if len(images) > 0 {
		xml = ensureDocxDrawingNamespaces(xml)
		relsXML := string(files[docxDocumentRels])
		typesXML := string(files[docxContentTypes])
		nextID := nextRelationshipID(relsXML)
		docPrID := 100

		for _, img := range images {
			if len(img.Data) == 0 || img.Key == "" {
				continue
			}
			fileName := img.FileName
			if fileName == "" {
				fileName = img.Key + ".png"
			}
			mediaPath := "word/media/" + fileName
			rID := fmt.Sprintf("rId%d", nextID)
			nextID++

			cx, cy := signatureDisplayEMU(img.Data)
			drawing := buildInlineImageDrawing(rID, fileName, docPrID, cx, cy)
			docPrID++

			ph := "{" + img.Key + "}"
			// 优先替换整段 <w:t>{key}</w:t>，使图片落在 <w:r> 内。
			replaced := false
			xml, replaced = replaceDocxTextNodeWithDrawing(xml, ph, drawing)
			if !replaced {
				xml = strings.ReplaceAll(xml, ph, drawing)
			}

			files[mediaPath] = img.Data
			order = append(order, mediaPath)

			relsXML = addImageRelationship(relsXML, rID, "media/"+fileName)
			typesXML = ensurePNGContentType(typesXML, mediaPath)
		}
		files[docxDocumentRels] = []byte(relsXML)
		files[docxContentTypes] = []byte(typesXML)
	}

	files[docxDocumentXML] = []byte(xml)

	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	written := make(map[string]bool, len(order))
	for _, name := range order {
		if written[name] {
			continue
		}
		written[name] = true
		w, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(files[name]); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// replaceDocxTextNodeWithDrawing 把含占位符的 <w:t>...</w:t> 换成 drawing 节点。
func replaceDocxTextNodeWithDrawing(xml, placeholder, drawing string) (string, bool) {
	re := regexp.MustCompile(`<w:t[^>]*>` + regexp.QuoteMeta(placeholder) + `</w:t>`)
	if !re.MatchString(xml) {
		return xml, false
	}
	return re.ReplaceAllString(xml, drawing), true
}

func ensureDocxDrawingNamespaces(xml string) string {
	const aNS = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`
	const picNS = `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`
	if !strings.Contains(xml, `xmlns:a="`) {
		xml = strings.Replace(xml, "<w:document ", "<w:document "+aNS+" ", 1)
	}
	if !strings.Contains(xml, `xmlns:pic="`) {
		xml = strings.Replace(xml, "<w:document ", "<w:document "+picNS+" ", 1)
	}
	return xml
}

func nextRelationshipID(relsXML string) int {
	maxID := 0
	for _, m := range rIDRe.FindAllStringSubmatch(relsXML, -1) {
		n, _ := strconv.Atoi(m[1])
		if n > maxID {
			maxID = n
		}
	}
	return maxID + 1
}

func addImageRelationship(relsXML, rID, target string) string {
	rel := fmt.Sprintf(
		`<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="%s"/>`,
		rID, target,
	)
	if strings.Contains(relsXML, "</Relationships>") {
		return strings.Replace(relsXML, "</Relationships>", rel+"</Relationships>", 1)
	}
	return relsXML + rel
}

func ensurePNGContentType(typesXML, partName string) string {
	const pngDefault = `<Default Extension="png" ContentType="image/png"/>`
	if !strings.Contains(typesXML, `Extension="png"`) {
		typesXML = strings.Replace(typesXML, "</Types>", pngDefault+"</Types>", 1)
	}
	override := fmt.Sprintf(
		`<Override PartName="/%s" ContentType="image/png"/>`,
		partName,
	)
	if !strings.Contains(typesXML, partName) && strings.Contains(typesXML, "</Types>") {
		typesXML = strings.Replace(typesXML, "</Types>", override+"</Types>", 1)
	}
	return typesXML
}

// signatureDisplayEMU 按图片比例缩放到签字区可用尺寸（EMU：1cm=360000）。
func signatureDisplayEMU(data []byte) (cx, cy int64) {
	const maxW int64 = 5 * 360000 // 5cm
	const maxH int64 = 2 * 360000 // 2cm
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return maxW, maxH * 8 / 10
	}
	w := int64(cfg.Width)
	h := int64(cfg.Height)
	// 像素 → EMU：按 96dpi 近似（1px ≈ 9525 EMU）
	cx = w * 9525
	cy = h * 9525
	if cx > maxW {
		cy = cy * maxW / cx
		cx = maxW
	}
	if cy > maxH {
		cx = cx * maxH / cy
		cy = maxH
	}
	if cx < 1 {
		cx = maxW / 2
	}
	if cy < 1 {
		cy = maxH / 2
	}
	return cx, cy
}

func buildInlineImageDrawing(rID, name string, docPrID int, cx, cy int64) string {
	return fmt.Sprintf(
		`<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">`+
			`<wp:extent cx="%d" cy="%d"/>`+
			`<wp:effectExtent l="0" t="0" r="0" b="0"/>`+
			`<wp:docPr id="%d" name="%s"/>`+
			`<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`+
			`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`+
			`<pic:pic>`+
			`<pic:nvPicPr><pic:cNvPr id="0" name="%s"/><pic:cNvPicPr/></pic:nvPicPr>`+
			`<pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`+
			`<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm>`+
			`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`+
			`</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`,
		cx, cy, docPrID, escapeDocxXML(name), escapeDocxXML(name), rID, cx, cy,
	)
}

// normalizeDocxTextRuns 在每个 <w:p> 段落内合并 <w:t> 文本节点，
// 把被拆分到多个 run 的占位符（{...}）恢复完整。
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
