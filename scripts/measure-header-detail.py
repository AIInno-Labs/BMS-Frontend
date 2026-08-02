"""Detailed measurement of customer-info sub-columns and row heights."""
from PIL import Image
import numpy as np
import json

REF = r"C:\Users\ASUS\.cursor\projects\d-Gertz-FRPDEMO\assets\c__Users_ASUS_AppData_Roaming_Cursor_User_workspaceStorage_6d6aab6433fbe6a24176d092160938fc_images_BRWA83B76F1716B_000137_HD-660009b9-fa1b-4957-93b9-7b171722b211.png"
TARGET_W = 953

# User-specified section percentages
PCTS = {"spine": 0.07, "info": 0.47, "logo": 0.26, "qa": 0.20}


def cluster(vals, gap=2):
    if not vals:
        return []
    out, s, p = [], vals[0], vals[0]
    for x in vals[1:]:
        if x - p > gap:
            out.append((s + p) // 2)
            s = x
        p = x
    out.append((s + p) // 2)
    return out


def scaled(px, scale):
    return max(1, round(px * scale))


def main():
    gray = np.mean(np.array(Image.open(REF).convert("RGB")), axis=2)
    mask = gray < 120
    cols = np.where(mask.sum(axis=0) > gray.shape[0] * 0.05)[0]
    rows = np.where(mask.sum(axis=1) > gray.shape[1] * 0.2)[0]
    left, top = int(cols[0]), int(rows[0])
    card_w = int(cols[-1] - cols[0] + 1)
    scale = TARGET_W / card_w

    header = gray[top : top + 140, left : left + card_w]

    # Section widths from user percentages
    spine_w = round(TARGET_W * PCTS["spine"])
    info_w = round(TARGET_W * PCTS["info"])
    logo_w = round(TARGET_W * PCTS["logo"])
    qa_w = TARGET_W - spine_w - info_w - logo_w

    # Measure info internal columns on meta row (y=5..14)
    meta = header[5:16, :]
    meta_v = cluster([x for x in range(meta.shape[1]) if (meta[:, x] < 88).mean() > 0.45])

    # Measure info internal on data rows (y=20..75), only info zone in image
    # Image spine ~60px, info ~215px
    info_x0, info_x1 = 65, 280
    data = header[18:82, info_x0:info_x1]
    data_v = cluster([x for x in range(data.shape[1]) if (data[:, x] < 88).mean() > 0.25])
    data_v_abs = [info_x0 + x for x in data_v]

    # Row lines in info zone
    info_zone = header[0:90, info_x0:info_x1]
    hlines = cluster([y for y in range(info_zone.shape[0]) if (info_zone[y, :] < 88).mean() > 0.42])

    # Logo/QA boundary: scan full header height for vertical lines right of info
    right_zone = header[0:90, 280:]
    rv = cluster([x for x in range(right_zone.shape[1]) if (right_zone[:, x] < 88).mean() > 0.5])
    rv_abs = [280 + x for x in rv]

    # QA internal rows
    qa_x0 = rv_abs[0] + 280 if rv_abs else 460
    qa_zone = header[0:90, qa_x0 : min(qa_x0 + 120, header.shape[1])]
    qa_h = cluster([y for y in range(qa_zone.shape[0]) if (qa_zone[y, :] < 88).mean() > 0.35])

    # Header + notice vertical extent
    full_top = header
    h_all = cluster([y for y in range(full_top.shape[0]) if (full_top[y, :] < 88).mean() > 0.48])

    out = {
        "target_width": TARGET_W,
        "sections_953": {"spine": spine_w, "info": info_w, "logo": logo_w, "qa": qa_w},
        "meta_v_lines_image": meta_v,
        "data_v_lines_image_rel": data_v,
        "data_v_lines_image_abs": data_v_abs,
        "info_h_lines_image": hlines,
        "info_h_lines_953": [scaled(y, scale) for y in hlines],
        "right_v_lines_image_abs": rv_abs,
        "qa_h_lines_image": qa_h,
        "qa_h_lines_953": [scaled(y, scale) for y in qa_h],
        "all_h_lines_image": h_all,
        "all_h_lines_953": [scaled(y, scale) for y in h_all],
    }

    if len(hlines) >= 2:
        rh = [hlines[i + 1] - hlines[i] for i in range(len(hlines) - 1)]
        out["info_row_heights_image"] = rh
        out["info_row_heights_953"] = [scaled(r, scale) for r in rh]

    # Map info subcolumn widths to 953 info zone
    if len(data_v) >= 2:
        rel_widths = [data_v[i + 1] - data_v[i] for i in range(len(data_v) - 1)]
        info_span = data_v[-1] - data_v[0]
        out["info_col_widths_953"] = [round(w / info_span * info_w) for w in rel_widths]
        # fix rounding
        diff = info_w - sum(out["info_col_widths_953"])
        if diff:
            out["info_col_widths_953"][-1] += diff

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
