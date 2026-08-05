#!/usr/bin/env python3
"""将《贵州省高等学校国家助学金申请表》样例 docx 转为含 {占位符} 的导出模板。

用法:
  python3 scripts/prepare_grant_template.py [源docx] [输出docx]

默认输出: assets/templates/grant_national_aid.docx
"""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = (
    Path.home()
    / "Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files"
    / "wxid_pguh1zi2f63122_17e0/temp/drag/贵州省高等学校国家助学金申请表.docx"
)
DEFAULT_OUT = ROOT / "assets" / "templates" / "grant_national_aid.docx"
DOCUMENT_XML = "word/document.xml"


def replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise ValueError(f"模板中未找到待替换文本: {old!r}")
    return text.replace(old, new, 1)


def normalize_docx_text_runs(xml: str) -> str:
    """合并同段落内被 Word 拆分的 <w:t>，便于整段替换样例值。"""
    wt_re = re.compile(r"(<w:t[^>]*>)([^<]*)(</w:t>)")
    paragraph_re = re.compile(r"<w:p[ >].*?</w:p>", re.DOTALL)

    def fix_paragraph(p_match: re.Match) -> str:
        p = p_match.group(0)
        matches = wt_re.findall(p)
        if len(matches) < 2:
            return p
        joined = "".join(m[1] for m in matches)
        idx = 0

        def repl(match: re.Match) -> str:
            nonlocal idx
            idx += 1
            open_tag, _, close_tag = matches[idx - 1]
            if idx == 1:
                if " " in joined and 'xml:space="preserve"' not in open_tag:
                    open_tag = open_tag[:-1] + ' xml:space="preserve">'
                return f"{open_tag}{joined}{close_tag}"
            return f"{open_tag}{close_tag}"

        return wt_re.sub(repl, p)

    return paragraph_re.sub(fix_paragraph, xml)


def inject_member_placeholders(xml: str) -> str:
    """将家庭成员数据行（R9~R17）替换为 M1~M9 占位符。"""
    rows = re.findall(r"<w:tr[ >].*?</w:tr>", xml, re.DOTALL)
    if len(rows) < 18:
        raise ValueError(f"表格行数不足，期望至少 18 行，实际 {len(rows)}")

    wt_re = re.compile(r"(<w:t[^>]*>)([^<]*)(</w:t>)")
    member_row_indices = list(range(9, 18))  # M1 ~ M9
    new_rows: list[str] = []

    for i, row_idx in enumerate(member_row_indices):
        prefix = f"M{i + 1}"
        row = rows[row_idx]
        cells = re.findall(r"<w:tc[ >].*?</w:tc>", row, re.DOTALL)
        if len(cells) < 5:
            raise ValueError(f"家庭成员行 {row_idx} 单元格数异常: {len(cells)}")

        placeholders = [
            "",
            f"{{{prefix}_NAME}}",
            f"{{{prefix}_AGE}}",
            f"{{{prefix}_RELATION}}",
            f"{{{prefix}_WORK}}",
        ]
        new_cells: list[str] = []
        for cell, ph in zip(cells, placeholders):
            if ph == "":
                new_cells.append(cell)
                continue
            new_cell, n = wt_re.subn(
                lambda m, value=ph: f'{m.group(1)}{value}{m.group(3)}',
                cell,
                count=1,
            )
            if n == 0:
                # 空单元格：在第一个 <w:p> 内插入 <w:t>
                new_cell = re.sub(
                    r"(<w:p[^>]*>)(\s*<w:pPr>.*?</w:pPr>)?",
                    rf'\1\2<w:r><w:t>{ph}</w:t></w:r>',
                    cell,
                    count=1,
                )
            new_cells.append(new_cell)
        new_rows.append((row_idx, row, "".join(new_cells)))

    out = xml
    for row_idx, old_row, new_row in reversed(new_rows):
        out = out.replace(old_row, new_row, 1)
    return out


def prepare_document_xml(xml: str) -> str:
    xml = normalize_docx_text_runs(xml)

    # 家庭户口：去掉 Wingdings 勾选符号，改为纯文本占位符
    xml = xml.replace('<w:sym w:font="Wingdings 2" w:char="F052"/>', "", 1)
    xml = replace_once(xml, "城镇      □农村", "{household}")

    replacements = [
        ("李四", "{student_name}"),
        ("女", "{gender}"),
        ("2002.07", "{birth}"),
        ("汉族", "{nation}"),
        ("共青团员", "{political_status}"),
        ("2021.09", "{enroll_time}"),
        ("202112314", "{student_no}"),
        ("2021级", "{grade}"),
        ("522321200207114411", "{id_card}"),
        ("12345678912", "{phone}"),
        (
            "黔西南民族职业技术学院医药系2021级健康管理专业1班",
            "{school_unit}",
        ),
        ("4人", "{family_pop}"),
        ("1600元", "{monthly_income}"),
        ("400元", "{per_capita_income}"),
        ("务工", "{income_source}"),
        ("贵州省兴义市凤仪路2号", "{address}"),
        ("562400", "{postal_code}"),
        (
            "申请理由（150字左右）：（字体为宋体五号）",
            "申请理由（150字左右）：{reason}（字体为宋体五号）",
        ),
        (
            "院系审核意见： 教学系领导签署意见、盖章",
            "院系审核意见：{dept_opinion} 教学系领导签署意见、盖章",
        ),
        (
            "学院审核意见：",
            "学院审核意见：{college_opinion}",
        ),
    ]
    for old, new in replacements:
        xml = replace_once(xml, old, new)

    xml = inject_member_placeholders(xml)
    return xml


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    if not src.exists():
        print(f"源模板不存在: {src}", file=sys.stderr)
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        backup = out.with_suffix(".bak.docx")
        shutil.copy2(out, backup)
        print(f"备份: {backup}")

    with zipfile.ZipFile(src, "r") as zr:
        files = {name: zr.read(name) for name in zr.namelist()}

    xml = files[DOCUMENT_XML].decode("utf-8")
    fixed = prepare_document_xml(xml)
    placeholders = sorted(set(re.findall(r"\{[a-zA-Z0-9_]+\}", fixed)))
    print(f"占位符 ({len(placeholders)}):")
    for ph in placeholders:
        print(f"  {ph}")

    files[DOCUMENT_XML] = fixed.encode("utf-8")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zw:
        for name, data in files.items():
            zw.writestr(name, data)

    print(f"已生成: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
