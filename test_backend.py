import requests
import json
import time
import sys

URL = "http://127.0.0.1:8000/api/manuscripts"

print("Uploading image...")
with open("sample_pages/page_06.png", "rb") as f:
    files = {"file": f}
    resp = requests.post(URL, files=files)

print("Status:", resp.status_code)
if resp.status_code != 200:
    print(resp.text)
    sys.exit(1)

data = resp.json()
m_id = data["id"]
print("Upload success, manuscript ID:", m_id)

print("\nFetching manuscript details...")
resp2 = requests.get(f"{URL}/{m_id}")
print("Status:", resp2.status_code)
manuscript = resp2.json()

print(f"Image URL: {manuscript['image_url']}")
print(f"Found {len(manuscript['verses'])} verses.")
for v in manuscript['verses']:
    print(f"Verse {v['verse_index']}: Status: {v['status']}, Kural: {v['kural']}, Best Guess: {v['best_guess_kural']}")
