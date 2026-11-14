// Self-contained so the static build can concatenate this module after engine.mjs.
// Ranked/team rules collect the rest of one side's three bans in one transaction.
function dbSteps(first,rule){
  const other=first==='blue'?'red':'blue';
  const bans=rule==='snake'?[first,other,other,first,first,other]:[first,first,first,other,other,other];
  return [...bans.map(team=>({type:'ban',team})),...[first,other,other,first,first,other].map(team=>({type:'pick',team}))];
}

function dbHistoryValid(history,first,rule){
  if(!Array.isArray(history)||history.length>12||!['blue','red'].includes(first)||!['ranked','team','snake'].includes(rule))return false;
  const order=dbSteps(first,rule),seen=new Set();
  for(let i=0;i<history.length;i++){
    const entry=history[i];
    if(!entry||entry.type!==order[i].type||entry.team!==order[i].team||!Number.isSafeInteger(entry.id)||entry.id<=0||seen.has(entry.id))return false;
    seen.add(entry.id);
  }
  return true;
}

/**
 * existingIds contains already committed bans for the current side only.
 * stepStart is the current history length, including any legacy partial bans.
 * Snake mode exposes only the current contiguous same-side run (one or two).
 */
export function banBatchContext(history,first='blue',rule='ranked'){
  if(!dbHistoryValid(history,first,rule))return null;
  const order=dbSteps(first,rule),stepStart=history.length,step=order[stepStart];
  if(!step||step.type!=='ban')return null;
  let needed=0;
  for(let i=stepStart;i<order.length&&order[i].type==='ban'&&order[i].team===step.team;i++)needed++;
  return {team:step.team,needed,existingIds:history.filter(h=>h.type==='ban'&&h.team===step.team).map(h=>h.id),stepStart};
}

/** Invalid batches return the exact input reference; nothing is partly applied. */
export function applyBanBatch(history,ids,brawlers,first='blue',rule='ranked'){
  const context=banBatchContext(history,first,rule);
  if(!context||!Array.isArray(ids)||ids.length!==context.needed||new Set(ids).size!==ids.length||!Array.isArray(brawlers))return history;
  const used=new Set(history.map(h=>h.id));
  const eligible=new Set(brawlers.filter(b=>b&&b.released).map(b=>b.id));
  if(ids.some(id=>!Number.isSafeInteger(id)||id<=0||used.has(id)||!eligible.has(id)))return history;
  const base=`ban-batch:${context.stepStart}:${context.team}:${ids.join(',')}`;
  let groupId=base,suffix=0;
  while(history.some(h=>h.groupId===groupId))groupId=base+':'+(++suffix);
  return [...history,...ids.map(id=>({type:'ban',team:context.team,id,groupId}))];
}

/** New ban batches undo together; picks and pre-batch legacy entries undo singly. */
export function undoDraftAction(history){
  if(!Array.isArray(history)||!history.length)return history;
  const last=history.at(-1);
  if(last?.type!=='ban'||last.groupId===undefined||last.groupId===null||last.groupId==='')return history.slice(0,-1);
  let start=history.length-1;
  while(start>0){
    const prior=history[start-1];
    if(prior?.type!=='ban'||prior.team!==last.team||prior.groupId!==last.groupId)break;
    start--;
  }
  return history.slice(0,start);
}
