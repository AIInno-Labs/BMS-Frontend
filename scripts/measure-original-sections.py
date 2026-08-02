"""Measure major section x-positions on original reference image."""
from PIL import Image
import numpy as np

REF = r"C:\Users\ASUS\.cursor\projects\d-Gertz-FRPDEMO\assets\c__Users_ASUS_AppData_Roaming_Cursor_User_workspaceStorage_6d6aab6433fbe6a24176d092160938fc_images_BRWA83B76F1716B_000137_HD-660009b9-fa1b-4957-93b9-7b171722b211.png"
TARGET = 953

img = Image.open(REF).convert("RGB")
gray = np.mean(np.array(img), axis=2)
mask = gray < 120
cols = np.where(mask.sum(axis=0) > gray.shape[0] * 0.05)[0]
rows = np.where(mask.sum(axis=1) > gray.shape[1] * 0.2)[0]
left, top = int(cols[0]), int(rows[0])
card_w = int(cols[-1] - cols[0] + 1)
scale = TARGET / card_w

header = gray[top : top + 90, left : left + card_w]
scores = [(header[:, x] < 88).mean() for x in range(header.shape[1])]

strong = []
for x in range(2, len(scores) - 2):
    if scores[x] > 0.75 and scores[x] >= scores[x - 1] and scores[x] >= scores[x + 1]:
        strong.append(x)

# cluster
clusters = []
if strong:
    s = strong[0]
    p = strong[0]
    for x in strong[1:]:
        if x - p > 4:
            clusters.append((s + p) // 2)
            s = x
        p = x
    clusters.append((s + p) // 2)

scaled = [round(x * scale) for x in clusters]
widths = [clusters[i + 1] - clusters[i] for i in range(len(clusters) - 1)]
scaled_w = [round(w * scale) for w in widths]
tot = clusters[-1] - clusters[0] if len(clusters) > 1 else card_w

print("card_w", card_w, "scale", round(scale, 4))
print("section borders (image px):", clusters)
print("section borders @953:", scaled)
print("section widths (image px):", widths)
print("section widths @953:", scaled_w)
if tot:
    print("section %:", [round(100 * w / tot, 1) for w in widths])
