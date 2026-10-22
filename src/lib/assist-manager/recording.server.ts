import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { withTaskTransaction } from "@/lib/tasks/db.server";

const MAX_RECORDING_BYTES = 128 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function* readBody(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export class AssistRecordingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AssistRecordingError";
  }
}

export async function storeAssistRecording(
  body: ReadableStream<Uint8Array>,
  sessionId: string,
  actorId: string,
): Promise<{ sizeBytes: number; sha256: string }> {
  if (!UUID.test(sessionId) || !UUID.test(actorId)) {
    throw new AssistRecordingError("Invalid session or account.", 400);
  }

  const recordingRoot = resolve(process.env.ASSIST_RECORDING_DIR ?? "/var/lib/softwarevala/assist-recordings");
  await mkdir(recordingRoot, { recursive: true, mode: 0o700 });

  const filename = `${randomUUID()}.webm`;
  const filePath = join(recordingRoot, filename);
  const checksum = createHash("sha256");
  let sizeBytes = 0;
  let fileCreated = false;

  try {
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.byteLength;
        if (sizeBytes > MAX_RECORDING_BYTES) {
          callback(new AssistRecordingError("Recording exceeds the 128 MB limit.", 413));
          return;
        }
        checksum.update(chunk);
        callback(null, chunk);
      },
    });
    const output = createWriteStream(filePath, { flags: "wx", mode: 0o600 });
    output.once("open", () => {
      fileCreated = true;
    });
    await pipeline(Readable.from(readBody(body)), limiter, output);
    if (sizeBytes === 0) throw new AssistRecordingError("Recording body is empty.", 400);
    const sha256 = checksum.digest("hex");

    await withTaskTransaction(actorId, async (tx) => {
      const sessions = await tx<{
        id: string;
        session_code: string;
        status: string;
        consent_hash: string | null;
        consent_by: string | null;
        consent_revoked_at: string | null;
        target_user_id: string | null;
      }[]>`
        select id, session_code, status, consent_hash, consent_by,
               consent_revoked_at, target_user_id
          from public.assist_sessions
         where id = ${sessionId}::uuid
         for update
      `;
      const session = sessions[0];
      if (
        !session ||
        session.target_user_id !== actorId ||
        !["active", "paused", "completed", "terminated"].includes(session.status) ||
        !session.consent_hash ||
        session.consent_by !== actorId ||
        session.consent_revoked_at
      ) {
        throw new AssistRecordingError("Recording is not authorized for this account and session.", 403);
      }
      const updated = await tx<{ id: string }[]>`
        update public.assist_sessions
           set recording_url = ${filename}, recording_sha256 = ${sha256}
         where id = ${sessionId}::uuid and recording_url is null
         returning id
      `;
      if (!updated.length) {
        throw new AssistRecordingError("A recording is already attached to this session.", 409);
      }
      const details = JSON.stringify({ sha256, size_bytes: sizeBytes, storage_key: filename });
      await tx`
        insert into public.assist_logs (session_id, actor_user_id, action, details)
        values (${sessionId}::uuid, ${actorId}::uuid, 'recording.persisted', ${details}::jsonb)
      `;
      await tx`
        insert into public.assist_audit_logs (
          session_id, session_code, actor, actor_user_id, actor_role, action,
          target, target_user_id, new_state, severity, result
        ) values (
          ${sessionId}::uuid, ${session.session_code}, ${actorId}, ${actorId}::uuid,
          'target', 'recording.persisted', 'masked_webm_recording', ${actorId}::uuid,
          ${details}::jsonb, 'info', 'success'
        )
      `;
      await tx`
        insert into public.audit_logs (
          actor_id, actor, action, entity_type, entity_id, severity, after_state, metadata
        ) values (
          ${actorId}::uuid, ${actorId}, 'assist.recording.persisted',
          'assist_sessions', ${sessionId}, 'info', ${details}::jsonb, ${details}::jsonb
        )
      `;
    });

    return { sizeBytes, sha256 };
  } catch (error) {
    if (fileCreated) {
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        console.error("[assist-recording] failed to remove uncommitted recording", {
          filePath,
          cleanupError,
        });
      }
    }
    if (error instanceof AssistRecordingError) throw error;
    throw new Error("The Assist recording could not be stored.", { cause: error });
  }
}
