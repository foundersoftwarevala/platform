-- The brief's six review states against the four the table allowed. 'removed'
-- is kept so nothing existing breaks; hidden, reported and archived are added
-- because the moderation flow needs somewhere to put a review that is neither
-- published nor rejected.
alter table public.marketplace_reviews
  drop constraint if exists marketplace_reviews_status_check;
alter table public.marketplace_reviews
  add constraint marketplace_reviews_status_check
  check (status in ('pending','published','rejected','removed',
                    'reported','hidden','archived'));
