// Launch path of the staged PWA: the lean offline worker, offline start, the Angular update-check
// reply, and the saved last screen shown while the app starts. Fresh profiles, synthetic tasks.
const {webkit,chromium,devices,expect}=require('../output/upstream/node_modules/@playwright/test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {serve}=require('./lib-static-server.cjs');
const root=path.resolve(__dirname,'..');
const arg=(name)=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
(async()=>{
 const remote=arg('--url');
 const {server,port}=remote?{server:null,port:0}:await serve(path.join(root,'output/pwa-public'));
 const base=remote||`http://127.0.0.1:${port}`;
 const engine=arg('--engine')||'chromium';
 const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='webkit'?{...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE}:{})}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({...devices['iPhone 13'],reducedMotion:'reduce'});
  await context.route(/^(?!https?:\/\/(127\.0\.0\.1|calm-work\.pages\.dev))/,r=>r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const frame=page.frameLocator('iframe[title="Calm Work"]');
  await page.goto(base+'/');
  await frame.locator('#phone-add').waitFor({timeout:60000});
  await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();const name=(await caches.keys()).find(k=>k.startsWith('calm-'));return r?.active?.state==='activated'&&!!name&&(await (await caches.open(name)).keys()).length>300;}),{timeout:60000}).toBe(true);
  const cache=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('calm-'));const c=await caches.open(name);const keys=(await c.keys()).map(r=>new URL(r.url).pathname);return {name,count:keys.length,shell:keys.includes('/'),renderer:keys.includes('/assets/calm/keyboard-review'),ngsw:(await caches.keys()).filter(k=>k.startsWith('ngsw')).length};});
  assert.ok(cache.count>300&&cache.shell&&cache.renderer,JSON.stringify(cache));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});

  const reply=await page.evaluate(()=>new Promise((resolve,reject)=>{const nonce=4242;const on=(e)=>{if(e.data?.type==='OPERATION_COMPLETED'&&e.data.nonce===nonce){navigator.serviceWorker.removeEventListener('message',on);resolve(e.data.result);}};navigator.serviceWorker.addEventListener('message',on);navigator.serviceWorker.controller.postMessage({action:'CHECK_FOR_UPDATES',nonce});setTimeout(()=>reject(new Error('no reply')),3000);}));
  assert.equal(reply,false,'update check answers at once');

  await frame.locator('#phone-add').click();
  await frame.locator('#add-title').fill('Synthetic launch snapshot task');
  await frame.locator('.add-submit').click();
  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="track"]').click();
  await frame.locator('body').evaluate(()=>CalmRuntime.flush());
  await frame.locator('body').evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('calm-launch-snapshot')||'null'));
  assert.ok(saved?.html.includes('Synthetic launch snapshot task'),'last screen saved on hide');
  assert.ok(!saved.html.includes('<script'),'saved screen has no scripts');

  await page.addInitScript(()=>{
   window.__launch={};
   new MutationObserver(()=>{const cover=document.querySelector('body > div[aria-hidden="true"] > iframe');if(cover&&!window.__launch.cover)window.__launch.cover=Math.round(performance.now());if(window.__launch.cover&&!cover&&!window.__launch.lifted)window.__launch.lifted=Math.round(performance.now());}).observe(document,{childList:true,subtree:true});
  });
  await page.reload();
  await frame.getByText('Synthetic launch snapshot task',{exact:true}).first().waitFor({timeout:60000});
  await page.waitForFunction(()=>window.__launch.lifted,null,{timeout:20000});
  const launch=await page.evaluate(()=>({...window.__launch,ready:Math.round(performance.now()),worker:performance.getEntriesByType('navigation')[0].workerStart>0||performance.getEntriesByType('navigation')[0].transferSize===0}));
  assert.ok(launch.cover<launch.lifted,'cover shows before the live screen');
  assert.ok(launch.worker,'navigation answered by the worker');

  if(engine==='chromium'){
   await context.setOffline(true);
   await page.reload();
   await frame.getByText('Synthetic launch snapshot task',{exact:true}).first().waitFor({timeout:60000});
   await context.setOffline(false);
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS (${engine}): lean worker cached ${cache.count} files incl. shell and renderer; update check replies at once; last screen saved without scripts; cover at ${launch.cover} ms, lifted at ${launch.lifted} ms${engine==='chromium'?'; offline launch shows tasks':''}.`);
 }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exit(1);});
