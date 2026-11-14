// UI regression fixtures only. These fabricated QA values are intercepted in the
// browser and are never written to production data files or presented as research.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
const readJson = name => JSON.parse(fs.readFileSync(path.join(project, 'dist/data', name + '.json'), 'utf8'));
const initial = [readJson('brawlers'), readJson('maps'), readJson('meta')];
const heroes = initial[0].list.filter(b => b.released);
const defaultMap = initial[1].list.find(m => m.id === 15000007)
  || initial[1].list.find(m => !m.disabled && m.gameMode.name === 'Gem Grab');
const shelly = heroes.find(b => b.name === 'Shelly');
const colt = heroes.find(b => b.name === 'Colt');
assert.ok(shelly && colt && defaultMap, 'QA fixture requires baseline heroes and a draft map');

const letters = ['S', 'A', 'B', 'C', 'D', 'F'];
const fixtureTiers = Object.fromEntries(letters.map(t => [t, []]));
heroes.forEach((b, i) => fixtureTiers[letters[i % letters.length]].push(b.id));
for (const letter of letters) fixtureTiers[letter] = fixtureTiers[letter].filter(id => id !== shelly.id && id !== colt.id);
fixtureTiers.F.push(shelly.id);
fixtureTiers.S.push(colt.id);
const editorialFixture = { sources: [{
  id: 'qa-explicit-youtube-tiers',
  title: 'QA fixture only: explicit author tiers, not a real published ranking',
  creator: 'QA fixture creator',
  url: 'https://www.youtube.com/watch?v=QA_FIXTURE1',
  publishedAt: '2026-11-14', verifiedAt: '2026-11-14',
  notes: 'Automated test fixture only. This is not a source for production ratings.',
  tiers: fixtureTiers
}] };
const now = new Date().toISOString();
const statsFixture = {
  fetchedAt: now,
  source: { name: 'QA measured-data fixture (not production)', url: 'https://qa.example.test/observed-battles',
    updatedAt: now, refreshCadence: 'QA fixtures only; no production measurements' },
  records: heroes.map((b, i) => ({ brawlerId: b.id, mapId: null, mode: null,
    winRate: .42 + i * .0025, battles: 2000 + i * 10 })),
  counters: [], synergies: []
};
statsFixture.records.push(
  { brawlerId: shelly.id, mapId: defaultMap.id, mode: defaultMap.gameMode.name, winRate: .923, battles: 1600 },
  { brawlerId: colt.id, mapId: defaultMap.id, mode: defaultMap.gameMode.name, winRate: .871, battles: 1500 }
);
const emptyStats = { fetchedAt: now, source: statsFixture.source, records: [], counters: [], synergies: [] };

async function installFixtures(context, stats, editorial, history = []) {
  await context.addInitScript(({ mapId, seedHistory }) => {
    localStorage.clear();
    localStorage.setItem('brawl-advice-team', JSON.stringify('blue'));
    localStorage.setItem('brawl-draft-v1', JSON.stringify({ first: 'blue', rule: 'ranked', map: mapId, history: seedHistory }));
  }, { mapId: defaultMap.id, seedHistory: history });
  await context.route('**/data.bundle.js', route => route.fulfill({ status: 200,
    contentType: 'text/javascript; charset=utf-8', body: 'window.BRAWL_DATA=' + JSON.stringify([...initial, editorial, stats]) + ';' }));
  await context.route('**/data/live-stats.json*', route => route.fulfill({ status: 200,
    contentType: 'application/json; charset=utf-8', body: JSON.stringify(stats) }));
}

async function loaded(page) {
  await page.waitForSelector('.draft-recommendations');
  await page.waitForFunction(() => {
    const refresh = document.querySelector('[data-action="refresh-stats"]');
    return refresh && !refresh.disabled;
  });
}

async function recommendationIds(page) {
  return page.locator('#recommendations .recommend-row').evaluateAll(rows => rows.map(row => Number(row.dataset.id)));
}

async function assertCandidateSet(page, used, label) {
  const ids = await recommendationIds(page);
  assert.equal(new Set(ids).size, ids.length, `${label}: duplicate recommended IDs`);
  assert.ok(ids.every(id => !used.has(id)), `${label}: a used hero is still recommended`);
  assert.ok(ids.every(id => heroes.some(b => b.id === id)), `${label}: invalid/unreleased hero recommended`);
  return ids;
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.width, `${label}: horizontal overflow ${dimensions.document} > ${dimensions.width}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const contexts = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await installFixtures(context, statsFixture, editorialFixture);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl + '/#draft'); await loaded(page);
    assert.equal(await page.locator('.hero-card').count(), initial[0].list.length);
    assert.ok((await recommendationIds(page)).length > 0, 'measured evidence should produce candidates');
    assert.equal(await page.locator(`#recommendations .recommend-row[data-id="${shelly.id}"] strong`).innerText(), '92.3%');
    assert.match(await page.locator('#recommendations').innerText(), /QA measured-data fixture/);

    const used = new Set();
    const pickTeams = ['blue', 'red', 'red', 'blue', 'blue', 'red'];
    for (let step = 0; step < 12; step++) {
      const before = await assertCandidateSet(page, used, `before step ${step + 1}`);
      assert.ok(before.length, `step ${step + 1}: candidates unexpectedly empty`);
      const id = before[0];
      const rows = page.locator('#recommendations .recommend-row');
      const shouldDisable = step >= 6 && pickTeams[step - 6] === 'red';
      const states = await rows.evaluateAll(items => items.map(item => item.disabled));
      assert.ok(states.every(value => value === shouldDisable), `step ${step + 1}: blue advice enabled/disabled on the wrong team turn`);
      if (shouldDisable) {
        assert.match(await page.locator('.advice-context').innerText(), /对方正在选人/);
        await page.locator(`.hero-main[data-id="${id}"]`).click();
      } else await page.locator(`#recommendations .recommend-row[data-id="${id}"]`).click();
      assert.equal(await page.locator('[data-action="confirm"]').isEnabled(), true, `step ${step + 1}: selected hero cannot be confirmed`);
      await page.locator('[data-action="confirm"]').click(); used.add(id);
      assert.equal(await page.locator('.ban-slot.filled,.pick-slot.filled').count(), step + 1);
      const after = await assertCandidateSet(page, used, `after step ${step + 1}`);
      assert.ok(!after.includes(id), `step ${step + 1}: newly used hero was not removed automatically`);
      assert.notDeepEqual(after, before, `step ${step + 1}: recommendations did not refresh`);
    }
    assert.match(await page.locator('.turn-strip').innerText(), /BP 完成/);
    assert.equal(await page.locator('.pick-slot.filled').count(), 6);
    assert.equal(await page.locator('.ban-slot.filled').count(), 6);
    assert.ok((await page.locator('#recommendations .recommend-row').evaluateAll(items => items.map(item => item.disabled))).every(Boolean));

    await page.goto(baseUrl + '/#tier'); await page.waitForSelector('.source-banner');
    assert.match(await page.locator('.tier-intro').innerText(), /YouTube 作者榜单/);
    assert.equal(await page.locator('#youtube-source').inputValue(), editorialFixture.sources[0].id);
    assert.equal(await page.locator('.source-banner a').first().getAttribute('href'), editorialFixture.sources[0].url);
    for (const [id, expected] of [[shelly.id, 'F'], [colt.id, 'S']]) {
      const actual = await page.locator(`.tier-member[data-id="${id}"]`).evaluate(button => button.closest('.tier-row').querySelector('h2').textContent);
      assert.equal(actual, expected, `hero ${id}: author-assigned tier was replaced with a class/model tier`);
    }
    assert.equal(await page.locator('.tier-member').count(), heroes.length);
    await page.locator('[data-action="tier-view"][data-view="stats"]').click();
    await page.waitForSelector('.winrate-row');
    const globalRows = statsFixture.records.filter(record => record.mapId === null).sort((a, b) => b.winRate - a.winRate);
    for (const row of globalRows.slice(0, 5)) {
      const displayed = await page.locator(`.winrate-row[data-id="${row.brawlerId}"] strong`).innerText();
      assert.equal(displayed, (row.winRate * 100).toFixed(1) + '%', 'stats board must show the supplied measured percentage');
    }
    assert.equal(await page.locator('.winrate-row').count(), heroes.length);

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(baseUrl + '/#draft'); await loaded(page); await assertNoOverflow(page, `${width}px draft recommendations`);
      await page.goto(baseUrl + '/#tier'); await page.waitForSelector('.tier-view-tabs');
      await page.locator('[data-action="tier-view"][data-view="youtube"]').click(); await assertNoOverflow(page, `${width}px YouTube tiers`);
      await page.locator('[data-action="tier-view"][data-view="stats"]').click(); await assertNoOverflow(page, `${width}px measured win-rate board`);
    }

    const seeded = heroes.slice(0, 8).map((b, i) => ({ id: b.id, type: i < 6 ? 'ban' : 'pick', team: i < 3 || i === 6 ? 'blue' : 'red' }));
    for (const [editorial, label] of [[editorialFixture, 'YouTube-only evidence'], [{ sources: [] }, 'no source evidence']]) {
      const absentContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(absentContext);
      await installFixtures(absentContext, emptyStats, editorial, seeded);
      const absentPage = await absentContext.newPage(); absentPage.on('pageerror', error => errors.push(error.message));
      await absentPage.goto(baseUrl + '/#draft'); await loaded(absentPage);
      const displayedRates = await absentPage.locator('#recommendations .recommend-row strong').allTextContents();
      assert.ok(displayedRates.every(value => /^[SABCDF]$/.test(value.trim())), `${label}: fabricated percentage or numeric recommendation`);
      const analysis = await absentPage.locator('#analysis').innerText();
      assert.match(analysis, /暂无样本/); assert.doesNotMatch(analysis, /\d+(?:\.\d+)?%/, `${label}: fabricated team win-rate estimate`);
      if (editorial.sources.length) {
        assert.ok(displayedRates.length > 0); assert.match(await absentPage.locator('#recommendations').innerText(), /尚无可用胜率样本/);
      } else {
        assert.equal(displayedRates.length, 0); assert.match(await absentPage.locator('#recommendations').innerText(), /暂无足够依据的候选/);
      }
      await absentPage.goto(baseUrl + '/#tier'); await absentPage.waitForSelector('.tier-view-tabs');
      await absentPage.locator('[data-action="tier-view"][data-view="stats"]').click();
      assert.equal(await absentPage.locator('.winrate-row').count(), 0);
      assert.match(await absentPage.locator('#tier-rows').innerText(), /暂无足量胜率样本/);
    }
    assert.deepEqual(errors, [], 'browser page errors');
    console.log('PASS: 12-step automatic recommendation updates, used-ID/duplicate exclusion, correct blue/red turn gating, explicit author tiers, measured percentages, absent-data honesty, 12 new responsive view checks; no page errors.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
