"""Offline migration: stop chat writes, download SQLite, then run this script locally.
DATABASE_URL must point to Supabase. Does not enable CHAT_STORAGE or delete SQLite.
"""
import argparse
import sqlite3
from pathlib import Path
from contextlib import closing
import storage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("backup", type=Path)
args = parser.parse_args()
if not args.source.is_file() or args.backup.exists():
    parser.error("Source must exist and backup must be a new path")
with closing(sqlite3.connect(args.source)) as source, closing(sqlite3.connect(args.backup)) as backup:
    source.backup(backup)
with closing(sqlite3.connect(args.backup)) as backup:
    rows = backup.execute("SELECT sender,request_id,name,text,created FROM messages ORDER BY id").fetchall()
with closing(storage.Postgres()) as target, target:
    for row in rows:
        target.connection.execute("INSERT INTO messages(sender,request_id,name,text,created) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(sender,request_id) DO NOTHING", row)
        actual = target.connection.execute("SELECT sender,request_id,name,text,created FROM messages WHERE sender=%s AND request_id=%s", row[:2]).fetchone()
        if tuple(actual) != tuple(row):
            raise ValueError("Migration conflict; transaction rolled back. Keep the backup.")
print(f"Verified {len(rows)} messages. Source and backup preserved; storage NOT switched.")
