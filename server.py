"""Single-instance Christmas chat server. Python standard library only."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from collections import deque
from contextlib import closing
from http.cookies import SimpleCookie, CookieError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get("CHAT_DB", str(ROOT / "data" / "chat.sqlite3")))
SECRET = os.environ.get("CHAT_SECRET", secrets.token_hex(32)).encode()
LOCK = threading.Lock()
LIMITS = {}
ASSETS = {"index.html", "styles.css", "geometry.js", "scene.js", "music.js", "chat.js"}
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".js": "text/javascript; charset=utf-8"}

def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB)) as db, db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL,
            request_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL,
            created REAL NOT NULL, UNIQUE(sender, request_id))""")

def signature(token):
    return hmac.new(SECRET, token.encode(), hashlib.sha256).hexdigest()

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass  # Do not record visitors' IP addresses or chat text in access logs.

    def identity(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            value = cookie["visitor"].value if "visitor" in cookie else ""
        except CookieError:
            value = ""
        token, _, sig = value.partition(".")
        valid = bool(re.fullmatch(r"[a-f0-9]{32}", token)) and hmac.compare_digest(signature(token), sig)
        if not valid:
            token = secrets.token_hex(16)
        return token, valid

    def reply(self, status, payload, cookie=None):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            secure = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
            self.send_header("Set-Cookie", f"visitor={cookie}.{signature(cookie)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400{secure}")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/healthz":
            return self.reply(200, {"ok": True})
        if path == "/api/chat":
            token, valid = self.identity()
            with closing(sqlite3.connect(DB)) as db, db:
                rows = db.execute("SELECT id, sender, name, text, created FROM messages WHERE created > ? ORDER BY id DESC LIMIT 100", (time.time() - 86400,)).fetchall()
            messages = [{"id": r[0], "mine": r[1] == token, "name": r[2], "text": r[3], "created": r[4]} for r in reversed(rows)]
            return self.reply(200, {"name": "익명 " + token[:6].upper(), "messages": messages}, None if valid else token)
        name = "index.html" if path == "/" else path.removeprefix("/")
        if name not in ASSETS:
            return self.reply(404, {"error": "찾을 수 없는 주소예요."})
        body = (ROOT / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES[Path(name).suffix])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/chat":
            return self.reply(404, {"error": "찾을 수 없는 주소예요."})
        origin = self.headers.get("Origin")
        if (origin and urlsplit(origin).netloc != self.headers.get("Host")) or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.reply(403, {"error": "이 사이트에서 다시 접속해 주세요."})
        token, valid = self.identity()
        if not valid:
            return self.reply(401, {"error": "연결을 새로 확인한 뒤 다시 보내 주세요."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096:
                return self.reply(413, {"error": "메시지는 300자까지 보낼 수 있어요."})
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
            text, request_id = data.get("text"), data.get("requestId")
            if not isinstance(text, str) or not isinstance(request_id, str):
                raise ValueError()
            text = "".join(c for c in text.strip() if c >= " " or c == "\n")
            text.encode("utf-8")
            if not 1 <= len(text) <= 300 or not re.fullmatch(r"[a-zA-Z0-9-]{8,80}", request_id):
                raise ValueError()
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"error": "1~300자의 메시지를 입력해 주세요."})
        now = time.time()
        # Use only the trusted direct peer for rate limiting; do not trust client XFF.
        peer = hashlib.sha256((self.client_address[0] + SECRET.hex()).encode()).hexdigest()
        with LOCK, closing(sqlite3.connect(DB)) as db, db:
            previous = db.execute("SELECT id FROM messages WHERE sender=? AND request_id=?", (token, request_id)).fetchone()
            if previous:
                return self.reply(200, {"id": previous[0]})
            for key in list(LIMITS):
                if LIMITS[key][-1] < now - 60:
                    del LIMITS[key]
            for key, maximum, window in [(token, 1, 2), (peer, 60, 60)]:
                recent = LIMITS.get(key, deque())
                if sum(t > now - window for t in recent) >= maximum:
                    return self.reply(429, {"error": "잠깐 쉬었다가 다시 보내 주세요."})
            for key in (token, peer):
                recent = LIMITS.setdefault(key, deque(maxlen=60))
                recent.append(now)
            name = "익명 " + token[:6].upper()
            result = db.execute("INSERT INTO messages(sender,request_id,name,text,created) VALUES(?,?,?,?,?)", (token, request_id, name, text, now))
            db.execute("DELETE FROM messages WHERE created < ? OR id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT 500)", (now - 86400,))
            message_id = result.lastrowid
        return self.reply(201, {"id": message_id})

def main():
    initialize()
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8000"))), Handler)
    print(f"Christmas Tree listening on port {server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
