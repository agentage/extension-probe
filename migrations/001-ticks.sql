-- migrations/001-ticks.sql: applied in order by the api image's `migrate` entry, as a job before the rollout
create table if not exists ticks (
  id         bigint generated always as identity primary key,
  job        text        not null,
  ticked_at  timestamptz not null default now()
);
