"""Cut the book's scanned pages into verse crops and line crops, labelled from the canonical text."""
import sys, os, glob, json
import numpy as np
from PIL import Image

def load_gray(path):
    return np.array(Image.open(path).convert("L"))

def ink_mask(a):
    bg = np.median(a)
    return a < bg - 55

def anchors(a):
    h, w = a.shape
    ink = ink_mask(a)
    col = ink[:int(h * 0.94), int(w * 0.88):int(w * 0.97)].sum(axis=1) > 0
    ys, s = [], None
    for y, v in enumerate(col):
        if v and s is None: s = y
        if not v and s is not None: ys.append((s + y) // 2); s = None
    merged = []
    for y in ys:
        if merged and y - merged[-1] < 0.03 * h: merged[-1] = (merged[-1] + y) // 2
        else: merged.append(y)
    return [y for y in merged if y > 0.035 * h]   # drop scan-edge shadows at the very top

def split_lines(crop_ink):
    """Find the two text lines as the two heaviest horizontal ink bands; return (y0,y1),(y2,y3)."""
    prof = crop_ink.sum(axis=1).astype(float)
    thr = 0.04 * prof.max()
    runs, s = [], None
    for y, v in enumerate(prof > thr):
        if v and s is None: s = y
        if not v and s is not None: runs.append([s, y]); s = None
    if s is not None: runs.append([s, len(prof)])
    merged = []
    for r in runs:                      # glue pieces of one line (dots, tall marks) together
        if merged and r[0] - merged[-1][1] < 7: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = [m for m in merged if m[1] - m[0] > 10]
    if len(merged) < 2: return None
    top2 = sorted(sorted(merged, key=lambda m: -prof[m[0]:m[1]].sum())[:2])
    return top2

def main(pdf_png_dir, out):
    os.makedirs(out, exist_ok=True)
    pages = sorted(glob.glob(os.path.join(pdf_png_dir, "p-*.png")))
    report, manifest = [], []
    for pi, p in enumerate(pages):
        a = load_gray(p); h, w = a.shape
        ys = anchors(a)
        report.append((pi + 1, len(ys)))
        if len(ys) != 10: continue
        cuts = [max(0, ys[0] - int(0.03 * h))] + [(ys[i] + ys[i + 1]) // 2 for i in range(9)] + [min(h, ys[-1] + int(0.03 * h))]
        for i in range(10):
            n = pi * 10 + i + 1
            crop = a[cuts[i]:cuts[i + 1], :int(w * 0.87)]
            ink = ink_mask(crop)
            rows = np.where(ink.sum(axis=1) > 0)[0]; cols = np.where(ink.sum(axis=0) > 0)[0]
            if len(rows) == 0: continue
            crop = crop[max(0, rows[0] - 4):rows[-1] + 5, max(0, cols[0] - 6):cols[-1] + 7]
            ink = ink_mask(crop)
            bands = split_lines(ink)
            if bands is None: continue
            for li, (y0, y1) in enumerate(bands):
                part = crop[max(0, y0 - 5):y1 + 6]
                fn = f"k{n:04d}_l{li + 1}.png"
                Image.fromarray(part).save(os.path.join(out, fn))
                manifest.append({"file": fn, "kural": n, "line": li + 1, "page": pi + 1})
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    print("anchors per page:", report)
    print("line images:", len(manifest))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
