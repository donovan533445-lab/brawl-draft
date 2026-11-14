const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs');const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.hero-card');
 const output=process.env.QA_OUTPUT_DIR||'./work/qa';fs.mkdirSync(output,{recursive:true});
 const snapshot=async name=>page.screenshot({path:`${output}/${name}.png`,fullPage:true});
 assert.equal(await page.locator('.hero-card').count(),109);
 for(let i=0;i<12;i++){await page.locator('.hero-main:not([disabled])').first().click();await page.locator('[data-action="confirm"]').click();}
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
 await page.locator('.desktop-nav [data-page="tier"]').click();await page.waitForSelector('.tier-row');assert.equal(await page.locator('.tier-member').count(),108);
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:844});for(const route of ['draft','brawlers','maps','tier','pool']){await page.goto(`http://127.0.0.1:4173/#${route}`);await page.waitForSelector('.page-heading');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width} ${route}`);}}
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4173/#draft');await page.waitForSelector('.hero-card');await snapshot('iphone-draft');
 await page.locator('.hero-main:not([disabled])').first().click();assert.equal(await page.locator('[data-action="confirm"]').isEnabled(),true);
 await page.locator('[data-action="confirm"]').click();assert.equal(await page.locator('.ban-slot.filled').count(),1);
 await page.locator('.help-button').click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: full draft, undo, storage, database, pool, map switch, tier, 25 responsive page checks, mobile interaction, dialogs; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
