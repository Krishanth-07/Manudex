# Manudex - Tamil Palm-Leaf Manuscript AI Recognition System

An intelligent preservation and transcription platform for ancient Tamil palm-leaf manuscripts (Tirukkural), featuring **ResNet-18 Deep Neural Feature Embeddings**, **Word-Level Bounding Segmentation**, and an interactive human-in-the-loop verification studio.

---

## 🏛️ System Architecture

* **Frontend:** React (Vite, Tailwind CSS, Lucide Icons, Canvas bounding engine)
* **Backend:** FastAPI (Python 3.10+)
* **AI / Deep Learning Engine:**
  * **ResNet-18 Deep Feature Extractor:** Zero-shot/few-shot embedding matcher for palm-leaf layouts and manuscript ink signatures.
  * **CRNN Tamil Line Recognizer:** CTC-based sequential glyph recognizer (`crnn_vijayanagar.pt`).
  * **Canonical Database:** 1,330 Thirukkural verses with word-level alignments, meanings, translations, and explanations.

---

## 🚀 Quick Deployment Guide

### Option 1: Deploy Frontend to Vercel (Recommended)

1. **Push to GitHub** (see instructions below).
2. Go to **[vercel.com/new](https://vercel.com/new)** and import your GitHub repository.
3. Configure Project Settings:
   * **Framework Preset:** Vite
   * **Root Directory:** `./` (or `frontend`)
   * **Build Command:** `cd frontend && npm install && npm run build` (or `npm run build` if root is `frontend`)
   * **Output Directory:** `frontend/dist` (or `dist`)
4. **Environment Variables:**
   * `VITE_API_URL`: Your backend API URL (e.g. `https://your-backend.onrender.com/api` or your tunnel URL).
5. Click **Deploy**!

---

### Option 2: Deploy Backend to Render / Railway

Because the AI backend uses PyTorch (`torch`, `torchvision`, ~1.8GB) and local SQLite/leaf databases:

1. Connect your GitHub repository to **[render.com](https://render.com)** as a **Web Service**.
2. Settings:
   * **Environment:** Python 3
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Once deployed, copy your Render URL and add it to your Vercel frontend as `VITE_API_URL`.

---

## 💻 Local Development

### 1. Backend (FastAPI + AI Engine)
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` (or `http://localhost:8000` for full static build).

---

## 📦 Pushing to GitHub

```bash
git init
git add .
git commit -m "feat: initial commit for Manudex AI manuscript system"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```
