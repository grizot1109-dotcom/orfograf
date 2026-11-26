-- Орфограф: таблицы рейтинга и дуэлей.
-- Живут в том же проекте Supabase, что и «Формулограф», и используют его таблицу players
-- и функцию _auth_player (один ник и один вход на оба приложения).

create table if not exists public.ru_scores (
  player_id uuid not null references public.players(id) on delete cascade,
  day date not null,
  name text not null,
  points int not null default 0 check (points between 0 and 60000),
  correct int not null default 0 check (correct >= 0),
  attempts int not null default 0 check (attempts between 0 and 3000),
  streak int not null default 0 check (streak between 0 and 5000),
  level int not null default 1 check (level between 1 and 1000),
  avatar text not null default '' check (char_length(avatar) <= 64),
  updated_at timestamptz not null default now(),
  primary key (player_id, day)
);
create index if not exists ru_scores_day_idx on public.ru_scores (day);
alter table public.ru_scores enable row level security;
drop policy if exists "ru scores are public" on public.ru_scores;
create policy "ru scores are public" on public.ru_scores for select using (true);
revoke insert, update, delete on public.ru_scores from anon, authenticated;
grant select on public.ru_scores to anon, authenticated;

create or replace function public.ru_submit_score(
  p_id uuid, p_secret text, p_name text, p_day date,
  p_points int, p_correct int, p_attempts int, p_streak int, p_level int, p_avatar text default ''
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _auth_player(p_id, p_secret, p_name);
  if p_day < current_date - 2 or p_day > current_date + 1 then raise exception 'bad day'; end if;
  if p_attempts < 0 or p_correct < 0 or p_points < 0 or p_streak < 0 or p_level < 1 or p_level > 1000
     or p_correct > p_attempts or p_attempts > 20000 or p_points > p_attempts * 30 then raise exception 'bad score'; end if;
  p_avatar := left(coalesce(p_avatar, ''), 64);
  insert into ru_scores (player_id, day, name, points, correct, attempts, streak, level, avatar, updated_at)
  values (p_id, p_day, btrim(p_name), p_points, p_correct, p_attempts, p_streak, p_level, p_avatar, now())
  on conflict (player_id, day) do update
    set name = excluded.name, points = excluded.points, correct = excluded.correct, attempts = excluded.attempts,
        streak = excluded.streak, level = excluded.level, avatar = excluded.avatar, updated_at = now();
  update ru_scores set name = btrim(p_name), avatar = p_avatar where player_id = p_id and (name <> btrim(p_name) or avatar <> p_avatar);
end $$;
revoke all on function public.ru_submit_score(uuid, text, text, date, int, int, int, int, int, text) from public;
grant execute on function public.ru_submit_score(uuid, text, text, date, int, int, int, int, int, text) to anon, authenticated;

create table if not exists public.ru_duels (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  creator_id uuid not null references public.players(id) on delete cascade,
  creator_name text not null,
  items text[] not null check (array_length(items, 1) between 5 and 80 and octet_length(array_to_string(items, '')) <= 12000),
  created_at timestamptz not null default now()
);
create table if not exists public.ru_duel_results (
  code text not null references public.ru_duels(code) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  correct int not null check (correct >= 0),
  total int not null check (total >= 0),
  created_at timestamptz not null default now(),
  primary key (code, player_id)
);
alter table public.ru_duels enable row level security;
alter table public.ru_duel_results enable row level security;
drop policy if exists "ru duels are public" on public.ru_duels;
create policy "ru duels are public" on public.ru_duels for select using (true);
drop policy if exists "ru duel results are public" on public.ru_duel_results;
create policy "ru duel results are public" on public.ru_duel_results for select using (true);
revoke insert, update, delete on public.ru_duels, public.ru_duel_results from anon, authenticated;
grant select on public.ru_duels, public.ru_duel_results to anon, authenticated;

create or replace function public.ru_create_duel(p_id uuid, p_secret text, p_name text, p_items text[])
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform _auth_player(p_id, p_secret, p_name);
  if (select count(*) from ru_duels where creator_id = p_id and created_at > now() - interval '1 hour') >= 20 then raise exception 'too many duels'; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from ru_duels where code = c);
  end loop;
  insert into ru_duels (code, creator_id, creator_name, items) values (c, p_id, btrim(p_name), p_items);
  return c;
end $$;
revoke all on function public.ru_create_duel(uuid, text, text, text[]) from public;
grant execute on function public.ru_create_duel(uuid, text, text, text[]) to anon, authenticated;

create or replace function public.ru_submit_duel(p_code text, p_id uuid, p_secret text, p_name text, p_correct int, p_total int)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform _auth_player(p_id, p_secret, p_name);
  select array_length(items, 1) into n from ru_duels where code = p_code;
  if n is null then raise exception 'no duel'; end if;
  if p_correct < 0 or p_total < 0 or p_correct > p_total or p_total > n then raise exception 'bad result'; end if;
  insert into ru_duel_results (code, player_id, name, correct, total)
  values (p_code, p_id, btrim(p_name), p_correct, p_total)
  on conflict (code, player_id) do nothing;
end $$;
revoke all on function public.ru_submit_duel(text, uuid, text, text, int, int) from public;
grant execute on function public.ru_submit_duel(text, uuid, text, text, int, int) to anon, authenticated;

-- Профили: сводка статистики игрока для карточки «профиль друга»
create table if not exists public.ru_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  stats jsonb not null,
  updated_at timestamptz not null default now(),
  constraint ru_profiles_stats_size check (octet_length(stats::text) <= 8192)
);
alter table public.ru_profiles enable row level security;
drop policy if exists "ru profiles are public" on public.ru_profiles;
create policy "ru profiles are public" on public.ru_profiles for select using (true);
revoke insert, update, delete on public.ru_profiles from anon, authenticated;
grant select on public.ru_profiles to anon, authenticated;

create or replace function public.ru_set_profile(p_id uuid, p_secret text, p_name text, p_stats jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _auth_player(p_id, p_secret, p_name);
  if p_stats is null or jsonb_typeof(p_stats) <> 'object' or octet_length(p_stats::text) > 8192 then raise exception 'bad stats'; end if;
  insert into ru_profiles (player_id, stats) values (p_id, p_stats)
  on conflict (player_id) do update set stats = excluded.stats, updated_at = now();
end $$;
revoke all on function public.ru_set_profile(uuid, text, text, jsonb) from public;
grant execute on function public.ru_set_profile(uuid, text, text, jsonb) to anon, authenticated;

-- Сообщения об ошибках в заданиях (кнопка «Сообщить об ошибке»). Читать может только владелец проекта.
create table if not exists public.ru_reports (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  item text not null check (char_length(item) <= 300),
  reason text not null check (char_length(reason) <= 60),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table public.ru_reports enable row level security;
revoke all on public.ru_reports from anon, authenticated;
create or replace function public.ru_report(p_id uuid, p_secret text, p_name text, p_item text, p_reason text, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _auth_player(p_id, p_secret, p_name);
  if (select count(*) from ru_reports where player_id = p_id and created_at > now() - interval '1 hour') >= 30 then raise exception 'too many reports'; end if;
  insert into ru_reports (player_id, name, item, reason, comment)
  values (p_id, btrim(p_name), left(coalesce(p_item, ''), 300), left(coalesce(p_reason, ''), 60), left(coalesce(p_comment, ''), 500));
end $$;
revoke all on function public.ru_report(uuid, text, text, text, text, text) from public;
grant execute on function public.ru_report(uuid, text, text, text, text, text) to anon, authenticated;

-- Лимиты на день подняты: до 20 000 заданий и 600 000 очков (раньше 3000 и 60 000 — упирались активные игроки)
alter table public.ru_scores drop constraint if exists ru_scores_attempts_check;
alter table public.ru_scores add constraint ru_scores_attempts_check check (attempts between 0 and 20000);
alter table public.ru_scores drop constraint if exists ru_scores_points_check;
alter table public.ru_scores add constraint ru_scores_points_check check (points between 0 and 600000);

-- Вход по паролю и резервная копия прогресса (пароли — bcrypt через pgcrypto; после 10 ошибок вход блокируется на 15 минут)
-- Полный текст функций: ru_set_password, ru_login, ru_has_password, ru_save_backup, ru_load_backup — см. миграции orfograf_login_and_backup и orfograf_login_lockout_fix в Supabase.
