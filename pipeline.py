"""Image -> raw OCR -> matched couplet -> diff. Keeps raw / suggested / canonical separate."""
import json, subprocess, sys, os
from PIL import Image
import matcher

HERE = os.path.dirname(os.path.abspath(__file__))

def prep(path, out):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, "white"); bg.alpha_composite(im)
    g = bg.convert("L"); g = g.resize((g.width * 3, g.height * 3), Image.LANCZOS); g.save(out)

def run(image_path, work="/tmp/manudex_work.png"):
    prep(image_path, work)
    raw = subprocess.run(["tesseract", work, "-", "-l", "tam", "--tessdata-dir",
                          os.path.join(HERE, "tessdata"), "--psm", "6"],
                         capture_output=True, text=True).stdout.strip()
    kurals = matcher.load(os.path.join(HERE, "thirukkural.json"))
    best = matcher.rank(raw.replace("\n", " "), kurals, top=3)
    score, n, _ = best[0]
    k = kurals[n - 1]
    canon = k["Line1"] + "\n" + k["Line2"]
    return {
        "raw_ocr": raw,
        "match": {"kural": n, "similarity": round(score, 2),
                  "runner_up_similarity": round(best[1][0], 2)},
        "suggested_text": canon,
        "translation": k["Translation"],
        "variants": [{"type": t, "manuscript": a, "canonical": b}
                     for t, a, b in matcher.diff(raw.replace("\n", " "), canon.replace("\n", " "))][:8],
    }

if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1]), ensure_ascii=False, indent=2))
