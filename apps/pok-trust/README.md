# pok Trust

Minimal macOS menu bar app that acts as the approver frontend for the
[pokd](../../packages/pokd) trust-broker daemon. It registers on the pokd unix
socket (`POK_BROKER_SOCKET`, default `~/.pok/pokd.sock`) as the preferred
approver; each forwarded secret-access request is shown in a floating,
non-activating panel with the command, repo, environment, keys, and initiator.
Approving requires Touch ID (falling back to the device password); denying,
cancelling auth, or ignoring the panel for 100 seconds sends a deny.

## Build

```sh
./build.sh
```

Compiles with Swift Package Manager (`swift build -c release`, macOS 13+, no
dependencies), assembles `dist/Pok Trust.app`, and codesigns it ad-hoc. The
bundle matters: LocalAuthentication evaluates biometry against the signed
bundle, so Touch ID falls back to a password prompt when biometry can't be
evaluated (e.g. running the bare binary, or an unsigned/modified bundle).

## Run

```sh
open "dist/Pok Trust.app"
```

A shield icon appears in the menu bar (filled while a request is pending). The
menu shows the pokd connection status, a "Launch at Login" toggle (via
`SMAppService.mainApp` — macOS may ask you to approve the login item in System
Settings), and Quit.

## Protocol

Speaks NDJSON over the pokd unix socket per the trust-broker protocol
(v1 + v1.1 frontend addendum): `frontend.register` →
`frontend.registered`/`frontend.replaced`, then `approval.forward` /
`approval.result` messages keyed by request id. If pokd is not running, the
app retries with backoff (1s–30s). If another frontend replaces this one, the
app stops retrying and offers a "Reconnect" menu item.
