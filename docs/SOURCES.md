# Topology evidence & scope

Curated on **2026-10-10**. This is a documented architecture map, **not live monitoring**. Node badges, pulses and failure effects are simulated. No runtime network/device APIs are used.

## Sources

Private source notes in `~/Documents/Obsidian/Home-Lab/`:
- **Host Inventory.md** — IP assignments, VM identities, endpoint groups (reconciled 2026-09-21).
- **Physical Wiring.md** — cable/port maps. Physical inventory supplied by Eugene 2026-06-03; cross-layer review 2026-09-21. Historical switch MAC tables do not prove current cable presence.
- **Network Architecture.md** — VLANs, resolver chain, OPNsense bridges, distinct VPN networks.
- **Management Access Map.md** — core direct IP/port links only. Older Hermes host and VPN-subnet descriptions there are superseded by newer topology evidence.

Only curated non-secret facts were transferred. Source documents themselves are deliberately NOT copied: some contain credentials.

## Read-only checks performed 2026-10-10

- Protectli `sudo -n qm list`: VM 111 OPNsense, 112 net and 313 HA running; template 999 stopped.
- node304 `sudo -n qm list`: VM 222 Unraid, 223 app and 299 exp running; template 999 stopped.
- Both hosts `/etc/network/interfaces`: Protectli vmbr1 physical members, internal-only vmbr20/vmbr30; node304 separate Management and User bridges.
- Unraid `virsh list --all`: nested `pbs` running.
- Unraid `/sys/class/net/eth0/speed` / `eth1/speed`: **2500 / 100 Mbps**. No diagnosis of the latter was attempted.
- `docker ps --format '{{.Names}}'` on net/app/Unraid: confirmed the service families included in cards. This is a point-in-time process listing, not functional service-health proof.
- Local `ip -brief address`: Hermes host MiniPC `enp1s0` at `192.168.20.32/24`. Older Mac-as-Hermes labels are superseded.

No appliance changes, restarts, physical control, credentials export, traffic injection, or public publishing performed. Switch-port state and every wireless association were not rechecked today.

## Deliberate simplifications

- Two standalone Proxmox hosts; no cluster, quorum, CARP, shared live storage or automatic failover.
- `node304` is the physical hypervisor; Unraid is VM 222; PBS is nested inside Unraid with a VirtioFS datastore. Local backups share this failure domain.
- One LACP edge denotes **two** 10G members, not a 20G per-flow path. Individual member failures and LACP negotiation are not simulated.
- Logical hosting/backup/VPN connections are distinct from cables. The app edge represents Enterprise → node304 vmbr20 → app/exp, not a physical app VM port.
- Wireless cards are grouped inventories, not online client counts. MAC addresses and Wi-Fi passwords are omitted. Reserved/offline Pi and uncertain MacBook Ethernet paths are described rather than drawn as active cables.
- Current Mac `.20.98` remains wireless; `.10.98` wired path is intentionally disconnected. MiniPC runs Hermes.
- Guest uses Cloudflare DNS; User/IoT use Pi-hole → Unbound → Dnsmasq for local names, Cloudflare DoT for public names.
- OPNsense home VPN `10.10.10.0/24` is separate from Neptune `10.7.0.0/24`. No site-to-site link inferred.
- UPS/generator/power redundancy is not documented here and therefore is not invented.
- Failure simulation propagates hard VM containment separately from connectivity. A connectivity-affected guest need not be stopped. Controller failure does not turn off switches/AP. DNS caching, firewall rules, convergence, restoration timing, backup-hook side effects and individual application dependencies are not exhaustively simulated.

## Inspiration and provenance

- [Leox1024/homelab-docs](https://github.com/Leox1024/homelab-docs)
- [Original interactive map](https://docs.leox.me/)
- [Original Reddit discussion](https://www.reddit.com/r/homelab/comments/1x28wt5/interactive_diagram/), read through its public feed. OP explicitly describes some of the displayed redundancy as a future target, not already installed hardware. This map instead uses Eugene’s documented existing topology.
- Inspected upstream commit: `03b3ec88d004c4ab6654936845efbd044cc465a0`.

Upstream root contained no license at inspection. This project independently implements the interaction idea; upstream code and graphic assets are not vendored or copied. It is not a fork and does not inherit upstream deployment settings or domain.
