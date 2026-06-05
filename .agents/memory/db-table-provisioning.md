---
name: DB table provisioning (no migrations)
description: How new DB collections must be created in this backend.
---

This backend has **no migration framework and no CREATE TABLE in app code** — the
existing tables (jsonb-`doc` collections) were created out-of-band, and the db wrapper's
`insert_one` assumes the table already exists.

**Rule:** any NEW collection must be self-provisioned idempotently at startup in
`core.init_pool` (`CREATE TABLE IF NOT EXISTS ...` + needed unique index), or it 500s in
dev and silently breaks in production.

**Why:** production uses a separate database, so a manually-created dev table will not
exist there. Startup-time creation is the only reliable way to keep both environments in sync.
