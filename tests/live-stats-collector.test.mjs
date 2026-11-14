import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSnapshot} from '../scripts/refresh-live-stats.mjs';
const B=[{id:1,name:'Shelly'},{id:2,name:'Colt'}];
const M=[{id:10,name:'Safe Zone',disabled:false,gameMode:{name:'Heist'}}];
const fixture=()=>({generated_utc:'2026-11-13T15:14:52Z',season:{season:'season55',dataset:'test',maps:['Safe Zone'],map_modes:{'Safe Zone':'heist'},rank_min:12,rank_max:12,daily:[{day:'20261110',games:2},{day:'20261111',games:3},{day:'20261113',games:4}]},ratings:{days:['20261110','20261111','20261113']},characters:[{name:'SHELLY',daily_rank_grid:[2,2,4,1,6,2]},{name:'COLT',daily_rank_grid:[2,0,4,3,6,4]}]});
const opts={fetchedAt:'2026-11-14T00:00:00Z'};
test('only measured post-patch cells contribute to global/mode/map win rates',()=>{
  const s=buildSnapshot(fixture(),B,M,opts),row=s.records.find(r=>r.brawlerId===1&&r.mode===null);
  assert.equal(row.battles,10);assert.equal(row.wins,3);assert.equal(row.winRate,.3);assert.equal(row.pickRate,.5);
  assert.equal(s.records.length,6);assert.equal(s.source.updatedAt,'2026-11-13');assert.equal(s.source.generatedAt,'2026-11-13T15:14:52Z');
  assert.deepEqual(s.counters,[]);assert.equal(s.capabilities.counters,false);assert.equal(s.source.window.from,'2026-11-11');
});
test('old data keeps actual dates instead of pretending the patch is covered',()=>{
  const f=fixture();f.ratings.days=['20261101','20261102','20261103'];f.season.daily=[];
  const s=buildSnapshot(f,B,M,opts);assert.equal(s.source.window.patchCutoffApplied,false);assert.equal(s.source.prePatch,true);assert.equal(s.source.stale,true);assert.equal(s.source.updatedAt,'2026-11-03');
});
test('impossible wins, duplicate heroes, malformed dimensions and empty rank slices fail',()=>{
  let f=fixture();f.characters[0].daily_rank_grid[3]=5;assert.throws(()=>buildSnapshot(f,B,M,opts),/Invalid measured count/);
  f=fixture();f.characters.push(f.characters[0]);assert.throws(()=>buildSnapshot(f,B,M,opts),/Duplicated/);
  f=fixture();f.characters[0].daily_rank_grid.pop();assert.throws(()=>buildSnapshot(f,B,M,opts),/dimension/);
  assert.throws(()=>buildSnapshot(fixture(),B,M,{...opts,minRank:20}),/Rank filters/);
});
test('unknown catalogue names are reported without inventing IDs or map-level records',()=>{
  const f=fixture();f.characters.push({name:'UNKNOWN',daily_rank_grid:[1,0,1,0,1,0]});
  const s=buildSnapshot(f,B,[],opts);assert.deepEqual(s.source.unknownBrawlers,['UNKNOWN']);assert.deepEqual(s.source.unknownMaps,['Safe Zone']);assert.equal(s.records.length,4);
});
