#!/usr/bin/env python3
"""修复 recognition_application.docx 模板：合并被拆分到多个 run 的 {占位符}。

Word/WPS 编辑后，{M2_NAME} 等占位符常被拆到多个 <w:t> 节点，
导致 Go 端 strings.ReplaceAll 匹配不到。本脚本在段落级别把同一段落内的
<w:t> 文本合并到第一个 run，其余 run 的 <w:t> 清空，保留第一个 run 的格式。
"""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "assets" / "templates" / "recognition_application.docx"
DOCUMENT_XML = "word/document.xml"

PH_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")


def fix_document_xml(xml: str) -> str:
    """在每个 <w:p> 内合并被拆分的占位符到第一个 <w:t>。"""
    wt_re = re.compile(r"(<w:t[^>]*>)([^<]*)</w:t>")

    def fix_paragraph(p_match: re.Match) -> str:
        p = p_match.group(0)
        wt_matches = list(wt_re.finditer(p))
        if not wt_matches:
            return p
        joined = "".join(m.group(2) for m in wt_matches)
        # 段落内没有占位符拆分就不动
        if not PH_RE.search(joined):
            # 但可能有未闭合的 { 片段，检查
            if "{" not in joined:
                return p
        # 把合并文本放第一个 <w:t>，其余清空
        first = wt_matches[0]
        open_tag = first.group(1)
        # 构建新段落
        new_p = p[: first.start()] + f"{open_tag}{joined}</w:t>"
        # 替换其余 <w:t>...</w:t> 为空 <w:t></w:t>
        for m in wt_matches[1:]:
            new_p = new_p.replace(m.group(0), f"{m.group(1)}</w:t>", 1)
        return new_p

    return re.sub(r"<w:p[ >].*?</w:p>", fix_paragraph, xml, flags=re.DOTALL)


def main() -> int:
    if not TEMPLATE.exists():
        print(f"模板不存在: {TEMPLATE}", file=sys.stderr)
        return 1

    # 备份
    backup = TEMPLATE.with_suffix(".bak.docx")
    shutil.copy2(TEMPLATE, backup)
    print(f"备份: {backup}")

    # 读 docx
    with zipfile.ZipFile(TEMPLATE, "r") as zr:
        files = {name: zr.read(name) for name in zr.namelist()}

    xml = files[DOCUMENT_XML].decode("utf-8")

    # 修复前统计占位符
    before = sorted(set(PH_RE.findall(xml)))
    fixed_xml = fix_document_xml(xml)
    after = sorted(set(PH_RE.findall(fixed_xml)))

    print(f"修复前占位符 ({len(before)}):", before)
    print(f"修复后占位符 ({len(after)}):", after)

    files[DOCUMENT_XML] = fixed_xml.encode("utf-8")

    # 写回 docx
    with zipfile.ZipFile(TEMPLATE, "w", zipfile.ZIP_DEFLATED) as zw:
        for name, data in files.items():
            zw.writestr(name, data)

    print(f"已修复: {TEMPLATE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
