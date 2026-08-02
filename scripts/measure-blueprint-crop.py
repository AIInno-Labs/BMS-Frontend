from PIL import Image
import numpy as np
import json

path = r"d:\Gertz\FRPDEMO\public\frp-job-card-header-blueprint.png"
img = Image.open(path).convert("RGB")
gray = np.mean(np.array(img), axis=2)
h, w = gray.shape


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


vscores = [(gray[: h - 20, x] < 90).mean() for x in range(w)]
vlines = cluster([x for x in range(w) if vscores[x] > 0.55])

hscores = [(gray[y, :] < 90).mean() for y in range(h)]
hlines = cluster([y for y in range(h) if hscores[y] > 0.5])

# Section boundaries - full height verticals
vfull = cluster([x for x in range(w) if (gray[:, x] < 90).mean() > 0.55])

# Info zone internal (x from spine end to logo start)
if len(vfull) >= 3:
    x0, x1 = vfull[1], vfull[2]
    info = gray[:, x0:x1]
    info_v = cluster([x for x in range(info.shape[1]) if (info[:, x] < 90).mean() > 0.3])
    info_h = cluster([y for y in range(info.shape[0]) if (info[y, :] < 90).mean() > 0.42])

out = {
    "size": [w, h],
    "vlines": vfull,
    "hlines": hlines,
    "section_widths": [vfull[i + 1] - vfull[i] for i in range(len(vfull) - 1)] if len(vfull) > 1 else [],
    "row_heights": [hlines[i + 1] - hlines[i] for i in range(len(hlines) - 1)] if len(hlines) > 1 else [],
}
if len(vfull) > 1:
    tot = vfull[-1] - vfull[0]
    out["section_pcts"] = [round(100 * (vfull[i + 1] - vfull[i]) / tot, 1) for i in range(len(vfull) - 1)]

if len(vfull) >= 3:
    out["info_vlines_rel"] = info_v
    out["info_hlines"] = info_h
    if len(info_h) >= 2:
        out["info_row_heights"] = [info_h[i + 1] - info_h[i] for i in range(len(info_h) - 1)]

print(json.dumps(out, indent=2))
