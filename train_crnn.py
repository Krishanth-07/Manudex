"""Train a small CRNN+CTC line recognizer on the book's line crops; evaluate on held-out pages."""
import json, os, random, sys, time, re
import numpy as np, torch, torch.nn as nn
from PIL import Image
import matcher

torch.set_num_threads(2); random.seed(0); np.random.seed(0); torch.manual_seed(0)
LINES, OUT = sys.argv[1], sys.argv[2]
EPOCHS = int(sys.argv[3]) if len(sys.argv) > 3 else 120
TEST_PAGES = {6, 12, 18, 23}
H = 32
VIRAMA = "்"

def norm(t):
    """What is visible on the page: no spaces/punctuation, and no pulli (the book omits it)."""
    t = re.sub(r"[\s.,;:!?'\"]", "", t)
    return t.replace(VIRAMA, "")

kurals = matcher.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "thirukkural.json"))
man = json.load(open(os.path.join(LINES, "manifest.json")))
for m in man:
    k = kurals[m["kural"] - 1]
    m["text"] = norm(k["Line1"] if m["line"] == 1 else k["Line2"])
train = [m for m in man if m["page"] not in TEST_PAGES]
test = [m for m in man if m["page"] in TEST_PAGES]
chars = sorted({c for m in train for c in m["text"]})
c2i = {c: i + 1 for i, c in enumerate(chars)}           # 0 = CTC blank
print(f"train lines {len(train)}, test lines {len(test)}, alphabet {len(chars)}")
unseen = {c for m in test for c in m["text"]} - set(chars)
print("test chars never seen in training:", "".join(sorted(unseen)) or "none")

def load_img(fn):
    return Image.open(os.path.join(LINES, fn)).convert("L")

def prep(im, aug):
    if aug:
        im = im.rotate(random.uniform(-2.5, 2.5), resample=Image.BILINEAR, fillcolor=int(np.median(np.array(im))))
    w, h = im.size
    sx = random.uniform(0.85, 1.15) if aug else 1.0
    nw = max(32, int(w * (H / h) * sx))
    im = im.resize((min(nw, 1400), H), Image.BILINEAR)
    a = np.array(im, dtype=np.float32)
    lo, hi = np.percentile(a, 2), np.percentile(a, 98)
    a = np.clip((a - lo) / max(hi - lo, 1), 0, 1)
    if aug:
        a = np.clip(a * random.uniform(0.85, 1.1) + random.uniform(-0.08, 0.08), 0, 1)
        a = np.clip(a + np.random.normal(0, 0.03, a.shape), 0, 1)
    return 1.0 - a                                       # ink = high

def batchify(items, aug):
    imgs = [prep(load_img(m["file"]), aug) for m in items]
    W = max(i.shape[1] for i in imgs)
    x = np.zeros((len(imgs), 1, H, W), np.float32)
    for i, a in enumerate(imgs): x[i, 0, :, :a.shape[1]] = a
    return torch.from_numpy(x), [a.shape[1] for a in imgs]

class CRNN(nn.Module):
    def __init__(self, n):
        super().__init__()
        def blk(i, o, pool): return [nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU()] + ([nn.MaxPool2d(pool)] if pool else [])
        self.cnn = nn.Sequential(*blk(1, 16, (2, 2)), *blk(16, 32, (2, 2)), *blk(32, 64, (2, 1)), *blk(64, 64, (2, 1)), nn.Dropout2d(0.2))
        self.rnn = nn.LSTM(64 * 2, 128, num_layers=2, bidirectional=True, batch_first=True, dropout=0.3)
        self.fc = nn.Linear(256, n)
    def forward(self, x):
        f = self.cnn(x)                                   # B,C,3,W/4
        B, C, Hh, W = f.shape
        f = f.permute(0, 3, 1, 2).reshape(B, W, C * Hh)
        o, _ = self.rnn(f)
        return self.fc(o).log_softmax(-1)                 # B,T,n

def decode(lp):
    out = []
    for seq in lp.argmax(-1).tolist():
        s, prev = [], 0
        for c in seq:
            if c != prev and c != 0: s.append(chars[c - 1])
            prev = c
        out.append("".join(s))
    return out

def cer(preds, refs):
    e = sum(matcher.lev(list(p), list(r)) for p, r in zip(preds, refs))
    return e / sum(len(r) for r in refs)

def predict(model, items):
    model.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(items), 16):
            x, _ = batchify(items[i:i + 16], False)
            out += decode(model(x))
    return out

model = CRNN(len(chars) + 1)
opt = torch.optim.AdamW(model.parameters(), 1e-3, weight_decay=1e-4)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, 2e-3, total_steps=EPOCHS * ((len(train) + 7) // 8))
ctc = nn.CTCLoss(blank=0, zero_infinity=True)
t0 = time.time()
for ep in range(1, EPOCHS + 1):
    model.train(); random.shuffle(train); tot = 0
    for i in range(0, len(train), 8):
        b = train[i:i + 8]
        x, widths = batchify(b, True)
        lp = model(x)
        T = lp.shape[1]
        tgt = torch.tensor([c2i[c] for m in b for c in m["text"]])
        tl = torch.tensor([len(m["text"]) for m in b])
        il = torch.tensor([min(T, max(1, w // 4)) for w in widths])
        loss = ctc(lp.permute(1, 0, 2), tgt, il, tl)
        opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 5); opt.step(); sched.step()
        tot += loss.item()
    if ep % 10 == 0 or ep == 1:
        c = cer(predict(model, test), [m["text"] for m in test])
        print(f"epoch {ep:3d}  loss {tot / ((len(train) + 7) // 8):.3f}  test CER {c:.1%}  ({time.time() - t0:.0f}s)", flush=True)
torch.save({"model": model.state_dict(), "chars": chars}, OUT)

# ---- verse-level: OCR both lines, match against ALL 1330 couplets
preds = predict(model, test)
by = {}
for m, p in zip(test, preds): by.setdefault(m["kural"], {})[m["line"]] = p
canon = [list(norm(k["Line1"] + k["Line2"])) for k in kurals]
ok = tot_v = 0; rows = []
for n, d in sorted(by.items()):
    if len(d) < 2: continue
    q = list(d[1] + d[2]); tot_v += 1
    sc = sorted(((1 - matcher.lev(q, c) / max(len(q), len(c)), i + 1) for i, c in enumerate(canon)), reverse=True)
    ok += sc[0][1] == n
    rows.append((n, sc[0][1], sc[0][0], sc[1][0]))
print(f"\nheld-out verses matched correctly: {ok}/{tot_v}")
for n, g, s1, s2 in rows[:40]: print(f"  Kural {n:3d} -> {g:4d}  sim {s1:.0%} vs runner-up {s2:.0%}  {'OK' if g == n else 'WRONG'}")
print("\nexamples (reference | prediction):")
for m, p in list(zip(test, preds))[:6]: print("  ", m["text"], "|", p)
