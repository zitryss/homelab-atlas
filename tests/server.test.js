import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('local static server exposes only app files and rejects private paths and writes', async()=>{
  const child=spawn(process.execPath,['scripts/serve.js'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  // Port zero is ephemeral; server startup emits the actual assigned port.
  try {
    const [chunk]=await once(child.stdout,'data');
    const base=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(base,'server must advertise its bound URL');
    const data=await fetch(base+'/data.js'); assert.equal(data.status,200);
    assert.match(data.headers.get('content-type'),/javascript/);
    assert.match(data.headers.get('content-security-policy'),/connect-src 'none'/);
    for(const p of ['/.git/config','/docs/SOURCES.md','/package.json','/../.ssh/config','/%2e%2e%2f.env','/%ZZ']) {
      const r=await fetch(base+p); assert.ok([400,404].includes(r.status),p);
    }
    assert.equal((await fetch(base+'/data.js',{method:'POST'})).status,405);
    const h=await fetch(base+'/data.js',{method:'HEAD'}); assert.equal(h.status,200); assert.equal(await h.text(),'');
  } finally {child.kill(); await once(child,'exit');}
});
