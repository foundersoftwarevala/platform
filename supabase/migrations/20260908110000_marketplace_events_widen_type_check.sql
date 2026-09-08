-- marketplace_events only accepts four event types.
--
-- marketplace_events_event_type_check permits product_view, demo_click,
-- cta_click and search. Every other value is rejected with 23514 - verified by
-- probing each candidate against the live table one at a time.
--
-- That is narrower than the application has ever assumed. The tracking
-- endpoint's original list accepted twelve kinds, eight of which the database
-- refuses: demo_open, add_to_cart, checkout_start, purchase, order_paid,
-- download, review and notify_me. Each returned {"ok":true,"recorded":false}
-- with no reason, so a caller firing a purchase event was told the request had
-- succeeded while nothing was written.
--
-- Until this is applied, the endpoint maps every kind onto one of the four the
-- constraint allows and keeps the real kind in metadata.action, so nothing is
-- lost and everything stays countable. Once this runs, the endpoint can store
-- each kind under its own name and the mapping becomes unnecessary.
--
-- Not applied from the application: this project currently has no path to run
-- DDL. It is committed so the widened constraint exists wherever migrations do
-- get applied.

alter table public.marketplace_events
  drop constraint if exists marketplace_events_event_type_check;

alter table public.marketplace_events
  add constraint marketplace_events_event_type_check
  check (event_type in (
    'product_view', 'demo_click', 'demo_open', 'live_demo', 'cta_click',
    'buy_click', 'add_to_cart', 'checkout_start', 'purchase', 'order_paid',
    'download', 'brochure_download', 'review', 'notify_me',
    'wishlist_add', 'wishlist_remove',
    'search', 'search_result_click',
    'session_start', 'session_end',
    'contact_sales', 'callback_request', 'whatsapp_lead', 'meeting_request'
  ));
