# Development

```sh
npm start
```

Open **http://127.0.0.1:4173** on this machine. Node.js 22+ is required; the app and server have no runtime dependencies or build step. Serve it over HTTP rather than opening `index.html` directly (native ES modules).

From another computer, use an SSH tunnel to MiniPC, or deliberately bind to its LAN address:

```sh
HOST=192.168.20.32 npm start
```

The server binds to loopback by default and has **no authentication**. Do not expose it to the public Internet: its topology and management URLs are private. It serves only application files, never `.git`, source notes or test artifacts. No telemetry, external fonts, analytics or background appliance requests.

## Explore

- Drag to pan; scroll/pinch or use zoom controls. **Fit** returns to the whole map.
- Search by device, IP or service; filter by VLAN.
- Select a device/cable for role, links, hosting, provenance and management access.
- Simulate a device failure or choose a preset; reset to the documented baseline.
- Solid network links, dashed hosting/backup paths and their legends distinguish physical paths from dependencies. Animated flows are decorative, not measurements.

The map preserves the important distinctions: **Protectli hosts the router, net and HA**; **node304 hosts Unraid/app/exp**; **PBS runs inside Unraid**. The PVE hosts are standalone. User/IoT DNS and independent Guest DNS are documented in the inspector.

## Maintain

- `data.js` — curated nodes, cable paths, VLANs and scenarios.
- `model.js` — qualitative failure effects; no generic reachability claims.
- `app.js`, `style.css` — interaction and appearance.
- [Sources](SOURCES.md) — verification dates, uncertainties and modeling limits.
- [Verification](VERIFICATION.md) — executed acceptance checks.

Keep passwords, tokens, raw appliance dumps and private keys out of this repository. Reconcile changes against the private Home-Lab notes and read-only device evidence before editing the model.

## Test

```sh
npm ci
npm test
npm run check
```

Browser acceptance tests use Playwright against an already-running local app and Chromium CDP at `http://127.0.0.1:9223` (override `CDP_URL` / `BASE_URL` as needed):

```sh
npm run test:browser
```

Repository: https://github.com/zitryss/homelab-atlas. No public application deployment is configured.
