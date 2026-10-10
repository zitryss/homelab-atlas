# Verification

Executed 2026-10-10 on MiniPC. All checks below completed against the actual local application.

- `npm test`: **12 passed, 0 failed**. Graph identifiers and containment, failure cascades, DNS/controller independence, WAN/local compute separation, unknown-fault rejection, static-server path/method restrictions.
- `npm run check`: JS syntax checks passed.
- `npm run test:browser`: **13 passed** in Chromium through CDP port 9223. Actual click and keyboard paths, node/cable inspector, safe external-link attributes, device fail/restore, preset replacement, service/IP search and empty state, Escape, VLAN filtering, drag/wheel/button/keyboard camera controls, touch pinch, fit/reset, reduced-motion flow toggle, desktop/mobile layout and no unsolicited external requests.
- Browser viewport coverage: 1600×1100, 390×844 and 320×740. No horizontal overflow at narrow widths. Mobile overview intentionally requires zoom/search to read individual nodes; the inspector sits below the map.
- No browser page/console errors in the acceptance run.
- `npm audit`: zero reported vulnerabilities at verification time.
- Screenshot review: `artifacts/desktop.png`, `artifacts/mobile.png`, `artifacts/failure.png` (local, ignored).
- Read-only topology/model review found no material issues. Parent separately checked the relevant live infrastructure; see [Sources](SOURCES.md).
- App server returned HTTP 200; `.git/config` and `docs/SOURCES.md` returned 404. Server defaults to loopback, accepts GET/HEAD only, and prevents background connections through CSP.

## Limits

This is a static architecture explorer, not telemetry or a firewall packet simulator. No appliance management link was clicked during tests. No power, HA automation, failover, cable disconnection, restoration, or physical failure was performed. Not tested on physical iOS/Safari hardware; touch coverage used Chromium touch input emulation. No remote GitHub repository or production hosting was created.
