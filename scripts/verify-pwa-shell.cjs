// Production shell proof using a fresh synthetic browser profile, never live accounts.
const { chromium, devices } = require('../output/upstream/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {serve} = require('./lib-static-server.cjs');
(async () => {
  const remote = process.argv.indexOf('--url');
  const remoteUrl = remote >= 0 ? process.argv[remote + 1] : null;
  const {server,port} = remoteUrl ? {server:null,port:0} : await serve(path.resolve(__dirname,'../output/pwa-public'));
  const baseUrl = remoteUrl || `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context = await browser.newContext({...devices['iPhone 13']});
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(baseUrl + '/');
    const frame=page.frameLocator('iframe[title="Calm Work"]');
    await frame.locator('#phone-add').waitFor({timeout:60000});
    assert.equal(await frame.locator('[data-show="plan"]:visible').count(), 0);
    await frame.locator('body').evaluate(() => show('plan'));
    assert.equal(await frame.locator('#screen-title').textContent(), 'Track');
    await frame.locator('body').evaluate(() => { state.view = 'plan'; renderScreen(); });
    assert.equal(await frame.locator('#screen .calendar-wrap').count(), 0);
    await frame.locator('#phone-add').click();
    await frame.locator('#add-title').fill('Synthetic PWA daily task');
    await frame.locator('.add-submit').click();
    await frame.getByText('Synthetic PWA daily task',{exact:true}).waitFor();
    await frame.locator('body').evaluate(()=>CalmRuntime.flush());
    // Dispatch the same resize Safari emits for its software keyboard.
    await page.evaluate(()=>{
      Object.defineProperty(visualViewport,'height',{configurable:true,value:300});
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(()=>document.querySelector('calm-shell').getBoundingClientRect().height===300);
    assert.ok((await page.locator('iframe[title="Calm Work"]').boundingBox()).height<=300);
    await page.evaluate(()=>{
      delete visualViewport.height;
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.reload();
    await frame.getByText('Synthetic PWA daily task',{exact:true}).waitFor({timeout:60000});
    await page.setViewportSize({width:844,height:390});
    await frame.locator('body[data-phone-focus="true"]').waitFor({timeout:5000});
    const desktop = await browser.newContext();
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(baseUrl + '/');
    const desktopFrame = desktopPage.frameLocator('iframe[title="Calm Work"]');
    await desktopFrame.locator('#phone-add').waitFor({state:'attached',timeout:60000});
    assert.ok(await desktopFrame.locator('[data-show="plan"]:visible').count() > 0);
    await desktop.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: iOS Plan hidden with route/restore fallback, desktop Plan retained, PWA capture, reload, viewport and landscape navigation.');
  } finally {await browser.close();server?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
