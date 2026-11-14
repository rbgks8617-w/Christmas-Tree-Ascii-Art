"""HTTP handler integration tests with two anonymous cookie sessions; no network required."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
import server

class ChatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DB = Path(cls.temp.name) / "chat.sqlite3"
        server.initialize()

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def client(self):
        return {}

    def raw_request(self, client, path="/api/chat", body=None, origin=None, extra_headers=None, method=None):
        import io
        from email.parser import BytesParser
        payload = json.dumps(body).encode() if body is not None else b""
        headers = [f"{method or ('POST' if body is not None else 'GET')} {path} HTTP/1.0", "Host: localhost"]
        headers += [f"{key}: {value}" for key, value in (extra_headers or {}).items()]
        if body is not None:
            headers += ["Content-Type: application/json", f"Content-Length: {len(payload)}"]
        if origin:
            headers += ["Origin: " + origin]
        if client.get("cookie"):
            headers += ["Cookie: " + client["cookie"]]
        request = ("\r\n".join(headers) + "\r\n\r\n").encode() + payload
        class Connection:
            def __init__(self): self.output = bytearray()
            def makefile(self, *args): return io.BytesIO(request)
            def sendall(self, data): self.output.extend(data)
            def settimeout(self, value): pass
        connection = Connection()
        server.Handler(connection, ("127.0.0.1", 12345), None)
        head, content = bytes(connection.output).split(b"\r\n\r\n", 1)
        status_line, header_bytes = head.split(b"\r\n", 1)
        response_headers = BytesParser().parsebytes(header_bytes)
        if response_headers.get("Set-Cookie"):
            client["cookie"] = response_headers["Set-Cookie"].split(";")[0]
        return int(status_line.split()[1]), content

    def request(self, client, path="/api/chat", body=None, origin=None):
        status, content = self.raw_request(client, path, body, origin)
        return status, json.loads(content)

    def test_shared_chat_validation_and_retries(self):
        alice, bob = self.client(), self.client()
        _, a = self.request(alice)
        _, b = self.request(bob)
        self.assertNotEqual(a["name"], b["name"])
        body = {"text": "<script>alert('text only')</script>", "requestId": "message-test-001"}
        status, sent = self.request(alice, body=body)
        self.assertEqual(status, 201)
        status, repeated = self.request(alice, body=body)
        self.assertEqual(status, 200)
        self.assertEqual(sent, repeated)
        _, received = self.request(bob)
        message = next(m for m in received["messages"] if m["id"] == sent["id"])
        self.assertEqual(message["text"], body["text"])
        self.assertFalse(message["mine"])
        _, own = self.request(alice)
        self.assertTrue(next(m for m in own["messages"] if m["id"] == sent["id"])["mine"])
        self.assertEqual(self.request(alice, body={"text": "spam", "requestId": "message-test-002"})[0], 429)
        self.assertEqual(self.request(bob, body={"text": "x"*301, "requestId": "too-long-001"})[0], 400)
        self.assertEqual(self.request(bob, body={"text": " ", "requestId": "empty-001"})[0], 400)
        self.assertEqual(self.request(bob, body={"text": "\ud800", "requestId": "invalid-001"})[0], 400)
        self.assertEqual(self.request(bob, body=body, origin="https://other.example")[0], 403)
        self.assertEqual(self.request(self.client(), body=body)[0], 401)
        self.assertEqual(self.request(bob, "/data/chat.sqlite3")[0], 404)
        self.assertEqual(self.request(bob, "/server.py")[0], 404)
        with server.closing(sqlite3.connect(server.DB)) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM messages WHERE request_id=?", ("message-test-001",)).fetchone()[0], 1)

    def test_admin_authentication_and_deletion(self):
        import secrets
        import time
        import admin
        previous = admin.PASSWORD
        admin.PASSWORD = secrets.token_urlsafe(32)
        admin.SESSIONS.clear()
        admin.ATTEMPTS.clear()
        manager = self.client()
        anonymous = self.client()
        try:
            self.assertEqual(self.request(anonymous, "/api/admin/messages")[0], 401)
            self.assertEqual(self.request(anonymous, "/api/admin/delete", {"id": 1})[0], 401)
            self.assertEqual(self.request(manager, "/api/admin/login", {"password": "wrong"})[0], 401)
            self.assertEqual(self.request(manager, "/api/admin/login", {"password": admin.PASSWORD}, origin="https://other.example")[0], 403)
            self.assertEqual(self.request(manager, "/api/admin/login", {"password": admin.PASSWORD})[0], 200)
            old_cookie = manager["cookie"]
            self.assertEqual(self.request({"cookie": old_cookie + "tamper"}, "/api/admin/messages")[0], 401)
            with server.closing(sqlite3.connect(server.DB)) as db, db:
                first = db.execute("INSERT INTO messages(sender,request_id,name,text,created) VALUES(?,?,?,?,?)", ("test", "admin-1", "anonymous", "first", time.time())).lastrowid
                second = db.execute("INSERT INTO messages(sender,request_id,name,text,created) VALUES(?,?,?,?,?)", ("test", "admin-2", "anonymous", "second", time.time())).lastrowid
            status, data = self.request(manager, "/api/admin/messages")
            self.assertEqual(status, 200)
            self.assertTrue(any(m["id"] == first for m in data["messages"]))
            self.assertEqual(self.request(manager, "/api/admin/delete", {"id": first}, origin="https://other.example")[0], 403)
            self.assertEqual(self.request(manager, "/api/admin/delete", {"id": first})[1]["deleted"], 1)
            self.assertEqual(self.request(manager, "/api/admin/clear", {"throughId": second})[0], 400)
            with server.closing(sqlite3.connect(server.DB)) as db, db:
                newest = db.execute("INSERT INTO messages(sender,request_id,name,text,created) VALUES(?,?,?,?,?)", ("test", "admin-3", "anonymous", "newer", time.time())).lastrowid
            self.assertEqual(self.request(manager, "/api/admin/clear", {"confirm": "DELETE", "throughId": second})[0], 200)
            _, data = self.request(manager, "/api/admin/messages")
            self.assertTrue(any(m["id"] == newest for m in data["messages"]))
            self.assertFalse(any(m["id"] <= second for m in data["messages"]))
            self.assertEqual(self.request(manager, "/api/admin/logout", {})[0], 200)
            self.assertEqual(self.request({"cookie": old_cookie}, "/api/admin/messages")[0], 401)
            for _ in range(5):
                self.assertEqual(self.request(manager, "/api/admin/login", {"password": "wrong"})[0], 401)
            self.assertEqual(self.request(manager, "/api/admin/login", {"password": admin.PASSWORD})[0], 429)
            admin.ATTEMPTS.clear()
            admin.PASSWORD = ""
            self.assertEqual(self.request(manager, "/api/admin/login", {"password": "anything"})[0], 503)
        finally:
            admin.PASSWORD = previous
            admin.SESSIONS.clear()
            admin.ATTEMPTS.clear()

    def test_music_streaming(self):
        client = self.client()
        path = server.ROOT / "assets" / "christmas.mp3"
        source = path.read_bytes()
        self.assertEqual(len(source), 22814974)
        status, body = self.raw_request(client, "/assets/christmas.mp3", extra_headers={"Range": "bytes=0-31"})
        self.assertEqual(status, 206)
        self.assertEqual(body, source[:32])
        status, body = self.raw_request(client, "/assets/christmas.mp3", extra_headers={"Range": "bytes=-32"})
        self.assertEqual(status, 206)
        self.assertEqual(body, source[-32:])
        status, body = self.raw_request(client, "/assets/christmas.mp3", extra_headers={"Range": "bytes=99999999-"})
        self.assertEqual(status, 416)
        status, body = self.raw_request(client, "/assets/christmas.mp3", method="HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")

    def test_assets_and_health(self):
        client = self.client()
        self.assertEqual(self.request(client, "/healthz")[0], 200)
        for path in ["/", "/admin", "/admin.js", "/admin.css", "/styles.css", "/scene.js", "/chat.js", "/music.js", "/geometry.js"]:
            status, content = self.raw_request(client, path)
            self.assertEqual(status, 200)
            self.assertGreater(len(content), 100)

if __name__ == "__main__":
    unittest.main()
