# ASCII Christmas Tree

For ongoing development, read [HANDOFF.md](HANDOFF.md) and [AGENTS.md](AGENTS.md)
first. They document the protected tree, current Supabase setup and pending
real-device verification.

Run the scene and shared anonymous chat together:

    python server.py

Open http://localhost:8000. Python 3.10+ is required. Install requirements.txt for PostgreSQL; SQLite uses the standard library.
Opening index.html or using a static file server runs the animation only.

## Animation and layout

- A tapered, textured trunk with bare branches and roots is present from the start.
- Leaves grow from it. Ornaments and gifts materialize as particles at their final
  positions without flying in from elsewhere.
- The gold ribbon winds from the bottom to the top along its spiral.
- The star descends, settles, and twinkles. The completed tree keeps rotating.
- Desktop: tree on the left, chat on the right. Mobile: tree at the top, chat below.
- Music plays directly from the supplied MP3 at assets/christmas.mp3 and loops.
  No YouTube API, iframe or third-party music request is used.
  Autoplay is attempted on entry, with a first-touch fallback if the browser blocks
  sound. Volume is remembered per browser. The server supports HTTP byte ranges
  for mobile playback and seeking without loading the entire audio into memory.

## Render deployment

Chat requires a **Web Service**, not a Static Site. Existing Static Sites cannot
run server.py: create a Web Service from this same GitHub repository, or use the
included render.yaml Blueprint. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Python 3 |
| Build command | pip install -r requirements.txt |
| Start command | python server.py |
| Health check | /healthz |

The server binds to 0.0.0.0 and Render's PORT automatically. The Blueprint uses
one free instance and generates CHAT_SECRET. For manual setup, set CHAT_SECRET
to a random secret to keep signed visitor cookies stable across restarts.

Anonymous names are assigned by signed HTTP-only cookies. All visitors share
one room, refreshed every 2.5 seconds. Messages are limited to 300 characters,
with send rate limits, safe text rendering and duplicate-send protection.
The UI shows the latest 100 messages. Messages are kept until an administrator
explicitly deletes them; there is no age-based or count-based automatic deletion.
SQLite remains the default until the verified Supabase cutover described in
DEPLOYMENT.md. PostgreSQL uses server-only DATABASE_URL; no API secret reaches
browser assets. Keep CHAT_SECRET unchanged to preserve anonymous identities.

## Terminal version and checks

    python christmas_tree_3d.py
    python christmas_tree_3d.py --time 15
    python -m unittest -v test_server.py
    node test_scene.cjs
    node test_ui.cjs
    node test_admin.cjs

The HTTP tests exercise real request parsing, separate visitor cookies, shared
messages, validation, rate limits, idempotency and asset isolation in-process.
Canvas/audio/admin tests use mocks, not a real browser or speaker playback.
geometry.js is generated from make_model() in christmas_tree_3d.py.

## Chat connection diagnosis

The page and /api/chat must be served by the same Python Web Service. Open
/healthz on the deployed service: it must return JSON with ok: true. If /api/chat
returns an HTML page or 404, check the URL and Render Start Command (python
server.py). A Static Site cannot run this backend. The client now waits up to
70 seconds for a sleeping service, retries on reconnect/send, and refreshes an
expired visitor cookie before retrying a message. Messages stay in the input
when sending fails. The normal UI shows only anonymous chat and its input.

The existing static hostname christmas-tree-ascii-art.onrender.com redirects
visitors to https://christmas-tree-ascii-art-server.onrender.com, where the
Python server serves both the scene and /api/chat on the same origin.

## Chat moderation

Visit /admin on the Python Web Service. Sign in with CHAT_ADMIN_PASSWORD from
that service's Render Environment settings. The password is never embedded in
client assets. Without this environment variable, admin login is disabled.
The Blueprint generates it for new setups; existing services can set it directly
in Render. Sessions expire after 8 hours and are revoked on logout or restart.
The page supports per-message deletion and confirmed clearing of the current
list. Messages arriving after the clear confirmation are preserved. All delete
operations require a server-validated admin session. Login attempts are limited.
