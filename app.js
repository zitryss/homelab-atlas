import { meta, nodes, links, zones, scenarios } from './data.js';
import { simulate } from './model.js';

const $ = (selector) => document.querySelector(selector);
const svgNS = 'http://www.w3.org/2000/svg';
const byId = new Map(nodes.map((node) => [node.id, node]));
const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
const edgeColors = { wan: '#a2b8f5', trunk: '#78d6c0', management: '#8aa9ec', ethernet: '#78b9d4', wifi: '#c29bdc', hosting: '#929cbb', backup: '#d3b77d', vpn: '#d898b7' };
const edgeNames = { wan: 'WAN', trunk: 'VLAN trunk', management: 'Management', ethernet: 'Ethernet', wifi: 'Wi-Fi', hosting: 'Hosted on', backup: 'Backup', vpn: 'VPN' };
const stateNames = { normal: 'Baseline', failed: 'Simulated failure', affected: 'Simulated impact' };
const faults = new Set();
let simulation = simulate(faults);
let selection = null;
let activeZone = 'all';
let camera = { x: 0, y: 0, scale: 1 };
let hasCustomCamera = false;
let suppressClick = false;
const svg = $('#network');
const world = $('#world');
const deviceElements = new Map();
const edgeElements = new Map();
const pointers = new Map();
let gesture = null;

function el(tag, attributes = {}, text) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function html(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function clip(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, Math.max(1, length - 1))}…` : value;
}
function announce(message) { $('#announcement').textContent = message; }
function getState(id) { return simulation.states[id] || { status: 'normal', reason: '' }; }
function isInZone(node) { return activeZone === 'all' || node.zone === activeZone || node.zone === 'multi'; }
function applyCamera() {
  world.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
  $('#zoom-level').textContent = `${Math.round(camera.scale * 100)}%`;
}
function mapSize() { const rect = svg.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }
function bounds() {
  const xs = nodes.flatMap((n) => [n.x, n.x + n.w]);
  const ys = nodes.flatMap((n) => [n.y, n.y + n.h]);
  for (const link of links) for (const [x, y] of link.points || []) { xs.push(x); ys.push(y); }
  return { left: Math.min(0, ...xs), top: Math.min(-45, ...ys), right: Math.max(1600, ...xs), bottom: Math.max(1120, ...ys) };
}
function fit() {
  const { width, height } = mapSize();
  if (!width || !height) return;
  const b = bounds();
  const scale = Math.min((width - 40) / (b.right - b.left), (height - 60) / (b.bottom - b.top));
  camera = { scale, x: (width - (b.right + b.left) * scale) / 2, y: (height - (b.bottom + b.top) * scale) / 2 - 10 };
  hasCustomCamera = false;
  applyCamera();
}
function zoom(factor, point) {
  const { width, height } = mapSize();
  const center = point || { x: width / 2, y: height / 2 };
  const next = Math.min(2.8, Math.max(0.12, camera.scale * factor));
  const ratio = next / camera.scale;
  camera.x = center.x - (center.x - camera.x) * ratio;
  camera.y = center.y - (center.y - camera.y) * ratio;
  camera.scale = next;
  hasCustomCamera = true;
  applyCamera();
}
function centerNode(node) {
  const { width, height } = mapSize();
  camera.scale = Math.max(camera.scale, Math.min(1.1, (width - 65) / node.w));
  camera.x = width / 2 - (node.x + node.w / 2) * camera.scale;
  camera.y = height / 2 - (node.y + node.h / 2) * camera.scale;
  hasCustomCamera = true;
  applyCamera();
}
function activateOnKeyboard(element, action) {
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); action(); }
  });
}
function cardIcon(kind, x, y) {
  const group = el('g', { class: 'device-icon', transform: `translate(${x} ${y})`, 'aria-hidden': 'true' });
  const name = String(kind).toLowerCase();
  if (/internet|cloud|wan/.test(name)) {
    group.append(el('circle', { cx: 10, cy: 10, r: 9 }), el('ellipse', { cx: 10, cy: 10, rx: 4, ry: 9 }), el('path', { d: 'M1 10h18' }));
  } else if (/wifi|wireless|access|^ap$/.test(name)) {
    group.append(el('path', { d: 'M0 6Q10 -2 20 6M4 11Q10 6 16 11M8 15Q10 13 12 15' }), el('circle', { cx: 10, cy: 19, r: 1 }));
  } else if (/vm|virtual|container|service/.test(name)) {
    group.append(el('path', { d: 'M10 0 20 5 20 15 10 20 0 15 0 5ZM0 5 10 10 20 5M10 10V20' }));
  } else if (/switch|router|firewall/.test(name)) {
    group.append(el('rect', { x: 0, y: 4, width: 21, height: 12, rx: 2 }), el('path', { d: 'M4 9v3m4-3v3m4-3v3m4-3v3M6 0v4M15 0v4' }));
  } else {
    group.append(el('rect', { x: 1, y: 0, width: 19, height: 20, rx: 2 }), el('path', { d: 'M1 7h19M1 14h19M5 3h2M5 10h2M5 17h2' }));
  }
  return group;
}
function draw() {
  // These quiet perimeter markers establish reading order without implying a network boundary.
  const bands = $('#bands');
  for (const [x, number, name] of [[40, '01', 'EDGE & HOME SERVICES'], [600, '02', 'COMPUTE & SWITCHING'], [1260, '03', 'WIRELESS & EXTERNAL']]) {
    bands.append(el('text', { x, y: -13, class: 'band-number' }, number), el('text', { x: x + 29, y: -13, class: 'band-label' }, name));
  }
  for (const link of links) {
    const from = byId.get(link.from), to = byId.get(link.to);
    if (!from || !to) continue;
    const a = [from.x + from.w / 2, from.y + from.h / 2];
    const b = [to.x + to.w / 2, to.y + to.h / 2];
    const vertices = link.points?.length > 1 ? link.points : [a, [(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]], b];
    const d = vertices.map((point, i) => `${i ? 'L' : 'M'}${point[0]} ${point[1]}`).join(' ');
    const group = el('g', { class: `edge ${link.type}`, 'data-link-id': link.id, 'data-id': link.id, tabindex: 0, role: 'button', 'aria-label': `${link.label}: ${from.label} to ${to.label}`, style: `--edge-color:${edgeColors[link.type] || '#91a9bd'}` });
    group.append(el('title', {}, `${link.label} · ${from.label} → ${to.label}`), el('path', { d, class: 'edge-hit' }), el('path', { d, class: 'edge-line' }), el('path', { d, class: 'edge-flow', 'aria-hidden': 'true' }));
    // Label the longest segment; cables remain independently keyboard-selectable.
    let longest = { length: 0, p: a, q: b };
    vertices.slice(1).forEach((q, i) => { const p = vertices[i]; const length = Math.hypot(q[0] - p[0], q[1] - p[1]); if (length > longest.length) longest = { length, p, q }; });
    if (longest.length > 105) {
      const horizontal = Math.abs(longest.q[0] - longest.p[0]) > Math.abs(longest.q[1] - longest.p[1]);
      const x = (longest.p[0] + longest.q[0]) / 2, y = (longest.p[1] + longest.q[1]) / 2;
      group.append(el('text', { x: x + (horizontal ? 0 : 8), y: y - (horizontal ? 7 : 0), class: 'edge-label', 'text-anchor': horizontal ? 'middle' : 'start' }, clip(link.label, 26)));
    }
    group.addEventListener('click', (event) => { event.stopPropagation(); if (!suppressClick) select('link', link.id); });
    activateOnKeyboard(group, () => select('link', link.id));
    $('#edges').append(group);
    edgeElements.set(link.id, group);
  }
  for (const node of nodes) {
    const color = zoneById.get(node.zone)?.color || (node.zone === 'multi' ? '#80d4c3' : '#a7b9d1');
    const group = el('g', { class: 'device', 'data-node-id': node.id, 'data-id': node.id, transform: `translate(${node.x} ${node.y})`, tabindex: 0, role: 'button', 'aria-label': `${node.label}, ${node.kind}, baseline`, style: `--node-color:${color}` });
    group.append(el('title', {}, `${node.label} · ${node.subtitle || node.kind}`), el('rect', { width: node.w, height: node.h, rx: 8, class: 'card' }), el('rect', { x: 0, y: 16, width: 3, height: Math.max(20, node.h - 32), rx: 1.5, class: 'card-accent' }));
    group.append(cardIcon(node.kind, 16, 15));
    const maxTitle = Math.floor((node.w - 35) / 8.8);
    group.append(el('text', { x: 47, y: 28, class: 'device-kind' }, clip(node.kind, Math.floor((node.w - 75) / 6))), el('circle', { cx: node.w - 17, cy: 23, r: 3, class: 'device-indicator' }));
    group.append(el('text', { x: 16, y: 56, class: 'device-label' }, clip(node.label, maxTitle)));
    if (node.h >= 85) group.append(el('text', { x: 16, y: 76, class: 'device-subtitle' }, clip(node.subtitle || '', Math.floor((node.w - 30) / 6))));
    if (node.h >= 105) group.append(el('text', { x: 16, y: node.h - 15, class: 'device-address' }, clip(node.ip || zoneById.get(node.zone)?.label || 'Documented resource', Math.floor((node.w - 30) / 6.1))));
    group.addEventListener('click', (event) => { event.stopPropagation(); if (!suppressClick) select('node', node.id); });
    activateOnKeyboard(group, () => select('node', node.id));
    $('#devices').append(group);
    deviceElements.set(node.id, group);
  }
}
function refreshMap() {
  for (const node of nodes) {
    const element = deviceElements.get(node.id), state = getState(node.id);
    element.classList.toggle('failed', state.status === 'failed');
    element.classList.toggle('affected', state.status === 'affected');
    element.classList.toggle('selected', selection?.type === 'node' && selection.id === node.id);
    element.classList.toggle('dimmed', !isInZone(node));
    element.setAttribute('aria-pressed', String(selection?.type === 'node' && selection.id === node.id));
    element.setAttribute('aria-label', `${node.label}, ${node.kind}, ${stateNames[state.status] || state.status}${node.ip ? `, ${node.ip}` : ''}`);
  }
  for (const link of links) {
    const element = edgeElements.get(link.id);
    if (!element) continue;
    const from = byId.get(link.from), to = byId.get(link.to);
    element.classList.toggle('dimmed', !(isInZone(from) && isInZone(to)));
    element.classList.toggle('impacted', getState(link.from).status !== 'normal' || getState(link.to).status !== 'normal');
    element.classList.toggle('selected', selection?.type === 'link' && selection.id === link.id);
    element.setAttribute('aria-pressed', String(selection?.type === 'link' && selection.id === link.id));
  }
}
function detailRow(list, name, value, className = '') {
  if (!value) return;
  const row = html('div');
  row.append(html('dt', '', name));
  const dd = html('dd', className);
  if (value instanceof Node) dd.append(value); else dd.textContent = value;
  row.append(dd); list.append(row);
}
function renderInspector() {
  const inspector = $('#inspector');
  inspector.replaceChildren();
  $('#deselect').hidden = !selection;
  if (!selection) {
    const intro = html('div', 'inspector-intro');
    intro.append(html('div', 'intro-symbol', '⌖'), html('h2', '', 'A map, not a monitor.'), html('p', 'muted', 'Select a device or connection to see what it does, where it lives, and what depends on it.'));
    const stats = html('div', 'intro-stats');
    for (const [value, name] of [[nodes.length, 'resources'], [links.length, 'connections'], [zones.length, 'zones']]) {
      const item = html('div'); item.append(html('strong', '', value), html('span', '', name)); stats.append(item);
    }
    intro.append(stats); inspector.append(intro); return;
  }
  if (selection.type === 'link') {
    const link = links.find((entry) => entry.id === selection.id);
    inspector.append(html('div', 'selection-kind', `${edgeNames[link.type] || link.type} connection`), html('h2', 'selection-title', link.label), html('p', 'muted', link.detail));
    const list = html('dl', 'detail-list');
    detailRow(list, 'From', byId.get(link.from)?.label || link.from);
    detailRow(list, 'To', byId.get(link.to)?.label || link.to);
    detailRow(list, 'Type', edgeNames[link.type] || link.type);
    inspector.append(list, html('p', 'provenance', `SOURCE / ${link.source}`));
    inspector.append(html('p', 'model-note', 'A documented relationship. Cable styling does not measure traffic or validate end-to-end reachability.'));
    return;
  }
  const node = byId.get(selection.id), state = getState(node.id);
  inspector.append(html('div', 'selection-kind', node.kind), html('h2', 'selection-title', node.label), html('p', 'muted', node.subtitle), html('span', `state-pill ${state.status}`, stateNames[state.status] || state.status));
  if (state.reason) inspector.append(html('p', state.status === 'normal' ? 'model-note' : 'reason', state.reason));
  const list = html('dl', 'detail-list');
  detailRow(list, 'Address', node.ip, 'mono');
  detailRow(list, 'Network', zoneById.get(node.zone)?.label || (node.zone === 'multi' ? 'Multiple zones' : node.zone));
  if (node.parent) detailRow(list, 'Hosted on', byId.get(node.parent)?.label || node.parent);
  if (node.services?.length) {
    const chips = html('div', 'services'); node.services.forEach((service) => chips.append(html('span', 'service', service)));
    detailRow(list, 'Services', chips);
  }
  inspector.append(list);
  if (node.details?.length) { const notes = html('ul', 'detail-notes'); node.details.forEach((detail) => notes.append(html('li', '', detail))); inspector.append(notes); }
  inspector.append(html('p', 'provenance', `SOURCE / ${node.source}`));
  if (node.url) {
    try {
      const target = new URL(node.url);
      if (['http:', 'https:'].includes(target.protocol)) {
        const management = html('a', 'management-link', 'Open management interface ↗');
        management.href = target.href; management.target = '_blank'; management.rel = 'noopener noreferrer';
        management.setAttribute('aria-label', `Open ${node.label} management interface in a new tab`); inspector.append(management);
      }
    } catch { /* Invalid or non-web management addresses are deliberately not made clickable. */ }
  }
  const button = html('button', `fault-button${faults.has(node.id) ? ' restore' : ''}`, faults.has(node.id) ? '↺ Restore this device' : '⊘ Simulate device failure');
  button.id = 'toggle-fault';
  button.addEventListener('click', () => {
    if (faults.has(node.id)) faults.delete(node.id); else faults.add(node.id);
    $('#scenario').value = '';
    updateSimulation();
    $('#toggle-fault')?.focus({ preventScroll: true });
  });
  inspector.append(button);
}
function select(type, id, center = false) {
  selection = { type, id };
  if (center && type === 'node') {
    const node = byId.get(id);
    if (!isInZone(node)) { activeZone = 'all'; $('#zone').value = 'all'; }
    centerNode(node);
  }
  refreshMap(); renderInspector();
  const label = type === 'node' ? byId.get(id).label : links.find((link) => link.id === id).label;
  announce(`${label} selected. Details available in the inspector.`);
}
function deselect() { selection = null; refreshMap(); renderInspector(); }
function updateSimulation() {
  simulation = simulate(new Set(faults));
  const active = faults.size > 0;
  $('#simulation-banner').hidden = !active;
  $('#simulation-summary').textContent = `${simulation.failed.length} failed · ${simulation.affected.length} affected · local model only`;
  $('#clear-faults').disabled = !active;
  $('#impact-count').textContent = String(simulation.impacts.length);
  const impacts = $('#impacts'); impacts.replaceChildren();
  if (simulation.impacts.length) {
    const list = html('ul', 'impact-list'); simulation.impacts.forEach((impact) => list.append(html('li', '', impact))); impacts.append(list);
  } else {
    const note = html('p', 'baseline-note'); note.append(html('span', '', '◇'), document.createTextNode(active ? 'No additional downstream effects are documented for this selection.' : 'Baseline configuration. Select a preset or fail an individual device to explore its impact.')); impacts.append(note);
  }
  refreshMap(); renderInspector();
}
function clearFaults() { faults.clear(); $('#scenario').value = ''; updateSimulation(); announce('All simulated failures cleared. Documented baseline restored.'); }
function showSearch() {
  const input = $('#search'), results = $('#search-results');
  const query = input.value.trim().toLowerCase();
  const matches = nodes.filter((node) => [node.label, node.ip, node.subtitle, node.kind, ...(node.services || [])].some((value) => String(value || '').toLowerCase().includes(query)));
  results.replaceChildren();
  results.append(html('p', 'search-message', query ? `${matches.length} matching ${matches.length === 1 ? 'resource' : 'resources'}` : `Browse all ${nodes.length} resources`));
  for (const node of matches) {
    const button = html('button', 'search-result'); button.append(html('span', '', node.label), html('small', '', node.ip || node.kind));
    button.addEventListener('click', () => { select('node', node.id, true); results.hidden = true; deviceElements.get(node.id).focus({ preventScroll: true }); });
    results.append(button);
  }
  if (!matches.length) results.append(html('p', 'search-message', 'No resources found. Try a hostname, IP address, or service such as DNS.'));
  results.hidden = false;
}
function setupCamera() {
  svg.addEventListener('wheel', (event) => {
    event.preventDefault(); const rect = svg.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    zoom(Math.exp(-delta * 0.0016), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  function point(event) { const rect = svg.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function startGesture() {
    const list = [...pointers.values()];
    if (!list.length) { gesture = null; return; }
    gesture = { camera: { ...camera }, points: list.map((p) => ({ ...p })), moved: false };
  }
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, point(event));
    // Capture on the original SVG target: a tap can still activate that card or cable.
    event.target.setPointerCapture?.(event.pointerId);
    startGesture();
    suppressClick = false;
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, point(event));
    const list = [...pointers.values()];
    if (list.length >= 2 && gesture.points.length >= 2) {
      const initial = gesture.points;
      const oldDistance = Math.hypot(initial[0].x - initial[1].x, initial[0].y - initial[1].y);
      const distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const scale = Math.min(2.8, Math.max(0.12, gesture.camera.scale * distance / Math.max(1, oldDistance)));
      const center = { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 };
      const origin = { x: (initial[0].x + initial[1].x) / 2, y: (initial[0].y + initial[1].y) / 2 };
      camera = { scale, x: center.x - (origin.x - gesture.camera.x) * scale / gesture.camera.scale, y: center.y - (origin.y - gesture.camera.y) * scale / gesture.camera.scale };
      suppressClick = true;
    } else {
      const dx = list[0].x - gesture.points[0].x, dy = list[0].y - gesture.points[0].y;
      if (Math.hypot(dx, dy) < 5 && !gesture.moved) return;
      camera = { ...gesture.camera, x: gesture.camera.x + dx, y: gesture.camera.y + dy };
      suppressClick = true;
    }
    gesture.moved = true; hasCustomCamera = true; svg.classList.add('panning'); applyCamera();
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size) startGesture(); else { gesture = null; svg.classList.remove('panning'); }
    if (!pointers.size) setTimeout(() => { suppressClick = false; }, 0);
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('lostpointercapture', (event) => { if (pointers.has(event.pointerId)) endPointer(event); });
  svg.addEventListener('click', (event) => { if (!suppressClick && !event.target.closest('.device,.edge')) deselect(); });
  svg.addEventListener('keydown', (event) => {
    if (event.target !== svg) return;
    const step = event.shiftKey ? 100 : 45;
    const offsets = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (offsets[event.key]) { event.preventDefault(); camera.x += offsets[event.key][0]; camera.y += offsets[event.key][1]; hasCustomCamera = true; applyCamera(); }
  });
  new ResizeObserver(() => { if (!hasCustomCamera) fit(); }).observe($('#canvas-wrap'));
}
function initialize() {
  document.title = `${meta.title || 'Homelab Atlas'} · zitryss.dev`;
  $('#map-subtitle').textContent = meta.subtitle || 'One lab. Every connection.';
  $('#map-count').textContent = `${nodes.length} RESOURCES / ${links.length} LINKS`;
  $('#reviewed').textContent = meta.reviewed ? `REVIEWED ${meta.reviewed}` : 'DOCUMENTED BASELINE';
  if (meta.disclaimer) $('.model-note').textContent = meta.disclaimer;
  for (const zone of zones) { const option = html('option', '', zone.label + (zone.subnet ? ` · ${zone.subnet}` : '')); option.value = zone.id; option.title = zone.description || ''; $('#zone').append(option); }
  for (const scenario of scenarios) { const option = html('option', '', scenario.label); option.value = scenario.id; option.title = scenario.description; $('#scenario').append(option); }
  for (const type of Object.keys(edgeColors).filter((type) => links.some((link) => link.type === type))) {
    const item = html('span', 'legend-item'); const line = html('span', `legend-line${type === 'hosting' || type === 'wifi' || type === 'vpn' ? ' dashed' : type === 'backup' ? ' dotted' : ''}`); line.style.setProperty('--c', edgeColors[type]); item.append(line, document.createTextNode(edgeNames[type])); $('#legend').append(item);
  }
  draw(); setupCamera(); updateSimulation(); requestAnimationFrame(fit);
  $('#zoom-in').addEventListener('click', () => zoom(1.25));
  $('#zoom-out').addEventListener('click', () => zoom(0.8));
  $('#fit').addEventListener('click', fit);
  $('#reset-view').addEventListener('click', () => { activeZone = 'all'; $('#zone').value = 'all'; $('#search').value = ''; $('#search-results').hidden = true; deselect(); fit(); announce('View reset. Simulation settings are unchanged.'); });
  $('#deselect').addEventListener('click', () => { deselect(); svg.focus({ preventScroll: true }); });
  $('#flow').addEventListener('click', () => { const enabled = $('#flow').getAttribute('aria-pressed') !== 'true'; $('#flow').setAttribute('aria-pressed', String(enabled)); $('#flow-state').textContent = enabled ? 'on' : 'off'; svg.classList.toggle('flow-on', enabled); announce(enabled ? 'Illustrative flow enabled. Reduced motion preferences are respected. This is not real traffic.' : 'Illustrative flow disabled.'); });
  $('#zone').addEventListener('change', (event) => { activeZone = event.target.value; refreshMap(); const zone = zoneById.get(activeZone); announce(zone ? `${zone.label}: ${zone.description || 'Unrelated resources are dimmed.'}` : 'Showing all network zones.'); });
  $('#scenario').addEventListener('change', (event) => { faults.clear(); const scenario = scenarios.find((entry) => entry.id === event.target.value); scenario?.faults.forEach((id) => faults.add(id)); updateSimulation(); if (scenario) announce(`Simulation: ${scenario.description}`); });
  $('#clear-faults').addEventListener('click', clearFaults);
  $('#banner-clear').addEventListener('click', clearFaults);
  $('#search').addEventListener('input', showSearch);
  $('#search').addEventListener('focus', showSearch);
  $('#search').addEventListener('keydown', (event) => { if (event.key === 'ArrowDown' || event.key === 'Enter') { const first = $('#search-results button'); if (first) { event.preventDefault(); first.focus(); } } });
  $('#search-results').addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); const buttons = [...document.querySelectorAll('.search-result')]; const index = buttons.indexOf(document.activeElement); const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) $('#search').focus(); else buttons[Math.min(next, buttons.length - 1)]?.focus();
  });
  document.addEventListener('pointerdown', (event) => { if (!event.target.closest('.search-wrap')) $('#search-results').hidden = true; });
  document.addEventListener('focusin', (event) => { if (!event.target.closest('.search-wrap')) $('#search-results').hidden = true; });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); $('#search-results').hidden = true; deselect(); if (event.target.closest('.sidebar')) svg.focus({ preventScroll: true }); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); fit(); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25); }
    if (event.key === '-') { event.preventDefault(); zoom(0.8); }
  });
}
initialize();
