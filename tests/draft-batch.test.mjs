import test from 'node:test';
import assert from 'node:assert/strict';
import {banBatchContext,applyBanBatch,undoDraftAction} from '../dist/draft-batch.mjs';
import {steps,applyChoice} from '../dist/engine.mjs';
const roster=Array.from({length:20},(_,i)=>({id:i+1,released:i!==19}));

for(const first of ['blue','red'])for(const rule of ['ranked','team']){
  test(`${first} first / ${rule}: two atomic triples lead into unchanged pick order`,()=>{
    const other=first==='blue'?'red':'blue',empty=[];
    assert.deepEqual(banBatchContext(empty,first,rule),{team:first,needed:3,existingIds:[],stepStart:0});
    const firstBatch=applyBanBatch(empty,[1,2,3],roster,first,rule);
    assert.equal(empty.length,0);assert.equal(firstBatch.length,3);assert.equal(new Set(firstBatch.map(h=>h.groupId)).size,1);
    assert.deepEqual(banBatchContext(firstBatch,first,rule),{team:other,needed:3,existingIds:[],stepStart:3});
    const secondBatch=applyBanBatch(firstBatch,[4,5,6],roster,first,rule);
    assert.equal(secondBatch.length,6);assert.notEqual(secondBatch[2].groupId,secondBatch[3].groupId);
    assert.equal(banBatchContext(secondBatch,first,rule),null);
    assert.deepEqual(secondBatch.slice(0,3).map(h=>h.id),[1,2,3]);
    assert.equal(secondBatch[0],firstBatch[0]);
    let history=secondBatch;
    for(const id of [7,8,9,10,11,12])history=applyChoice(history,id,roster,first,rule);
    assert.deepEqual(history.slice(6).map(h=>h.team),[first,other,other,first,first,other]);
    assert.deepEqual(history.map(h=>({type:h.type,team:h.team})),steps(first,rule));
    assert.equal(banBatchContext(history,first,rule),null);
  });
}

test('invalid selections are rejected transactionally by identity',()=>{
  const empty=[];
  for(const ids of [[1,2],[1,2,3,4],[1,1,2],[1,2,20],[1,2,99],[1,2,null],[1,2,'3']]){
    assert.equal(applyBanBatch(empty,ids,roster),empty);assert.equal(empty.length,0);
  }
  const history=applyBanBatch(empty,[1,2,3],roster);
  assert.equal(applyBanBatch(history,[1,4,5],roster),history);assert.equal(history.length,3);
  const picked=applyBanBatch(history,[4,5,6],roster);
  assert.equal(applyBanBatch(picked,[7,8,9],roster),picked);
});

test('legacy partial team bans retain their IDs and only require the remainder',()=>{
  const legacy=[{type:'ban',team:'blue',id:1}];
  assert.deepEqual(banBatchContext(legacy),{team:'blue',needed:2,existingIds:[1],stepStart:1});
  const filled=applyBanBatch(legacy,[2,3],roster);
  assert.equal(filled[0],legacy[0]);assert.equal(legacy.length,1);
  assert.deepEqual(undoDraftAction(filled),legacy);
  const redPartial=[...filled,{type:'ban',team:'red',id:4}];
  assert.deepEqual(banBatchContext(redPartial),{team:'red',needed:2,existingIds:[4],stepStart:4});
  assert.equal(applyBanBatch(redPartial,[5,6],roster).length,6);
  const oneLeft=[{type:'ban',team:'red',id:1},{type:'ban',team:'red',id:2}];
  assert.deepEqual(banBatchContext(oneLeft,'red'),{team:'red',needed:1,existingIds:[1,2],stepStart:2});
});

for(const first of ['blue','red'])test(`snake ${first} first uses contiguous runs of 1,2,2,1`,()=>{
  const counts=[],teams=[];let h=[],next=1;
  while(banBatchContext(h,first,'snake')){
    const context=banBatchContext(h,first,'snake');counts.push(context.needed);teams.push(context.team);
    const ids=Array.from({length:context.needed},()=>next++);h=applyBanBatch(h,ids,roster,first,'snake');
  }
  const other=first==='blue'?'red':'blue';
  assert.deepEqual(counts,[1,2,2,1]);assert.deepEqual(teams,[first,other,first,other]);
  assert.deepEqual(h.map(x=>({type:x.type,team:x.team})),steps(first,'snake').slice(0,6));
});

test('undo removes one confirmed triple, then ordinary picks and legacy bans singly',()=>{
  const first=applyBanBatch([],[1,2,3],roster),both=applyBanBatch(first,[4,5,6],roster);
  assert.deepEqual(undoDraftAction(both),first);assert.deepEqual(undoDraftAction(first),[]);
  const picked=applyChoice(both,7,roster);assert.deepEqual(undoDraftAction(picked),both);
  const legacy=[{type:'ban',team:'blue',id:1},{type:'ban',team:'blue',id:2}];
  assert.deepEqual(undoDraftAction(legacy),legacy.slice(0,1));
  const empty=[];assert.equal(undoDraftAction(empty),empty);
});

test('malformed or out-of-order history never produces a partial mutation',()=>{
  for(const h of [[{type:'ban',team:'red',id:1}],[{type:'ban',team:'blue',id:1},{type:'ban',team:'blue',id:1}],[null]]){
    assert.equal(banBatchContext(h),null);assert.equal(applyBanBatch(h,[2,3,4],roster),h);
  }
  assert.equal(banBatchContext([],'green'),null);assert.equal(banBatchContext([],'blue','invalid'),null);
});
