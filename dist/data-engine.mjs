// Recommendation inputs are measured battle statistics and attributed YouTube tiers.
// No class weights, inferred win rates, mirrored matchup rates or pooled sample counts.
export const DATA_MIN_PAIR_BATTLES = 30;
const deDayMs = 24 * 60 * 60 * 1000;
const deTierOrder = ['S', 'A', 'B', 'C', 'D', 'F'];
const deStatsIndexes = new WeakMap();

function deId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function deNameKey(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : NaN;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function deSource(snapshot) {
  const source = snapshot?.source;
  if (!source || typeof source.name !== 'string' || !source.name.trim()) return null;
  try {
    const url = new URL(source.url);
    return ['http:', 'https:'].includes(url.protocol) ? source : null;
  } catch { return null; }
}

function deValidStat(record, minBattles = 1) {
  return record && typeof record.winRate === 'number' && Number.isFinite(record.winRate)
    && record.winRate >= 0 && record.winRate <= 1
    && Number.isSafeInteger(record.battles) && record.battles >= minBattles;
}

function deIndexRows(records, targetKey) {
  const index = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = deId(record?.brawlerId);
    if (id === null) continue;
    let bucket = index.get(id);
    if (!targetKey) {
      if (!bucket) index.set(id, bucket = []);
      bucket.push(record);
      continue;
    }
    const target = deId(record[targetKey]);
    if (target === null) continue;
    if (!bucket) index.set(id, bucket = new Map());
    let pairs = bucket.get(target);
    if (!pairs) bucket.set(target, pairs = []);
    pairs.push(record);
  }
  return index;
}

// Collector snapshots are immutable data values. Reuse indexes across every
// pick/map context, rebuilding on replacement, append or a new retrieval date.
// Weak keys let superseded large snapshots and their indexes be collected.
function deStatsIndex(stats) {
  if (!stats || typeof stats !== 'object') return null;
  const records = stats.records, counters = stats.counters, synergies = stats.synergies;
  const recordsLength = Array.isArray(records) ? records.length : 0;
  const countersLength = Array.isArray(counters) ? counters.length : 0;
  const synergiesLength = Array.isArray(synergies) ? synergies.length : 0;
  const cached = deStatsIndexes.get(stats);
  if (cached && cached.recordsInput === records && cached.countersInput === counters
    && cached.synergiesInput === synergies && cached.recordsLength === recordsLength
    && cached.countersLength === countersLength && cached.synergiesLength === synergiesLength
    && cached.fetchedAt === stats.fetchedAt) return cached;
  const indexed = {
    recordsInput: records, countersInput: counters, synergiesInput: synergies,
    recordsLength, countersLength, synergiesLength, fetchedAt: stats.fetchedAt,
    records: deIndexRows(records), counters: deIndexRows(counters, 'enemyId'),
    synergies: deIndexRows(synergies, 'allyId')
  };
  deStatsIndexes.set(stats, indexed);
  return indexed;
}

function deScope(record, wantedMap, wantedMode) {
  const hasMap = record.mapId !== null && record.mapId !== undefined;
  const recordMode = deNameKey(record.mode);
  if (wantedMode && recordMode && wantedMode !== recordMode) return null;
  if (hasMap) return wantedMap !== null && deId(record.mapId) === wantedMap ? 'map' : null;
  if (recordMode) return wantedMode && recordMode === wantedMode ? 'mode' : null;
  return 'global';
}

function deBestRecord(records, context, minBattles = 1) {
  const priority = { map: 0, mode: 1, global: 2 };
  const wantedMap = deId(context?.mapId), wantedMode = deNameKey(context?.mode);
  let best = null;
  for (const record of Array.isArray(records) ? records : []) {
    if (!deValidStat(record, minBattles)) continue;
    const scope = deScope(record, wantedMap, wantedMode);
    if (scope !== null && (!best || priority[scope] < priority[best.scope]
      || (scope === best.scope && record.battles > best.record.battles))) best = { record, scope };
  }
  return best;
}

/**
 * Select the narrowest available measured context, not a class-level estimate.
 * Rates must be fractions in [0, 1]; percentages such as 55 are rejected.
 * Duplicate rows are not summed because their battle samples may overlap.
 */
export function selectStat(stats, id, context = {}) {
  const brawlerId = deId(id), source = deSource(stats);
  if (brawlerId === null || !source) return null;
  const chosen = deBestRecord(deStatsIndex(stats)?.records.get(brawlerId), context);
  return chosen ? { ...chosen.record, brawlerId, scope: chosen.scope, source, fetchedAt: stats.fetchedAt ?? null } : null;
}

function deYoutubeSource(source) {
  if (!source || typeof source.creator !== 'string' || !source.creator.trim()
    || typeof source.title !== 'string' || !source.title.trim()
    || !Number.isFinite(deTimestamp(source.publishedAt)) || !source.tiers) return false;
  try {
    const url = new URL(source.url), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return false;
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean).length === 1;
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) return false;
    return (url.pathname === '/watch' && !!url.searchParams.get('v'))
      || /^\/(shorts|live|embed)\/[^/]+\/?$/.test(url.pathname);
  } catch { return false; }
}

/**
 * A selected video's missing heroes stay unrated. The selector never silently
 * fills gaps from an older creator/video or converts a statistical rate to a tier.
 */
export function selectYoutubeTier(editorial, brawler, sourceId) {
  if (!brawler || !deId(brawler.id)) return null;
  const sources = (Array.isArray(editorial?.sources) ? editorial.sources : []).filter(deYoutubeSource);
  const source = sourceId !== undefined && sourceId !== null && sourceId !== ''
    ? sources.find(item => String(item.id) === String(sourceId))
    : [...sources].sort((a, b) => deTimestamp(b.publishedAt) - deTimestamp(a.publishedAt))[0];
  if (!source) return null;
  const id = deId(brawler.id), name = deNameKey(brawler.name);
  const matches = deTierOrder.filter(label => (Array.isArray(source.tiers[label]) ? source.tiers[label] : [])
    .some(item => deId(item) === id || (typeof item === 'string' && name && deNameKey(item) === name)));
  return matches.length === 1 ? { tier: matches[0], source } : null;
}

/** Retrieval freshness annotates evidence; it does not remove dated samples. */
export function statsFreshness(stats, now = Date.now(), maxAgeMs = deDayMs) {
  const fetchedAt = stats?.fetchedAt ?? null, timestamp = deTimestamp(fetchedAt);
  const nowTime = deTimestamp(now), limit = Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? maxAgeMs : deDayMs;
  const sourceUpdatedAt = stats?.sourceUpdatedAt ?? stats?.source?.updatedAt ?? null;
  if (fetchedAt === null || fetchedAt === '') return { stale: true, ageMs: null, fetchedAt, sourceUpdatedAt, reason: 'missing' };
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowTime)) return { stale: true, ageMs: null, fetchedAt, sourceUpdatedAt, reason: 'invalid' };
  const ageMs = nowTime - timestamp;
  if (ageMs < -5 * 60 * 1000) return { stale: true, ageMs, fetchedAt, sourceUpdatedAt, reason: 'future' };
  return { stale: ageMs > limit, ageMs: Math.max(0, ageMs), fetchedAt, sourceUpdatedAt, reason: ageMs > limit ? 'expired' : 'fresh' };
}

export function isStatsStale(stats, now = Date.now(), maxAgeMs = deDayMs) {
  return statsFreshness(stats, now, maxAgeMs).stale;
}

/** 95% Wilson lower bound used only for conservative ordering, never as win rate. */
export function empiricalLowerBound(winRate, battles) {
  if (!deValidStat({ winRate, battles })) return null;
  const z = 1.959963984540054, zz = z * z;
  const center = winRate + zz / (2 * battles);
  const margin = z * Math.sqrt((winRate * (1 - winRate) + zz / (4 * battles)) / battles);
  return Math.max(0, Math.min(1, (center - margin) / (1 + zz / battles)));
}

function dePairEvidence(stats, id, entries, table, targetKey, context, kind) {
  if (!deSource(stats)) return [];
  const indexed = deStatsIndex(stats)?.[table]?.get(id);
  return [...new Set(entries.map(entry => deId(entry.id)).filter(target => target !== null))].flatMap(target => {
    const chosen = deBestRecord(indexed?.get(target), context, DATA_MIN_PAIR_BATTLES);
    return chosen ? [{ ...chosen.record, scope: chosen.scope, kind, targetId: target, source: stats.source }] : [];
  });
}

function deContextLabel(scope) {
  return scope === 'map' ? '当前地图' : scope === 'mode' ? '当前模式' : '全局';
}

function dePercent(rate) { return (rate * 100).toFixed(1) + '%'; }

/**
 * Rank on observed evidence. Where empirical data exists, ordering is the mean
 * of the relevant records' Wilson lower bounds (base, measured counters and
 * measured teammate pairs). This is a sorting index, NOT a team-win prediction.
 * Pair samples are not pooled or treated as independent games. Editorial tiers
 * break empirical ties and supply an explicit fallback when no rates exist.
 */
export function rankCandidates({ brawlers = [], history = [], team = 'blue', mapId, mode,
  stats, editorial, sourceId, poolIds } = {}) {
  const selections = Array.isArray(history) ? history : [];
  const used = new Set(selections.map(entry => deId(entry?.id)).filter(id => id !== null));
  const pool = poolIds === undefined || poolIds === null ? null
    : new Set((Array.isArray(poolIds) || poolIds instanceof Set ? [...poolIds] : []).map(deId).filter(id => id !== null));
  const allies = selections.filter(entry => entry?.type === 'pick' && entry.team === team);
  const enemies = selections.filter(entry => entry?.type === 'pick' && ['blue', 'red'].includes(entry.team) && entry.team !== team);
  const context = { mapId, mode }, seen = new Set(), rows = [];
  const freshness = statsFreshness(stats);
  for (const b of Array.isArray(brawlers) ? brawlers : []) {
    const id = deId(b?.id);
    if (id === null || b.released !== true || seen.has(id) || used.has(id) || (pool && !pool.has(id))) continue;
    seen.add(id);
    const stat = selectStat(stats, id, context), tier = selectYoutubeTier(editorial, b, sourceId);
    const pairs = [...dePairEvidence(stats, id, enemies, 'counters', 'enemyId', context, 'counter'),
      ...dePairEvidence(stats, id, allies, 'synergies', 'allyId', context, 'synergy')];
    const evidence = [...(stat ? [stat] : []), ...pairs];
    if (!evidence.length && !tier) continue;
    const fragments = [];
    if (stat) fragments.push(`${deContextLabel(stat.scope)}胜率 ${dePercent(stat.winRate)}，${stat.battles} 场，来源 ${stat.source.name}`);
    for (const pair of pairs) {
      const target = brawlers.find(item => deId(item.id) === pair.targetId);
      fragments.push(`${pair.kind === 'counter' ? '对阵' : '搭配'} ${target?.name || pair.targetId}：${dePercent(pair.winRate)} / ${pair.battles} 场（${deContextLabel(pair.scope)}，${pair.source.name}）`);
    }
    if (tier) fragments.push(`${tier.source.creator}：${tier.tier} 档，视频发布 ${String(tier.source.publishedAt).slice(0, 10)}`);
    if (!evidence.length) fragments.push('尚无可用胜率样本，仅参考该视频评级');
    else if (freshness.stale) fragments.push(freshness.reason === 'expired' ? '缓存已超过 24 小时' : '统计获取时间待核实');
    const row = { b, stat, tier, reason: fragments.join('；'), evidenceKind: evidence.length ? 'statistics' : 'youtube',
      pairEvidence: pairs, freshness };
    if (evidence.length) row.evidenceScore = evidence.reduce((sum, record) => sum + empiricalLowerBound(record.winRate, record.battles), 0) / evidence.length;
    rows.push(row);
  }
  return rows.sort((a, b) => Number(b.evidenceKind === 'statistics') - Number(a.evidenceKind === 'statistics')
    || (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0)
    || (a.tier ? deTierOrder.indexOf(a.tier.tier) : deTierOrder.length) - (b.tier ? deTierOrder.indexOf(b.tier.tier) : deTierOrder.length)
    || deId(a.b.id) - deId(b.b.id));
}
