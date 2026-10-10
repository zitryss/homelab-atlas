import test from 'node:test';
import assert from 'node:assert/strict';
import {nodes, links, scenarios, zones} from '../data.js';
import {simulate} from '../model.js';

test('unique graph identifiers, valid containment and no obsolete architecture', () => {
  const ids = new Set(nodes.map(n => n.id));
  assert.equal(ids.size, nodes.length);
  assert.equal(new Set(links.map(l => l.id)).size, links.length);
  for (const n of nodes) {
    assert.ok(!n.parent || ids.has(n.parent));
    assert.ok(n.source && n.details.length);
    const seen = new Set([n.id]); let p = n.parent;
    while (p) { assert.ok(!seen.has(p), 'parent cycle'); seen.add(p); p=nodes.find(x=>x.id===p).parent; }
  }
  for (const l of links) { assert.ok(ids.has(l.from) && ids.has(l.to)); assert.ok(l.detail); }
  for (const s of scenarios) for (const id of s.faults) assert.ok(ids.has(id));
  assert.deepEqual(zones.filter(z=>z.id!=='external').map(z=>z.id), ['mgmt','user','iot','guest']);
});
test('baseline never claims live online telemetry', () => {
  const r=simulate(); assert.equal(r.failed.length,0); assert.equal(r.affected.length,0);
  assert.ok(Object.values(r.states).every(s=>s.status==='normal'));
});
test('Protectli host loss cascades into VMs but not other physical compute', () => {
  const r=simulate(new Set(['protectli']));
  for(const id of ['opnsense','net','ha']) assert.equal(r.states[id].status,'affected');
  assert.equal(r.states.node304.status,'normal'); assert.equal(r.states.app.status,'normal');
  assert.match(r.states.ha.reason,/host|Protectli|parent/i);
});
test('node304 loss includes nested PBS and leaves core router available', () => {
  const r=simulate(new Set(['node304']));
  for(const id of ['unraid','pbs','app','exp']) assert.equal(r.states[id].status,'affected');
  assert.equal(r.states.opnsense.status,'normal');
});
test('Unraid and PBS failures do not halt local app VM disks', () => {
  assert.equal(simulate(new Set(['unraid'])).states.app.status,'normal');
  assert.equal(simulate(new Set(['unraid'])).states.pbs.status,'affected');
  assert.equal(simulate(new Set(['pbs'])).states.unraid.status,'normal');
});
test('controller/Pi-hole loss does not fail adopted switches or access point', () => {
  const r=simulate(new Set(['net']));
  for(const id of ['ap','enterprise','flex']) assert.equal(r.states[id].status,'normal');
  assert.ok(r.impacts.some(s=>/DNS/.test(s)));
});
test('core switch loss impacts PoE AP, Wi-Fi and wired paths without stopping hosts', () => {
  const r=simulate(new Set(['enterprise']));
  for(const id of ['ap','user-wifi','iot-wifi','guest-wifi','minipc','atv']) assert.equal(r.states[id].status,'affected');
  assert.equal(r.states.protectli.status,'normal');
  assert.equal(r.states.node304.status,'affected');
  assert.match(r.states.node304.reason,/management|network/i);
});
test('Flex loss affects PBS management, not its compute or NAS User path', () => {
  const r=simulate(new Set(['flex']));
  assert.equal(r.states.pbs.status,'affected'); assert.equal(r.states.unraid.status,'normal');
  assert.match(r.states.pbs.reason,/management/i);
});
test('WAN failure leaves local compute untouched and only home VPN affected', () => {
  const r=simulate(new Set(['internet']));
  assert.equal(r.states.app.status,'normal'); assert.equal(r.states.ha.status,'normal');
  assert.equal(r.states.neptune.status,'normal'); assert.equal(r.states.vpn.status,'affected');
});
test('multiple faults retain explicit failure precedence and reset is pure', () => {
  const faults=new Set(['protectli','net','unraid']); const r=simulate(faults);
  assert.equal(r.states.net.status,'failed'); assert.equal(r.states.pbs.status,'affected');
  assert.equal(faults.size,3); assert.equal(simulate().affected.length,0);
});
test('invalid fault identifiers fail closed', () => assert.throws(()=>simulate(new Set(['unknown'])), /Unknown/));
