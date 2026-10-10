import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.connectOverCDP(process.env.CDP_URL||'http://127.0.0.1:9223');
const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[],outbound=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(!r.url().startsWith(base+'/'))outbound.push(r.url());});
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
try{
  await mkdir('artifacts',{recursive:true});
  await page.goto(base); await expect(page.locator('.device')).toHaveCount(21);
  await check('all resources/links rendered and baseline labeled',async()=>{
    await expect(page.locator('.edge')).toHaveCount(26);
    await expect(page.locator('.document-status')).toContainText('NOT LIVE');
    await expect(page.locator('#simulation-banner')).toBeHidden();
    await expect(page.locator('.device.failed,.device.affected')).toHaveCount(0);
  });
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  await check('click device, management link safety and nested VM details',async()=>{
    await page.locator('[data-node-id="pbs"]').click();
    await expect(page.locator('#inspector')).toContainText('Unraid');
    await expect(page.locator('#inspector .management-link')).toHaveAttribute('rel','noopener noreferrer');
    await expect(page.locator('#inspector')).toContainText('No direct Proxmox VMID');
  });
  await check('device failure and restoration are local and visible',async()=>{
    await page.locator('#toggle-fault').click();
    await expect(page.locator('[data-node-id="pbs"]')).toHaveClass(/failed/);
    await expect(page.locator('#simulation-banner')).toBeVisible();
    await expect(page.locator('[data-node-id="app"]')).not.toHaveClass(/affected|failed/);
    await page.locator('#toggle-fault').click();
    await expect(page.locator('#simulation-banner')).toBeHidden();
  });
  await check('scenario host cascade and replacement semantics',async()=>{
    await page.selectOption('#scenario','node304-loss');
    for(const id of ['unraid','pbs','app','exp'])await expect(page.locator(`[data-node-id="${id}"]`)).toHaveClass(/affected/);
    await page.selectOption('#scenario','dns-loss');
    await expect(page.locator('[data-node-id="net"]')).toHaveClass(/failed/);
    for(const id of ['ap','enterprise','flex','node304'])await expect(page.locator(`[data-node-id="${id}"]`)).not.toHaveClass(/affected|failed/);
    await page.locator('#banner-clear').click();
    await expect(page.locator('.device.failed,.device.affected')).toHaveCount(0);
  });
  await check('search service, empty state, keyboard selection',async()=>{
    await page.locator('#search').fill('Vaultwarden');
    await expect(page.locator('.search-result')).toHaveCount(1);
    await page.locator('#search').press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(page.locator('#inspector h2')).toHaveText('app');
    await page.locator('#search').fill('zz-no-such-host');
    await expect(page.locator('#search-results')).toContainText('No resources found');
    await page.keyboard.press('Escape'); await expect(page.locator('#search-results')).toBeHidden();
    await page.locator('#reset-view').click();
  });
  await check('VLAN filter dims unrelated devices and resets',async()=>{
    await page.selectOption('#zone','iot');
    await expect(page.locator('[data-node-id="app"]')).toHaveClass(/dimmed/);
    await expect(page.locator('[data-node-id="ha"]')).not.toHaveClass(/dimmed/);
    await page.locator('#reset-view').click();
    await expect(page.locator('.device.dimmed')).toHaveCount(0);
  });
  await check('cable inspection is keyboard accessible',async()=>{
    await page.locator('[data-link-id="lagg"]').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#inspector')).toContainText('Not a 20G single-flow');
    await page.keyboard.press('Escape');await expect(page.locator('#inspector')).toContainText('A map, not a monitor');
  });
  await check('zoom, wheel, drag, fit and keyboard panning',async()=>{
    const before=await page.locator('#world').getAttribute('transform');
    await page.locator('#zoom-in').click(); expect(await page.locator('#world').getAttribute('transform')).not.toBe(before);
    await page.locator('#fit').click(); expect(await page.locator('#world').getAttribute('transform')).toBe(before);
    const b=await page.locator('#network').boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height-90);await page.mouse.wheel(0,-150);
    await expect(page.locator('#world')).not.toHaveAttribute('transform',before);
    const wheel=await page.locator('#world').getAttribute('transform');
    await page.mouse.down();await page.mouse.move(b.x+b.width/2+70,b.y+b.height-120,{steps:8});await page.mouse.up();
    expect(await page.locator('#world').getAttribute('transform')).not.toBe(wheel);
    await page.locator('#network').focus(); const drag=await page.locator('#world').getAttribute('transform');await page.keyboard.press('ArrowRight');
    expect(await page.locator('#world').getAttribute('transform')).not.toBe(drag);
    await page.locator('#fit').click();
  });
  await check('decorative flow toggle respects reduced motion',async()=>{
    await page.locator('#flow').click();await expect(page.locator('#flow')).toHaveAttribute('aria-pressed','true');
    expect(await page.locator('.edge-flow').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
    await page.locator('#flow').click();
  });
  await page.locator('#reset-view').click();await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  await page.selectOption('#scenario','protectli-loss');await page.screenshot({path:'artifacts/failure.png',fullPage:true});await page.locator('#banner-clear').click();
  await check('mobile layout, search and inspector remain usable',async()=>{
    await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#search').fill('192.168.10.21');await page.locator('.search-result').click();
    await expect(page.locator('#inspector h2')).toHaveText('Proxmox Backup');
    await page.locator('#toggle-fault').click();await expect(page.locator('[data-node-id="pbs"]')).toHaveClass(/failed/);
    await page.locator('#toggle-fault').click();await page.locator('#reset-view').click();
    await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  });
  await check('narrow phone layout has no horizontal overflow',async()=>{
    await page.setViewportSize({width:320,height:740}); await page.locator('#fit').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator('#zoom-in')).toBeInViewport();
  });
  await check('touch pinch zoom changes camera',async()=>{
    await page.locator('#network').scrollIntoViewIfNeeded();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    const r=await page.locator('#network').boundingBox(), x=r.x+r.width/2,y=r.y+r.height/2;
    const before=await page.locator('#world').getAttribute('transform');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#world')).not.toHaveAttribute('transform',before);
    await cdp.detach();
  });
  await check('no console errors or unsolicited external requests',async()=>{expect(errors).toEqual([]);expect(outbound).toEqual([]);});
  console.log(`Browser acceptance: ${checks} checks passed; no external device operations.`);
}finally{await context.close();await browser.close();}
