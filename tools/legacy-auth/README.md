Legacy Auth Cleanup Scripts

Prereqs
- Set `DATABASE_URL`.
- Set `AUTH_MIGRATION_DATE` to the Firebase migration cutover (ISO-8601).
- For Firebase linking, also set:
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

Scripts (node)
- `node tools/legacy-auth/audit-legacy-users.js --sample 10`
- `node tools/legacy-auth/mark-legacy-users.js --dry-run`
- `node tools/legacy-auth/link-firebase-users.js --delay-ms 200 --limit 200`
- `node tools/legacy-auth/delete-legacy-users.js --soft --limit 200`
- `node tools/legacy-auth/delete-legacy-users.js --hard --confirm=DELETE --limit 50`

Notes
- All scripts write JSONL logs to `tools/legacy-auth/logs/`.
- Legacy predicate is documented in each script. Update `AUTH_MIGRATION_DATE` before running.
