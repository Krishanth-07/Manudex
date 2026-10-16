"""Match noisy OCR text to the nearest Thirukkural couplet and diff against it."""
import json, re, difflib, sys, unicodedata

def graphemes(s):
    """Split Tamil text into letter units (base + vowel sign/pulli stay together)."""
    s = unicodedata.normalize("NFC", s)
    out = []
    for ch in s:
        if out and unicodedata.category(ch) in ("Mn", "Mc"):
            out[-1] += ch
        elif not ch.isspace():
            out.append(ch)
    return out

def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]

def load(path):
    return json.load(open(path, encoding="utf-8"))["kural"]

def rank(ocr_text, kurals, top=3):
    q = graphemes(ocr_text)
    res = []
    for k in kurals:
        c = graphemes(k["Line1"] + " " + k["Line2"])
        d = lev(q, c)
        res.append((1 - d / max(len(q), len(c)), k["Number"], d))
    res.sort(reverse=True)
    return res[:top]

def diff(ocr_text, canon_text):
    a, b = graphemes(ocr_text), graphemes(canon_text)
    ops = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if tag != "equal":
            ops.append((tag, "".join(a[i1:i2]), "".join(b[j1:j2])))
    return ops

if __name__ == "__main__":
    kurals = load(sys.argv[1]); text = sys.argv[2]
    for score, n, d in rank(text, kurals):
        k = kurals[n - 1]
        print(f"Kural {n}  similarity {score:.0%}  edits {d}  {k['Line1']} / {k['Line2']}")
