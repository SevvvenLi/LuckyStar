from flask import Flask, render_template, jsonify, request, abort
import json
from pathlib import Path
import os
from datetime import datetime

import psycopg2
import psycopg2.extras

app = Flask(__name__)

BASE_DIR = Path(__file__).parent
CONTENT_PATH = BASE_DIR / "content.json"

DATABASE_URL = os.environ.get("DATABASE_URL")  # ✅ Railway 注入
INBOX_KEY = os.environ.get("INBOX_KEY", "change-this-key")


def load_content():
    if not CONTENT_PATH.exists():
        return {"messages": []}
    with open(CONTENT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {"messages": data.get("messages", [])}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set. Please add Railway PostgreSQL.")
    # Railway/云数据库常要求 SSL。没写 sslmode 时强制 require
    if "sslmode=" not in DATABASE_URL:
        return psycopg2.connect(DATABASE_URL + "?sslmode=require")
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS replies (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL,
            message TEXT NOT NULL,
            user_agent TEXT,
            ip TEXT
        );
    """)
    conn.commit()
    cur.close()
    conn.close()


# 启动时建表
init_db()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/inbox")
def inbox_page():
    key = request.args.get("key", "")
    if key != INBOX_KEY:
        abort(404)
    return render_template("inbox.html")


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
    files = [p.name for p in photos_dir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    files.sort()
    return jsonify({"photos": [f"/static/photos/{name}" for name in files]})


@app.post("/api/reply")
def api_reply():
    data = request.get_json(silent=True) or {}
    msg = (data.get("message") or "").strip()

    if not msg:
        return jsonify({"ok": False, "error": "empty"}), 400
    if len(msg) > 500:
        return jsonify({"ok": False, "error": "too_long"}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO replies (created_at, message, user_agent, ip) VALUES (%s, %s, %s, %s)",
        (
            datetime.utcnow(),
            msg,
            request.headers.get("User-Agent", ""),
            request.headers.get("X-Forwarded-For", request.remote_addr) or ""
        )
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"ok": True})


@app.get("/api/replies")
def api_replies():
    key = request.args.get("key", "")
    if key != INBOX_KEY:
        abort(404)

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT id,
               to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
               message
        FROM replies
        ORDER BY id DESC
        LIMIT 200
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify({"ok": True, "replies": rows})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
