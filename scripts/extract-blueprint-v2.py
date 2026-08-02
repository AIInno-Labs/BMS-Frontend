"""Extract header blueprint dimensions from PDF scan → lib/job-card-header-blueprint.json"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

# Primary scan (717×1024). Falls back to header blueprint PNG in public/.
REF_CANDIDATES = [
    Path(
        r"C:\Users\ASUS\.cursor\projects\d-Gertz-FRPDEMO\assets"
        r"\c__Users_ASUS_AppData_Roaming_Cursor_User_workspaceStorage_6d6aab6433fbe6a24176d092160938fc_images_"
        r"BRWA83B76F1716B_000137_HD-660009b9-fa1b-4957-93b9-7b171722b211.png"
    ),
    Path(r"d:\Gertz\FRPDEMO\public\frp-job-card-header-notice-blueprint.png"),
]
OUT = Path(r"d:\Gertz\FRPDEMO\lib\job-card-header-blueprint.json")
TARGET_W = 953
LEFT, TOP, TABLE_W, HEADER_H, NOTICE_H = 47, 54, 413, 86, 45


def s(px: float, factor: float) -> int:
    return max(1, round(px * factor))


def fix_sum(parts: list[int], total: int) -> list[int]:
    out = parts[:]
    out[-1] += total - sum(out)
    return out


def main() -> None:
    factor = TARGET_W / TABLE_W

    # Section borders (src px) — measured from scan peak analysis
    v_src = [2, 65, 258, 307, 412]
    v = [s(x, factor) for x in v_src]
    sections = fix_sum([v[i + 1] - v[i] for i in range(4)], TARGET_W)

    # Meta row: 8 equal columns across info zone (193 src px)
    meta_cols = fix_sum([56, 56, 56, 55, 56, 56, 55, 55], sections[1])

    # Data rows: label 25 | value 71 | label 25 | value 72 (src px inside info)
    data_cols = fix_sum([s(25, factor), s(71, factor), s(25, factor), s(72, factor)], sections[1])

    # Horizontal rows (src px): top, meta-bottom, then 6 data row lines
    h_src = [0, 4, 18, 34, 48, 62, 76, 86]
    h = [s(y, factor) for y in h_src]
    meta_h = h[2] - h[1]
    data_heights = [h[i + 1] - h[i] for i in range(2, len(h) - 1)]

    # QA block (src px inside qa zone 307..412)
    qa_h_src = [0, 14, 38, 62, 86]
    qa_h = [s(y, factor) for y in qa_h_src]
    qa_title = qa_h[1] - qa_h[0]
    qa_name = qa_h[2] - qa_h[1]
    qa_sign = qa_h[3] - qa_h[2]
    qa_date = qa_h[4] - qa_h[3]

    result = {
        "targetWidth": TARGET_W,
        "scaleFactor": round(factor, 4),
        "sourceTableWidth": TABLE_W,
        "verticalBorders953": v,
        "sectionWidths953": {
            "spine": sections[0],
            "info": sections[1],
            "logo": sections[2],
            "qa": sections[3],
        },
        "infoMetaColumnWidths953": meta_cols,
        "infoDataColumnWidths953": {
            "leftLabel": data_cols[0],
            "leftValue": data_cols[1],
            "rightLabel": data_cols[2],
            "rightValue": data_cols[3],
        },
        "headerHeight953": h[-1],
        "metaRowHeight953": meta_h,
        "dataRowHeights953": data_heights,
        "noticeHeight953": s(NOTICE_H, factor),
        "qaLabelWidth953": s(34, factor),
        "qaTitleHeight953": qa_title,
        "qaNameHeight953": qa_name,
        "qaSignHeight953": qa_sign,
        "qaDateHeight953": qa_date,
        "logoImageWidth953": s(27, factor),
        "logoColumnWidth953": sections[2],
    }

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
