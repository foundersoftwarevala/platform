alter table public.ai_content_items drop constraint if exists ai_content_items_publish_state_check;
alter table public.ai_content_items add constraint ai_content_items_publish_state_check check (publish_state in ('NONE','PARTIAL','COMPLETE','SKIPPED','FAILED'));
