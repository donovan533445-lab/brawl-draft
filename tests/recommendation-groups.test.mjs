import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRecommendations, rankCandidates, RECOMMENDATION_PRIORITY_GAPS } from '../dist/data-engine.mjs';

const source = { name: 'QA observed battle source', url: 'https://qa.example.test/battles' };
const authorSource = { id: 'qa-video', creator: 'QA author', title: 'QA author tier fixture',
  url: 'https://www.youtube.com/watch?v=qa-tier-fixture', publishedAt: '2026-11-14', tiers: {} };
const measured = (id, score, authorTier = null) => ({
  b: { id, name: `Hero ${id}`, released: true }, evidenceKind: 'statistics', evidenceScore: score,
  stat: { brawlerId: id, winRate: .91, battles: 2000, source },
  tier: authorTier ? { tier: authorTier, source: authorSource } : null, pairEvidence: []
});
const editorial = (id, label) => ({ b: { id, name: `Hero ${id}`, released: true },
  evidenceKind: 'youtube', stat: null, tier: { tier: label, source: authorSource }, pairEvidence: [] });
const groupIds = groups => Object.fromEntries(groups.map(group => [group.id, group.rows.map(row => row.b.id)]));

test('relative measured boundaries are inclusive and are separate from author tiers', () => {
  const best = .8;
  const rows = [
    measured(1, best, 'F'),
    measured(2, best - .015, 'D'),
    measured(3, best - .015 - 1e-8, 'S'),
    measured(4, best - .04, 'A'),
    measured(5, best - .04 - 1e-8, 'S')
  ];
  const groups = groupRecommendations(rows);
  assert.deepEqual(groupIds(groups), { preferred: [1, 2], alternative: [3, 4], caution: [5] });
  const strongest = groups[0].rows[0];
  assert.equal(strongest.tier.tier, 'F', 'this-turn priority must not relabel the author tier');
  assert.equal(strongest.priority.basis, 'statistics');
  assert.equal(strongest.priority.bestEvidenceScore, best);
  assert.match(strongest.priority.description, /不是胜率差.*不改动作者档位/);
  assert.equal(RECOMMENDATION_PRIORITY_GAPS.preferred, .015);
  assert.equal(RECOMMENDATION_PRIORITY_GAPS.alternative, .04);
});

test('ties remain preferred and keep input rank order even if the highest score is later', () => {
  const rows = [measured(9, .7), measured(3, .7), measured(8, .69), measured(2, .71)];
  const groups = groupRecommendations(rows);
  assert.deepEqual(groupIds(groups), { preferred: [9, 3, 2], alternative: [8], caution: [] });
  assert.equal(groups[0].rows[0].priority.bestEvidenceScore, .71);
  assert.deepEqual(rows.map(row => row.b.id), [9, 3, 8, 2]);
});

test('editorial-only fallback keeps original S/A, B/C, D/F assignments and no numeric measurement', () => {
  const rows = ['S', 'A', 'B', 'C', 'D', 'F'].map((label, i) => editorial(i + 1, label));
  const groups = groupRecommendations(rows);
  assert.deepEqual(groupIds(groups), { preferred: [1, 2], alternative: [3, 4], caution: [5, 6] });
  for (const row of groups.flatMap(group => group.rows)) {
    assert.equal(row.priority.basis, 'author');
    assert.equal(row.priority.authorTier, row.tier.tier);
    assert.equal(row.stat, null);
    assert.ok(!('gap' in row.priority));
    assert.ok(!('evidenceScore' in row.priority));
    assert.ok(!('winRate' in row.priority));
    assert.match(row.priority.description, /不生成胜率或置信指标/);
  }
});

test('mixed evidence uses measured ordering where available, otherwise attributed author fallback', () => {
  const groups = groupRecommendations([measured(1, .7, 'F'), editorial(2, 'S'), measured(3, .6, 'S'), editorial(4, 'C')]);
  assert.deepEqual(groupIds(groups), { preferred: [1, 2], alternative: [4], caution: [3] });
  assert.equal(groups[0].rows[0].priority.basis, 'statistics');
  assert.equal(groups[0].rows[1].priority.basis, 'author');
  assert.equal(groups[2].rows[0].tier.tier, 'S');
});

test('missing or unsupported evidence is retained ungraded without inventing 0% or 50%', () => {
  const missing = { b: { id: 1, name: 'Unrated' }, stat: null, tier: null, evidenceKind: 'youtube' };
  const invalidScore = { ...measured(2, .99), stat: { winRate: .8, battles: 0, source } };
  const unsupportedTier = { ...editorial(3, 'A'), tier: { tier: 'A', source: { creator: 'Unknown' } } };
  const groups = groupRecommendations([missing, invalidScore, unsupportedTier, measured(4, .6)]);
  assert.deepEqual(groupIds(groups), { preferred: [4], alternative: [], caution: [1, 2, 3] });
  for (const row of groups[2].rows) {
    assert.equal(row.priority.basis, 'unavailable');
    assert.ok(!('gap' in row.priority)); assert.ok(!('evidenceScore' in row.priority));
    assert.ok(!('winRate' in row.priority));
    assert.match(row.priority.description, /暂不判断强弱/);
  }
  assert.equal(groups[0].rows[0].priority.bestEvidenceScore, .6, 'unsupported numeric scores must not set the comparison baseline');
});

test('measured pair-only candidates can be grouped without fabricating an aggregate win rate', () => {
  const pairOnly = { b: { id: 1, name: 'Pair-only hero' }, stat: null, tier: null,
    evidenceKind: 'statistics', evidenceScore: .6,
    pairEvidence: [{ brawlerId: 1, enemyId: 9, winRate: .67, battles: 400, source }] };
  const insufficient = { ...pairOnly, b: { id: 2, name: 'Too few pairs' }, evidenceScore: .9,
    pairEvidence: [{ brawlerId: 2, enemyId: 9, winRate: 1, battles: 29, source }] };
  const groups = groupRecommendations([pairOnly, insufficient]);
  assert.deepEqual(groupIds(groups), { preferred: [1], alternative: [], caution: [2] });
  assert.equal(groups[0].rows[0].stat, null);
  assert.equal(groups[0].rows[0].priority.basis, 'statistics');
});

test('each input row appears once and frozen inputs are never decorated or reordered', () => {
  const rows = Object.freeze([Object.freeze(measured(1, .7)), Object.freeze(editorial(2, 'C')),
    Object.freeze({ b: { id: 3, name: 'No evidence' }, stat: null, tier: null })]);
  const before = JSON.stringify(rows), groups = groupRecommendations(rows);
  const grouped = groups.flatMap(group => group.rows);
  assert.equal(grouped.length, rows.length);
  assert.deepEqual(new Set(grouped.map(row => row.b.id)), new Set(rows.map(row => row.b.id)));
  assert.equal(JSON.stringify(rows), before);
  for (const row of grouped) {
    const original = rows.find(item => item.b.id === row.b.id);
    assert.notEqual(row, original);
    assert.equal(row.stat, original.stat); assert.equal(row.tier, original.tier);
    assert.equal(original.priority, undefined);
  }
});

test('empty evidence produces three explicit empty groups with visible grading criteria', () => {
  for (const value of [undefined, null, [], 'invalid']) {
    const groups = groupRecommendations(value);
    assert.deepEqual(groups.map(group => group.id), ['preferred', 'alternative', 'caution']);
    assert.deepEqual(groups.map(group => group.rows.length), [0, 0, 0]);
    assert.match(groups[0].description, /0\.015.*S\/A/);
    assert.match(groups[1].description, /0\.04.*B\/C/);
    assert.match(groups[2].description, /没有可用证据.*不推断其强弱/);
  }
});

test('rankCandidates remains compatible and measured priorities can differ from video tiers', () => {
  const brawlers = [{ id: 1, name: 'Hero 1', released: true }, { id: 2, name: 'Hero 2', released: true },
    { id: 3, name: 'Hero 3', released: true }];
  const stats = { fetchedAt: new Date().toISOString(), source,
    records: [{ brawlerId: 1, winRate: .68, battles: 100000 },
      { brawlerId: 2, winRate: .67, battles: 100000 }, { brawlerId: 3, winRate: .6, battles: 100000 }] };
  const author = { ...authorSource, tiers: { F: [1], B: [2], S: [3] } };
  const ranked = rankCandidates({ brawlers, stats, editorial: { sources: [author] } });
  assert.deepEqual(ranked.map(row => row.b.id), [1, 2, 3]);
  assert.deepEqual(groupIds(groupRecommendations(ranked)), { preferred: [1, 2], alternative: [], caution: [3] });
  assert.equal(ranked[0].tier.tier, 'F'); assert.equal(ranked[0].priority, undefined);
});
