from flask import Flask, render_template, jsonify, session
import json, random
from pathlib import Path
import os

app = Flask(__name__)

# 让 session 能用（随便一个长字符串也行）
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-this-to-a-random-long-string")

BASE_DIR = Path(__file__).parent
CONTENT_PATH = BASE_DIR / "content.json"


def load_content():
    if not CONTENT_PATH.exists():
        return {}
    with open(CONTENT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def build_pool(data):
    pool = []
    for msg in data.get("messages", []):
        pool.append({"type": "text", "value": msg})
    random.shuffle(pool)
    return pool


@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/content")
def api_content():
    data = load_content()
    messages = data.get("messages", [])
    return jsonify({"messages": messages, "total": len(messages)})

@app.get("/api/photos")
def photos():
    photos_dir = BASE_DIR / "static" / "photos"
    if not photos_dir.exists():
        return jsonify({"photos": []})

    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    files = []
    for p in photos_dir.iterdir():
        if p.is_file() and p.suffix.lower() in exts:
            files.append(p.name)

    # 排序：001.jpg -> 002.jpg 这种会按名字顺序
    files.sort()

    # 返回可以直接在前端用的 URL
    return jsonify({
        "photos": [f"/static/photos/{name}" for name in files]
    })



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)