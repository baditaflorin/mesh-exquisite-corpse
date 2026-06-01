# mesh-exquisite-corpse

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-exquisite-corpse-14b8a6)](https://baditaflorin.github.io/mesh-exquisite-corpse/)
[![version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/baditaflorin/mesh-exquisite-corpse/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> The party drawing game, peer-to-peer: three people each draw head, body, or legs blind — reveal stitches them into one surreal creature.

Live: **https://baditaflorin.github.io/mesh-exquisite-corpse/**

Source: **https://github.com/baditaflorin/mesh-exquisite-corpse**

Tip the dev: **https://www.paypal.com/paypalme/florinbadita**

---

## What it is

The classic surrealist parlour game **exquisite corpse**, in your browser. Three players each claim one strip — **head**, **body**, or **legs** — and draw it without seeing the others' work. When all three mark "done", anyone can hit **reveal** and the three strips composite into one absurd creature on every peer's screen at once. Hit **new round** to clear and play again.

**Try it:** open the live link in **three browser tabs** (they auto-join the same room). Claim a different part in each tab, scribble something, mark each one done, then reveal — the assembled corpse appears in all three.

No backend of its own beyond the self-hosted WebRTC stack listed below. Built on `@baditaflorin/mesh-common`, hosted on GitHub Pages from `docs/`.

## Quickstart (local)

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-exquisite-corpse
cd mesh-exquisite-corpse
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides (localStorage keys)

The settings drawer lets the user override signaling and TURN endpoints. Keys:

- `mesh-exquisite-corpse:signalingUrl`
- `mesh-exquisite-corpse:turnTokenUrl`
- `mesh-exquisite-corpse:iceServers`
- `mesh-exquisite-corpse:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is **no GitHub Actions build workflow**; the Husky pre-commit + pre-push hooks gate formatting / typecheck / smoke build locally.

```bash
npm run smoke   # build + sanity-check docs/
```

## Privacy

See `docs/privacy.md` for the threat model — what other peers in the mesh see, what the self-hosted infra sees, what stays local.

## License

MIT — see `LICENSE`.
