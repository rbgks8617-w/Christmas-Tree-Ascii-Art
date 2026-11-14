"""Password-protected chat moderation. No credentials are stored in source."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from contextlib import closing
from http.cookies import SimpleCookie, CookieError
from urllib.parse import urlsplit

PASSWORD = os.environ.get("CHAT_ADMIN_PASSWORD", "")
SESSIONS = {}
ATTEMPTS = {}
LOCK = threading.Lock()
TTL = 8 * 60 * 60

def session_key(handler):
    try:
        cookie = SimpleCookie(handler.headers.get("Cookie", ""))
        token = cookie["tree_admin"].value if "tree_admin" in cookie else ""
    except CookieError:
        token = ""
    return hashlib.sha256(token.encode()).hexdigest()

def authenticated(handler):
    with LOCK:
        now = time.time()
        for key in list(SESSIONS):
            if SESSIONS[key] < now:
                del SESSIONS[key]
        return SESSIONS.get(session_key(handler), 0) > now

def cookie(handler, token, age):
    secure = "; Secure" if handler.headers.get("X-Forwarded-Proto") == "https" else ""
    return f"tree_admin={token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age={age}{secure}"

def handle(handler, db_path):
    path = urlsplit(handler.path).path
    method = handler.command
    if not path.startswith("/api/admin/"):
        return False
    if method == "GET":
        if not authenticated(handler):
            handler.reply(401, {"error": "관리자 로그인이 필요해요."})
        elif path == "/api/admin/messages":
            with closing(sqlite3.connect(db_path)) as db:
                rows = db.execute("SELECT id, name, text, created FROM messages ORDER BY id DESC LIMIT 500").fetchall()
            handler.reply(200, {"messages": [{"id": r[0], "name": r[1], "text": r[2], "created": r[3]} for r in rows]})
        else:
            handler.reply(404, {"error": "잘못된 주소예요."})
        return True
    origin = handler.headers.get("Origin")
    if (origin and urlsplit(origin).netloc != handler.headers.get("Host")) or handler.headers.get("Content-Type", "").split(";")[0] != "application/json":
        handler.reply(403, {"error": "관리자 페이지에서 다시 시도해 주세요."})
        return True
    try:
        size = int(handler.headers.get("Content-Length", "0"))
        if not 0 < size <= 4096:
            raise ValueError()
        body = json.loads(handler.rfile.read(size))
        if not isinstance(body, dict):
            raise ValueError()
    except (ValueError, UnicodeError):
        handler.reply(400, {"error": "요청 형식이 올바르지 않아요."})
        return True
    if method == "POST" and path == "/api/admin/login":
        if not PASSWORD:
            handler.reply(503, {"error": "Render에서 CHAT_ADMIN_PASSWORD를 설정해 주세요."})
            return True
        candidate = body.get("password", "")
        if not isinstance(candidate, str):
            handler.reply(400, {"error": "비밀번호를 입력해 주세요."})
            return True
        try:
            candidate = candidate.encode("utf-8")
        except UnicodeError:
            handler.reply(400, {"error": "올바른 비밀번호를 입력해 주세요."})
            return True
        peer = hashlib.sha256(handler.client_address[0].encode()).hexdigest()
        now = time.time()
        with LOCK:
            for key in list(ATTEMPTS):
                ATTEMPTS[key] = [t for t in ATTEMPTS[key] if t > now - 300]
                if not ATTEMPTS[key]:
                    del ATTEMPTS[key]
            attempts = ATTEMPTS.setdefault(peer, [])
            if len(attempts) >= 5:
                handler.reply(429, {"error": "로그인 시도가 많아요. 5분 후 다시 시도해 주세요."})
                return True
            if not hmac.compare_digest(candidate, PASSWORD.encode()):
                attempts.append(now)
                handler.reply(401, {"error": "비밀번호가 맞지 않아요."})
                return True
            ATTEMPTS.pop(peer, None)
            token = secrets.token_urlsafe(32)
            if len(SESSIONS) >= 50:
                del SESSIONS[min(SESSIONS, key=SESSIONS.get)]
            SESSIONS[hashlib.sha256(token.encode()).hexdigest()] = now + TTL
        handler.reply(200, {"ok": True}, response_cookie=cookie(handler, token, TTL))
        return True
    if not authenticated(handler):
        handler.reply(401, {"error": "관리자 로그인이 필요해요."})
        return True
    if method == "POST" and path == "/api/admin/logout":
        with LOCK:
            SESSIONS.pop(session_key(handler), None)
        handler.reply(200, {"ok": True}, response_cookie=cookie(handler, "", 0))
    elif method == "POST" and path == "/api/admin/delete":
        message_id = body.get("id")
        if type(message_id) is not int or message_id <= 0:
            handler.reply(400, {"error": "삭제할 메시지를 선택해 주세요."})
            return True
        with closing(sqlite3.connect(db_path)) as db, db:
            result = db.execute("DELETE FROM messages WHERE id=?", (message_id,))
        handler.reply(200, {"deleted": result.rowcount})
    elif method == "POST" and path == "/api/admin/clear":
        # Delete only the messages present when the administrator confirmed.
        through_id = body.get("throughId")
        if body.get("confirm") != "DELETE" or type(through_id) is not int or through_id < 0:
            handler.reply(400, {"error": "삭제 확인이 필요해요."})
            return True
        with closing(sqlite3.connect(db_path)) as db, db:
            result = db.execute("DELETE FROM messages WHERE id<=?", (through_id,))
        handler.reply(200, {"deleted": result.rowcount})
    else:
        handler.reply(404, {"error": "잘못된 주소예요."})
    return True
