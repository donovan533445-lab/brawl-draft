import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {steps,applyChoice,matchup,teamScore,recommendation,suitability,rankedModes} from '../dist/engine.mjs';
const B=JSON.parse(fs.readFileSync(new URL('../dist/data/brawlers.json',import.meta.url))).list;
const M=JSON.parse(fs.readFileSync(new URL('../dist/data/maps.json',import.meta.url))).list;
test('full snapshots have unique IDs and complete hero skill arrays',()=>{
  assert.equal(new Set(B.map(b=>b.id)).size,B.length);assert.equal(new Set(M.map(m=>m.id)).size,M.length);
  assert.ok(B.length>=100);assert.ok(M.length>=1000);
  for(const b of B){assert.ok(b.name&&b.class?.name);assert.ok(Array.isArray(b.gadgets)&&Array.isArray(b.starPowers));}
  for(const mode of rankedModes)assert.ok(M.some(m=>!m.disabled&&m.gameMode.name===mode));
});
test('first pick reverses full snake pick order and leaves 3 slots per team',()=>{
  for(const first of ['blue','red'])for(const rule of ['ranked','snake']){
    const order=steps(first,rule);assert.equal(order.length,12);assert.equal(order[6].team,first);
    const other=first==='blue'?'red':'blue';assert.deepEqual(order.slice(6).map(s=>s.team),[first,other,other,first,first,other]);
    for(const t of [first,other])for(const type of ['ban','pick'])assert.equal(order.filter(s=>s.team===t&&s.type===type).length,3);
  }
});
test('draft rejects duplicates, unknown IDs, unavailable heroes and 13th choice',()=>{
  const eligible=B.filter(b=>b.released);let history=[];
  for(const b of eligible.slice(0,12)){const next=applyChoice(history,b.id,B);assert.equal(next.length,history.length+1);history=next;assert.equal(applyChoice(history,b.id,B),history);}
  assert.equal(applyChoice(history,eligible[12].id,B),history);
  assert.deepEqual(applyChoice([],999,B),[]);
  for(const b of B.filter(x=>!x.released))assert.deepEqual(applyChoice([],b.id,B),[]);
});
test('matchup model is antisymmetric for every hero pairing',()=>{
  for(const a of B)for(const b of B){assert.equal(matchup(a,b)+matchup(b,a),0);assert.ok(Number.isFinite(matchup(a,b)));}
});
test('scores stay bounded for full teams and every mode',()=>{
  assert.equal(teamScore([],[],'Gem Grab'),null);
  for(const mode of rankedModes){for(let i=0;i<B.length-6;i++){
    const team=B.slice(i,i+3),enemy=B.slice(i+3,i+6),score=teamScore(team,enemy,mode);
    for(const key of ['total','fit','variety','counter'])assert.ok(score[key]>=0&&score[key]<=100,`${key}: ${score[key]}`);
    assert.equal(score.complete,true);for(const b of team){assert.ok(recommendation(b,mode,team,enemy)>=0);assert.ok(recommendation(b,mode,team,enemy)<=100);assert.ok(suitability(b,mode)>0);}
  }}
});
test('team scoring reflects role diversity and incomplete stages',()=>{
  const tank=B.filter(b=>b.class.name==='Tank').slice(0,3),mixed=[tank[0],B.find(b=>b.class.name==='Marksman'),B.find(b=>b.class.name==='Support')];
  assert.equal(teamScore(tank,[],'Brawl Ball').variety,33);assert.equal(teamScore(mixed,[],'Brawl Ball').variety,100);
  assert.equal(teamScore([tank[0]],[],'Brawl Ball').complete,false);
});
