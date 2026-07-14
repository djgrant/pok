# pok trust-broker protocol

This is the contract between `pokd` and an approver frontend – a separate
process that shows each secret-access request to a human and returns their
decision. The macOS Touch ID app is one such frontend; any process that speaks
this protocol can take the role.

`pokd` owns and versions this spec. A frontend implements it. The two ship
independently, so treat this document as the boundary between them.

## Transport

Messages are NDJSON: one JSON object per line, `\n`-terminated, over the pokd
unix socket. The socket path is `$POK_BROKER_SOCKET`, defaulting to
`~/.pok/pokd.sock` (mode 0600).

Every message carries `v` (protocol major version, currently `1`) and a `type`.
A frontend that receives a message with an unfamiliar `type` should ignore that
line rather than close the connection.

## Versions

The wire format is additive. A field introduced at a minor version is optional;
a frontend that ignores it still interoperates.

| Version | Adds |
|---|---|
| v1 | The request/response core. |
| v1.1 | The frontend role: `frontend.register`, `frontend.registered`, `frontend.replaced`, `approval.forward`, `approval.result`. |
| v1.2 | `access` on a request; `grant` on a result. |

## The frontend role (v1.1)

Only one frontend is registered at a time. It is then the preferred approver:
pokd forwards each request to it before falling back to its own local approver
chain (Touch ID helper, `osascript`, stdin).

### Registration

The frontend opens the socket and sends:

```json
{ "v": 1, "type": "frontend.register", "name": "pok-trust" }
```

`name` is a short identifier for the audit log; the decision is recorded as
`frontend:<name>`.

pokd replies:

```json
{ "v": 1, "type": "frontend.registered" }
```

If another frontend registers later, it replaces this one. The displaced
connection receives `{ "v": 1, "type": "frontend.replaced" }` and is then
closed by pokd. A frontend that sees `frontend.replaced` should stop retrying –
a second frontend has taken over – and offer the human a way to reclaim the
role.

### A single approval

pokd forwards a pending request:

```json
{
  "v": 1,
  "type": "approval.forward",
  "id": "01J...",
  "reason": "secret access requested",
  "request": {
    "repo": "djgrant/pok",
    "command": "pok run deploy",
    "task": "deploy",
    "keys": ["STRIPE_SECRET_KEY"],
    "context": {},
    "initiator": "agent",
    "access": "read"
  }
}
```

`id` keys the exchange. `initiator` is `"human"` or `"agent"`. `access` is
`"read"` or `"write"` and is absent on pre-v1.2 requests, where it means
`"read"`.

The frontend shows this to the human and returns their decision under the same
`id`:

```json
{ "v": 1, "type": "approval.result", "id": "01J...", "decision": "allow" }
```

`decision` is `"allow"` or `"deny"`. `reason` is optional free text for the
audit log.

pokd validates each result and drops – with one log line, without closing the
connection – any that fails:

```jsonc
{ "v": 2, "type": "approval.result", "id": "01J..." }   // wrong v: ignored
{ "v": 1, "type": "approval.result", "decision": "allow" } // no id: ignored
{ "v": 1, "type": "approval.result", "id": "01J...", "decision": "maybe" } // ignored
```

### Standing grants (v1.2)

A frontend may attach a grant to an allow, meaning "allow this and equivalent
requests for a while":

```json
{
  "v": 1,
  "type": "approval.result",
  "id": "01J...",
  "decision": "allow",
  "grant": { "ttlSeconds": 900 }
}
```

`ttlSeconds` must be a positive number no greater than `86400` (24 hours). pokd
honours a grant on an allow only. An out-of-range or malformed grant is dropped
with one log line, and the allow itself still stands.

## Timeouts and fallback

pokd waits about 110 seconds for a result – inside the client's own 120-second
budget, so the daemon settles the request rather than the client timing out
first. If the frontend has not answered by then, pokd records a deny with reason
`approval timed out`.

If the frontend disconnects while a forward is outstanding, that request falls
back to pokd's local approver chain. A frontend that cannot reach pokd should
reconnect with backoff; the reference app uses 1 s rising to 30 s.

## Failing closed

The broker denies on anything it cannot positively approve: a malformed message,
an unreachable approver, an expired timeout. A frontend should hold the same
line – when in doubt, deny.
