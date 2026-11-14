import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStat, selectYoutubeTier, rankCandidates, statsFreshness, isStatsStale,
  empiricalLowerBound, DATA_MIN_PAIR_BATTLES } from '../dist/data-engine.mjs';

const deHeroes = [
  { id: 1, name: 'Shelly', released: true },
  { id: 2, name: 'Mr. P', released: true },
  { id: 3, name: 'Colt', released: true },
  { id: 4, name: 'Piper', released: true },
  { id: 5, name: 'Unreleased', released: false }
];
const deProvider = { name: 'Observed battle provider', url: 'https://stats.example/data' };
const deStats = (records = [], extra = {}) => ({ source: deProvider, fetchedAt: new Date().toISOString(), records, ...extra });
const deEditorial = { sources: [
  { id: 'old', creator: 'Earlier creator', title: 'Older ranking', url: 'https://www.youtube.com/watch?v=older-video',
    publishedAt: '2026-10-01', tiers: { S: ['Piper'], A: [1] } },
  { id: 'new', creator: 'Latest creator', title: 'Current verified ranking', url: 'https://youtu.be/current-video',
    publishedAt: '2026-11-13', verifiedAt: '2026-11-14', tiers: { S: ['mR. p'], A: ['SHELLY'], B: ['Colt'] } }
] };

test('selectStat uses exact map, then mode, then global without mixing or summing rows', () => {
  const snapshot = deStats([
    { brawlerId: 1, mapId: null, mode: null, winRate: .7, battles: 10000 },
    { brawlerId: 1, mapId: null, mode: 'Gem Grab', winRate: .6, battles: 1000 },
    { brawlerId: 1, mapId: 101, mode: 'Gem Grab', winRate: .5, battles: 100 },
    { brawlerId: 1, mapId: 101, mode: 'Gem Grab', winRate: .51, battles: 200 },
    { brawlerId: 1, mapId: 101, mode: 'Brawl Ball', winRate: .99, battles: 90000 }
  ]);
  const exact = selectStat(snapshot, 1, { mapId: 101, mode: 'Gem Grab' });
  assert.equal(exact.scope, 'map'); assert.equal(exact.winRate, .51); assert.equal(exact.battles, 200);
  assert.equal(selectStat(snapshot, '1', { mapId: 102, mode: 'gemGrab' }).scope, 'mode');
  assert.equal(selectStat(snapshot, 1, { mapId: 102, mode: 'Heist' }).scope, 'global');
  assert.equal(selectStat(snapshot, 1, {}).scope, 'global');
  assert.equal(snapshot.records[3].scope, undefined, 'input snapshot remains unchanged');
});

test('unverified rates and counts do not become evidence or a fabricated 50% fallback', () => {
  const records = [
    { brawlerId: 1, winRate: 55, battles: 100 },
    { brawlerId: 2, winRate: NaN, battles: 100 },
    { brawlerId: 3, winRate: .6, battles: 0 },
    { brawlerId: 4, winRate: .6, battles: 1.5 }
  ];
  assert.equal(selectStat(deStats(records), 1), null);
  assert.equal(selectStat({ records: [{ brawlerId: 1, winRate: .7, battles: 100 }] }, 1), null);
  assert.deepEqual(rankCandidates({ brawlers: deHeroes, stats: deStats(records) }), []);
  assert.deepEqual(rankCandidates({ brawlers: deHeroes }), []);
  assert.equal(empiricalLowerBound(60, 10), null);
  assert.equal(empiricalLowerBound(.6, 0), null);
});

test('YouTube tiers resolve source IDs and case/punctuation while keeping omitted heroes unrated', () => {
  assert.equal(selectYoutubeTier(deEditorial, deHeroes[1]).tier, 'S');
  assert.equal(selectYoutubeTier(deEditorial, deHeroes[0], 'old').tier, 'A');
  assert.equal(selectYoutubeTier(deEditorial, deHeroes[3]), null, 'no silent fallback to an older video');
  assert.equal(selectYoutubeTier(deEditorial, deHeroes[0], 'missing'), null);
  assert.equal(selectYoutubeTier({ sources: [{ ...deEditorial.sources[1], url: 'javascript:alert(1)' }] }, deHeroes[0]), null);
  assert.equal(selectYoutubeTier({ sources: [{ ...deEditorial.sources[1], tiers: { S: [1], A: ['Shelly'] } }] }, deHeroes[0]), null,
    'conflicting tier assignments are not silently resolved');
});

test('each draft step automatically excludes every banned/picked ID, duplicates and unreleased heroes', () => {
  const brawlers = [...deHeroes, { ...deHeroes[0] }];
  const stats = deStats(deHeroes.map(b => ({ brawlerId: b.id, winRate: .6, battles: 1000 })));
  let history = [];
  for (const hero of deHeroes.slice(0, 4)) {
    const available = rankCandidates({ brawlers, stats, history });
    assert.equal(new Set(available.map(row => row.b.id)).size, available.length);
    assert.ok(available.every(row => row.b.released && !history.some(entry => entry.id === row.b.id)));
    history.push({ id: hero.id, type: history.length < 2 ? 'ban' : 'pick', team: history.length % 2 ? 'red' : 'blue' });
  }
  assert.deepEqual(rankCandidates({ brawlers, stats, history }), []);
  assert.deepEqual(rankCandidates({ brawlers, stats, poolIds: new Set(['2']) }).map(row => row.b.id), [2]);
  assert.deepEqual(rankCandidates({ brawlers, stats, poolIds: [] }), []);
});

test('conservative evidence ordering penalizes tiny samples without changing displayed measured rate', () => {
  const stats = deStats([
    { brawlerId: 1, winRate: 1, battles: 1 },
    { brawlerId: 2, winRate: .55, battles: 1000 }
  ]);
  const rows = rankCandidates({ brawlers: deHeroes, stats });
  assert.deepEqual(rows.map(row => row.b.id), [2, 1]);
  assert.equal(rows[1].stat.winRate, 1);
  assert.equal(rows[1].stat.battles, 1);
  assert.equal(rows[1].stat.wins, undefined, 'no rounded/synthetic win count is inserted');
  assert.ok(rows[0].evidenceScore >= 0 && rows[0].evidenceScore <= 1);
  assert.match(rows[0].reason, /全局胜率 55\.0%.*1000 场.*Observed battle provider/);
});

test('measured counters and teammate pairs react to the next pick and require sufficient samples', () => {
  const stats = deStats([
    { brawlerId: 1, winRate: .6, battles: 1000 },
    { brawlerId: 2, winRate: .59, battles: 1000 }
  ], { counters: [
    { brawlerId: 1, enemyId: 3, winRate: .2, battles: 1000 },
    { brawlerId: 2, enemyId: 3, winRate: .8, battles: 1000 },
    { brawlerId: 1, enemyId: 4, winRate: 1, battles: DATA_MIN_PAIR_BATTLES - 1 }
  ], synergies: [{ brawlerId: 2, allyId: 4, winRate: .7, battles: 500 }] });
  const base = { brawlers: deHeroes, stats, team: 'blue', mode: 'Gem Grab', mapId: 101 };
  assert.equal(rankCandidates(base)[0].b.id, 1);
  const history = [{ id: 3, type: 'pick', team: 'red' }, { id: 4, type: 'pick', team: 'blue' }];
  const ranked = rankCandidates({ ...base, history });
  assert.equal(ranked[0].b.id, 2); assert.equal(ranked[0].pairEvidence.length, 2);
  assert.match(ranked[0].reason, /对阵 Colt.*80\.0% \/ 1000 场/);
  assert.match(ranked[0].reason, /搭配 Piper.*70\.0% \/ 500 场/);
  assert.equal(rankCandidates({ ...base, history: [{ id: 4, type: 'pick', team: 'red' }] })[0].pairEvidence.length, 0);
});

test('wrong-context matchup records and unobserved reverse matchups are not used', () => {
  const stats = deStats([{ brawlerId: 1, winRate: .6, battles: 1000 }], { counters: [
    { brawlerId: 1, enemyId: 2, mapId: 202, mode: 'Heist', winRate: .9, battles: 1000 },
    { brawlerId: 2, enemyId: 1, winRate: .1, battles: 1000 }
  ] });
  const rows = rankCandidates({ brawlers: deHeroes, stats, mapId: 101, mode: 'Gem Grab',
    history: [{ id: 2, type: 'pick', team: 'red' }] });
  assert.equal(rows[0].pairEvidence.length, 0);
  assert.equal(rows[0].stat.winRate, .6);
});

test('editorial-only fallback retains attribution but has no win rate or statistical score', () => {
  const rows = rankCandidates({ brawlers: deHeroes, editorial: deEditorial });
  assert.deepEqual(rows.map(row => row.b.id), [2, 1, 3]);
  assert.ok(rows.every(row => row.stat === null && row.evidenceKind === 'youtube' && !('evidenceScore' in row)));
  assert.match(rows[0].reason, /Latest creator.*S 档.*2026-11-13/);
  assert.match(rows[0].reason, /尚无可用胜率样本/);
});

test('freshness flags old/invalid retrieval dates without discarding measured records', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const fresh = deStats([], { fetchedAt: '2026-11-14T11:30:00Z', sourceUpdatedAt: '2026-10-01' });
  assert.equal(isStatsStale(fresh, now), false, 'source age is distinct from retrieval age');
  const nested = deStats([], { fetchedAt: '2026-11-14T11:30:00Z', source: { ...deProvider, updatedAt: '2026-10-02' } });
  assert.equal(statsFreshness(nested, now).sourceUpdatedAt, '2026-10-02');
  assert.equal(isStatsStale(nested, now), false);
  assert.equal(isStatsStale({ fetchedAt: '2026-11-13T12:00:00Z' }, now), false);
  assert.equal(statsFreshness({ fetchedAt: '2026-11-13T11:59:59Z' }, now).reason, 'expired');
  for (const value of [undefined, '', 'not-a-date']) assert.equal(isStatsStale({ fetchedAt: value }, now), true);
  assert.equal(statsFreshness({ fetchedAt: '2026-11-15' }, now).reason, 'future');
  const dated = deStats([{ brawlerId: 1, winRate: .6, battles: 100 }], { fetchedAt: '2000-01-01' });
  const rows = rankCandidates({ brawlers: deHeroes, stats: dated });
  assert.equal(rows[0].stat.winRate, .6); assert.equal(rows[0].freshness.stale, true);
  assert.match(rows[0].reason, /缓存已超过 24 小时/);
});

test('large snapshots are indexed once and reused across picks and map contexts', () => {
  const brawlers = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, name: `Hero ${i + 1}`, released: true }));
  const records = [], counters = [], synergies = [];
  for (const hero of brawlers) {
    records.push({ brawlerId: hero.id, winRate: .55, battles: 1000 });
    for (let map = 0; map < 80; map++) records.push({ brawlerId: hero.id, mapId: 2000 + map,
      mode: 'Gem Grab', winRate: .5 + hero.id / 2000, battles: 1000 });
    for (let target = 1; target <= 40; target++) for (let map = 0; map < 5; map++) {
      counters.push({ brawlerId: hero.id, enemyId: target, mapId: 2000 + map, mode: 'Gem Grab', winRate: .6, battles: 1000 });
      synergies.push({ brawlerId: hero.id, allyId: target, mapId: 2000 + map, mode: 'Gem Grab', winRate: .6, battles: 1000 });
    }
  }
  const reads = { records: 0, counters: 0, synergies: 0 };
  const observe = (list, key) => new Proxy(list, { get(target, property, receiver) {
    if (typeof property === 'string' && /^\d+$/.test(property)) reads[key]++;
    return Reflect.get(target, property, receiver);
  } });
  const snapshot = deStats(observe(records, 'records'), { counters: observe(counters, 'counters'), synergies: observe(synergies, 'synergies') });
  const history = [{ id: 1, type: 'pick', team: 'blue' }, { id: 2, type: 'pick', team: 'blue' },
    { id: 3, type: 'pick', team: 'red' }, { id: 4, type: 'pick', team: 'red' }];
  const expected = { records: records.length, counters: counters.length, synergies: synergies.length };
  const rows = rankCandidates({ brawlers, stats: snapshot, history, team: 'blue', mapId: 2003, mode: 'Gem Grab' });
  assert.equal(rows.length, 76);
  assert.equal(rows[0].pairEvidence.length, 4);
  assert.deepEqual(reads, expected, 'all source tables are traversed once, not once per hero/opponent');
  rankCandidates({ brawlers, stats: snapshot, history: [...history, { id: 5, type: 'pick', team: 'red' }], team: 'blue', mapId: 2004, mode: 'Gem Grab' });
  selectStat(snapshot, 8, { mapId: 2020, mode: 'Gem Grab' });
  assert.deepEqual(reads, expected, 'later draft steps and new maps only read indexed subsets');
  assert.deepEqual(Object.keys(records[0]).sort(), ['battles', 'brawlerId', 'winRate'], 'indexing does not decorate input records');
});

test('index invalidation respects replaced/extended source arrays and retrieval versions', () => {
  const snapshot = deStats([{ brawlerId: 1, winRate: .5, battles: 100 }]);
  assert.equal(selectStat(snapshot, 1).winRate, .5);
  snapshot.records = [{ brawlerId: 1, winRate: .7, battles: 200 }];
  assert.equal(selectStat(snapshot, 1).winRate, .7);
  snapshot.records.push({ brawlerId: 2, winRate: .6, battles: 150 });
  assert.equal(selectStat(snapshot, 2).winRate, .6);
  snapshot.records[0] = { brawlerId: 1, winRate: .8, battles: 400 };
  snapshot.fetchedAt = '2026-11-14T13:00:00Z';
  assert.equal(selectStat(snapshot, 1).winRate, .8);
  assert.equal(selectStat(deStats([{ brawlerId: 1, winRate: .3, battles: 500 }]), 1).winRate, .3,
    'a different snapshot never reuses another snapshot’s rows');
});
