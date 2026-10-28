# AYRA Local PC Bridge

This opt-in agent runs on the PC that owns the workspace. It binds only to
`127.0.0.1:50001`; it does not expose a LAN listener or connect to a VPS relay.
The browser UI requires a manually paired token. The token is not stored by the
website.

## Security limits

- Exact browser origins are allowlisted (`softwarevala.net` and local dev).
- A random pairing token between 32 and 256 bytes is required on every run.
- Requests are limited to 30 actions per minute and 16 KiB per WebSocket frame.
- `open_vscode` and `read_file` are confined to `AYRA_WORKSPACE`.
- Reads are limited to small, source-like text files; environment files, private
  key folders, credential paths, binaries, and files over 64 KiB are rejected.
- `run_command` is **not** an arbitrary shell. Only read-only `git_status` and
  `git_recent` are accepted; all other command names are rejected.
- The bridge has no file-write, delete, network, deployment, or privilege-elevation
  action. Never remove these limits to expose a general command runner.

## Install and pair

Install a current Node.js LTS, then in this folder run:

```sh
npm install
```

Generate a pairing token and set the workspace. On PowerShell:

```powershell
$env:AYRA_BRIDGE_TOKEN = (node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
$env:AYRA_WORKSPACE = 'C:\path\to\softwarevala'
npm start
```

On macOS/Linux:

```sh
export AYRA_BRIDGE_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
export AYRA_WORKSPACE="$HOME/path/to/softwarevala"
npm start
```

The agent prints its loopback listener and configured workspace. Keep the token
private; paste it into the AYRA Local PC panel only on the trusted
`https://softwarevala.net` site. Close the terminal to stop the bridge. The
service is not installed as a background task and does not auto-start.

`AYRA_VSCODE_COMMAND` may be set to an explicit VS Code executable path if the
`code` command is unavailable. The executable is launched without a shell.

## Tests

```sh
npm test
```
