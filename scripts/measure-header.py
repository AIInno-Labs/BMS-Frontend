"""Measure job card header border positions from reference PNG."""
from PIL import Image
import numpy as np
import json
import sys

REF = r"C:\Users\ASUS\.cursor\projects\d-Gertz-FRPDEMO\assets\c__Users_ASUS_AppData_Roaming_Cursor_User_workspaceStorage_6d6aab6433fbe6a24176d092160938fc_images_BRWA83B76F1716B_000137_HD-660009b9-fa1b-4957-93b9-7b171722b211.png"
TARGET_W = 953


def cluster(vals, gap=3):
    if not vals:
        return []
    out = []
    s = vals[0]
    p = vals[0]
    for x in vals[1:]:
        if x - p > gap:
            out.append((s + p) // 2)
            s = x
        p = x
    out.append((s + p) // 2)
    return out


def main():
    img = Image.open(REF).convert("RGB")
    gray = np.mean(np.array(img), axis=2)
    h, w = gray.shape

    mask = gray < 120
    cols = np.where(mask.sum(axis=0) > h * 0.05)[0]
    rows = np.where(mask.sum(axis=1) > w * 0.2)[0]
    left, right, top = int(cols[0]), int(cols[-1]), int(rows[0])
    card_w = right - left + 1
    scale = TARGET_W / card_w

    header = gray[top : top + 185, left : right + 1]
    ch, cw = header.shape

    vscores = [(header[:132, x] < 88).mean() for x in range(cw)]
    vstrong = cluster([x for x in range(cw) if vscores[x] > 0.58])

    hscores = [(header[y, :] < 88).mean() for y in range(145)]
    hstrong = cluster([y for y in range(145) if hscores[y] > 0.52])

    # Info sub-columns: scan middle of customer block only (rows 40-120)
    info = header[40:120, :]
    iscores = [(info[:, x] < 88).mean() for x in range(cw)]
    isub = cluster([x for x in range(cw) if iscores[x] > 0.35])

    # Notice bottom
    notice_h = 0
    for y in range(125, 200):
        if y >= ch:
            break
        if (header[y, :] < 88).mean() > 0.5:
            notice_h = y
    notice_top = hstrong[3] if len(hstrong) > 3 else 131

    result = {
        "image_size": [w, h],
        "card_left": left,
        "card_width_px": card_w,
        "scale_to_953": scale,
        "vertical_borders_px": vstrong,
        "vertical_borders_953": [round(x * scale) for x in vstrong],
        "horizontal_borders_px": hstrong,
        "horizontal_borders_953": [round(y * scale) for y in hstrong],
        "info_subcolumns_px": isub,
        "notice_top_px": notice_top,
        "notice_bottom_px": notice_h,
        "notice_height_px": notice_h - notice_top if notice_h else 0,
    }

    if len(vstrong) >= 2:
        widths = [vstrong[i + 1] - vstrong[i] for i in range(len(vstrong) - 1)]
        result["section_widths_px"] = widths
        result["section_widths_953"] = [round(x * scale) for x in widths]
        tot = vstrong[-1] - vstrong[0]
        result["section_pcts"] = [round(100 * x / tot, 1) for x in widths]

    if len(hstrong) >= 2:
        heights = [hstrong[i + 1] - hstrong[i] for i in range(len(hstrong) - 1)]
        result["row_heights_px"] = heights
        result["row_heights_953"] = [max(1, round(x * scale)) for x in heights]

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
