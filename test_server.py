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

    def raw_request(self, client, path="/api/chat", body=None, origin=None):
        import io
        from email.parser import BytesParser
        payload = json.dumps(body).encode() if body is not None else b""
        headers = [f"{'POST' if body is not None else 'GET'} {path} HTTP/1.0", "Host: localhost"]
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

    def test_assets_and_health(self):
        client = self.client()
        self.assertEqual(self.request(client, "/healthz")[0], 200)
        for path in ["/", "/styles.css", "/scene.js", "/chat.js", "/music.js", "/geometry.js"]:
            status, content = self.raw_request(client, path)
            self.assertEqual(status, 200)
            self.assertGreater(len(content), 100)

if __name__ == "__main__":
    unittest.main()
