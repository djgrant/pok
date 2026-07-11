# @pokit/pokd

The pok trust-broker daemon. `pokd` listens on a unix socket and asks a human to approve secret access before pok tasks resolve environment variables. Every request and decision is appended to an audit log.

## Usage

Run the daemon in the foreground:

```sh
bunx pokd
# or, when installed globally:
pokd
```

On boot it prints the socket path, audit log path, and approver mode. Stop it with Ctrl-C (the socket is removed on shutdown).

- Socket: `$POK_BROKER_SOCKET`, defaulting to `~/.pok/pokd.sock` (mode 0600)
- Audit log: append-only JSONL at `~/.pok/audit.log` — `{ ts, request, decision, reason, approver }`

pok clients engage the broker automatically when the socket exists (set `POK_BROKER=0` to opt out).

## Approval chain

On macOS:

1. **Touch ID** — a small Swift helper (`~/.pok/bin/pok-approve`, compiled on demand with `swiftc` from the bundled `swift/approve.swift`) prompts via LocalAuthentication, falling back to device-owner auth if biometrics are unavailable.
2. **Dialog** — if `swiftc` is unavailable or compilation fails, an `osascript` dialog with Deny/Allow buttons (Deny is the default).
3. **Deny** — if neither approver can run, the request is denied.

On other platforms, `pokd` asks `Allow? [y/N]` on its own stdin.

A denial (or any malformed request) responds with `decision: "deny"` — the broker fails closed.
