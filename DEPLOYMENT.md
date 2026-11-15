# Supabase cutover and deployment review

Changes: storage.py, schema.sql, migrate_sqlite.py, server.py, admin.py,
requirements.txt, render.yaml, README.md and test_server.py.

Use Supabase Connect > Session pooler for project ygswuhugtryamouynyja.
Store the database connection string in Render DATABASE_URL, never in browser
code. This driver uses a PostgreSQL password, not a Supabase HTTP API secret.
https://supabase.com/docs/guides/database/connecting-to-postgres

## Approval required before production changes
1. Do not restart/redeploy the current ephemeral SQLite service before backup.
2. Pause incoming writes in a maintenance window. Export live SQLite with its
   backup API to capture WAL data; download and retain that backup locally.
3. Run schema.sql in Supabase SQL editor. RLS is enabled and anon/authenticated
   roles have no direct table access.
4. Install requirements.txt; configure DATABASE_URL privately on the local machine.
5. Run python migrate_sqlite.py downloaded.sqlite3 backup.sqlite3.
   Backup must be a new path. Import deduplicates sender/request_id and verifies
   every imported field. A conflict rolls back the import. Source is not deleted.
   PostgreSQL assigns numeric IDs; sender/request_id is the stable identity.
6. Verify imported counts and sample records. Keep both SQLite copies.
7. Only after verification and deployment approval set CHAT_STORAGE=postgres and
   DATABASE_URL in Render. Keep CHAT_SECRET and CHAT_ADMIN_PASSWORD unchanged.
8. Deploy, test chat and duplicate retry, restart Render, and confirm persistence.
   Test admin deletion only on explicitly disposable test messages.

Do not push main before approval when Render auto-deploy is enabled.
The migration script never switches the backend or deletes source data.
Never revert to SQLite after accepting PostgreSQL messages without reconciling data.

## Graphics
Files: village.js, santa.js, scene.js, index.html, server.py and test_scene.cjs.
Six houses with snowy roofs, windows and chimneys; rising smoke; distant firs,
hills, paths, lamps and fences. Santa and three reindeer fly right to left for
8 seconds per 30-second cycle. Tree depth remains in front of scenery.
Pause, replay and reduced-motion share the existing elapsed-time control.

## Validation status
Local HTTP tests: authentication, deletion, old-message retention, duplicate
retry, failure responses and asset access. Node VM tests: tree animation, audio,
chat, admin controls and scenery. These are not actual browser/device tests.
Supabase integration, real migration, Render restart, Chrome/iPhone Safari and
long-duration performance checks remain pending environment access and approval.
