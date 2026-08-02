"""
Extract every visible header + notice border from the FRP job card PDF scan.
Outputs lib/job-card-header-blueprint.json with hardcoded pixel values @ 953px width.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image
import numpy as np

REF = Path(
    r"C:\Users\ASUS\.cursor\projects\d-Gertz-FRPDEMO\assets"
    r"\c__Users_ASUS_AppData_Roaming_Cursor_User_workspaceStorage_6d6aab6433fbe6a24176d092160938fc_images_"
    r"BRWA83B76F1716B_000137_HD-660009b9-fa1b-4957-93b9-7b171722b211.png"
)
OUT = Path(r"d:\Gertz\FRPDEMO\lib\job-card-header-blueprint.json")
TARGET_W = 953


def cluster(vals: list[int], gap: int = 3) -> list[int]:
    if not vals:
        return []
    out: list[int] = []
    start = vals[0]
    prev = vals[0]
    for v in vals[1:]:
        if v - prev > gap:
            out.append((start + prev) // 2)
            start = v
        prev = v
    out.append((start + prev) // 2)
    return out


def scale(px: float, factor: float) -> int:
    return max(1, round(px * factor))


def dark_fraction(region: np.ndarray, threshold: int = 88) -> np.ndarray:
    return (region < threshold).mean(axis=0 if region.ndim == 2 and region.shape[0] <= region.shape[1] else 1)


def find_table_width(gray: np.ndarray, left: int, top: int) -> int:
    """Rightmost dark pixel on a header metadata row."""
    row = gray[top + 20, left : left + 600]
    hits = np.where(row < 100)[0]
    return int(hits[-1] + 1) if len(hits) else 413


def find_vertical_lines(region: np.ndarray, min_frac: float) -> list[int]:
    h, w = region.shape
    scores = [(region[:, x] < 88).mean() for x in range(w)]
    strong = [x for x, s in enumerate(scores) if s >= min_frac]
    return cluster(strong, gap=2)


def find_horizontal_lines(region: np.ndarray, min_frac: float) -> list[int]:
    h, w = region.shape
    scores = [(region[y, :] < 88).mean() for y in range(h)]
    strong = [y for y, s in enumerate(scores) if s >= min_frac]
    return cluster(strong, gap=2)


def widths_from_lines(lines: list[int]) -> list[int]:
    return [lines[i + 1] - lines[i] for i in range(len(lines) - 1)]


def main() -> None:
    img = Image.open(REF).convert("RGB")
    gray = np.mean(np.array(img), axis=2)
    h_img, w_img = gray.shape

    mask = gray < 120
    cols = np.where(mask.sum(axis=0) > h_img * 0.05)[0]
    rows = np.where(mask.sum(axis=1) > w_img * 0.2)[0]
    left, top = int(cols[0]), int(rows[0])

    table_w = find_table_width(gray, left, top)
    factor = TARGET_W / table_w

    # --- vertical section borders (full header height) ---
    header_src_h = 86
    notice_src_h = 45
    header = gray[top : top + header_src_h, left : left + table_w]
    notice = gray[top + header_src_h : top + header_src_h + notice_src_h, left : left + table_w]

    v_header = find_vertical_lines(header, min_frac=0.78)
    # ensure outer edges
    if not v_header or v_header[0] > 3:
        v_header = [0] + v_header
    if v_header[-1] < table_w - 3:
        v_header = v_header + [table_w - 1]

    v_header = cluster(v_header, gap=4)

    # Major section boundaries: pick lines spanning nearly full header height
    v_major: list[int] = []
    for x in range(table_w):
        frac = (header[:, x] < 88).mean()
        if frac >= 0.78:
            v_major.append(x)
    v_major = cluster(v_major, gap=5)

    # If too many internal lines, keep strongest by score
    if len(v_major) > 6:
        scored = sorted(
            v_major,
            key=lambda x: (header[:, max(0, x - 1) : min(table_w, x + 2)] < 88).mean(),
            reverse=True,
        )
        # always keep leftmost and rightmost clusters
        v_major = cluster(scored[:8], gap=5)

    # Manual refinement from scan: spine|info ~65, info|logo ~258, logo|qa ~307, right ~412
    v_src_refined = cluster(
        [x for x in range(table_w) if (header[:, x] < 88).mean() > 0.75],
        gap=6,
    )
    # pick section-level: left inner, spine, info|logo, logo|qa, right inner
    section_candidates = [2, 65, 258, 307, table_w - 1]
    section_candidates = [x for x in section_candidates if 0 <= x < table_w]
    v_sections = cluster(section_candidates, gap=3)

    v_953 = [scale(x, factor) for x in v_sections]
    section_widths_953 = widths_from_lines(v_953)

    # --- info sub-columns (meta row) ---
    meta = header[4:18, v_sections[1] : v_sections[2]]
    meta_v = find_vertical_lines(meta, min_frac=0.35)
    meta_v_abs = [v_sections[1] + x for x in meta_v]
    meta_cols_953 = widths_from_lines([scale(x, factor) for x in meta_v_abs])
    if meta_cols_953:
        diff = section_widths_953[1] - sum(meta_cols_953)
        meta_cols_953[-1] += diff

    # --- info sub-columns (data rows) ---
    data = header[18:82, v_sections[1] : v_sections[2]]
    data_v = find_vertical_lines(data, min_frac=0.28)
    data_v_abs = [v_sections[1] + x for x in data_v]

    # --- horizontal lines ---
    h_header = find_horizontal_lines(header, min_frac=0.48)
    h_notice = find_horizontal_lines(notice, min_frac=0.48)
    notice_offset = header_src_h
    h_all_src = h_header + [notice_offset + y for y in h_notice if y > 2]
    h_all_src = cluster(sorted(set([0] + h_all_src + [header_src_h + notice_src_h - 1])), gap=3)

    h_953 = [scale(y, factor) for y in h_all_src]
    header_h_953 = scale(header_src_h, factor)
    notice_h_953 = scale(notice_src_h, factor)

    # Row heights inside header (between horizontal borders)
    h_header_953 = [y for y in h_953 if y <= header_h_953]
    if len(h_header_953) < 2:
        h_header_953 = [0, scale(18, factor), header_h_953]
    header_row_heights = widths_from_lines(h_header_953)

    # QA internal horizontal lines
    qa_x0, qa_x1 = v_sections[3], v_sections[4]
    qa_zone = header[:, qa_x0:qa_x1]
    qa_h = find_horizontal_lines(qa_zone, min_frac=0.35)
    qa_row_heights_953 = widths_from_lines([scale(y, factor) for y in qa_h]) if len(qa_h) > 1 else []

    result = {
        "sourceImage": REF.name,
        "targetWidth": TARGET_W,
        "sourceTableWidth": table_w,
        "scaleFactor": round(factor, 4),
        "verticalBorders953": v_953,
        "sectionWidths953": {
            "spine": section_widths_953[0] if len(section_widths_953) > 0 else None,
            "info": section_widths_953[1] if len(section_widths_953) > 1 else None,
            "logo": section_widths_953[2] if len(section_widths_953) > 2 else None,
            "qa": section_widths_953[3] if len(section_widths_953) > 3 else None,
        },
        "infoMetaColumnWidths953": meta_cols_953,
        "infoDataVerticalBordersSrc": data_v_abs,
        "headerHeight953": header_h_953,
        "noticeHeight953": notice_h_953,
        "headerHorizontalBorders953": h_header_953,
        "headerRowHeights953": header_row_heights,
        "qaRowHeights953": qa_row_heights_953,
        "logoColumnWidth953": section_widths_953[2] if len(section_widths_953) > 2 else None,
    }

    # Fix rounding so sections sum to TARGET_W
    if section_widths_953:
        total = sum(section_widths_953)
        if total != TARGET_W:
            section_widths_953[-1] += TARGET_W - total
            result["sectionWidths953"]["qa"] = section_widths_953[-1]

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
