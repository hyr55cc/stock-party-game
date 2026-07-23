-- ============================================================
--  BIG MARGIN — إعداد قاعدة البيانات على Supabase
--  انسخ هذا الملف كامل والصقه في: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- جدول الملف الشخصي (مرتبط تلقائياً بحساب المستخدم في نظام تسجيل الدخول)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz default now(),
  games_played int default 0,
  games_won int default 0,
  top3_finishes int default 0,
  best_portfolio_value numeric default 100000,
  total_trades int default 0,
  avatar_url text
);

-- إذا كان الجدول موجوداً مسبقاً بدون عمود الصورة، شغّل هذا السطر لإضافته:
alter table profiles add column if not exists avatar_url text;

-- جدول الإنجازات المفتوحة لكل لاعب
create table if not exists player_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_key)
);

-- تفعيل أمان الصفوف (كل لاعب يشوف بياناته فقط)
alter table profiles enable row level security;
alter table player_achievements enable row level security;

create policy "users read own profile" on profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on profiles
  for update using (auth.uid() = id);
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "users read own achievements" on player_achievements
  for select using (auth.uid() = user_id);
-- ملاحظة: تعمداً ما أضفنا policy تسمح للاعب يضيف إنجازات لنفسه —
-- فقط السيرفر (عبر service_role key الذي يتجاوز RLS) يقدر يمنح الإنجازات، لمنع الغش.
