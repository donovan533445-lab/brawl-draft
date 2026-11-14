const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const B=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/brawlers.json'),'utf8')).list;
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('brawl-draft-v1')));
async function selectThreeBans(page){
 const before=(await saved(page))?.history.length||0;
 const ids=await page.locator('.hero-main:not([disabled])').evaluateAll(rows=>rows.slice(0,3).map(row=>Number(row.dataset.id)));
 assert.equal(ids.length,3);
 for(let i=0;i<3;i++){
  await page.locator(`.hero-main[data-id="${ids[i]}"]`).click();
  assert.equal(await page.locator('.ban-slot.pending').count(),i+1);
  assert.equal(await page.locator('[data-action="confirm"]').isEnabled(),i===2);
 }
 await page.locator('[data-action="confirm"]').click();
 const history=(await saved(page)).history;
 assert.equal(history.length,before+3,'one confirmation should commit a complete ban group');
 assert.ok(history.slice(-3).every(row=>row.type==='ban'&&row.groupId===history.at(-1).groupId));
 assert.equal(await page.locator('.ban-slot.pending').count(),0);
 return ids;
}
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const output=process.env.QA_OUTPUT_DIR||'./work/qa';fs.mkdirSync(output,{recursive:true});
 const snapshot=async name=>page.screenshot({path:`${output}/${name}.png`,fullPage:true});
 try{
  await page.goto(base);await page.waitForSelector('.hero-card');
  assert.equal(await page.locator('.hero-card').count(),B.length);
  await selectThreeBans(page);await selectThreeBans(page);
  for(let i=0;i<6;i++){await page.locator('.hero-main:not([disabled])').first().click();await page.locator('[data-action="confirm"]').click();}
  assert.match(await page.locator('.turn-strip').innerText(),/BP 完成/);
  assert.equal(await page.locator('.pick-slot.filled').count(),6);assert.equal(await page.locator('.ban-slot.filled').count(),6);
  await snapshot('desktop-complete');
  await page.reload();await page.waitForSelector('.turn-strip.complete');
  await page.locator('[data-action="undo"]').click();assert.equal(await page.locator('.pick-slot.filled').count(),5);
  await page.locator('.desktop-nav [data-page="brawlers"]').click();await page.waitForSelector('#library-grid');
  await page.locator('#hero-search').fill('雪莉');assert.equal(await page.locator('#library-grid .hero-card').count(),1);
  await page.locator('[data-action="toggle-pool"]').click();await page.locator('.hero-main').click();await page.waitForSelector('dialog[open]');
  assert.match(await page.locator('#modal-body').innerText(),/随身妙具/);await page.locator('.close-dialog').click();
  await page.locator('.desktop-nav [data-page="pool"]').click();await page.waitForSelector('.pool-row');assert.equal(await page.locator('.pool-row.is-owned').count(),1);
  await page.locator('[data-pool-field="level"]').first().selectOption('11');
  await page.reload();await page.waitForSelector('.pool-row');assert.equal(await page.locator('[data-pool-field="level"]').first().inputValue(),'11');
  await page.locator('.desktop-nav [data-page="maps"]').click();await page.waitForSelector('.map-card');
  await page.locator('#map-search').fill('Shooting Star');assert.equal(await page.locator('.map-card').count(),1);
  await page.locator('.map-card').click();await page.locator('[data-action="use-map"]').click();await page.locator('#confirm-reset').click();await page.waitForSelector('.draft-toolbar');
  assert.match(await page.locator('.map-trigger').innerText(),/流星/);assert.equal(await page.locator('.pick-slot.filled').count(),0);
  await page.locator('.desktop-nav [data-page="tier"]').click();await page.waitForSelector('.tier-row');
  assert.equal(await page.locator('.tier-member').count(),B.filter(b=>b.released).length);
  for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});
   for(const route of ['draft','brawlers','maps','tier','pool']){
    await page.goto(`${base}/#${route}`);await page.waitForSelector('.page-heading');await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width} ${route}`);
   }
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/#draft');await page.waitForSelector('.hero-card');
  await snapshot('iphone-draft');await selectThreeBans(page);assert.equal(await page.locator('.ban-slot.filled').count(),3);
  await page.locator('[data-action="undo"]').click();assert.equal(await page.locator('.ban-slot.filled').count(),0);
  assert.equal(await page.locator('.ban-slot.pending').count(),3,'mobile undo restores the editable batch');
  await page.locator('[data-action="clear-ban-selection"]').click();assert.equal(await page.locator('.ban-slot.pending').count(),0);
  assert.equal(await page.locator('[data-action="confirm"]').isEnabled(),false);
  await page.locator('.help-button').click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: two batch bans plus six individual picks, undo/storage, database/pool/map/tier, 25 responsive page checks, mobile batch confirm/undo/clear and dialogs; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
