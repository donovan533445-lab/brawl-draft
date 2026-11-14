import {CLASSES,RARITIES,nameOf,mapName,modeName,rankedModes,suitability,recommendation,matchup,matchupReason,teamScore,tier,steps,applyChoice} from './engine.mjs';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=$('#main'),modal=$('#modal'),body=$('#modal-body');
let B=[],M=[],meta={},page='draft',search='',role='',poolOnly=false,mapSearch='',mapMode='',showDisabled=false,selected=null,dialogOrigin=null;
let storageWorking=true,toastTimer;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{storageWorking=false;toast('浏览器无法保存数据，请导出备份');}};
let pool=read('brawl-pool-v1',{}),draft=read('brawl-draft-v1',{first:'blue',rule:'ranked',map:15000007,history:[]});
let tabMode='Gem Grab';
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
    <div class="workspace-grid"><section class="roster panel"><div class="panel-title"><h2>选择英雄 <span id="roster-count"></span></h2><label class="checkbox-label"><input id="pool-only" type="checkbox" ${poolOnly?'checked':''}> 仅我的英雄池</label></div>${filterBar()}<div id="roster-grid" class="hero-grid draft-grid"></div><div id="selection-bar"></div></section>
    <aside class="draft-aside"><section class="map-panel panel"><div class="panel-title"><h2>战场情报</h2><button data-action="map-detail" data-id="${m.id}">放大 ↗</button></div><div class="map-preview">${mapImage(m)}<div class="map-preview-title">${modeIcon(m.gameMode)}<span><b>${esc(mapName(m))}</b><small>${esc(modeName(m.gameMode.name))}</small></span></div></div><p class="map-note">${modeTip(currentMode())}</p></section><section class="recommend-panel panel" id="recommendations"></section></aside></div>
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
function recommended(){const t=turn()||{team:draft.first,type:'pick'},allies=histories(t.team,'pick'),enemies=histories(t.team==='blue'?'red':'blue','pick');return B.filter(b=>b.released&&!used(b.id)&&(!poolOnly||owned(b.id))).map(b=>({b,score:recommendation(b,currentMode(),allies,enemies)})).sort((a,b)=>b.score-a.score||a.b.id-b.b.id);}
function renderRecommendations(){
  const t=turn(),rows=recommended().slice(0,4);
  $('#recommendations').innerHTML=`<div class="panel-title"><h2>${t?.type==='ban'?'留意这些英雄':'选人参考'}</h2><span class="mini-label">规则评估</span></div>${rows.map(({b,score},i)=>`<button class="recommend-row" data-action="select" data-id="${b.id}" ${!t?'disabled':''}><span class="rec-index">${i+1}</span>${portrait(b)}<span class="rec-copy"><b>${esc(nameOf(b))}</b><small>${esc(CLASSES[b.class.name])} · ${t?.type==='ban'?'模式适配较高':'结合职业、机制与当前阵容'}</small></span><strong>${score}</strong></button>`).join('')||'<p class="quiet-note">没有可用英雄，试试关闭英雄池筛选。</p>'}<p class="evaluation-note">基于模式、职业及部分英雄机制。未使用实时胜率或地形识别。</p>`;
}
function renderAnalysis(){
  const blue=histories('blue','pick'),red=histories('red','pick');
  $('#analysis').innerHTML=`<div class="panel-title"><h2>阵容实验室</h2><button data-action="sources">评分如何计算 ↗</button></div><div class="analysis-grid">${['blue','red'].map(team=>{
    const list=team==='blue'?blue:red,other=team==='blue'?red:blue,s=teamScore(list,other,currentMode());
    return `<div class="team-analysis ${team}"><div class="score-header"><h3>${teamLabel(team)}阵容</h3><b>${s?s.total:'--'}<small> / 100</small></b></div>${s?`<div class="score-metrics"><span>模式适配 <b>${s.fit}</b></span><span>职业互补 <b>${s.variety}</b></span><span>对位压力 <b>${s.counter}</b></span></div><p>${!s.complete?`已选 ${list.length}/3 位，当前为阶段评分。`:'三位英雄已就位。'}${list.length===3&&new Set(list.map(b=>b.class.name)).size<3?'职业重复较多，留意功能覆盖。':list.length===3?'职业覆盖较广，继续结合实际地形与熟练度判断。':''}</p>`:'<p>选取第一位英雄后，这里会显示阵容分析。</p>'}</div>`;
  }).join('')}</div>${blue.length&&red.length?`<div class="matchup-table"><h3>英雄对位</h3><div class="table-scroll"><table><thead><tr><th scope="col">蓝方 / 红方</th>${red.map(b=>`<th scope="col">${esc(nameOf(b))}</th>`).join('')}</tr></thead><tbody>${blue.map(a=>`<tr><th scope="row">${esc(nameOf(a))}</th>${red.map(b=>{const v=matchup(a,b);return `<td class="${v>0?'advantage':v<0?'disadvantage':''}"><button data-action="matchup-reason" data-id="${a.id}" data-enemy="${b.id}" title="${esc(matchupReason(a,b))}">${v>0?'偏有利':v<0?'偏不利':'中性'} <small>${v>0?'+':''}${v}</small> ⓘ</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="evaluation-note">采用职业相性与部分英雄机制规则，点击对位查看条件；不代表实测胜率。</p></div>`:''}`;
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
    <h3>模式适配</h3><div class="mode-scores">${rankedModes.map(m=>`<div><span>${esc(modeName(m))}</span><b>${suitability(b,m)}</b></div>`).join('')}</div>
    <h3>英雄克制参考</h3><p class="evaluation-note">职业相性与部分英雄机制推导，同分按数据顺序展示；点击对位说明查看生效条件。</p><div class="counter-columns"><div><h4>对位偏有利</h4>${favorable.map(x=>`<button class="counter-item" data-action="matchup-reason" data-id="${id}" data-enemy="${x.b.id}">${portrait(x.b)}<span>${esc(nameOf(x.b))}<small>${esc(CLASSES[x.b.class.name])}</small></span><b>+${x.v}</b></button>`).join('')||'<p>无显著职业优势</p>'}</div><div><h4>需要留意</h4>${unfavorable.map(x=>`<button class="counter-item" data-action="matchup-reason" data-id="${id}" data-enemy="${x.b.id}">${portrait(x.b)}<span>${esc(nameOf(x.b))}<small>${esc(CLASSES[x.b.class.name])}</small></span><b>${x.v}</b></button>`).join('')||'<p>无显著职业劣势</p>'}</div></div><a class="source-link" href="${esc(b.link)}" target="_blank" rel="noreferrer">在 Brawlify 查看英雄 ↗</a></div>`);
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
function renderTier(){main.innerHTML=`${pageTitle('找到适合战场的英雄','按所选模式查看职业适配强度，点击英雄了解技能。')}<section class="panel tier-intro"><div><h2>模式适配强度榜</h2><p>这是规则模型榜单。同职业同分，不代表当前版本的实战强弱或胜率。</p></div><label>选择模式<select id="tier-mode">${modeOptions(tabMode)}</select></label></section><div class="tier-legend"><span><b>S</b>85+</span><span><b>A</b>75–84</span><span><b>B</b>65–74</span><span><b>C</b>55–64</span><span><b>D</b>低于55</span><button data-action="sources">查看评估规则 ↗</button></div><div id="tier-rows"></div>`;renderTierRows();}
function renderTierRows(){const list=B.filter(b=>b.released).map(b=>({b,score:suitability(b,tabMode)})).sort((a,b)=>b.score-a.score||a.b.id-b.b.id);$('#tier-rows').innerHTML=['S','A','B','C','D'].map(t=>`<section class="tier-row panel"><h2 class="tier-${t}">${t}</h2><div class="tier-members">${list.filter(x=>tier(x.score)===t).map(({b,score})=>`<button class="tier-member" data-action="detail" data-id="${b.id}" aria-label="${esc(nameOf(b))}，适配分${score}">${portrait(b)}<span>${esc(nameOf(b))}</span><small>${score}</small></button>`).join('')||'<p class="quiet-note">本模式暂无该档英雄</p>'}</div></section>`).join('');}
function renderPool(){const count=Object.values(pool).filter(x=>x.owned).length;main.innerHTML=`${pageTitle('你的英雄，你的主场。','记录已拥有英雄、战力等级与熟练度，让选人更贴近你的习惯。',`<div class="pool-tools"><button class="button subtle" data-action="import-pool">导入</button><button class="button yellow" data-action="export-pool">导出备份</button><input type="file" id="pool-file" accept=".json,application/json" hidden></div>`)}<div class="pool-summary"><div><b>${count}</b><span>已拥有英雄</span></div><div><b>${Object.values(pool).filter(x=>x.owned&&x.level===11).length}</b><span>满级英雄</span></div><div><b>${Object.values(pool).filter(x=>x.owned&&x.mastery>=4).length}</b><span>熟练英雄</span></div><p>${storageWorking?'自动保存在此浏览器。换设备前请导出备份。':'浏览器存储不可用，请导出备份。'}</p></div><section class="panel database-panel">${filterBar()}<div class="pool-list" id="pool-list"></div></section>`;renderPoolList();}
function renderPoolList(){const list=filteredBrawlers().sort((a,b)=>Number(owned(b.id))-Number(owned(a.id))||a.id-b.id);$('#pool-list').innerHTML=list.map(b=>{const p=pool[b.id]||{};return `<article class="pool-row ${p.owned?'is-owned':''}"><button class="pool-avatar" data-action="detail" data-id="${b.id}">${portrait(b)}</button><div class="pool-name"><b>${esc(nameOf(b))}</b><small>${esc(CLASSES[b.class.name])}</small></div><label class="pool-level">战力<select data-pool-field="level" data-id="${b.id}" aria-label="${esc(nameOf(b))}战力等级" ${!p.owned?'disabled':''}>${Array.from({length:11},(_,i)=>`<option value="${i+1}" ${(p.level||1)===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><label class="pool-mastery">熟练度<select data-pool-field="mastery" data-id="${b.id}" aria-label="${esc(nameOf(b))}熟练度" ${!p.owned?'disabled':''}>${['未练习','入门','熟悉','熟练','绝活'].map((x,i)=>`<option value="${i+1}" ${(p.mastery||1)===i+1?'selected':''}>${x}</option>`).join('')}</select></label><button class="button pool-owned-button ${p.owned?'subtle':'yellow'}" data-action="toggle-pool" data-id="${b.id}" aria-pressed="${!!p.owned}">${p.owned?'♥ 已拥有':'+ 加入'}</button></article>`;}).join('')||'<div class="empty-state">没有找到英雄。</div>';}
function sources(){openDialog(`<div class="dialog-heading"><span class="eyebrow">DATA & METHODOLOGY</span><h2>数据与评分说明</h2></div><div class="detail-content prose"><h3>真实资料，明确来源</h3><p>本地快照包含 ${B.length} 位英雄、${M.length} 张地图及其模式。英雄的描述、星徽之力与随身妙具来自 <a href="https://brawlapi.com/" target="_blank" rel="noreferrer">BrawlAPI</a>；图像由 <a href="https://github.com/Brawlify/CDN" target="_blank" rel="noreferrer">Brawlify CDN</a> 提供。快照时间：${esc(new Date(meta.fetchedAt).toLocaleDateString('zh-CN'))}。未开放英雄不参与模拟。</p><p>已启用地图不等于本赛季排位池。数据库保留历史与特殊模式地图。未核实的中文译名及技能原文保留英文。</p><h3>评分是职业规则模型</h3><p>当前未接入对战统计，也没有实时胜率。机制参考 <a href="https://supercell.com/brawlstars/en/blog/game-updates/release-notes-november-2026/" target="_blank" rel="noreferrer">Supercell 更新说明</a> 与 <a href="https://supercell.com/brawlstars/en/blog/release-notes/welcome-to-starr-park/" target="_blank" rel="noreferrer">英雄机制介绍</a>，克制关系为本站推导。模式适配由职业和模式目标的固定权重给出。职业关系覆盖远程压制、刺客切投掷、控制限制坦克等一般情况。另对科莱特、格尔、雪莉、莫提斯、黑鸦加入有条件的机制规则，点击对位可查看解释。启发分由本站设定，并非数据源统计。</p><p>选人参考 = 模式适配 + 对敌方的平均职业压力 + 职业互补（新职业 +5，重复职业 −7），结果限制在 0–100。新英雄沿用其职业权重，不伪造版本强度。</p><p>阵容总分 = 模式适配 × 50% + 职业互补 × 25% + 对位压力 × 25%。职业互补 = 不同职业数 / 已选人数 × 100。对位压力 = 50 + 平均对位启发分 × 2。未选满 3 位时为阶段评分。</p><p>强度榜使用模式适配分：S ≥85，A ≥75，B ≥65，C ≥55，其余 D。同职业同分；顺序不表示英雄排名差距。地形、装备、等级和熟练度尚未纳入评分。</p><h3>BP 与个人英雄池</h3><p>排位记录模式按双方各 3 个禁用录入，并按 1–2–2–1 的队伍轮次选人。蛇形禁用用于练习。可切换先手，支持撤销与导出。本工具为本地单机模拟，不连接游戏账号或其他玩家。</p><p>英雄池与本局 BP 自动保存在当前设备的浏览器中，不跨设备同步。导入英雄池会替换当前备份。英雄池筛选仅决定可见候选，不限制双方实际可选范围。</p><h3>玩家创作声明</h3><p>本内容与 Supercell 无关，亦未获得其认可、赞助或批准。游戏素材及商标属于 Supercell。详见 <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noreferrer">Supercell 玩家内容政策</a>。</p></div>`);}
function help(){openDialog(`<div class="dialog-heading"><span class="eyebrow">READY TO BRAWL?</span><h2>开始你的 BP 练习</h2></div><div class="detail-content prose"><ol><li>选择地图和模式，设置哪一方先选。</li><li>依次为双方录入 3 位禁用英雄。</li><li>点击英雄头像，再点「锁定英雄」。选人按先手、后手、后手、先手、先手、后手进行。</li><li>查看职业对位和阵容分析。用「撤销」回到上一步，用右上角导出保存本局。</li></ol><p>去「我的英雄池」记录你拥有的英雄，回到模拟器后可勾选「仅我的英雄池」。</p><button class="button yellow" data-action="close">准备好了！</button></div>`);}
function download(filename,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function resetWith(change={}){if(draft.history.length){openDialog(`<div class="dialog-heading"><h2>开始一局新的 BP？</h2><p>修改规则或地图会清空当前选择。你也可以先导出本局。</p></div><div class="detail-content dialog-actions"><button class="button subtle" data-action="export-draft">导出本局</button><button class="button yellow" id="confirm-reset">开始新局</button></div>`);$('#confirm-reset').onclick=()=>{draft={...draft,...change,history:[]};selected=null;persist();closeDialog();render();};}else{draft={...draft,...change,history:[]};selected=null;persist();if(modal.open)closeDialog();render();}}
async function importPool(file){if(!file)return;try{if(file.size>500000)throw Error('文件过大');const data=JSON.parse(await file.text());if(data.type!=='brawl-pool'||data.version!==1||!data.heroes||Array.isArray(data.heroes)||typeof data.heroes!=='object')throw Error('文件格式不正确');const next={};for(const [id,v] of Object.entries(data.heroes)){if(!B.some(b=>String(b.id)===id)||!v||typeof v!=='object'||typeof v.owned!=='boolean'||!Number.isInteger(v.level)||v.level<1||v.level>11||!Number.isInteger(v.mastery)||v.mastery<1||v.mastery>5)throw Error('英雄池数据无效');next[id]={owned:v.owned,level:v.level,mastery:v.mastery};}openDialog(`<div class="dialog-heading"><h2>导入英雄池</h2><p>该备份包含 ${Object.values(next).filter(x=>x.owned).length} 位已拥有英雄，将替换当前英雄池。</p></div><div class="detail-content dialog-actions"><button class="button subtle" data-action="close">取消</button><button class="button yellow" id="confirm-import">导入备份</button></div>`);$('#confirm-import').onclick=()=>{pool=next;write('brawl-pool-v1',pool);closeDialog();render();toast('英雄池已导入');};}catch(e){toast('导入失败：'+e.message);}}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const id=Number(el.dataset.id),action=el.dataset.action;
  switch(action){
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
    case 'export-draft':download('brawl-draft.json',{type:'brawl-draft',version:1,exportedAt:new Date().toISOString(),map:{id:currentMap().id,name:currentMap().name,mode:currentMode()},first:draft.first,rule:draft.rule,history:draft.history.map(h=>({...h,name:brawler(h.id)?.name})),scores:{blue:teamScore(histories('blue','pick'),histories('red','pick'),currentMode()),red:teamScore(histories('red','pick'),histories('blue','pick'),currentMode())}});toast('已导出 BP 记录');break;
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
  if(id==='tier-mode'){tabMode=el.value;renderTierRows();}
  if(id==='pool-file'){importPool(el.files[0]);el.value='';}
  if(el.dataset.poolField){const heroId=Number(el.dataset.id);if(owned(heroId)){pool[heroId][el.dataset.poolField]=Number(el.value);write('brawl-pool-v1',pool);const value=el.value;renderPool();const control=$(`[data-pool-field="${el.dataset.poolField}"][data-id="${heroId}"]`);control?.focus();}}
});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src='./assets/icon.png';e.target.classList.add('image-fallback');}},{capture:true});
window.addEventListener('hashchange',()=>{search='';role='';poolOnly=false;selected=null;render();window.scrollTo(0,0);});
async function init(){try{const results=await Promise.all(['brawlers','maps','meta'].map(async k=>{const r=await fetch(`./data/${k}.json`);if(!r.ok)throw Error('数据库载入失败');return r.json();}));B=results[0].list;M=results[1].list;meta=results[2];
  // Validate persisted data before using it in markup or applying selections.
  pool=Object.fromEntries(Object.entries(pool&&typeof pool==='object'?pool:{}).filter(([id,v])=>B.some(b=>String(b.id)===id)&&v&&typeof v.owned==='boolean').map(([id,v])=>[id,{owned:v.owned,level:Number.isInteger(v.level)&&v.level>=1&&v.level<=11?v.level:1,mastery:Number.isInteger(v.mastery)&&v.mastery>=1&&v.mastery<=5?v.mastery:1}]));
  if(!draft||!['blue','red'].includes(draft.first)||!['ranked','snake'].includes(draft.rule))draft={first:'blue',rule:'ranked',map:15000007,history:[]};
  if(!M.some(m=>m.id===draft.map&&rankedModes.includes(m.gameMode.name)))draft.map=M.find(m=>!m.disabled&&m.gameMode.name==='Gem Grab').id;
  let h=[];for(const entry of Array.isArray(draft.history)?draft.history.slice(0,12):[])h=applyChoice(h,entry?.id,B,draft.first,draft.rule);draft.history=h;
  $('#data-date').textContent=`资料快照 ${new Date(meta.fetchedAt).toLocaleDateString('zh-CN')}`;render();
}catch(e){main.innerHTML='<div class="empty-state panel"><h1>竞技场暂时无法载入</h1><p>请检查网络连接后重试。如果从本地打开，请使用启动脚本。</p><button class="button yellow" data-action="retry">重新载入</button></div>';console.error(e);}}
init();
