-- ============ PROFILES: chat identity fields ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS presence text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET handle = COALESCE(handle, username, 'user-' || substr(id::text, 1, 8)),
    display_name = COALESCE(display_name, full_name, username, 'Member')
WHERE handle IS NULL OR display_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON public.profiles (handle);

-- ============ ROLE PERMISSIONS ============
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role permissions readable" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;

INSERT INTO public.role_permissions (role, permission)
SELECT r, p FROM (VALUES
  ('admin'::public.app_role),('boss'),('founder'),('developer'),('employee'),('support'),
  ('sales'),('marketing'),('finance'),('vendor'),('author'),('affiliate'),('influencer'),
  ('reseller'),('franchise'),('seo'),('customer'),('marketplace-user')
) AS roles(r)
CROSS JOIN (VALUES ('message.send'),('message.react'),('attachment.upload'),('conversation.create')) AS perms(p)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT r, p FROM (VALUES ('admin'::public.app_role),('boss'),('founder'),('support')) AS roles(r)
CROSS JOIN (VALUES ('chat.manage'),('chat.moderate'),('chat.assign'),('chat.export')) AS perms(p)
ON CONFLICT DO NOTHING;

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT 'New conversation',
  kind text NOT NULL DEFAULT 'direct',
  reference_code text,
  department text,
  category text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  ai_enabled boolean NOT NULL DEFAULT false,
  assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_label text,
  favorite boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_participant(id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));
CREATE POLICY "create own conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_permission(auth.uid(), 'conversation.create'));
CREATE POLICY "participants update conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_participant(id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'))
  WITH CHECK (public.is_participant(id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read participants" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));
CREATE POLICY "add participants" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_participant(conversation_id, auth.uid())
    OR public.has_permission(auth.uid(), 'chat.assign')
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "update own membership" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'chat.assign'))
  WITH CHECK (user_id = auth.uid() OR public.has_permission(auth.uid(), 'chat.assign'));
CREATE POLICY "leave conversation" ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'chat.assign'));

-- ============ MESSAGES (immutable) ============
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  client_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));
CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_participant(conversation_id, auth.uid())
              AND public.has_permission(auth.uid(), 'message.send'));

CREATE OR REPLACE FUNCTION public.block_message_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Messages are immutable';
END; $$;
DROP TRIGGER IF EXISTS messages_no_update ON public.messages;
CREATE TRIGGER messages_no_update BEFORE UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.block_message_mutation();

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- ============ MESSAGE SIDE TABLES ============
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  media_kind text NOT NULL DEFAULT 'file',
  duration_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read attachments" ON public.message_attachments FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));
CREATE POLICY "participants add attachments" ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_participant(conversation_id, auth.uid()) AND public.has_permission(auth.uid(), 'attachment.upload'));

CREATE TABLE IF NOT EXISTS public.message_mentions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT ON public.message_mentions TO authenticated;
GRANT ALL ON public.message_mentions TO service_role;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read mentions" ON public.message_mentions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid())));
CREATE POLICY "participants add mentions" ON public.message_mentions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read reactions" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid())));
CREATE POLICY "participants add own reactions" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid())));
CREATE POLICY "remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_receipts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.message_receipts TO authenticated;
GRANT ALL ON public.message_receipts TO service_role;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read receipts" ON public.message_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid())));
CREATE POLICY "own receipts insert" ON public.message_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid())));
CREATE POLICY "own receipts update" ON public.message_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_bookmarks (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_bookmarks TO authenticated;
GRANT ALL ON public.message_bookmarks TO service_role;
ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.message_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ AI HANDOFF ============
CREATE TABLE IF NOT EXISTS public.chat_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.chat_handoffs TO authenticated;
GRANT ALL ON public.chat_handoffs TO service_role;
ALTER TABLE public.chat_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or managed handoffs" ON public.chat_handoffs FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_participant(conversation_id, auth.uid()) OR public.has_permission(auth.uid(), 'chat.manage'));
CREATE POLICY "request handoff" ON public.chat_handoffs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "resolve handoff" ON public.chat_handoffs FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'chat.assign'))
  WITH CHECK (public.has_permission(auth.uid(), 'chat.assign'));

-- ============ REALTIME ============
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============ PROFILE AUTO-CREATE (extend existing) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base_handle text;
BEGIN
  base_handle := COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.raw_user_meta_data ->> 'handle',
                          NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'user-' || substr(NEW.id::text, 1, 8));
  INSERT INTO public.profiles (id, email, full_name, username, phone, handle, display_name, job_title)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', base_handle, NEW.phone,
          base_handle, COALESCE(NEW.raw_user_meta_data ->> 'full_name', base_handle),
          NEW.raw_user_meta_data ->> 'job_title')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'customer'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;