-- The policy configuration the module cannot run without.
--
-- Privacy controls, access modes and settings are rules rather than data: they
-- describe what the system will and will not permit, and every screen reads
-- them to decide what to offer. They are seeded exactly as the source defines
-- them, including which controls are critical and which settings are locked.
--
-- Nothing else is. The source also seeds an agent, an end user, a live session,
-- a chat message, a file transfer, an approval, an AI suggestion and an
-- emergency stop. Section 27 forbids fake sessions, and of all the fabricated
-- data in this series a fake remote-control session is the worst thing to leave
-- in a console: it reads as somebody's screen having actually been watched, by
-- a named agent, for a stated reason. The screens will show honest empty states
-- until a real session exists.

insert into public.assist_privacy_controls (control_key,label,description,icon,enabled,is_critical,sort_order) values
  ('no_screenshot','No Screenshot','Block all screenshot attempts','camera',true,true,1),
  ('no_recording','No Screen Recording','Prevent any screen recording','video',true,true,2),
  ('no_clipboard','No Clipboard Copy','Block clipboard access','clipboard',true,true,3),
  ('no_persistence','No File Persistence','Auto-delete all transferred files','file-x',true,true,4),
  ('no_background','No Background Access','Block background process visibility','eye',true,true,5),
  ('mask_sensitive','Mask Sensitive Fields','Auto-blur password and sensitive inputs','lock',true,true,6),
  ('auto_blur','Auto Blur Password Areas','Detect and blur password fields','lock',true,false,7)
on conflict (control_key) do nothing;

insert into public.assist_access_modes (mode_key,label,description,icon,is_active,sort_order) values
  ('app_only','App Only','Access restricted to specific application','app-window',true,1),
  ('browser_only','Browser Only','Access limited to browser window','globe',false,2),
  ('single_window','Single Window','Only one window visible at a time','layers',true,3),
  ('no_background','No Background','Background processes hidden','eye-off',true,4)
on conflict (mode_key) do nothing;

insert into public.assist_settings (section,setting_key,label,control_type,value,sort_order,is_locked) values
  ('Session Defaults','default_duration','Default Session Duration','select','30',1,false),
  ('Session Defaults','max_duration','Maximum Session Duration','select','120',2,false),
  ('Session Defaults','auto_timeout','Auto Timeout (minutes)','number','15',3,false),
  ('Session Defaults','require_consent','Require User Consent','toggle','true',4,true),
  ('Privacy & Security','no_screenshot','Block Screenshots','toggle','true',1,true),
  ('Privacy & Security','no_recording','Block Recording','toggle','true',2,true),
  ('Privacy & Security','mask_sensitive','Mask Sensitive Data','toggle','true',3,true),
  ('Privacy & Security','auto_delete','Auto Delete Files','toggle','true',4,true),
  ('AI Configuration','ai_enabled','Enable AI Assist','toggle','true',1,false),
  ('AI Configuration','ai_translate','Auto Translate','toggle','true',2,false),
  ('AI Configuration','ai_summarize','Auto Summarize','toggle','true',3,false),
  ('AI Configuration','ai_risk','Risk Detection','toggle','true',4,false),
  ('Notifications','notify_new','New Request Alert','toggle','true',1,false),
  ('Notifications','notify_end','Session End Alert','toggle','true',2,false),
  ('Notifications','notify_security','Security Alert','toggle','true',3,false),
  ('Notifications','notify_ai','AI Suggestion Alert','toggle','false',4,false)
on conflict (setting_key) do nothing;
