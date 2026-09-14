-- service_role already bypasses RLS, but Postgres still enforces plain
-- table-level command grants regardless of RLS bypass. 0001_init.sql only
-- granted these to `authenticated`, so admin scripts running as
-- service_role (e.g. scripts/seed.ts) fail with "permission denied" even
-- though they're only meant to be gated by RLS. This mirrors the exact
-- same grants already given to `authenticated` — no table structure, FK,
-- column, or RLS policy changes.

grant usage on schema public to service_role;
grant select, insert on profiles to service_role;
grant select, insert, update on talents to service_role;
grant select, insert, update on companies to service_role;
grant select, insert, update on matches to service_role;
grant select, insert on messages to service_role;
grant select, insert on phase_history to service_role;
