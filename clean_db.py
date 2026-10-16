import sqlite3
import json

conn = sqlite3.connect('db/manudex.db')
c = conn.cursor()
try:
    c.execute("SELECT id, manuscript_id, raw_ocr, suggested_text FROM verses")
    rows = c.fetchall()
    for row in rows:
        vid, mid, raw_ocr_str, sugg_str = row
        if "Custom" in str(raw_ocr_str):
            if sugg_str:
                sugg = json.loads(sugg_str)
                c.execute("UPDATE verses SET raw_ocr = ? WHERE id = ?", (json.dumps(sugg), vid))
                print(f"Updated verse {vid} to use suggested text instead of Custom")
    conn.commit()
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
