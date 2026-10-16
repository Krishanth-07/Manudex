"""Split a page of kural pairs into verses, run pipeline on each, score vs expected numbers."""
import sys, os, json
import numpy as np
from PIL import Image
import pipeline

def bands(img_path):
    im = Image.open(img_path).convert("RGBA")
    bg = Image.new("RGBA", im.size, "white"); bg.alpha_composite(im)
    g = bg.convert("L"); a = np.array(g)
    ink = (a < 140)
    ink[:, int(a.shape[1] * 0.88):] = False      # drop the printed verse numbers on the right
    ink[int(a.shape[0] * 0.95):, :] = False      # drop page number at the bottom
    prof = ink.sum(axis=1)
    rows = prof > 1
    out, start = [], None
    for y, v in enumerate(rows):
        if v and start is None: start = y
        if not v and start is not None:
            if y - start > 8: out.append((start, y))
            start = None
    if start is not None: out.append((start, len(rows)))
    return g, out

def number_anchors(img_path):
    im = Image.open(img_path).convert("RGBA")
    bg = Image.new("RGBA", im.size, "white"); bg.alpha_composite(im)
    a = np.array(bg.convert("L")); h, w = a.shape
    ink = (a[:, int(w * 0.90):] < 140).sum(axis=1) > 0
    ink[int(h * 0.95):] = False
    ys, start = [], None
    for y, v in enumerate(ink):
        if v and start is None: start = y
        if not v and start is not None:
            ys.append((start + y) // 2); start = None
    merged = []
    for y in ys:                       # merge fragments of the same number (e.g. two-digit "10")
        if merged and y - merged[-1] < 30: merged[-1] = (merged[-1] + y) // 2
        else: merged.append(y)
    print("anchors:", merged)
    return merged

def main(img_path, outdir):
    os.makedirs(outdir, exist_ok=True)
    g, _ = bands(img_path)
    ys = number_anchors(img_path)
    print("verse-number anchors found:", len(ys))
    cuts = [0] + [(ys[i] + ys[i + 1]) // 2 for i in range(len(ys) - 1)] + [int(g.height * 0.95)]
    pairs = list(zip(cuts[:-1], cuts[1:]))
    ok = 0
    for n, (ya, yb) in enumerate(pairs, 1):
        crop = g.crop((0, ya, int(g.width * 0.88), yb))
        p = os.path.join(outdir, f"v{n}.png"); crop.save(p)
        r = pipeline.run(p, work=os.path.join(outdir, f"w{n}.png"))
        hit = r["match"]["kural"] == n; ok += hit
        print(f"verse {n:>2}: matched Kural {r['match']['kural']:>4}  sim {r['match']['similarity']:.0%}  "
              f"runner-up {r['match']['runner_up_similarity']:.0%}  {'OK' if hit else 'WRONG'}")
    print(f"\ncorrect: {ok}/{len(pairs)}")

main(sys.argv[1], sys.argv[2])
