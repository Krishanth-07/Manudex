# Manudex – handoff to the app builder

## What already works (do not rebuild)
`recognize.py` -> `recognize_page(image_path)` reads a scanned page of the book "Tirukkural in Ancient Scripts"
(Vijayanagar-style hand-lettering), finds the text lines, reads them with a trained CRNN, and matches each
2-line verse to one of the 1,330 couplets in `thirukkural.json`.

Returns one dict per verse:
- `raw_ocr`          two raw strings from the model (never overwritten)
- `status`           "matched" or "no_confident_match"
- `kural`            Kural number when matched, else null
- `best_guess_kural`, `similarity`, `margin`   confidence numbers
- `suggested_text`   canonical Tamil (2 lines) when matched
- `translation`      English translation when matched
- `lines_y`          pixel bands of the two lines on the page (for highlighting on the image)

Held-out test (pages the model never saw): 36/37 verses correct; the one miss was flagged by low margin.
Run `python recognize.py sample_pages/page_06.png` to see it work.

## Known limits (show these honestly in the UI / README)
- Reads only this book's hand-lettered style (Kurals 1-250 were trained on). NOT real palm leaves.
- The book omits the pulli dot; raw OCR therefore has no pulli. Canonical text has it.
- Page layout assumptions: ~10 two-line verses per page, verse numbers in a right margin.
- Book is copyrighted by its authors / Madras Christian College. Prototype use only until permission is obtained.

## Build this
Backend: FastAPI.
- POST /api/manuscripts  (multipart image) -> runs recognize_page, stores result, returns id
- GET  /api/manuscripts/{id} -> image URL + verses
- PUT  /api/manuscripts/{id}/verses/{i}  -> save human-verified text (Accept / Edit / Mark Uncertain / Mark Unreadable)
Store three separate fields per verse: raw_ocr, suggested_text, verified_text. AI never overwrites raw or verified.
SQLite is fine.

Frontend (React + Vite or plain HTML/JS), matching the four design screenshots (Manudex brand):
1. Home      2. Upload (drag/drop + image quality card)      3. Processing (stepper, progress)
4. Transcription: page image on the left with line boxes; right panel tabs Transcription / Translation / Notes
   with the three states Raw OCR -> AI-Normalized -> Human Verified, confidence chips, and a Compare table
   (manuscript reading vs canonical, via difflib) – label them "possible variants", not errors.
Show "No confident match" in amber when status = no_confident_match; never show a guessed Kural as fact.

Visual direction: dark forest green, antique gold, warm parchment, serif headings (e.g. Cormorant/Playfair),
clean sans UI, palm-leaf imagery. Avoid purple/blue AI dashboard looks.
Name the product "Manudex" (the screenshots say "Olaichuvadi Scholar" – replace it).
