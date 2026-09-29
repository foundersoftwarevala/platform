-- One commit of a batch at a time, and a crashed one still finishable.
--
-- Two operators pressing Commit on the same batch, or one pressing it twice,
-- both read the batch as ready and both start taking its addresses in. The rows
-- themselves survive that - the second run finds them already there and reports
-- them as held rather than writing them twice - but the batch's own record would
-- be written by whichever finished last, and each caller would be told a story
-- about work the other did.
--
-- So a commit claims the batch: the move to PROCESSING is a conditional update
-- that only one caller can win. The claim is stamped, because a commit whose
-- process died must not leave the batch claimed for ever - after ten minutes,
-- which is many times the longest a batch of five hundred has taken, it can be
-- claimed again and finished.

alter table public.demo_intake_batches
  add column if not exists claimed_at timestamptz;

comment on column public.demo_intake_batches.claimed_at is
  'When a commit claimed this batch. A PROCESSING batch whose claim is older than ten minutes is treated as abandoned and may be claimed again.';
