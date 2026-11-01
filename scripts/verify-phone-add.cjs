// Phone add sheet, row tap, Larger Text and launch images in the staged PWA.
// Safari engine with a fresh profile and synthetic tasks; not a physical iPhone check.
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
 const engine=arg('--engine')||'webkit';
 const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='webkit'?{...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE}:{})}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({...devices['iPhone 13'],reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');
  assert.equal(await page.locator('link[rel="apple-touch-startup-image"]').count(),20,'launch image per iPhone size and orientation');
  const launch=await page.locator('link[rel="apple-touch-startup-image"]').first().getAttribute('href');
  assert.equal((await page.request.get(base+'/'+launch)).status(),200,'launch image is served');
  const frame=page.frameLocator('iframe[title="Calm Work"]');
  const body=frame.locator('body');
  await frame.locator('#phone-add').waitFor({timeout:60000});
  await expect(body).toHaveAttribute('data-phone-focus','true');

  await frame.locator('#phone-add').click();
  await expect(frame.locator('#add-quick')).toBeVisible();
  await expect(frame.locator('[data-add-field="schedule"]')).toBeHidden();
  await expect(frame.locator('.add-submit')).toBeDisabled();
  await expect(frame.locator('.add-submit')).toHaveText(/Add task/);
  await expect(frame.locator('[data-quick-day="today"]')).toHaveAttribute('aria-pressed','true');
  assert.equal(await frame.locator('#add-title').getAttribute('enterkeyhint'),'done');
  await frame.locator('#add-title').fill('Synthetic phone add');
  await expect(frame.locator('.add-submit')).toBeEnabled();
  await frame.locator('[data-quick-day="tomorrow"]').click();
  await expect(frame.locator('[data-quick-day="tomorrow"]')).toHaveAttribute('aria-pressed','true');
  await expect(frame.locator('#add-title')).toBeFocused();
  await frame.locator('[data-quick-estimate="30"]').click();
  await expect(frame.locator('[data-quick-estimate="30"]')).toHaveAttribute('aria-pressed','true');
  await frame.locator('#add-quick-time').fill('09:30');
  await expect(frame.locator('.add-chip-picker:has(#add-quick-time)')).toHaveText('09:30');
  await frame.locator('[data-quick-estimate="other"]').click();
  assert.equal(await frame.locator('#add-field-value').getAttribute('inputmode'),'decimal');
  await frame.locator('#add-field-value').fill('45');
  await frame.locator('#add-field-value').press('Enter');
  await expect(frame.locator('[data-quick-estimate="other"]')).toHaveText('45 min');
  for(const chip of await frame.locator('.add-chip').all()){
   const box=await chip.boundingBox();if(box)assert.ok(box.height>=44,'chip is a 44pt target');
  }
  const sheet=await frame.locator('.add-bar').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth}));
  assert.ok(sheet.overflow<=1,'sheet has no sideways scroll');
  await frame.locator('.add-submit').click();
  await expect(frame.locator('#add-overlay')).toBeHidden();
  await expect(frame.getByText('Added to Inbox.',{exact:true})).toBeVisible();
  const added=await body.evaluate(()=>{const t=tasks.find(t=>t.title==='Synthetic phone add');return {date:t.date,schedule:t.schedule,estimate:t.estimate,tomorrow:calmTomorrow()};});
  assert.deepEqual([added.date,added.schedule,added.estimate],[added.tomorrow,'09:30',45]);

  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="inbox"]').click();
  const row=frame.locator('#screen [data-row]').filter({hasText:'Synthetic phone add'});
  const expected=await body.evaluate((_,d)=>new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}),added.date);
  await expect(row.locator('[data-inline="date"]')).toHaveText(expected);
  await row.locator('.task-name').first().click();
  await expect(frame.locator('#drawer-content')).toBeVisible();
  await expect(frame.locator('#drawer-content input[name="estimate"]')).toHaveAttribute('inputmode','decimal');
  await frame.locator('#close-drawer').click();

  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="track"]').click();
  for(const size of [{width:375,height:667},{width:390,height:844},{width:932,height:430}]){
   await page.setViewportSize(size);
   await expect(body).toHaveAttribute('data-phone-focus','true');await page.waitForTimeout(300);
   await body.evaluate(()=>calmApplyTextScale(17*1.6));
   await expect(body).toHaveAttribute('data-text-scale','1.60');
   await expect.poll(()=>body.evaluate(()=>{const nav=document.getElementById('mobile-nav').getBoundingClientRect();return Math.abs(document.documentElement.getBoundingClientRect().height-nav.bottom)<3&&document.documentElement.scrollWidth-document.documentElement.clientWidth<=1;})).toBe(true);
   await frame.locator('#phone-add').click();
   const fits=await frame.locator('.add-bar').evaluate(el=>({sideways:el.scrollWidth-el.clientWidth,submit:!!el.querySelector('.add-submit').getClientRects().length}));
   assert.ok(fits.sideways<=1&&fits.submit,JSON.stringify({size,fits}));
   await frame.locator('#close-add').click();
  }
  await body.evaluate(()=>calmApplyTextScale(17));
  await expect(body).toHaveAttribute('data-text-scale','1.00');
  assert.equal(await body.evaluate(()=>document.documentElement.style.zoom),'');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS (${engine}): add sheet day, time and length chips; numeric minutes; Inbox toast; en-GB date chip; row tap opens details; text at 160% on three sizes; 20 launch images.`);
 }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exit(1);});
