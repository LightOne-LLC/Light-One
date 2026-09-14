-- Swipe-based Like/Skip state, feeding the existing `matches` table.
--
-- Design notes:
-- - One row per (liker, target) decision. The `unique (liker_id, target_id)`
--   constraint is what actually guarantees "no duplicate Like" and "no
--   re-deciding a candidate" — enforced by Postgres, not application code.
-- - No update/delete policy: a decision is final for this MVP (mirrors the
--   immutable-once-set pattern already used by `profiles.role`).
-- - `target_id` intentionally has no FK: it may point at either `talents.id`
--   or `companies.id` depending on `liker_role`, which Postgres can't express
--   as a single FK. `messages.sender_id` already follows this same
--   un-FK'd-uuid, RLS/app-validated convention in 0001_init.sql.
-- - RLS select allows `target_id = auth.uid()` in addition to the caller's
--   own rows: mutual-Like detection requires reading the *other* party's
--   Like row, which is unavoidable for this check to work at all (this is
--   the same tradeoff every mutual-match system makes at the DB level).

create table likes (
  id uuid primary key default gen_random_uuid(),
  liker_id uuid not null references auth.users (id) on delete cascade,
  liker_role text not null check (liker_role in ('talent', 'company')),
  target_id uuid not null check (target_id <> liker_id),
  decision text not null check (decision in ('like', 'skip')),
  created_at timestamptz not null default now(),
  unique (liker_id, target_id)
);

create index likes_target_id_idx on likes (target_id);

alter table likes enable row level security;

create policy "likes: select own or targeting me" on likes
  for select to authenticated
  using (liker_id = auth.uid() or target_id = auth.uid());

-- liker_role must match the caller's actual registered role (not just any
-- string they send), so a mismatched role can't corrupt which side of a
-- resulting match gets treated as talent_id vs company_id.
create policy "likes: insert own" on likes
  for insert to authenticated
  with check (
    liker_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = liker_role)
  );

grant select, insert on likes to authenticated;
grant select, insert on likes to service_role;
