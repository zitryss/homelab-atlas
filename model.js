import {nodes} from './data.js';

// Deliberately qualitative: hosting, known paths and service impacts are separate.
// No generic graph flood-fill: backup targets and controller edges are not power dependencies.
export function simulate(faults = new Set()) {
  const byId = Object.fromEntries(nodes.map(n => [n.id,n]));
  for (const id of faults) if (!byId[id]) throw new Error(`Unknown fault: ${id}`);
  const states = Object.fromEntries(nodes.map(n => [n.id,{status:faults.has(n.id)?'failed':'normal',reason:faults.has(n.id)?'Explicit simulated device failure.':'Documented baseline; not a live health check.'}]));
  const impacts=[];
  const stopped=new Set(faults);
  // Only hard compute containment cascades into guest execution.
  let changed=true;
  while(changed) {
    changed=false;
    for(const n of nodes) if(n.parent && stopped.has(n.parent) && !stopped.has(n.id)) {
      stopped.add(n.id); changed=true;
      states[n.id]={status:'affected',reason:`Hosting unavailable: parent ${byId[n.parent].label} is stopped in this simulation.`};
    }
  }
  function affect(id, reason) {
    if(states[id].status==='normal') states[id]={status:'affected',reason};
    else if(states[id].status==='affected' && !stopped.has(id) && !states[id].reason.includes(reason)) states[id].reason+=' '+reason;
  }
  if(stopped.has('protectli')) impacts.push('Protectli loss stops OPNsense, net and Home Assistant. There is no second router or automatic guest migration. Direct PiKVM Ethernet reachability through Protectli vmbr1 is lost; independent console power is not modeled.');
  if(stopped.has('protectli')) affect('kvm','Documented management path through Protectli vmbr1 unavailable; PiKVM power/console state is unknown.');
  if(stopped.has('node304')) impacts.push('node304 loss stops app, exp, Unraid and nested PBS. The NAS and its local backup server share the same physical failure domain.');
  if(stopped.has('unraid')) impacts.push('NAS/media, NFS ISO and backup targets are unavailable, including the nested PBS VM. Other hosts’ existing local VM disks do not disappear. Restic backup-hook side effects are not modeled.');
  if(stopped.has('pbs')) impacts.push('PBS backups/restores are unavailable; this alone does not stop running Proxmox guests.');
  if(stopped.has('opnsense')) {
    impacts.push('WAN, inter-VLAN routing, DHCP, Unbound upstream DNS and the home WireGuard endpoint are unavailable. Same-VLAN switching may continue. The physical IoT-to-HA bridge also depends on this router VM.');
    affect('ha','Physical IoT path through OPNsense bridge0 is unavailable; HA VM may still run.');
    affect('vpn','OPNsense home WireGuard endpoint unavailable.');
  }
  if(stopped.has('net')) impacts.push('Pi-hole DNS for User/IoT and UniFi controller management are unavailable. DNS cache, direct-IP access and existing sessions may still work. Adopted switches/AP keep their configuration; Guest uses public DNS.');
  if(stopped.has('internet')) {
    impacts.push('Home Internet access and remote home-VPN access are unavailable. Local compute and LAN switching remain; uncached public DNS/external integrations may fail. Neptune is an independent cloud host.');
    affect('vpn','Home WAN uplink unavailable.');
  }
  if(stopped.has('enterprise')) {
    impacts.push('Core switch paths are lost, including AP PoE and the Flex uplink. This indicates connectivity loss, not that node304, Unraid, app or MiniPC powered off.');
    affect('ap','PoE supply and uplink from Enterprise unavailable.');
    affect('flex','Upstream switched network unavailable; USB-C power is independent.');
    for(const id of ['minipc','atv']) affect(id,'Wired User-network path through Enterprise unavailable; endpoint power not modeled.');
    for(const id of ['node304','pbs']) affect(id,'Management path to the wider network through Flex/Enterprise unavailable; compute may continue.');
    for(const id of ['unraid','app','exp']) affect(id,'User-network path through Enterprise unavailable; local compute may continue.');
    for(const id of ['user-wifi','iot-wifi','guest-wifi']) affect(id,'Wi-Fi access unavailable because the AP loses Enterprise PoE/uplink.');
  }
  if(stopped.has('flex')) {
    impacts.push('Flex failure removes node304 and PBS switched management paths. Their User-side paths via Enterprise are separate; this does not stop their VMs or NAS services.');
    affect('node304','Management network path through Flex unavailable; host compute and User bridge may continue.');
    affect('pbs','Management network path through Flex unavailable; nested VM may still run.');
  }
  if(stopped.has('ap')) {
    impacts.push('Wireless User, IoT and Guest access is lost; wired devices and virtual machines do not depend on AP power.');
    for(const id of ['user-wifi','iot-wifi','guest-wifi']) affect(id,'Wi-Fi access through U6 Enterprise unavailable.');
  }
  if(stopped.has('ha')) impacts.push('Home Assistant and its MQTT/local automation services are unavailable. Individual device standalone operation is not modeled.');
  if(stopped.has('app')) impacts.push('Self-hosted app VM services unavailable; NAS/media and core routing are separate workloads.');
  if(stopped.has('neptune')) impacts.push('Neptune’s separate 10.7.0.0/24 WireGuard service is unavailable. OPNsense 10.10.10.0/24 is a different VPN.');
  if(faults.size && !impacts.length) impacts.push('Selected device unavailable in this simulation. No additional documented dependency is modeled.');
  return {states, impacts, failed:nodes.filter(n=>states[n.id].status==='failed').map(n=>n.id), affected:nodes.filter(n=>states[n.id].status==='affected').map(n=>n.id)};
}
