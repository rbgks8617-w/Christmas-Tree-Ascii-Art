"""Server-only PostgreSQL adapter; SQLite remains available until verified cutover."""
import os
import sqlite3
try:
    import psycopg
except ImportError:
    psycopg = None

ERRORS = (sqlite3.Error, OSError) + ((psycopg.Error,) if psycopg else ())

def remote():
    backend = os.environ.get("CHAT_STORAGE", "sqlite")
    if backend not in ("sqlite", "postgres"):
        raise OSError("Unsupported CHAT_STORAGE")
    return backend == "postgres"

class Postgres:
    def __init__(self):
        if psycopg is None:
            raise OSError("Install requirements.txt before enabling PostgreSQL")
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise OSError("DATABASE_URL is required")
        self.connection = psycopg.connect(url, connect_timeout=10,
                                         sslmode="require", options="-c statement_timeout=10000 -c search_path=public")
    def execute(self, sql, args=()):
        sql = sql.replace("?", "%s")
        insert = sql.startswith("INSERT INTO messages")
        if insert:
            sql += " RETURNING id"
        cursor = self.connection.execute(sql, args)
        if insert:
            return type("Inserted", (), {"lastrowid": cursor.fetchone()[0]})()
        return cursor
    def __enter__(self):
        return self
    def __exit__(self, kind, value, traceback):
        if kind is None:
            self.connection.commit()
        else:
            self.connection.rollback()
    def close(self):
        self.connection.close()

def connect(path):
    return Postgres() if remote() else sqlite3.connect(path)

def check():
    db = Postgres()
    try:
        db.execute("SELECT id, sender, request_id, name, text, created FROM messages LIMIT 0")
    finally:
        db.close()
