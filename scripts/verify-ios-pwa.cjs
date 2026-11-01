// Safari-engine coverage of the production shell; fresh profiles and synthetic data only.
// WebKit is not a substitute for physical iOS toolbar, keyboard and Home Screen checks.
const {chromium,webkit,devices,expect}=require('../output/upstream/node_modules/@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
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
 const out=path.join(root,'output/ios-pwa-'+engine);fs.mkdirSync(out,{recursive:true});
 const results=[];
 try{
  for(const protection of ['best-effort','persistent','unavailable','error']){
   const context=await browser.newContext({...devices['iPhone 13'],reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   await context.addInitScript((protection)=>{
    if(window.top!==window)return;
    if(protection==='unavailable')Object.defineProperty(navigator,'storage',{configurable:true,value:undefined});
    else {
     const storage=navigator.storage || {};
     for(const name of ['persisted','persist'])Object.defineProperty(storage,name,{configurable:true,value:async()=>{if(protection==='error')throw Error('Storage policy unavailable');return protection==='persistent';}});
     Object.defineProperty(navigator,'storage',{configurable:true,value:storage});
    }
   },protection);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/');
   const frame=page.frameLocator('iframe[title="Calm Work"]');
   await frame.locator('#phone-add').waitFor({timeout:60000});
   await page.waitForFunction(()=>!!document.querySelector('calm-shell'));
   await frame.locator('#sync-chip').click();
   await frame.locator('#device-checks summary').click();
   await frame.locator('#device-checks-output').waitFor();
   await expect(frame.locator('#device-checks-output')).not.toHaveValue('');
   const diagnostics=JSON.parse(await frame.locator('#device-checks-output').inputValue());
   assert.equal(diagnostics.storageProtection,protection==='error'?'unavailable':protection);
   assert.equal(await page.getByText('Data will not be persisted permanently.',{exact:false}).count(),0);
   assert.equal(await frame.locator('#storage-notice').isVisible(),protection!=='persistent');
   await frame.locator("#mobile-more").click();
   await frame.locator('#mobile-menu [data-show="track"]').click();
   if(protection==='best-effort'){
    for(const standalone of [false,true]){
     await page.evaluate(standalone=>Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone}),standalone);
     await page.addStyleTag({content:`calm-shell{padding-top:${standalone?47:0}px!important;padding-bottom:${standalone?34:0}px!important;}calm-shell[data-keyboard="true"]{padding-bottom:0!important;}`});
     for(const size of [{width:375,height:667},{width:393,height:852},{width:430,height:932},{width:430,height:1200},{width:932,height:430}]){
      await page.setViewportSize(size);
      await expect(frame.locator("body")).toHaveAttribute("data-phone-focus","true");
      await expect.poll(async()=>Math.round((await page.locator("calm-shell").boundingBox()).height)).toBe(size.height);
      await expect.poll(async()=>frame.locator('body').evaluate(()=>Math.abs(innerHeight-document.getElementById('mobile-nav').getBoundingClientRect().bottom)<2)).toBe(true);
      const measurements=await frame.locator('body').evaluate(()=>({frameHeight:innerHeight,bodyHeight:document.body.getBoundingClientRect().height,navBottom:document.getElementById('mobile-nav').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth-innerWidth,phone:document.body.dataset.phoneFocus,pointer:matchMedia("(pointer: coarse)").matches,navDisplay:getComputedStyle(document.getElementById("mobile-nav")).display}));
      assert.ok(Math.abs(measurements.frameHeight-measurements.navBottom)<2,JSON.stringify({size,standalone,measurements}));
      assert.ok(Math.abs(measurements.frameHeight-measurements.bodyHeight)<2,'body fills actual iframe');
      assert.ok(measurements.overflow<=1);
      await frame.locator('#phone-add').click();
      const sheet=await frame.locator('.add-bar').boundingBox();const iframe=await page.locator('iframe').boundingBox();
      assert.ok(Math.abs(sheet.y+sheet.height-iframe.y-iframe.height)<2,'capture docks to frame bottom');
      await frame.locator('#close-add').click();
      results.push({standalone,size,...measurements});
     }
     // Safari changes the visible viewport independently of the layout viewport,
     // and pans it during focus. This reproduces that geometry, not an iOS keyboard.
     await page.setViewportSize({width:393,height:852});
     await frame.locator('#phone-add').click();
     await frame.locator('#add-title').fill('Synthetic Safari keyboard capture');
     await page.evaluate(()=>{
      Object.defineProperty(visualViewport,'height',{configurable:true,value:300});
      Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:220});
      visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'));
     });
     await page.waitForFunction(()=>{const r=document.querySelector('calm-shell').getBoundingClientRect();return Math.abs(r.top-220)<1&&Math.abs(r.height-300)<1;});
     await frame.locator('.add-submit').scrollIntoViewIfNeeded();
     const submit=await frame.locator('.add-submit').boundingBox();
     assert.ok(submit.y>=220&&submit.y+submit.height<=521,'submit reachable in panned visual viewport');
     await page.screenshot({path:path.join(out,standalone?'standalone-keyboard.png':'browser-keyboard.png')});
     await frame.locator('.add-submit').click();
     await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'));});
     await frame.locator('body').evaluate(()=>CalmRuntime.flush());
     await page.reload();
     await frame.getByText('Synthetic Safari keyboard capture',{exact:true}).first().waitFor({timeout:60000});
     await page.screenshot({path:path.join(out,standalone?'standalone.png':'browser.png')});
     await frame.locator('body').evaluate(async()=>{
      for(let n=0;n<30;n++)tasks.push({id:'ios-overflow-'+Date.now()+'-'+n,title:'Synthetic long list task '+n,project:'',date:calmToday(),today:true,schedule:'',estimate:10,done:false});
      renderScreen();await CalmRuntime.flush();document.getElementById('screen').scrollTop=100000;
     });
     assert.ok(await frame.locator('#screen').evaluate(el=>el.scrollTop>0),'long task list scrolls independently');
     assert.ok(await frame.locator('body').evaluate(()=>Math.abs(innerHeight-document.getElementById('mobile-nav').getBoundingClientRect().bottom)<2),'list scroll leaves navigation at bottom');

    }
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2)+'\n');
  console.log(`PASS (${engine}): storage granted/denied/unavailable/error; five screen sizes; Safari-tab and simulated standalone safe areas; pinned navigation and capture; panned keyboard viewport; durable reload; no runtime errors.`);
 }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
