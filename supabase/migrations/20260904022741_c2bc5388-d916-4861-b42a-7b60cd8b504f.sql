-- Chat attachment access: first folder in the path is the conversation id.
CREATE POLICY "chat files readable by conversation participants"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-files'
  AND public.is_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "chat files uploadable by conversation participants"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND public.is_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "chat files removable by uploader"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-files' AND owner = auth.uid());

-- Avatars: readable by signed-in members, writable only inside the owner's folder.
CREATE POLICY "avatars readable by members"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars writable by owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars updatable by owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars deletable by owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);