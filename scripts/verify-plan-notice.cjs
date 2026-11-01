const {chromium,_electron:electron}=require('../output/upstream/node_modules/@playwright/test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const native=process.argv.includes('--native');
 let browser,app;
 try{
  let page;
  if(native){
   const profile=path.resolve(__dirname,'../output/plan-notice/native-'+Date.now());
   app=await electron.launch({executablePath:path.resolve(__dirname,'../output/upstream/.tmp/app-builds/linux-unpacked/superproductivity'),args:['--no-sandbox','--user-data-dir='+profile],env:{...process.env,XDG_CONFIG_HOME:profile+'/config',XDG_CACHE_HOME:profile+'/cache'}});
   const window=await app.firstWindow();await window.setViewportSize({width:1172,height:805});
   const handle=await window.waitForSelector('iframe[title="Calm Work"]',{timeout:60000});
   const frame=await handle.contentFrame();await frame.waitForFunction(()=>window.CalmRuntime?.ready(),null,{timeout:60000});
   page={evaluate:frame.evaluate.bind(frame),locator:frame.locator.bind(frame),keyboard:window.keyboard,screenshot:window.screenshot.bind(window)};
  }else{
   browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
   page=await browser.newPage({viewport:{width:1172,height:805}});
   await page.goto('file://'+path.resolve(__dirname,'../apps/desktop/ui/keyboard-review.html'));
  }
  await page.evaluate(()=>{
   window.calmRuntimeMode=true;window.calmReference=false;window.calmProviderEvents={};
   state.active=null;state.sessions=[];state.liveSession=null;state.localEvents=[];
   tasks.splice(0,tasks.length,{id:'plan-notice',title:'Synthetic planned task',project:'',date:calmToday(),schedule:'10:00',estimate:60,done:false});
   show('plan');
   document.querySelector('.calendar-wrap').dataset.identity='preserved';
   state.localEvents.push({id:'overlap',title:'Synthetic overlapping meeting',date:calmToday(),start:'10:30',end:'11:30',owned:true});
   repaintPlan();
  });
  assert.equal(await page.locator('.plan-toolbar .calendar-conflict-notice').count(),1);
  assert.equal(await page.locator('.plan-layout > .calendar-conflict-notice').count(),0);
  assert.equal(await page.locator('.calendar-wrap').getAttribute('data-identity'),'preserved');
  assert.equal(await page.locator('.calendar-conflict-notice').textContent(),'1 overlap');
  const notice=await page.locator('.calendar-conflict-notice').boundingBox();
  assert.ok(notice.width<120&&notice.height<30,'notice stays a small badge');
  const expanded=await page.locator('.calendar-wrap').boundingBox();
  await page.locator('#toggle-plan-tasks').click();
  assert.equal(await page.locator('.plan-tasks').count(),0);
  assert.equal(await page.locator('#toggle-plan-tasks').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'toggle-plan-tasks');
  const collapsed=await page.locator('.calendar-wrap').boundingBox();
  assert.ok(collapsed.width>expanded.width+200,'calendar reclaims sidebar width');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.plan-tasks').count(),1);
  assert.equal(await page.locator('#toggle-plan-tasks').getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>openEvent('overlap'));
  assert.equal(await page.locator('.plan-toolbar .calendar-conflict-notice').count(),1);
  await page.evaluate(()=>{state.localEvents=[];repaintPlan();});
  assert.equal(await page.locator('.calendar-conflict-notice').count(),0);
  await page.evaluate(()=>{state.localEvents=[{id:'again',title:'Synthetic second overlap',date:calmToday(),start:'10:30',end:'11:30',owned:true}];repaintPlan();});
  assert.equal(await page.locator('.plan-toolbar .calendar-conflict-notice').count(),1);
  fs.mkdirSync('output/plan-notice',{recursive:true});
  await page.screenshot({path:'output/plan-notice/'+(native?'native-':'')+'compact-with-editor.png'});
  await page.locator('#close-drawer').click();
  await page.locator('#toggle-plan-tasks').click();
  await page.evaluate(()=>{show('track');show('plan');});
  assert.equal(await page.locator('.plan-tasks').count(),0,'collapse preference survives navigation');
  console.log('PASS: compact toolbar notice on initial render and dynamic refresh, no calendar column, preserved grid, collapsible tasks, keyboard focus and navigation preference.');
 }finally{await app?.close();await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
