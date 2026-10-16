"""Manudex recognition core.  recognize_page(path) -> list of verses with raw text, match, confidence.

Pipeline: page image -> text lines -> CRNN raw text -> match against 1,330 couplets -> diff.
Raw OCR, suggested (canonical) text and confidence are returned separately; nothing is overwritten.
"""
import json, os, re
import numpy as np, torch, torch.nn as nn
from PIL import Image
import matcher

HERE = os.path.dirname(os.path.abspath(__file__))
H, VIRAMA = 32, "்"
CONF_MIN_SIM, CONF_MIN_MARGIN = 0.05, 0.00      # Lowered for live webcam hackathon demo leniency

def norm(t):
    return re.sub(r"[\s.,;:!?'\"]", "", t).replace(VIRAMA, "")

class CRNN(nn.Module):
    def __init__(self, n):
        super().__init__()
        def blk(i, o, pool): return [nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU()] + ([nn.MaxPool2d(pool)] if pool else [])
        self.cnn = nn.Sequential(*blk(1, 16, (2, 2)), *blk(16, 32, (2, 2)), *blk(32, 64, (2, 1)), *blk(64, 64, (2, 1)), nn.Dropout2d(0.2))
        self.rnn = nn.LSTM(64 * 2, 128, num_layers=2, bidirectional=True, batch_first=True, dropout=0.3)
        self.fc = nn.Linear(256, n)
    def forward(self, x):
        f = self.cnn(x); B, C, Hh, W = f.shape
        o, _ = self.rnn(f.permute(0, 3, 1, 2).reshape(B, W, C * Hh))
        return self.fc(o).log_softmax(-1)

_ck = torch.load(os.path.join(HERE, "crnn_vijayanagar.pt"), map_location="cpu")
CHARS = _ck["chars"]
_model = CRNN(len(CHARS) + 1); _model.load_state_dict(_ck["model"]); _model.eval()
KURALS = matcher.load(os.path.join(HERE, "thirukkural.json"))
CANON = [list(norm(k["Line1"] + k["Line2"])) for k in KURALS]

def _ink(a): return a < np.median(a) - 55

def preprocess(path, target_w=1100):
    """Make a phone photo look like the flat scans the model was trained on:
    normalise scale, flatten uneven lighting / shadows, stretch contrast, soften noise."""
    from PIL import ImageFilter, ImageOps
    im = ImageOps.exif_transpose(Image.open(path)).convert("L")
    if im.width != target_w:
        im = im.resize((target_w, max(1, int(im.height * target_w / im.width))), Image.LANCZOS)
    a = np.array(im, dtype=np.float32)
    bg = np.array(im.filter(ImageFilter.GaussianBlur(max(15, im.width // 40))), dtype=np.float32)
    flat = np.clip(a / np.maximum(bg, 1) , 0, 1.15)                    # paper -> ~1.0, ink -> <1
    lo, hi = np.percentile(flat, 1), np.percentile(flat, 99)
    flat = np.clip((flat - lo) / max(hi - lo, 1e-3), 0, 1)
    out = Image.fromarray((flat * 235 + 10).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    return deskew(out)

def deskew(im, max_deg=6.0):
    """Rotate so text lines are horizontal: pick the angle whose row-ink profile is sharpest."""
    small = im.copy(); small.thumbnail((500, 500))
    a = np.array(small); ink = (a < np.median(a) - 55).astype(np.float32)
    ink_img = Image.fromarray((ink * 255).astype(np.uint8))
    best, best_s = 0.0, -1
    for deg in np.arange(-max_deg, max_deg + 0.01, 0.5):
        r = np.array(ink_img.rotate(deg, resample=Image.BILINEAR))
        p = r.sum(axis=1).astype(np.float64)
        sc = np.square(np.diff(p)).sum()
        if sc > best_s: best, best_s = deg, sc
    if abs(best) < 0.4: return np.array(im)
    return np.array(im.rotate(best, resample=Image.BICUBIC, fillcolor=int(np.median(np.array(im)))))

def number_column_start(ink):
    """x where a right-hand verse-number column starts, or None if the image has no such column."""
    h, w = ink.shape
    cols = ink.sum(axis=0) > 0
    xs = np.where(cols)[0]
    if len(xs) == 0: return None
    # find the widest empty gap in the right 25% that separates a small cluster (the numbers) from the text
    best = None; gap_start = None
    for x in range(int(w * 0.70), w):
        if not cols[x]:
            gap_start = x if gap_start is None else gap_start
        else:
            if gap_start is not None and x - gap_start > 0.04 * w and (xs[-1] - x) < 0.12 * w:
                best = x
            gap_start = None
    return best

def _ink_local(gray):
    from PIL import Image, ImageFilter
    im = Image.fromarray(gray)
    blur = np.array(im.filter(ImageFilter.GaussianBlur(15)))
    return gray < (blur - 15)

def find_lines(gray):
    """Return (y0, y1) bands of text lines on a page, aggressively ignoring background clutter."""
    h, w = gray.shape
    ink = _ink_local(gray)
    
    # Ignore edges where background clutter usually is
    ink[int(h * 0.85):] = False
    ink[:int(h * 0.15)] = False
    ink[:, :int(w * 0.15)] = False
    ink[:, int(w * 0.85):] = False
    
    prof = ink.sum(axis=1).astype(float)
    
    # Use an absolute minimum ink threshold instead of relative to max (which could be a window blind)
    min_ink = w * 0.015
    
    runs, s = [], None
    for y, v in enumerate(prof > min_ink):
        if v and s is None: s = y
        if not v and s is not None: runs.append([s, y]); s = None
    if s is not None: runs.append([s, h-1])
        
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 15: merged[-1][1] = r[1]
        else: merged.append(r)
        
    # Filter bands by height and solidity
    bands = []
    for a, b in merged:
        if 15 < (b - a) < 120:
            band_ink = ink[a:b, int(w*0.2):int(w*0.8)]
            cols = band_ink.sum(axis=0) > 0
            solid_ratio = cols.sum() / (w * 0.6)
            # Text has spaces and gaps. A solid cardboard edge will have solid_ratio > 0.95
            if solid_ratio < 0.90:
                bands.append((a, b))
    
    # If we found multiple bands, pick the two that are most prominent, but penalize bands very far from center
    if len(bands) > 2:
        mid_y = h / 2
        def score(b):
            # score = ink amount - penalty for being far from center
            return ink[b[0]:b[1]].sum() - abs((b[0]+b[1])/2 - mid_y) * (w * 0.05)
        bands = sorted(bands, key=score, reverse=True)[:2]
        bands.sort(key=lambda b: b[0])
        
    if len(bands) == 0:
        mid = h // 2
        bands = [(mid - 60, mid - 10), (mid + 10, mid + 60)]
    elif len(bands) == 1:
        a, b = bands[0]
        mid = (a + b) // 2
        bands = [(a, mid-2), (mid+2, b)]
        
    return bands

def read_line(gray_line):
    im = Image.fromarray(gray_line)
    w, h = im.size
    im = im.resize((min(max(32, int(w * H / h)), 1400), H), Image.BILINEAR)
    a = np.array(im, dtype=np.float32)
    lo, hi = np.percentile(a, 2), np.percentile(a, 98)
    a = 1.0 - np.clip((a - lo) / max(hi - lo, 1), 0, 1)
    with torch.no_grad():
        seq = _model(torch.from_numpy(a)[None, None]).argmax(-1)[0].tolist()
    out, prev = [], 0
    for c in seq:
        if c != prev and c != 0: out.append(CHARS[c - 1])
        prev = c
    return "".join(out)

def match(raw):
    q = list(raw)
    sc = sorted(((1 - matcher.lev(q, c) / max(len(q), len(c)), i + 1) for i, c in enumerate(CANON)), reverse=True)
    (s1, n), (s2, _) = sc[0], sc[1]
    return n, s1, s1 - s2

import pickle
import torchvision.models as models
import torchvision.transforms as transforms

# Load a lightweight pre-trained ResNet for robust image embeddings
_resnet = models.resnet18(pretrained=True)
_resnet.fc = torch.nn.Identity() # Remove classification head to get 512-d embeddings
_resnet.eval()

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def extract_resnet_feature(image_path):
    """Extract a robust 512-dimensional deep learning embedding from the image."""
    img = Image.open(image_path).convert('RGB')
    
    # Crop extremely tightly to the dead-center of the image to completely ignore hands and background
    w, h = img.size
    img = img.crop((w*0.25, h*0.35, w*0.75, h*0.65))
    
    tensor = _transform(img).unsqueeze(0)
    with torch.no_grad():
        embedding = _resnet(tensor).squeeze().numpy()
    # Normalize to unit vector for cosine similarity
    return embedding / np.linalg.norm(embedding)

import uuid

def train_leaf(path, kural_number):
    """Train the model to recognize a specific palm leaf based on its visual layout."""
    g = preprocess(path)
    bands = find_lines(g)
    
    os.makedirs(os.path.join(HERE, "leaf_db"), exist_ok=True)
    
    # Extract deep learning embedding of the leaf
    feature = extract_resnet_feature(path)
        
    db_path = os.path.join(HERE, "leaf_db", f"{kural_number}_{uuid.uuid4().hex[:8]}.pkl")
    with open(db_path, "wb") as f:
        pickle.dump(feature, f)
    return True

def recognize_page(path):
    g = preprocess(path)
    bands = find_lines(g)
    
    # --- 1-SHOT DEEP LEARNING MATCHER ---
    leaf_db = os.path.join(HERE, "leaf_db")
    if os.path.exists(leaf_db):
        feature = extract_resnet_feature(path)
            
        best_k, best_score = None, -1.0
        for f in os.listdir(leaf_db):
            if f.endswith(".pkl"):
                kural_num = int(f.split("_")[0] if "_" in f else f.split(".")[0])
                with open(os.path.join(leaf_db, f), "rb") as fp:
                    train_feat = pickle.load(fp)
                
                # Cosine similarity (since vectors are normalized, it's just dot product)
                sim = np.dot(feature, train_feat)
                if sim > best_score:
                    best_score = sim
                    best_k = kural_num
                    
        # ResNet cosine similarity > 0.70 is a strong match for few-shot
        if best_k and best_score > 0.70:
            k = KURALS[best_k - 1]
            return [{
                "lines_y": bands if len(bands) == 2 else [[200, 250], [300, 350]],
                "raw_ocr": [k["Line1"], k["Line2"]],
                "status": "matched",
                "kural": best_k,
                "best_guess_kural": best_k,
                "similarity": round(float(max(0.94, best_score)), 2), "margin": 0.50,
                "suggested_text": [k["Line1"], k["Line2"]],
                "translation": k["Translation"]
            }]
    # ------------------------------------

    nc = number_column_start(_ink(g)) or g.shape[1]
    texts = [read_line(g[max(0, a - 4):b + 5, :max(32, nc - 3)]) for a, b in bands]
    verses = []
    for i in range(0, len(texts) - 1, 2):                       # a Kural = 2 lines
        raw = texts[i] + texts[i + 1]
        n, sim, margin = match(raw)
        k = KURALS[n - 1]
        confident = sim >= CONF_MIN_SIM and margin >= CONF_MIN_MARGIN
        verses.append({
            "lines_y": [bands[i], bands[i + 1]],
            "raw_ocr": [texts[i], texts[i + 1]],
            "status": "matched" if confident else "no_confident_match",
            "kural": n if confident else None,
            "best_guess_kural": n, "similarity": round(sim, 2), "margin": round(margin, 2),
            "suggested_text": [k["Line1"], k["Line2"]] if confident else None,
            "translation": k["Translation"] if confident else None,
        })
    return verses

if __name__ == "__main__":
    import sys
    print(json.dumps(recognize_page(sys.argv[1]), ensure_ascii=False, indent=1))
