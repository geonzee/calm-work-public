const {_electron:electron}=require('../output/upstream/node_modules/@playwright/test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),profile=path.join(root,'output/recovery-native-'+Date.now());
let app;
async function launch(){app=await electron.launch({executablePath:path.join(root,'scripts/launch-core.sh'),args:['--no-sandbox'],env:{...process.env,CALM_WORK_PROFILE:profile}});const page=await app.firstWindow();const frame=page.frameLocator('iframe[title="Calm Work"]');await frame.locator('#global-add').waitFor({timeout:60000});await frame.locator('body').evaluate(async()=>{for(let i=0;i<100&&!CalmRuntime.ready();i++)await new Promise(r=>setTimeout(r,50));});return{page,frame};}
function fixture(){const now=Date.now(),day=new Date().toLocaleDateString('en-CA');return {format:'calm-work-workspace',version:1,document:{tasks:[{id:'restore-task',title:'Restored task',project:'Alpha',date:day,schedule:'09:00',estimate:25,done:false,today:true,nativeMs:20000,nativeDays:{[day]:20000}}],projects:['Alpha'],sessions:[{id:'restore-task',sessionKey:'restore-entry',title:'Restored task',project:'Alpha',date:day,start:'08:00',end:'08:00',startMinute:480,endMinute:480.15,focusedSeconds:9,duration:.15,estimate:25,recorded:true,dailyMs:{[day]:9000}}],events:[{id:'restored-event',title:'Local meeting',date:day,start:'14:00',end:'14:30',calendar:'Local calendar',owned:true}],drafts:{$capture:{title:'Draft +Alpha',active:true,project:'Alpha',estimate:'25'}},clock:{active:'restore-task',running:false,startedAt:now-4000,resumedAt:now,elapsedMs:4000,estimate:25,nativeStartMs:16000,nativeStartDays:{[day]:16000},dailyMs:{[day]:4000}}}};}
(async()=>{let {page,frame}=await launch();const archive=fixture();
 try{
  await page.evaluate(()=>{const service=window.ng.getComponent(document.querySelector('calm-shell'))._workspace;const put=service._put.bind(service);service._put=async(id,value)=>{if(value.kind==='session')throw new Error('Synthetic interrupted restore');return put(id,value);};});
  const interrupted=await frame.locator('body').evaluate(async (_element, archive)=>{try{await CalmRuntime.restore(archive);return '';}catch(error){return error.message;}},archive);assert.match(interrupted,/Synthetic interrupted restore/);
  await page.evaluate(async()=>{await window.ng.getComponent(document.querySelector('calm-shell'))._workspace._writes.flushPendingWrites();});
  await app.evaluate(({app})=>app.exit(0));app=null;({page,frame}=await launch());
  await frame.locator('#workspace-recovery').waitFor();
  await frame.locator('#recovery-file').setInputFiles({name:'workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
  await frame.locator('#recovery-apply').click();await frame.locator('#workspace-recovery').waitFor({state:'detached'});
  const recovered=await frame.locator('body').evaluate(()=>CalmRuntime.snapshot());
  assert.equal(recovered.tasks.length,1);assert.equal(recovered.sessions.length,1);assert.equal(recovered.events.length,1);assert.equal(recovered.clock.running,false);assert.equal(recovered.clock.elapsedMs,4000);assert.equal(recovered.tasks[0].nativeMs,16000);assert.equal(recovered.drafts.$capture.title,'Draft +Alpha');
  await frame.locator('body').evaluate(async()=>{tasks[0].title='Keep new local edit';await CalmRuntime.flush();});
  await frame.locator('body').evaluate((_element, archive)=>CalmRuntime.restore(archive),archive);
  assert.equal(await frame.locator('body').evaluate(()=>tasks[0].title),'Keep new local edit');
  const changed=structuredClone(archive);changed.document.tasks[0].title='Other backup';
  const rejected=await frame.locator('body').evaluate(async (_element, archive)=>{try{await CalmRuntime.restore(archive);return '';}catch(error){return error.message;}},changed);assert.match(rejected,/empty workspace/);
  await frame.locator('body').evaluate(()=>finishTask());await frame.locator('body').evaluate(()=>CalmRuntime.flush());
  const finished=await frame.locator('body').evaluate(()=>CalmRuntime.snapshot());assert.equal(finished.clock,null);assert.equal(finished.tasks[0].nativeMs,20000);assert.equal(finished.sessions.length,2);
  console.log('PASS: interrupted durable recovery resumes without duplicate tasks/time, paused clock and drafts survive, exact totals finish correctly, replay keeps subsequent edits and nonempty restore is rejected.');
 }finally{if(app)await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
