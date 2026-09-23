/**
 * The one connection that uses the server password, so that nothing after it
 * has to.
 *
 * It reads `SV_SSH_PASSWORD` from .env.ops, opens a single session, appends the
 * public key at `SV_SSH_KEY` to the server's authorized_keys if it is not
 * already there, and then proves key authentication works by opening a second
 * session with the key and no password at all.
 *
 * The password is never printed, never passed on a command line where it would
 * reach a process list, and never written anywhere. Delete `SV_SSH_PASSWORD`
 * from .env.ops once this has run.
 *
 *   node scripts/ops/ssh-install-key.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { Client } from "ssh2";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");

/** .env.ops, parsed without pulling in a dependency for it. */
function config() {
  const path = join(ROOT, ".env.ops");
  if (!existsSync(path)) throw new Error("no .env.ops - copy scripts/ops/env.example to it");
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const cfg = config();
const hostSpec = cfg.SV_SSH_HOST ?? "root@77.37.121.112";
const [user, host] = hostSpec.includes("@") ? hostSpec.split("@") : ["root", hostSpec];
const keyPath = (cfg.SV_SSH_KEY ?? "~/.ssh/softwarevala_ops").replace(/^~/, homedir());
const password = cfg.SV_SSH_PASSWORD ?? "";

if (!password) {
  console.error("SV_SSH_PASSWORD is not set in .env.ops, and key authentication is not working yet.");
  process.exit(2);
}

// Made here rather than expected to exist, so this is one step and not two.
if (!existsSync(`${keyPath}.pub`)) {
  console.log(`making a key at ${keyPath}`);
  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "softwarevala-ops", "-f", keyPath], {
    stdio: "inherit",
  });
}
const pub = readFileSync(`${keyPath}.pub`, "utf8").trim();

/** Run one command over one session and collect its output. */
function run(auth, command) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let out = "";
    client
      .on("ready", () => {
        client.exec(command, (err, stream) => {
          if (err) { client.end(); return reject(err); }
          stream
            .on("close", (code) => { client.end(); resolve({ code, out }); })
            .on("data", (d) => { out += d.toString(); })
            .stderr.on("data", (d) => { out += d.toString(); });
        });
      })
      .on("error", (err) => reject(err))
      .connect({ host, port: 22, username: user, readyTimeout: 20_000, ...auth });
  });
}

console.log(`connecting to ${user}@${host} with the password, once`);

// Appended through stdin-free shell quoting: the key is a single-quoted literal
// and contains no single quotes, so there is nothing to escape.
const install = [
  "umask 077",
  "mkdir -p ~/.ssh",
  "touch ~/.ssh/authorized_keys",
  `grep -qxF '${pub}' ~/.ssh/authorized_keys || echo '${pub}' >> ~/.ssh/authorized_keys`,
  "echo installed:$(grep -c . ~/.ssh/authorized_keys)",
].join(" && ");

try {
  const first = await run({ password }, install);
  console.log(`  ${first.out.trim()}`);
} catch (err) {
  console.error(`  password connection failed: ${err.message}`);
  process.exit(1);
}

console.log("checking the key works on its own, with no password");
try {
  const second = await run(
    { privateKey: readFileSync(keyPath) },
    'echo "connected as $(whoami) on $(hostname)"; node --version 2>/dev/null || echo "node: not on PATH"; pm2 --version 2>/dev/null | tail -1 || echo "pm2: not on PATH"',
  );
  console.log(second.out.trim().split("\n").map((l) => `  ${l}`).join("\n"));
  console.log("\nkey authentication works. Remove SV_SSH_PASSWORD from .env.ops now.");
} catch (err) {
  console.error(`  key connection failed: ${err.message}`);
  console.error("  Check the server allows public key authentication:");
  console.error("    grep -E 'PubkeyAuthentication|AuthorizedKeysFile' /etc/ssh/sshd_config");
  process.exit(1);
}
