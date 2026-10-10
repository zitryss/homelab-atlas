// Curated, credential-free topology. See docs/SOURCES.md for evidence and limits.
export const meta = {
  title: 'Homelab Atlas', subtitle: 'zitryss.dev · Berlin', reviewed: '2026-10-10',
  disclaimer: 'Documented topology, not live monitoring. Flows and failures are illustrative; no device commands are sent.'
};
export const zones = [
  {id:'mgmt',label:'Management · VLAN 1',subnet:'192.168.10.0/24',color:'#a9b7d4',description:'Native LAN. Gateway / DNS: 192.168.10.11. Infrastructure administration.'},
  {id:'user',label:'User · VLAN 20',subnet:'192.168.20.0/24',color:'#67b7ff',description:'Gateway .20.1; Pi-hole DNS .10.12. Personal devices, NAS and app workloads.'},
  {id:'iot',label:'IoT · VLAN 30',subnet:'192.168.30.0/24',color:'#66ddba',description:'Gateway .30.1; Pi-hole DNS .10.12. Home Assistant and IoT endpoints.'},
  {id:'guest',label:'Guest · VLAN 40',subnet:'192.168.40.0/24',color:'#d8a2ff',description:'Gateway .40.1; Cloudflare public DNS. Isolated from other VLANs.'},
  {id:'external',label:'External',subnet:'Internet / VPN',color:'#e9b873',description:'Single WAN and two separate WireGuard networks. No implied site-to-site tunnel.'}
];
const docs = 'Host Inventory / Network Architecture / Physical Wiring; reconciled 2026-09-21';
const live = 'Read-only SSH check 2026-10-10; see docs/SOURCES.md';
function n(id,label,kind,subtitle,zone,x,y,extra={}) {
  return {id,label,kind,subtitle,zone,x,y,w:240,h:128,services:[],details:[],source:docs,...extra};
}
export const nodes = [
  n('internet','Internet / ISP','wan','Single uplink · PPPoE','external',40,60,{details:['ISP modem/ONT → Protectli Eth 2 → OPNsense igc0 / VLAN 7 / pppoe0.','No second WAN or automatic router failover is documented.']}),
  n('opnsense','OPNsense','firewall','VM 111 · routing & firewall','multi',370,60,{ip:'192.168.10.11',parent:'protectli',url:'https://192.168.10.11/',services:['Routing & firewall','Dnsmasq DHCP / local records','Unbound DNS / Cloudflare DoT','WireGuard 10.10.10.1/24'],details:['Gateways: Management .10.11 · User .20.1 · IoT .30.1 · Guest .40.1.','USER: vlan020 + vtnet1 → bridge1. IoT: vlan030 + vtnet2 → bridge0.','The router bridges internal VM-only networks onto the physical SFP+ VLAN trunk.','Single router VM, not CARP/HA.'],source:live}),
  n('vpn','Home VPN','vpn','Road-warrior access','external',910,60,{ip:'10.10.10.1/24',details:['OPNsense WireGuard: ddns.zitryss.dev:51820.','MacBook .2, iPhone .3 and Android .4 on 10.10.10.0/24.','Access remains subject to firewall policy. External/mobile traversal is not asserted verified.']}),
  n('neptune','Neptune','cloud','Linode · separate WireGuard','external',1260,60,{ip:'139.162.206.249',services:['WireGuard 10.7.0.1/24'],details:['Independent public host; not the OPNsense home VPN endpoint.','No home-to-Neptune site-to-site tunnel is inferred.']}),
  n('protectli','Protectli VP6650','server','Standalone Proxmox VE','mgmt',40,260,{ip:'192.168.10.10',url:'https://192.168.10.10:8006/',services:['OPNsense · VM 111','net · VM 112','Home Assistant · VM 313'],details:['Two X710 SFP+ functions and Eth 2 passed through to OPNsense.','vmbr1: enp3s0 + enp5s0 + enp6s0. vmbr20/vmbr30 have no physical bridge ports.','Eth 3 → Mac reserved management cable is intentionally disconnected.','Standalone host, no cluster quorum or automatic VM migration.'],source:live}),
  n('enterprise','Enterprise 8 PoE','switch','Core switch · dual SFP+','multi',600,260,{ip:'192.168.10.1',url:'https://192.168.10.12:8443/',services:['VLANs 1 / 20 / 30 / 40','U6 Enterprise PoE+'],details:['SFP+ 1/2 ↔ Protectli SFP+ 1/2: 2 × 10 GbE LACP. One flow generally uses one member.','Eth 1 Management; Eth 2 AP; Eth 3 Flex; Eth 4 Unraid; Eth 5 node304 User bridge; Eth 6 Apple TV; Eth 7 MiniPC.','Eth 8 was link-down at last documented review; no present MacBook cable is assumed.']}),
  n('flex','Flex XG','switch','Downstream switch · USB-C power','multi',910,260,{ip:'192.168.10.2',url:'https://192.168.10.12:8443/',details:['Enterprise Eth 3 ↔ Flex Eth 2, limited to 2.5 GbE by Enterprise RJ45.','Eth 3 → node304 management. Eth 4 → Unraid eth1 / PBS management.','Eth 1 Pi assignment is reserved/offline in last evidence. Eth 5 configured Management, link-down.','USB-C-powered, not powered through its PoE-input port.']}),
  n('ap','U6 Enterprise','ap','Wi-Fi 6E · PoE+','multi',1260,260,{ip:'192.168.10.3',url:'https://192.168.10.12:8443/',services:['User Wi-Fi','IoT Wi-Fi','Guest Wi-Fi'],details:['One Ethernet port; Enterprise Eth 2 supplies the VLAN trunk and PoE+.','Loss of UniFi controller alone does not imply loss of switching or existing Wi-Fi configuration.']}),
  n('net','net','vm','VM 112 · network services','mgmt',40,455,{ip:'192.168.10.12',parent:'protectli',url:'http://192.168.10.12:49153/admin/',services:['Pi-hole','UniFi Network','Traefik','Smokeping','Speedtest Tracker','Restic'],details:['Pi-hole is the User/IoT resolver; its upstream is OPNsense Unbound.','The net host itself gets DNS from OPNsense, not from its own Pi-hole container.','UniFi UI: https://192.168.10.12:8443/. Controller failure does not power down adopted devices.'],source:live}),
  n('node304','node304','server','NAS hardware · standalone PVE','mgmt',600,455,{ip:'192.168.10.20',url:'https://192.168.10.20:8006/',services:['Unraid · VM 222','app · VM 223','exp · VM 299'],details:['Physical hypervisor, NOT the Unraid operating system.','Eth 1 / vmbr1 via Flex handles management. Eth 4 / vmbr20 via Enterprise serves User VMs.','Eth 2 and Eth 3 are passed through to Unraid. Local VM disks are not PBS storage.','No automatic failover to Protectli.'],source:live}),
  n('minipc','MiniPC / Hermes','desktop','Omarchy · operator workstation','user',910,455,{ip:'192.168.20.32',services:['Hermes Agent','Local development','Personal / gaming'],details:['Current Hermes execution host. Wired enp1s0 is on the User network.','Documented cable: Enterprise Eth 7. Historical Mac/Hermes labels in older docs are superseded.'],source:live}),
  n('user-wifi','User Wi-Fi','clients','Personal devices · VLAN 20','user',1260,455,{services:['MacBook .20.51','iPad .20.52','iPhone .20.53','Watch .20.54','Edifier .20.55','Dyson .20.56','Roborock .20.57','Android .20.97','Mac / macmini .20.98'],details:['Grouped endpoint inventory, not a live association/client count.','Mac .20.98 remains Wi-Fi; reserved wired .10.98 is disconnected.']}),
  n('ha','Home Assistant','vm','VM 313 · local automation','iot',40,650,{ip:'192.168.30.13',parent:'protectli',url:'https://ha.zitryss.dev/',services:['Home Assistant OS','MQTT','Local voice & automation'],details:['Internal Protectli vmbr30 reaches physical IoT VLAN through OPNsense bridge0.','Enviro and LED cube publish MQTT to .30.13:1883.','Not every device or automation is modeled, and no physical device controls are exposed here.'],source:live}),
  n('app','app','vm','VM 223 · self-hosted services','user',600,650,{ip:'192.168.20.23',parent:'node304',services:['Traefik','Vaultwarden','FreshRSS','Invidious / Companion','Yattee Server','Firecrawl / SearXNG','Restic'],details:['Services use host-scoped URLs: <service>.app.zitryss.dev.','VM has local disks; NAS backup unavailability does not imply immediate loss of application runtime.'],source:live}),
  n('unraid','Unraid','storage','VM 222 · NAS & media','user',910,650,{ip:'192.168.20.22',parent:'node304',url:'http://192.168.20.22:8080/',services:['Plex / Jellyfin','Sonarr / Radarr / Prowlarr','Download services','Restic / HA backup targets','NFS ISO library','Nested PBS VM'],details:['Runs inside node304, with passed-through NICs and storage.','eth0 User path is 2500 Mbps; eth1 / PBS management path is currently 100 Mbps. Cause not diagnosed.','PBS datastore is passed from an Unraid share using VirtioFS.','A backup stored on this hardware is not an independent off-site copy.'],source:live}),
  n('iot-wifi','IoT Wi-Fi','clients','Sensors & controls · VLAN 30','iot',1260,650,{services:['Voice / Jarvis .30.51','Key Lights .30.52 / .53','Keypad .30.54','AirGradient .30.55','LED cube .30.56','Shelly TRV .30.57','Shelly plug .30.58','AC Infinity .30.59','Enviro Grow .30.60'],details:['Grouped documented reservations; not continuous connectivity checks.','MQTT paths to HA are conceptual here, not a full firewall or packet-flow simulation.']}),
  n('kvm','PiKVM','kvm','Direct management / rescue','mgmt',40,845,{ip:'192.168.10.99',url:'https://192.168.10.99/',details:['PiKVM Ethernet is directly connected to Protectli Eth 4 / vmbr1.','This is the documented management path. Console target and independent power are not inferred.']}),
  n('atv','Apple TV','media','Wired media endpoint','user',330,845,{ip:'192.168.20.24',details:['Enterprise Eth 6, User VLAN 20. Current hostname: atv.zitryss.dev.','Separate from the grouped wireless clients.']}),
  n('exp','exp','vm','VM 299 · disposable sandbox','user',600,845,{ip:'192.168.20.99',parent:'node304',services:['Ansible / provisioning experiments'],details:['Non-production sandbox. Template VM 999 is omitted from the active map on both standalone hosts.'],source:live}),
  n('pbs','Proxmox Backup','backup','Nested VM · inside Unraid','mgmt',910,845,{ip:'192.168.10.21',parent:'unraid',url:'https://192.168.10.21:8007/',services:['PBS','VirtioFS datastore'],details:['node304 → Unraid → PBS. No direct Proxmox VMID.','Management: Flex Eth 4 → node304 Eth 3 → Unraid eth1/br1 → PBS nic0.','Documented backup jobs exclude Unraid VM 222, avoiding backup of its own nested target.','PBS loss affects backups; existing VM disks remain local.'],source:live}),
  n('guest-wifi','Guest Wi-Fi','clients','Isolated visitors · VLAN 40','guest',1260,845,{details:['Internet-only segment isolated from other VLANs.','DHCP .40.100–.200; Cloudflare DNS, not Pi-hole.','No client identities or credentials are included.']})
];
function l(id,from,to,type,label,detail,points,source='Physical Wiring / Network Architecture; 2026-09-21') {
  return {id,from,to,type,label,detail,source,...(points?{points}:{})};
}
export const links = [
  l('wan','internet','opnsense','wan','PPPoE · Eth 2','ONT/modem to passed-through OPNsense WAN igc0, VLAN 7 and pppoe0.',[[280,124],[370,124]]),
  l('home-vpn','opnsense','vpn','vpn','WireGuard','Remote-access logical service, not another physical cable.',[[610,100],[910,100]]),
  l('cloud','internet','neptune','wan','Public Internet','Public reachability context only; no dedicated home-to-Neptune tunnel.',[[160,60],[160,24],[1380,24],[1380,60]]),
  l('host-opn','protectli','opnsense','hosting','VM 111','Compute containment: OPNsense runs on Protectli.',[[280,284],[344,284],[344,180],[370,180]]),
  l('lagg','opnsense','enterprise','trunk','2 × 10G · LACP','Two physical SFP+ members terminate in OPNsense via PCI passthrough. Tagged VLANs 20/30/40. Not a 20G single-flow connection.',[[610,154],[720,154],[720,260]]),
  l('mgmt-core','protectli','enterprise','management','Eth 1 · Management','Separate Protectli Eth 1 ↔ Enterprise Eth 1 native Management path.',[[280,324],[600,324]]),
  l('flex-uplink','enterprise','flex','trunk','2.5G · E3 ↔ E2','Enterprise Eth 3 to Flex Eth 2; native Management plus User VLAN 20.',[[840,305],[910,305]]),
  l('ap-uplink','enterprise','ap','trunk','2.5G · PoE+','Enterprise Eth 2 → U6 only RJ45 port. Native Management and SSID VLANs 20/30/40.',[[805,260],[805,220],[1380,220],[1380,260]]),
  l('node-mgmt','flex','node304','management','Management · Eth 1','Flex Eth 3 → node304 Eth 1 / vmbr1. Not the User VM path.',[[970,388],[970,418],[720,418],[720,455]]),
  l('node-user','enterprise','app','ethernet','User VMs · vmbr20','Enterprise Eth 5 → node304 Eth 4 / vmbr20 → app/exp virtual NICs. Line represents the shared VM network path, not a cable directly to app.',[[630,388],[566,388],[566,714],[600,714]]),
  l('unraid-user','enterprise','unraid','ethernet','2.5G · NAS User','Enterprise Eth 4 → node304 Eth 2 passthrough → Unraid eth0.',[[805,388],[868,388],[868,684],[910,684]]),
  l('pbs-mgmt','flex','pbs','management','100M · PBS path','Flex Eth 4 → node304 Eth 3 passthrough → Unraid eth1/br1 → PBS nic0. Unraid eth1 speed verified 100 Mbps on 2026-10-10.',[[1110,388],[1182,388],[1182,908],[1150,908]],live),
  l('operator','enterprise','minipc','ethernet','Eth 7 · User','Documented wired MiniPC path.',[[840,350],[884,350],[884,496],[910,496]]),
  l('atv-wire','enterprise','atv','ethernet','Eth 6 · User','Wired Apple TV path.',[[655,388],[544,388],[544,815],[450,815],[450,845]]),
  l('host-net','protectli','net','hosting','VM 112','Compute containment; network is vmbr1.',[[112,388],[112,455]]),
  l('host-ha','protectli','ha','hosting','VM 313','Compute containment; HA uses internal vmbr30, bridged to physical IoT by OPNsense.',[[72,388],[20,388],[20,714],[40,714]]),
  l('kvm-wire','protectli','kvm','management','Eth 4 · rescue','Direct Ethernet management path on Protectli vmbr1.',[[88,388],[6,388],[6,910],[40,910]]),
  l('host-app','node304','app','hosting','VM 223','Hosted on local node304 VM disks.',[[720,583],[720,650]]),
  l('host-unraid','node304','unraid','hosting','VM 222','NAS operating system runs as VM on node304 with hardware passthrough.',[[840,548],[880,548],[880,746],[910,746]]),
  l('host-exp','node304','exp','hosting','VM 299','Compute containment, not a second cable.',[[790,583],[856,583],[856,810],[720,810],[720,845]]),
  l('host-pbs','unraid','pbs','hosting','libvirt + VirtioFS','Nested VM and share-backed datastore; not a direct PVE guest.',[[1030,778],[1030,845]]),
  l('backup','protectli','pbs','backup','PVE → PBS','Logical backup destination, not shared running VM storage. Both PVE hosts use PBS; Unraid VM 222 excluded. Scheduling/success are not monitored.',[[40,356],[0,356],[0,1044],[1030,1044],[1030,973]]),
  l('backup-node','node304','pbs','backup','PVE → PBS','node304 local guests back up to nested PBS. This shares the node304 failure domain.',[[840,570],[1204,570],[1204,950],[1150,950]]),
  l('wifi-user','ap','user-wifi','wifi','VLAN 20','Grouped User Wi-Fi access.',[[1305,388],[1305,455]]),
  l('wifi-iot','ap','iot-wifi','wifi','VLAN 30','Grouped IoT Wi-Fi access.',[[1484,388],[1548,388],[1548,714],[1500,714]]),
  l('wifi-guest','ap','guest-wifi','wifi','VLAN 40','Guest Wi-Fi access; isolated segment.',[[1496,388],[1578,388],[1578,909],[1500,909]])
];
export const scenarios = [
  {id:'protectli-loss',label:'Protectli host failure',faults:['protectli'],description:'Router, DNS VM and Home Assistant share one physical host. No automatic failover.'},
  {id:'node304-loss',label:'node304 host failure',faults:['node304'],description:'App, sandbox, NAS and nested backup server share one failure domain.'},
  {id:'router-loss',label:'OPNsense VM failure',faults:['opnsense'],description:'Inter-VLAN routing, WAN, DHCP, upstream DNS and physical-to-VM IoT bridge affected.'},
  {id:'dns-loss',label:'net / Pi-hole failure',faults:['net'],description:'User/IoT DNS and controller unavailable; switches/AP do not power down.'},
  {id:'switch-loss',label:'Core switch failure',faults:['enterprise'],description:'Switched connectivity and AP PoE fail; compute workloads need not stop.'},
  {id:'nas-loss',label:'Unraid failure',faults:['unraid'],description:'Media, NAS, backup targets and nested PBS affected; app VM still runs.'},
  {id:'wan-loss',label:'Internet uplink failure',faults:['internet'],description:'Home Internet access lost; local compute is not powered off.'}
];
