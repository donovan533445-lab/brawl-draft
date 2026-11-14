import {CLASSES,RARITIES,nameOf,mapName,modeName,rankedModes,suitability,recommendation,matchup,matchupReason,teamScore,tier,steps,applyChoice} from './engine.mjs';
import {rankCandidates,selectStat,selectYoutubeTier,isStatsStale} from './data-engine.mjs';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=$('#main'),modal=$('#modal'),body=$('#modal-body');
let B=[],M=[],meta={},page='draft',search='',role='',poolOnly=false,mapSearch='',mapMode='',showDisabled=false,selected=null,dialogOrigin=null;
let storageWorking=true,toastTimer;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{storageWorking=false;toast('浏览器无法保存数据，请导出备份');}};
let pool=read('brawl-pool-v1',{}),draft=read('brawl-draft-v1',{first:'blue',rule:'ranked',map:15000007,history:[]});
let tabMode='Gem Grab';
let tierView='youtube',youtubeSourceId='',editorial={sources:[]},liveStats={records:[]},statsStatus='loading',statsError='',adviceTeam=read('brawl-advice-team','blue');
const asset=(type,id)=>`./assets/${type}/${id}.png`;
const brawler=id=>B.find(b=>b.id===id);
const currentMap=()=>M.find(m=>m.id===draft.map)||M.find(m=>!m.disabled&&rankedModes.includes(m.gameMode.name));
const currentMode=()=>currentMap()?.gameMode.name||'Gem Grab';
const owned=id=>!!pool[id]?.owned;
const teamLabel=t=>t==='blue'?'蓝方':'红方';
const histories=(team,type)=>draft.history.filter(h=>h.team===team&&h.type===type).map(h=>brawler(h.id)).filter(Boolean);
const used=id=>draft.history.some(h=>h.id===id);
const turn=()=>steps(draft.first,draft.rule)[draft.history.length];
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
function openDialog(html){dialogOrigin=document.activeElement;body.innerHTML=html;if(!modal.open)modal.showModal();$('.close-dialog').focus();}
function closeDialog(){modal.close();dialogOrigin?.isConnected&&dialogOrigin.focus();}
$('.close-dialog').addEventListener('click',closeDialog);
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
modal.addEventListener('close',()=>{if(dialogOrigin?.isConnected)dialogOrigin.focus();});
function persist(){write('brawl-draft-v1',draft);}
function updateCounts(){$$('.pool-count').forEach(x=>x.textContent=Object.values(pool).filter(v=>v.owned).length);}
function portrait(b,cls='',lazy=true){return `<img class="portrait ${cls}" src="${asset('brawlers',b.id)}" alt="${esc(nameOf(b))}" ${lazy?'loading="lazy"':''} width="160" height="160">`;}
function mapImage(m,cls=''){return `<img class="${cls}" src="${asset('maps',m.id)}" alt="${esc(mapName(m))}地图" loading="lazy" width="240" height="340">`;}
function modeIcon(m){return `<img class="mode-icon" src="${asset('modes',m.id)}" alt="" width="40" height="40">`;}
function pageTitle(title,sub,right=''){return `<div class="page-heading"><div><div class="eyebrow">BRAWL STARS · 战术实验室</div><h1>${title}</h1><p>${sub}</p></div>${right}</div>`;}
function modeOptions(value,all=false){const modes=all?[...new Set(M.map(m=>m.gameMode.name))]:rankedModes;return modes.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(modeName(x))}</option>`).join('');}
function filterBar(placeholder='搜索英雄名称…',extras=''){return `<div class="filter-bar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="hero-search" type="search" placeholder="${placeholder}" aria-label="搜索英雄" value="${esc(search)}" autocomplete="off"></label><select id="role-filter" aria-label="按职业筛选"><option value="">全部职业</option>${Object.entries(CLASSES).map(([k,v])=>`<option value="${k}" ${role===k?'selected':''}>${v}</option>`).join('')}</select>${extras}</div>`;}
function filteredBrawlers(){return B.filter(b=>(!search||[b.name,nameOf(b)].some(n=>n.toLowerCase().includes(search.toLowerCase())))&&(!role||b.class.name===role)&&(!poolOnly||owned(b.id)));}
function heroCard(b,{context='draft',score,rank}={}){
  const h=draft.history.find(h=>h.id===b.id),unavailable=context==='draft'&&(!!h||!b.released);
  const selectedClass=context==='draft'&&selected===b.id?'selected':'';
  return `<article class="hero-card ${selectedClass} ${unavailable?'unavailable':''}" style="--rarity:${esc(b.rarity.color)}">
    <button class="hero-main" data-action="${context==='draft'?'select':'detail'}" data-id="${b.id}" ${unavailable?'disabled':''} aria-label="${context==='draft'?'选择':'查看'}${esc(nameOf(b))}${h?'，已'+(h.type==='ban'?'禁用':'选取'):''}">
      ${portrait(b)}${rank?`<span class="rank-index">#${rank}</span>`:''}${score!==undefined?`<span class="tier-label tier-${tier(score)}">${tier(score)}</span>`:''}
      ${h?`<span class="used-overlay">${h.type==='ban'?'禁用':teamLabel(h.team)+'已选'}</span>`:''}${!b.released?'<span class="used-overlay">未开放</span>':''}
      <span class="hero-caption"><b>${esc(nameOf(b))}</b><small>${esc(CLASSES[b.class.name]||b.class.name)}</small></span>
    </button>
    ${context!=='draft'?`<button class="pool-toggle ${owned(b.id)?'owned':''}" data-action="toggle-pool" data-id="${b.id}" aria-label="${owned(b.id)?'移出':'加入'}${esc(nameOf(b))}的英雄池" aria-pressed="${owned(b.id)}">${owned(b.id)?'♥':'♡'}</button>`:''}
    ${context==='draft'&&owned(b.id)?'<span class="owned-marker" title="在我的英雄池中">♥</span>':''}
    ${score!==undefined?`<div class="card-score">适配分 <b>${score}</b></div>`:''}
  </article>`;
}
function render(){
  page=location.hash.slice(1).split('?')[0]||'draft';if(!['draft','brawlers','maps','tier','pool'].includes(page))page='draft';
  $$('.desktop-nav a,.mobile-nav a').forEach(a=>{const active=a.dataset.page===page;a.classList.toggle('active',active);active?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');});
  updateCounts();
  ({draft:renderDraft,brawlers:renderBrawlers,maps:renderMaps,tier:renderTier,pool:renderPool})[page]();
}
function teamPanel(team){
  const picks=histories(team,'pick'),bans=histories(team,'ban'),t=turn(),active=t?.team===team;
  return `<section class="team-panel ${team} ${active?'active-team':''}" aria-label="${teamLabel(team)}阵容">
    <div class="team-header"><h2>${teamLabel(team)} <span>${draft.first===team?'先手':'后手'}</span></h2><span class="team-state">${active?(t.type==='ban'?'正在禁用':'正在选人'):'等待回合'}</span></div>
    <div class="ban-row"><span>BAN</span>${Array.from({length:3},(_,i)=>bans[i]?`<div class="ban-slot filled">${portrait(bans[i])}<span>╱</span></div>`:'<div class="ban-slot"><span>⊘</span></div>').join('')}</div>
    <div class="pick-row">${Array.from({length:3},(_,i)=>{
      const b=picks[i],isNext=t?.type==='pick'&&active&&picks.length===i;
      return `<div class="pick-slot ${b?'filled':''} ${isNext?'next-pick':''}">${b?portrait(b,'',false):`<span class="slot-question">${isNext?'+':'?'}</span>`}<div class="pick-caption"><span>${b?esc(nameOf(b)):'待选英雄'}</span><small>${i+1}号位</small></div></div>`;
    }).join('')}</div>
  </section>`;
}
function renderDraft(){
  const m=currentMap(),t=turn(),complete=!t;
  main.innerHTML=`${pageTitle('每一手，都有胜算。','禁用 · 选取 · 阵容分析，把对局优势带进竞技场。',`<button class="button subtle" data-action="export-draft">导出 BP</button>`)}
    <div class="draft-toolbar"><button class="map-trigger" data-action="map-picker">${modeIcon(m.gameMode)}<span><small>${esc(modeName(currentMode()))}</small><b>${esc(mapName(m))}</b></span><span class="change-label">更换地图 ▾</span></button>
    <div class="draft-options"><label>先手<select id="first-select" aria-label="先手队伍"><option value="blue" ${draft.first==='blue'?'selected':''}>蓝方</option><option value="red" ${draft.first==='red'?'selected':''}>红方</option></select></label><label>规则<select id="rule-select" aria-label="BP 规则"><option value="ranked" ${draft.rule==='ranked'?'selected':''}>排位记录</option><option value="snake" ${draft.rule==='snake'?'selected':''}>蛇形禁用</option></select></label><button class="button subtle" data-action="undo" ${!draft.history.length?'disabled':''}>↶ 撤销</button><button class="square-button reset-button" data-action="reset" aria-label="重置本局">↻</button></div></div>
    <div class="arena">${teamPanel('blue')}<div class="versus"><b>VS</b><small>${complete?'阵容就绪':'3 VS 3'}</small></div>${teamPanel('red')}</div>
    <div class="turn-strip ${complete?'complete':t.team}" aria-live="polite"><span class="step-counter">${complete?'✓':String(draft.history.length+1).padStart(2,'0')}<small>/ 12</small></span><div><b>${complete?'BP 完成，查看你的阵容！':`${teamLabel(t.team)}${t.type==='ban'?'禁用':'选取'}英雄`}</b><span>${complete?'阵容评分已生成，可导出本局记录。':t.type==='ban'?'点击英雄头像，再确认禁用。双方各禁用 3 位。':'已禁用和已选英雄不可重复选择。'}</span></div><div class="step-track" aria-label="BP 进度">${steps(draft.first,draft.rule).map((s,i)=>`<i class="${s.team} ${i<draft.history.length?'done':''} ${i===draft.history.length?'now':''}" title="第${i+1}步 ${teamLabel(s.team)}${s.type==='ban'?'禁用':'选人'}"></i>`).join('')}</div></div>
    <section class="recommend-panel panel draft-recommendations" id="recommendations"></section><div class="workspace-grid"><section class="roster panel"><div class="panel-title"><h2>选择英雄 <span id="roster-count"></span></h2><label class="checkbox-label"><input id="pool-only" type="checkbox" ${poolOnly?'checked':''}> 仅我的英雄池</label></div>${filterBar()}<div id="roster-grid" class="hero-grid draft-grid"></div><div id="selection-bar"></div></section>
    <aside class="draft-aside"><section class="map-panel panel"><div class="panel-title"><h2>战场情报</h2><button data-action="map-detail" data-id="${m.id}">放大 ↗</button></div><div class="map-preview">${mapImage(m)}<div class="map-preview-title">${modeIcon(m.gameMode)}<span><b>${esc(mapName(m))}</b><small>${esc(modeName(m.gameMode.name))}</small></span></div></div><p class="map-note">${modeTip(currentMode())}</p></section></aside></div>
    <section class="analysis-panel panel" id="analysis"></section>
    <p class="quiet-note">排位记录模式将双方各 3 个禁用分组录入，方便复盘；并非联机排位。选取顺序为先手 → 后手 → 后手 → 先手 → 先手 → 后手。</p>`;
  renderRoster();renderRecommendations();renderAnalysis();
}
function modeTip(mode){return {'Gem Grab':'围绕宝石控制中场，兼顾持续压制与持有者的生存。','Brawl Ball':'推进、开墙与防守都很关键。避免阵容缺少近距离保护。','Bounty':'控制距离，保持生存。远程压制与反突进缺一不可。','Heist':'保留对金库的持续输出，同时考虑回防能力。','Hot Zone':'站稳热区需要持续控场，治疗与范围伤害更有价值。','Knockout':'每条生命都很珍贵。重视射程、探点与安全的收割机会。'}[mode]||'结合地形、任务目标与队伍配合选取英雄。';}
function renderRoster(){
  const list=filteredBrawlers().sort((a,b)=>Number(b.released)-Number(a.released)||nameOf(a).localeCompare(nameOf(b),'zh-CN'));
  $('#roster-count').textContent=`${list.length} / ${B.length}`;
  $('#roster-grid').innerHTML=list.length?list.map(b=>heroCard(b)).join(''):'<div class="empty-state"><b>没有找到英雄</b><p>试试其他名称，或清除筛选条件。</p><button class="button" data-action="clear-filters">清除筛选</button></div>';
  renderSelection();
}
function renderSelection(){
  const b=brawler(selected),t=turn();
  $('#selection-bar').innerHTML=t?`<div class="selection-bar">${b?`${portrait(b)}<div><b>${esc(nameOf(b))}</b><small>${esc(CLASSES[b.class.name])} · ${esc(RARITIES[b.rarity.name]||b.rarity.name)}</small></div><button class="detail-mini" data-action="detail" data-id="${b.id}" aria-label="查看${esc(nameOf(b))}详情">详情</button>`:'<div class="selection-hint">选择一位英雄，锁定你的决策。</div>'}<button class="button ${t.type==='ban'?'danger':'yellow'}" data-action="confirm" ${!b||used(b.id)||!b.released?'disabled':''}>${t.type==='ban'?'确认禁用':'锁定英雄'} <span>→</span></button></div>`:'<div class="selection-bar"><b>阵容已锁定，准备开战！</b><button class="button yellow" data-action="scroll-analysis">查看分析 ↓</button></div>';
}
function recommended(){const t=turn();return rankCandidates({brawlers:B,history:draft.history,team:adviceTeam==='follow'?(t?.team||draft.first):adviceTeam,mapId:currentMap().id,mode:currentMode(),stats:liveStats,editorial,sourceId:youtubeSourceId||undefined,poolIds:poolOnly?B.filter(b=>owned(b.id)).map(b=>b.id):undefined});}
function renderRecommendations(){
  const host=$('#recommendations');if(!host)return;
  const t=turn(),mine=adviceTeam==='follow'?(t?.team||draft.first):adviceTeam,canPick=t&&(t.type==='ban'||t.team===mine),rows=recommended().slice(0,5);
  const hand=draft.history.filter(h=>h.type==='pick').length+1;
  host.innerHTML=`<div class="panel-title"><h2>${!t?'本局已完成':t.type==='ban'?'禁用参考':`${teamLabel(mine)}第 ${Math.min(hand,6)} 手候选`}</h2><span class="mini-label">自动更新</span></div><div class="advice-controls"><label>为谁推荐<select id="advice-team"><option value="blue" ${adviceTeam==='blue'?'selected':''}>蓝方 · 我方</option><option value="red" ${adviceTeam==='red'?'selected':''}>红方 · 我方</option><option value="follow" ${adviceTeam==='follow'?'selected':''}>当前选人方</option></select></label><button data-action="refresh-stats" ${statsStatus==='loading'?'disabled':''}>${statsStatus==='loading'?'刷新中…':'刷新胜率'}</button></div><p class="advice-context">${!t?'六位英雄均已选定，可查看下方阵容资料。':t.type==='ban'?'按真实胜率与视频榜单筛选，已禁用或已选英雄自动排除。':canPick?'轮到我方选人，点击候选后确认锁定。':'对方正在选人，以下为我方下一手保留候选。'}</p><div class="advice-list" aria-live="polite">${rows.map(({b,stat,tier:yt,reason},i)=>`<button class="recommend-row" data-action="select" data-id="${b.id}" ${!canPick?'disabled':''}><span class="rec-index">${i+1}</span>${portrait(b)}<span class="rec-copy"><b>${esc(nameOf(b))}${yt?` <em>${esc(yt.tier)}</em>`:''}</b><small>${stat?`${stat.scope==='map'?'本地图':stat.scope==='mode'?'本模式':'全局'} · ${Number(stat.battles).toLocaleString()} 场`:'YouTube 作者评级'}</small><span class="recommend-reason">${esc(reason)}</span></span><strong>${stat?`${(stat.winRate*100).toFixed(1)}<small>%</small>`:yt?.tier||'—'}</strong></button>`).join('')||'<div class="empty-state"><b>暂无足够依据的候选</b><p>等待胜率数据，或查看视频榜单中已收录的英雄。</p></div>'}</div>${statsFootnote()}<p class="evaluation-note">每次禁用、选人、撤销和切换地图都会重算。只在有实测对位或搭配数据时计入对应调整。</p>`;
}
function renderAnalysis(){
  const host=$('#analysis');if(!host)return;const blue=histories('blue','pick'),red=histories('red','pick');
  host.innerHTML=`<div class="panel-title"><h2>阵容数据</h2><button data-action="sources">来源与统计口径 ↗</button></div><div class="analysis-grid">${['blue','red'].map(team=>{const list=team==='blue'?blue:red,records=list.map(b=>({b,stat:selectStat(liveStats,b.id,{mapId:currentMap().id,mode:currentMode()})}));const known=records.filter(x=>x.stat),mean=known.length?known.reduce((n,x)=>n+x.stat.winRate,0)/known.length:null;return `<div class="team-analysis ${team}"><div class="score-header"><h3>${teamLabel(team)} · ${list.length}/3 已选</h3><b>${mean===null?'—':(mean*100).toFixed(1)+'%'}<small> 英雄胜率均值</small></b></div>${records.map(({b,stat})=>`<div class="line-stat"><span>${esc(nameOf(b))}</span><b>${stat?(stat.winRate*100).toFixed(1)+'%':'暂无样本'}</b><small>${stat?`${stat.battles.toLocaleString()} 场 · ${stat.scope==='map'?'本地图':stat.scope==='mode'?'本模式':'全局'}`:''}</small></div>`).join('')||'<p>选出英雄后显示对应统计。</p>'}<p class="evaluation-note">${known.length}/${list.length} 位有可用样本。均值仅用于查看已选英雄表现，不是这套三人阵容的胜率预测。</p></div>`;}).join('')}</div>${blue.length&&red.length?`<div class="matchup-table"><h3>实测英雄对位</h3><div class="table-scroll"><table><thead><tr><th>蓝方 / 红方</th>${red.map(b=>`<th>${esc(nameOf(b))}</th>`).join('')}</tr></thead><tbody>${blue.map(a=>`<tr><th>${esc(nameOf(a))}</th>${red.map(b=>{const pair=empiricalPair(a.id,b.id);return `<td>${pair?`${(pair.winRate*100).toFixed(1)}%<small> · ${pair.battles} 场</small>`:'暂无足量样本'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="evaluation-note">展示蓝方英雄出现在红方英雄对面的排位样本表现，不代表单挑胜率。</p></div>`:''}`;
}
function renderBrawlers(){
  main.innerHTML=`${pageTitle('英雄图鉴','查看完整英雄资料、随身妙具与星徽之力。',`<div class="stat-sticker"><b>${B.length}</b><span>位英雄</span></div>`)}<section class="panel database-panel">${filterBar()}<p class="result-count" id="result-count"></p><div class="hero-grid library-grid" id="library-grid"></div></section>`;renderLibrary();
}
function renderLibrary(){const list=filteredBrawlers().sort((a,b)=>a.id-b.id);$('#result-count').textContent=`显示 ${list.length} 位英雄 · 点击头像查看资料，爱心加入英雄池`;
  $('#library-grid').innerHTML=list.map(b=>heroCard(b,{context:'library'})).join('')||'<div class="empty-state">没有找到英雄。请调整搜索与职业筛选。</div>';}
function detail(id){const b=brawler(id);if(!b)return;const cls=b.class.name;
  const targets=B.filter(x=>x.released&&x.id!==b.id).map(x=>({b:x,v:matchup(b,x)}));
  const favorable=targets.filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,5),unfavorable=targets.filter(x=>x.v<0).sort((a,b)=>a.v-b.v).slice(0,5);
  openDialog(`<div class="detail-hero" style="--rarity:${esc(b.rarity.color)}">${portrait(b,'',false)}<div><span class="eyebrow">BRAWLER #${b.id-16000000+1}</span><h2>${esc(nameOf(b))}</h2><p>${esc(b.name)} · ${esc(CLASSES[cls])}</p><span class="rarity-tag">${esc(RARITIES[b.rarity.name]||b.rarity.name)}</span></div></div><div class="detail-content"><p class="bio" lang="en">${esc(b.description)}</p><p class="evaluation-note">英雄与技能原文来自数据源，未翻译的名称保留英文。未开放英雄不参与 BP。</p><button class="button ${owned(id)?'subtle':'yellow'}" data-action="toggle-pool" data-id="${id}">${owned(id)?'♥ 已加入英雄池':'♡ 加入我的英雄池'}</button>
    <h3>随身妙具</h3><div class="ability-list">${(b.gadgets||[]).map(g=>`<article><span class="ability-kind gadget">G</span><div><h4>${esc(g.name)}</h4><p lang="en">${esc(g.description)}</p></div></article>`).join('')||'<p>暂无资料</p>'}</div>
    <h3>星徽之力</h3><div class="ability-list">${(b.starPowers||[]).map(g=>`<article><span class="ability-kind star">★</span><div><h4>${esc(g.name)}</h4><p lang="en">${esc(g.description)}</p></div></article>`).join('')||'<p>暂无资料</p>'}</div>
    <h3>模式样本胜率</h3><div class="mode-scores">${rankedModes.map(m=>{const stat=selectStat(liveStats,b.id,{mapId:null,mode:m});return `<div><span>${esc(modeName(m))}</span><b>${stat?(stat.winRate*100).toFixed(1)+'%':'—'}</b></div>`;}).join('')}</div>
    <h3>机制克制参考（非实测）</h3><p class="evaluation-note">职业相性与部分英雄机制推导，同分按数据顺序展示；点击对位说明查看生效条件。</p><div class="counter-columns"><div><h4>对位偏有利</h4>${favorable.map(x=>`<button class="counter-item" data-action="matchup-reason" data-id="${id}" data-enemy="${x.b.id}">${portrait(x.b)}<span>${esc(nameOf(x.b))}<small>${esc(CLASSES[x.b.class.name])}</small></span><b>+${x.v}</b></button>`).join('')||'<p>无显著职业优势</p>'}</div><div><h4>需要留意</h4>${unfavorable.map(x=>`<button class="counter-item" data-action="matchup-reason" data-id="${id}" data-enemy="${x.b.id}">${portrait(x.b)}<span>${esc(nameOf(x.b))}<small>${esc(CLASSES[x.b.class.name])}</small></span><b>${x.v}</b></button>`).join('')||'<p>无显著职业劣势</p>'}</div></div><a class="source-link" href="${esc(b.link)}" target="_blank" rel="noreferrer">在 Brawlify 查看英雄 ↗</a></div>`);
}
function renderMaps(){main.innerHTML=`${pageTitle('选好你的战场','浏览全部地图与模式，查看地形后进入 BP。',`<div class="stat-sticker"><b>${M.length}</b><span>张地图</span></div>`)}<section class="panel database-panel"><div class="filter-bar"><label class="search-field"><span>⌕</span><input id="map-search" type="search" aria-label="搜索地图" placeholder="搜索地图中文或英文名称…" value="${esc(mapSearch)}"></label><select id="map-mode-filter" aria-label="地图模式"><option value="">全部模式</option>${modeOptions(mapMode,true)}</select><label class="checkbox-label"><input id="show-disabled" type="checkbox" ${showDisabled?'checked':''}> 包含停用地图</label></div><p class="result-count" id="map-result-count"></p><div class="map-grid" id="map-grid"></div><button class="button load-more" id="load-more-maps" data-action="more-maps">加载更多地图</button></section>`;mapLimit=24;renderMapGrid();}
let mapLimit=24;
function matchingMaps(){return M.filter(m=>(showDisabled||!m.disabled)&&(!mapMode||m.gameMode.name===mapMode)&&(!mapSearch||[m.name,mapName(m)].some(n=>n.toLowerCase().includes(mapSearch.toLowerCase()))));}
function renderMapGrid(){const list=matchingMaps();$('#map-result-count').textContent=`共 ${list.length} 张 · 数据源的启用状态不等同于当前排位地图池`;
  $('#map-grid').innerHTML=list.slice(0,mapLimit).map(m=>`<button class="map-card" data-action="map-detail" data-id="${m.id}"><div class="map-card-image">${mapImage(m)}${m.disabled?'<span class="map-disabled">已停用</span>':''}</div><div class="map-card-caption">${modeIcon(m.gameMode)}<span><b>${esc(mapName(m))}</b><small>${esc(modeName(m.gameMode.name))}</small></span></div></button>`).join('')||'<div class="empty-state">没有匹配的地图，请更改搜索或模式筛选。</div>';$('#load-more-maps').hidden=mapLimit>=list.length;}
function mapDetail(id){const m=M.find(x=>x.id===id);if(!m)return;openDialog(`<div class="dialog-heading"><span class="eyebrow">MAP INTELLIGENCE</span><h2>${esc(mapName(m))}</h2><p>${esc(modeName(m.gameMode.name))} · ${esc(m.name)}</p></div><div class="large-map">${mapImage(m)}</div><div class="detail-content"><p>${m.disabled?'数据源标记为停用地图。':'数据源标记为启用地图，不保证属于本赛季排位池。'}</p><p>${modeTip(m.gameMode.name)}</p>${rankedModes.includes(m.gameMode.name)?`<button class="button yellow" data-action="use-map" data-id="${m.id}">在此地图开始 BP →</button>`:'<p class="evaluation-note">BP 模拟器目前支持 6 种常规 3v3 排位模式。</p>'}<a class="source-link" href="${esc(m.link)}" target="_blank" rel="noreferrer">在 Brawlify 查看地图 ↗</a></div>`);}
function mapPicker(mode=currentMode(),q=''){const list=M.filter(m=>!m.disabled&&m.gameMode.name===mode&&(!q||[m.name,mapName(m)].some(n=>n.toLowerCase().includes(q.toLowerCase()))));
  openDialog(`<div class="dialog-heading"><span class="eyebrow">CHOOSE YOUR BATTLEGROUND</span><h2>选择战场</h2><p>地图状态来自数据库，可用于模拟练习。</p></div><div class="detail-content"><div class="filter-bar"><select id="picker-mode" aria-label="选择模式">${modeOptions(mode)}</select><label class="search-field"><input id="picker-search" type="search" placeholder="搜索地图…" aria-label="搜索可用地图" value="${esc(q)}"></label></div><div class="picker-grid">${list.map(m=>`<button class="picker-map ${m.id===draft.map?'chosen':''}" data-action="use-map" data-id="${m.id}">${mapImage(m)}<b>${esc(mapName(m))}</b></button>`).join('')||'<p>未找到地图。</p>'}</div></div>`);
}
function renderTier(){
  const sourcesList=editorial.sources||[];if(!youtubeSourceId&&sourcesList.length)youtubeSourceId=sourcesList[0].id;
  main.innerHTML=`${pageTitle('有出处的强度榜','YouTube 作者观点与真实排位胜率，分别查看。')}<div class="tier-view-tabs"><button data-action="tier-view" data-view="youtube" class="button ${tierView==='youtube'?'yellow':'subtle'}">YouTube 强度榜</button><button data-action="tier-view" data-view="stats" class="button ${tierView==='stats'?'yellow':'subtle'}">对战胜率榜</button></div><section class="panel tier-intro"><div><h2>${tierView==='youtube'?'YouTube 作者榜单':'真实排位胜率'}</h2><p>${tierView==='youtube'?'保留作者原始档位，不再按照职业生成强度等级。':'按样本胜率排序，显示对局数量和统计截止时间。'}</p></div>${tierView==='youtube'?`<label>视频来源<select id="youtube-source">${sourcesList.map(s=>`<option value="${esc(s.id)}" ${s.id===youtubeSourceId?'selected':''}>${esc(s.creator)} · ${esc(s.publishedAt)}</option>`).join('')}</select></label>`:`<label>选择模式<select id="tier-mode"><option value="">全部模式</option>${modeOptions(tabMode)}</select></label>`}</section><div id="tier-data-status"></div><div id="tier-rows"></div>`;
  renderTierRows();
}
function renderTierRows(){
  const host=$('#tier-rows'),info=$('#tier-data-status');
  if(tierView==='youtube'){
    const source=(editorial.sources||[]).find(s=>s.id===youtubeSourceId)||(editorial.sources||[])[0];
    if(!source){info.innerHTML='';host.innerHTML='<div class="panel empty-state"><h2>尚无已核验的完整视频榜单</h2><p>未确认的英雄不会被自动归档。可切换到真实胜率榜查看对战数据。</p></div>';return;}
    info.innerHTML=`<div class="panel source-banner"><div><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a><p>${esc(source.creator)} · 发布 ${esc(source.publishedAt)} · 核验 ${esc(source.verifiedAt||'')}</p></div>${source.notes?`<p>${esc(source.notes)}</p>`:''}</div>`;
    const rated=B.filter(b=>b.released).map(b=>({b,yt:selectYoutubeTier(editorial,b,source.id)}));
    host.innerHTML=['S','A','B','C','D','F'].filter(t=>rated.some(x=>x.yt?.tier===t)).map(t=>`<section class="tier-row panel"><h2 class="tier-${t}">${t}</h2><div class="tier-members">${rated.filter(x=>x.yt?.tier===t).map(({b})=>`<button class="tier-member" data-action="detail" data-id="${b.id}" aria-label="${esc(nameOf(b))}，作者${t}档">${portrait(b)}<span>${esc(nameOf(b))}</span></button>`).join('')}</div></section>`).join('');
    const missing=rated.filter(x=>!x.yt);host.innerHTML+=`<section class="tier-row panel unrated-tier"><h2>?</h2><div class="tier-members">${missing.map(({b})=>`<button class="tier-member" data-action="detail" data-id="${b.id}">${portrait(b)}<span>${esc(nameOf(b))}</span></button>`).join('')}<p class="quiet-note">${missing.length} 位未在此来源中核实评级，保留未评级。</p></div></section>`;
  }else{
    info.innerHTML=statsFootnote(true);const ranked=B.filter(b=>b.released).map(b=>({b,stat:selectStat(liveStats,b.id,{mapId:null,mode:tabMode||null})})).filter(x=>x.stat&&x.stat.battles>=30).sort((a,b)=>b.stat.winRate-a.stat.winRate||b.stat.battles-a.stat.battles);
    host.innerHTML=ranked.length?`<section class="panel winrate-board"><div class="winrate-heading"><span>英雄</span><span>样本胜率</span><span>样本量</span></div>${ranked.map(({b,stat},i)=>`<button class="winrate-row" data-action="detail" data-id="${b.id}"><span class="winrate-hero"><i>${i+1}</i>${portrait(b)}<b>${esc(nameOf(b))}</b></span><strong>${(stat.winRate*100).toFixed(1)}%</strong><span>${stat.battles.toLocaleString()} 场</span></button>`).join('')}</section>`:'<div class="panel empty-state"><h2>暂无足量胜率样本</h2><p>数据正在刷新，或当前筛选不在数据覆盖范围内。</p><button class="button yellow" data-action="refresh-stats">刷新数据</button></div>';
  }
}
function renderPool(){const count=Object.values(pool).filter(x=>x.owned).length;main.innerHTML=`${pageTitle('你的英雄，你的主场。','记录已拥有英雄、战力等级与熟练度，让选人更贴近你的习惯。',`<div class="pool-tools"><button class="button subtle" data-action="import-pool">导入</button><button class="button yellow" data-action="export-pool">导出备份</button><input type="file" id="pool-file" accept=".json,application/json" hidden></div>`)}<div class="pool-summary"><div><b>${count}</b><span>已拥有英雄</span></div><div><b>${Object.values(pool).filter(x=>x.owned&&x.level===11).length}</b><span>满级英雄</span></div><div><b>${Object.values(pool).filter(x=>x.owned&&x.mastery>=4).length}</b><span>熟练英雄</span></div><p>${storageWorking?'自动保存在此浏览器。换设备前请导出备份。':'浏览器存储不可用，请导出备份。'}</p></div><section class="panel database-panel">${filterBar()}<div class="pool-list" id="pool-list"></div></section>`;renderPoolList();}
function renderPoolList(){const list=filteredBrawlers().sort((a,b)=>Number(owned(b.id))-Number(owned(a.id))||a.id-b.id);$('#pool-list').innerHTML=list.map(b=>{const p=pool[b.id]||{};return `<article class="pool-row ${p.owned?'is-owned':''}"><button class="pool-avatar" data-action="detail" data-id="${b.id}">${portrait(b)}</button><div class="pool-name"><b>${esc(nameOf(b))}</b><small>${esc(CLASSES[b.class.name])}</small></div><label class="pool-level">战力<select data-pool-field="level" data-id="${b.id}" aria-label="${esc(nameOf(b))}战力等级" ${!p.owned?'disabled':''}>${Array.from({length:11},(_,i)=>`<option value="${i+1}" ${(p.level||1)===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><label class="pool-mastery">熟练度<select data-pool-field="mastery" data-id="${b.id}" aria-label="${esc(nameOf(b))}熟练度" ${!p.owned?'disabled':''}>${['未练习','入门','熟悉','熟练','绝活'].map((x,i)=>`<option value="${i+1}" ${(p.mastery||1)===i+1?'selected':''}>${x}</option>`).join('')}</select></label><button class="button pool-owned-button ${p.owned?'subtle':'yellow'}" data-action="toggle-pool" data-id="${b.id}" aria-pressed="${!!p.owned}">${p.owned?'♥ 已拥有':'+ 加入'}</button></article>`;}).join('')||'<div class="empty-state">没有找到英雄。</div>';}
function sources(){openDialog(`<div class="dialog-heading"><span class="eyebrow">SOURCES & BATTLE DATA</span><h2>榜单与胜率来源</h2></div><div class="detail-content prose"><h3>YouTube 作者强度榜</h3><p>强度档位直接保留视频作者的判断，不再按职业给英雄打分。每份榜单标明作者、标题、发布日期和核验日期。没有核实评级的英雄显示为未评级，不自动补齐档位。</p>${(editorial.sources||[]).map(v=>`<p><a href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.creator)} · ${esc(v.title)}</a><br>发布：${esc(v.publishedAt)}；${esc(v.notes||'作者观点与统计胜率分别展示。')}</p>`).join('')}<h3>实际排位对战样本</h3><p>统计来源：<a href="https://huggingface.co/datasets/EliF77/brawlstars-ranked" target="_blank" rel="noreferrer">EliF77 / brawlstars-ranked</a>，由 <a href="https://github.com/elixf7/brawlstars-data-pipeline" target="_blank" rel="noreferrer">公开数据采集项目</a> 发布。网站聚合英雄在地图、模式及全局的样本胜率；样本覆盖该采集项目观察到的玩家，不代表全服全部对局。</p>${statsFootnote(true)}<p>上游通常按天或按周发布。站点定期拉取新数据，打开页面后每 5 分钟检查站点快照，也可手动刷新。重新拉取不会将旧对局变成新对局，统计截止时间始终保留。</p><h3>每一手如何自动推荐</h3><p>每次禁用、选人、撤销和换图都会重新计算候选：先排除已用及未开放英雄，再参考本地图、本模式或全局的实测表现。按样本量评估不确定性；只有存在足量实测对位或搭配样本时才使用相应调整。没有胜率时只参考视频已核实档位，两者都没有时不生成虚构推荐。</p><p>选择“蓝方·我方”或“红方·我方”后，对手每选出一位英雄，也会重算我方下一手候选。对手回合中的我方候选不可直接锁定，防止误选到对手阵容。</p><h3>不要混淆不同数字</h3><p>页面的百分比为数据源样本胜率，不是职业分数。对位百分比表示英雄在对手英雄对面出现时所在队伍的样本表现，不是单挑胜率。阵容中的“英雄胜率均值”也不是该三人阵容的获胜概率。视频评级属于作者意见，不能当作实测胜率。</p><h3>英雄与地图资料</h3><p>${B.length} 位英雄、${M.length} 张地图资料来自 <a href="https://brawlapi.com/" target="_blank" rel="noreferrer">BrawlAPI</a>，图片由 <a href="https://github.com/Brawlify/CDN" target="_blank" rel="noreferrer">Brawlify CDN</a> 提供。地图的启用状态不等于本赛季排位池。未核实的中文名称保留英文。</p><h3>个人英雄池</h3><p>英雄池及 BP 保存在当前浏览器，可导出备份，不自动跨设备同步。英雄池筛选仅限制候选列表。</p><h3>玩家创作声明</h3><p>本内容与 Supercell 无关，亦未获得其认可、赞助或批准。游戏素材和商标属于 Supercell。参见 <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noreferrer">玩家内容政策</a>。</p></div>`);}
function help(){openDialog(`<div class="dialog-heading"><span class="eyebrow">READY TO BRAWL?</span><h2>开始你的 BP 练习</h2></div><div class="detail-content prose"><ol><li>选择地图和模式，设置哪一方先选。</li><li>依次为双方录入 3 位禁用英雄。</li><li>点击英雄头像，再点「锁定英雄」。选人按先手、后手、后手、先手、先手、后手进行。</li><li>查看实测对位（若有样本）和阵容资料。用「撤销」回到上一步，用右上角导出保存本局。</li></ol><p>去「我的英雄池」记录你拥有的英雄，回到模拟器后可勾选「仅我的英雄池」。</p><button class="button yellow" data-action="close">准备好了！</button></div>`);}
function download(filename,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function resetWith(change={}){if(draft.history.length){openDialog(`<div class="dialog-heading"><h2>开始一局新的 BP？</h2><p>修改规则或地图会清空当前选择。你也可以先导出本局。</p></div><div class="detail-content dialog-actions"><button class="button subtle" data-action="export-draft">导出本局</button><button class="button yellow" id="confirm-reset">开始新局</button></div>`);$('#confirm-reset').onclick=()=>{draft={...draft,...change,history:[]};selected=null;persist();closeDialog();render();};}else{draft={...draft,...change,history:[]};selected=null;persist();if(modal.open)closeDialog();render();}}
async function importPool(file){if(!file)return;try{if(file.size>500000)throw Error('文件过大');const data=JSON.parse(await file.text());if(data.type!=='brawl-pool'||data.version!==1||!data.heroes||Array.isArray(data.heroes)||typeof data.heroes!=='object')throw Error('文件格式不正确');const next={};for(const [id,v] of Object.entries(data.heroes)){if(!B.some(b=>String(b.id)===id)||!v||typeof v!=='object'||typeof v.owned!=='boolean'||!Number.isInteger(v.level)||v.level<1||v.level>11||!Number.isInteger(v.mastery)||v.mastery<1||v.mastery>5)throw Error('英雄池数据无效');next[id]={owned:v.owned,level:v.level,mastery:v.mastery};}openDialog(`<div class="dialog-heading"><h2>导入英雄池</h2><p>该备份包含 ${Object.values(next).filter(x=>x.owned).length} 位已拥有英雄，将替换当前英雄池。</p></div><div class="detail-content dialog-actions"><button class="button subtle" data-action="close">取消</button><button class="button yellow" id="confirm-import">导入备份</button></div>`);$('#confirm-import').onclick=()=>{pool=next;write('brawl-pool-v1',pool);closeDialog();render();toast('英雄池已导入');};}catch(e){toast('导入失败：'+e.message);}}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const id=Number(el.dataset.id),action=el.dataset.action;
  switch(action){
    case 'refresh-stats':refreshStats(true);break;
    case 'tier-view':tierView=el.dataset.view;renderTier();break;
    case 'select': if(!turn()||used(id)||!brawler(id)?.released)return;selected=id;if(page!=='draft'){location.hash='draft';}else{renderRoster();}break;
    case 'confirm':{const next=applyChoice(draft.history,selected,B,draft.first,draft.rule);if(next===draft.history)return;draft.history=next;selected=null;persist();renderDraft();break;}
    case 'undo':draft.history.pop();selected=null;persist();renderDraft();break;
    case 'reset':resetWith();break;
    case 'detail':detail(id);break;
    case 'matchup-reason':{const a=brawler(id),b=brawler(Number(el.dataset.enemy));if(!a||!b)return;const score=matchup(a,b);openDialog('<div class="dialog-heading"><h2>'+esc(nameOf(a))+' vs '+esc(nameOf(b))+'</h2><p>对位启发分 '+(score>0?'+':'')+score+' · 非胜率</p></div><div class="detail-content prose"><p>'+esc(matchupReason(a,b))+'</p><p>这是机制和职业的条件性推导。地图、装备、操作和技能是否可用会改变结果。</p><button class="button yellow" data-action="detail" data-id="'+id+'">查看英雄资料</button></div>');break;}
    case 'map-detail':mapDetail(id);break;
    case 'map-picker':mapPicker();break;
    case 'use-map':{const m=M.find(x=>x.id===id);if(!m||!rankedModes.includes(m.gameMode.name))return;if(page!=='draft'){page='draft';location.hash='draft';}resetWith({map:id});break;}
    case 'toggle-pool':{if(!brawler(id))return;pool[id]={level:1,mastery:1,...pool[id],owned:!owned(id)};write('brawl-pool-v1',pool);updateCounts();if(modal.open&&$('.detail-hero',body)){detail(id);}else if(page==='pool'){renderPool();}else if(page==='brawlers'){renderLibrary();}toast(pool[id].owned?'已加入英雄池':'已移出英雄池');break;}
    case 'clear-filters':search='';role='';poolOnly=false;renderDraft();break;
    case 'sources':sources();break;case 'help':help();break;case 'close':closeDialog();break;
    case 'export-draft':download('brawl-draft.json',{type:'brawl-draft',version:1,exportedAt:new Date().toISOString(),map:{id:currentMap().id,name:currentMap().name,mode:currentMode()},first:draft.first,rule:draft.rule,history:draft.history.map(h=>({...h,name:brawler(h.id)?.name})),statistics:{source:liveStats.source,fetchedAt:liveStats.fetchedAt,heroes:draft.history.filter(h=>h.type==='pick').map(h=>({id:h.id,team:h.team,stat:selectStat(liveStats,h.id,{mapId:currentMap().id,mode:currentMode()})}))}});toast('已导出 BP 记录');break;
    case 'export-pool':download('brawl-hero-pool.json',{type:'brawl-pool',version:1,exportedAt:new Date().toISOString(),heroes:pool});toast('已导出英雄池备份');break;
    case 'import-pool':$('#pool-file').click();break;
    case 'more-maps':mapLimit+=24;renderMapGrid();break;
    case 'scroll-analysis':$('#analysis').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});break;
    case 'retry':location.reload();break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='hero-search'){search=e.target.value;if(page==='draft')renderRoster();else if(page==='brawlers')renderLibrary();else if(page==='pool')renderPoolList();}
  if(e.target.id==='map-search'){mapSearch=e.target.value;mapLimit=24;renderMapGrid();}
  if(e.target.id==='picker-search'){const q=e.target.value,mode=$('#picker-mode').value;mapPicker(mode,q);const input=$('#picker-search');input.focus();input.setSelectionRange(q.length,q.length);}
});
document.addEventListener('change',e=>{
  const el=e.target,id=el.id;
  if(id==='role-filter'){role=el.value;if(page==='draft')renderRoster();else if(page==='brawlers')renderLibrary();else renderPoolList();}
  if(id==='pool-only'){poolOnly=el.checked;renderRoster();renderRecommendations();}
  if(id==='first-select'){const val=el.value;el.value=draft.first;resetWith({first:val});}
  if(id==='rule-select'){const val=el.value;el.value=draft.rule;resetWith({rule:val});}
  if(id==='map-mode-filter'){mapMode=el.value;mapLimit=24;renderMapGrid();}
  if(id==='show-disabled'){showDisabled=el.checked;mapLimit=24;renderMapGrid();}
  if(id==='picker-mode')mapPicker(el.value);
  if(id==='advice-team'){adviceTeam=el.value;write('brawl-advice-team',adviceTeam);renderRecommendations();}
  if(id==='youtube-source'){youtubeSourceId=el.value;renderTierRows();}
  if(id==='tier-mode'){tabMode=el.value;renderTierRows();}
  if(id==='pool-file'){importPool(el.files[0]);el.value='';}
  if(el.dataset.poolField){const heroId=Number(el.dataset.id);if(owned(heroId)){pool[heroId][el.dataset.poolField]=Number(el.value);write('brawl-pool-v1',pool);const value=el.value;renderPool();const control=$(`[data-pool-field="${el.dataset.poolField}"][data-id="${heroId}"]`);control?.focus();}}
});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='./assets/icon.png';e.target.classList.add('image-fallback');}},{capture:true});
window.addEventListener('hashchange',()=>{search='';role='';poolOnly=false;selected=null;render();window.scrollTo(0,0);});
async function init(){try{const results=window.BRAWL_DATA||await Promise.all(['brawlers','maps','meta','youtube-tiers','live-stats'].map(async k=>{const r=await fetch(`./data/${k}.json`);if(!r.ok)throw Error('数据库载入失败');return r.json();}));B=results[0].list;M=results[1].list;meta=results[2];editorial=results[3]||{sources:[]};liveStats=results[4]||{records:[]};statsStatus=liveStats.records?.length?'cached':'unavailable';
  // Validate persisted data before using it in markup or applying selections.
  pool=Object.fromEntries(Object.entries(pool&&typeof pool==='object'?pool:{}).filter(([id,v])=>B.some(b=>String(b.id)===id)&&v&&typeof v.owned==='boolean').map(([id,v])=>[id,{owned:v.owned,level:Number.isInteger(v.level)&&v.level>=1&&v.level<=11?v.level:1,mastery:Number.isInteger(v.mastery)&&v.mastery>=1&&v.mastery<=5?v.mastery:1}]));
  if(!['blue','red','follow'].includes(adviceTeam))adviceTeam='blue';
  if(!draft||!['blue','red'].includes(draft.first)||!['ranked','snake'].includes(draft.rule))draft={first:'blue',rule:'ranked',map:15000007,history:[]};
  if(!M.some(m=>m.id===draft.map&&rankedModes.includes(m.gameMode.name)))draft.map=M.find(m=>!m.disabled&&m.gameMode.name==='Gem Grab').id;
  let h=[];for(const entry of Array.isArray(draft.history)?draft.history.slice(0,12):[])h=applyChoice(h,entry?.id,B,draft.first,draft.rule);draft.history=h;
  $('#data-date').textContent=`资料快照 ${new Date(meta.fetchedAt).toLocaleDateString('zh-CN')}`;render();refreshStats();setInterval(()=>{if(!document.hidden)refreshStats();},300000);
}catch(e){main.innerHTML='<div class="empty-state panel"><h1>竞技场暂时无法载入</h1><p>请检查网络连接后重试。如果从本地打开，请使用启动脚本。</p><button class="button yellow" data-action="retry">重新载入</button></div>';console.error(e);}}
function empiricalPair(a,b){const rows=(liveStats.counters||[]).filter(x=>x.brawlerId===a&&x.enemyId===b&&x.battles>=30&&(!x.mapId||x.mapId===currentMap().id)&&(!x.mode||x.mode===currentMode()));return rows.sort((a,b)=>Number(!!b.mapId)-Number(!!a.mapId)||Number(!!b.mode)-Number(!!a.mode)||b.battles-a.battles)[0]||null;}
function statsFootnote(wide=false){const source=liveStats.source||{},has=!!liveStats.records?.length;return '<div class="'+(wide?'panel source-banner':'stats-footnote')+'"><b>'+(!has?(statsStatus==='loading'?'正在获取对战统计…':'暂无可用的胜率快照'):isStatsStale(liveStats)?'缓存统计 · 请留意日期':'排位样本统计')+'</b><p>'+esc(source.name||'公开排位对战数据')+(source.updatedAt?' · 统计截止 '+esc(source.updatedAtPrecision==='day'?source.updatedAt+'（UTC，按日）':new Date(source.updatedAt).toLocaleString('zh-CN')):'')+'</p><p>'+'数据源每周发布；站点每小时检查新快照，非秒级直播数据'+'</p>'+(has?'<small>站点获取 '+esc(new Date(liveStats.fetchedAt).toLocaleString('zh-CN'))+'</small>':'')+(statsError?'<p>本次刷新失败，保留上一份带日期的快照。</p>':'')+'</div>';}
async function refreshStats(manual=false){if(statsStatus==='loading'&&!manual&&liveStats.records?.length)return;statsStatus='loading';statsError='';if(page==='draft')renderRecommendations();try{const r=await fetch('./data/live-stats.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Stats unavailable');const next=await r.json();if(!Array.isArray(next.records))throw Error('Invalid stats');liveStats=next;statsStatus=next.records.length?'ready':'unavailable';}catch(e){statsError=e.message;statsStatus=liveStats.records?.length?'cached':'error';}if(page==='draft'){renderRecommendations();renderAnalysis();}else if(page==='tier'&&tierView==='stats')renderTierRows();if(manual)toast(statsStatus==='ready'?'已载入最新公开快照':'已保留当前可用数据');}
init();
