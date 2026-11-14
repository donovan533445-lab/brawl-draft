export const CLASSES={'Damage Dealer':'输出','Tank':'坦克','Marksman':'射手','Assassin':'刺客','Controller':'控制','Artillery':'投掷','Support':'辅助'};
export const MODE_NAMES={'Gem Grab':'宝石争霸','Brawl Ball':'乱斗足球','Bounty':'赏金猎人','Heist':'金库攻防','Hot Zone':'热区争夺','Knockout':'乱斗淘汰赛','Solo Showdown':'单人荒野决斗','Duo Showdown':'双人荒野决斗','Wipeout':'乱斗歼灭战','Duels':'决斗','Brawl Ball 5v5':'5v5 乱斗足球','Gem Grab 5v5':'5v5 宝石争霸','Knockout 5v5':'5v5 淘汰赛','Wipeout 5v5':'5v5 歼灭战','Brawl Arena':'乱斗竞技场','Basket Brawl':'篮球争霸','Volley Brawl':'排球争霸','Big Game':'天选之战','Robo Rumble':'机甲入侵','Boss Fight':'机甲攻坚战'};
export const RARITIES={'Common':'初始','Rare':'稀有','Super Rare':'超稀有','Epic':'史诗','Mythic':'神话','Legendary':'传奇','Ultra Legendary':'极限传奇'};
export const NAMES={'Shelly':'雪莉','Colt':'柯尔特','Bull':'公牛','Brock':'布洛克','Rico':'瑞科','Spike':'斯派克','Barley':'巴利','Jessie':'杰西','Nita':'妮塔','Dynamike':'爆破麦克','El Primo':'普里莫','Mortis':'莫提斯','Crow':'黑鸦','Poco':'波克','Bo':'阿渤','Piper':'佩佩','Pam':'帕姆','Tara':'塔拉','Darryl':'达里尔','Penny':'潘妮','Frank':'弗兰肯','Gene':'吉恩','Tick':'迪克','Leon':'里昂','Rosa':'罗莎','Carl':'卡尔','Bibi':'比比','8-Bit':'8比特','Sandy':'沙迪','Bea':'贝亚','Emz':'艾魅','Mr. P':'P先生','Max':'麦克斯','Jacky':'雅琪','Gale':'格尔','Nani':'纳妮','Sprout':'芽芽','Surge':'瑟奇','Colette':'科莱特','Amber':'琥珀','Lou':'小罗','Byron':'拜伦','Edgar':'艾德加','Ruffs':'拉夫','Stu':'斯图','Belle':'贝尔','Squeak':'史魁克','Grom':'格罗姆','Buzz':'巴兹','Griff':'格里夫','Ash':'阿什','Meg':'梅格','Lola':'萝拉','Fang':'阿方','Eve':'伊芙','Janet':'珍妮特','Bonnie':'邦妮','Otis':'奥蒂斯','Sam':'山姆','Gus':'格斯','Buster':'巴斯特','Chester':'切斯特','Gray':'格雷','Mandy':'曼迪','R-T':'阿尔缇','Willow':'薇洛','Maisie':'麦茜','Hank':'汉克','Cordelius':'科迪琉斯','Doug':'道格','Pearl':'珀尔','Chuck':'查克','Charlie':'查莉','Mico':'米科','Kit':'凯特','Larry & Lawrie':'拉里和劳里','Melodie':'梅洛迪','Angelo':'安吉洛','Draco':'德拉科','Lily':'莉莉','Berry':'拜瑞','Clancy':'克兰西','Moe':'萌','Kenji':'健次','Shade':'谢德','Juju':'朱朱','Buzz Lightyear':'巴斯光年','Meeple':'米宝','Ollie':'奥利','Lumi':'露米','Finx':'芬克斯','Jae-Yong':'载勇','Kaze':'风姬','Alli':'艾莉','Trunk':'特朗克','Mina':'米娜','Ziggy':'吉吉'};
export const MAP_NAMES={'Shooting Star':'流星','Hard Rock Mine':'坚石矿井','Crystal Arcade':'水晶街机厅','Deathcap Trap':'毒菌陷阱','Gem Fort':'宝石要塞','Undermine':'地下矿洞','Kaboom Canyon':'轰隆峡谷','Safe Zone':'安全区域','Hideout':'隐匿之地','Backyard Bowl':'后院球场','Triple Dribble':'三重威胁','Pinhole Punt':'精准射门','Sneaky Fields':'绿茵潜伏','Super Beach':'超级海滩','Hot Potato':'烫手山芋','Bridge Too Far':'遥远的桥','Layer Cake':'夹心蛋糕','Dry Season':'干旱季节','Double Swoosh':'双重惊喜','Pinball Dreams':'弹珠梦想','Center Stage':'舞台中央','Pit Stop':'维修站','Beach Ball':'沙滩足球','Open Business':'开放营业','Dueling Beetles':'甲虫决斗','Ring of Fire':'火焰之环','Parallel Plays':'平行游戏','Split':'分流','Belle\'s Rock':'贝尔之岩','Goldarm Gulch':'金臂峡谷','Out in the Open':'空旷原野','Flaring Phoenix':'烈焰凤凰','New Horizons':'全新视野'};
export const nameOf=b=>NAMES[b?.name]||b?.name||'';
export const mapName=m=>MAP_NAMES[m?.name]||m?.name||'';
export const modeName=m=>MODE_NAMES[m]||m;
export const rankedModes=['Gem Grab','Brawl Ball','Bounty','Heist','Hot Zone','Knockout'];
const WEIGHTS={
 'Gem Grab':{'Damage Dealer':76,Tank:62,Marksman:72,Assassin:64,Controller:86,Artillery:72,Support:82},
 'Brawl Ball':{'Damage Dealer':82,Tank:86,Marksman:58,Assassin:77,Controller:79,Artillery:65,Support:78},
 Bounty:{'Damage Dealer':65,Tank:48,Marksman:89,Assassin:69,Controller:73,Artillery:80,Support:80},
 Heist:{'Damage Dealer':88,Tank:68,Marksman:72,Assassin:67,Controller:61,Artillery:76,Support:51},
 'Hot Zone':{'Damage Dealer':78,Tank:78,Marksman:56,Assassin:56,Controller:90,Artillery:84,Support:78},
 Knockout:{'Damage Dealer':69,Tank:49,Marksman:90,Assassin:69,Controller:73,Artillery:80,Support:78}
};
// Role-level heuristics, not measured matchup win rates. Positive means row pressures column.
export const MATCHUPS={
 'Damage Dealer':{Tank:13,Assassin:5,Support:2},
 Tank:{Controller:-12,Marksman:-7,Artillery:4,Support:5},
 Marksman:{Tank:7,Support:8,Controller:4,Assassin:-12,Artillery:-5},
 Assassin:{Artillery:16,Marksman:12,Support:10,Tank:-9,Controller:-4},
 Controller:{Tank:12,Assassin:4,Support:3,Artillery:-7},
 Artillery:{Controller:7,Marksman:5,Assassin:-16,Tank:-4},
 Support:{Assassin:-10,Marksman:-8}
};
// Mechanism-based exceptions are conditional tactical assumptions, never live statistics.
export const MECHANICS=[
 {name:'Colette',targets:['Tank'],value:18,reason:'科莱特的生命值相关伤害对高血量目标更有价值，仍需命中与队友补伤。'},
 {name:'Gale',targets:['Assassin'],value:16,reason:'格尔保留击退与控制时，可以限制近身突进；技能空档期风险更高。'},
 {name:'Shelly',targets:['Tank','Assassin'],value:15,reason:'雪莉在近距离且有超级技能时能以爆发和击退反制突进，远距离不成立。'},
 {name:'Mortis',targets:['Artillery'],value:18,reason:'莫提斯能利用位移贴近投掷英雄，但需要绕开控制、妙具和敌方保护。'},
 {name:'Crow',targets:['Support'],value:10,reason:'黑鸦持续施加中毒与治疗压制时，可削弱依赖恢复的阵容；不适用于所有辅助。'}
];
function mechanism(a,b){return MECHANICS.find(m=>m.name===a?.name&&m.targets.includes(b?.class?.name));}
export function matchupReason(a,b){const ab=mechanism(a,b),ba=mechanism(b,a);return ab?.reason||ba?.reason||`${CLASSES[a?.class?.name]}对${CLASSES[b?.class?.name]}的职业相性推导，需结合地形与技能。`;}
export function matchup(a,b){
  const aRule=mechanism(a,b),bRule=mechanism(b,a);
  if(aRule||bRule)return ((aRule?.value||0)-(bRule?.value||0));
  const ac=a?.class?.name,bc=b?.class?.name;
  const ab=MATCHUPS[ac]?.[bc],ba=MATCHUPS[bc]?.[ac];
  if(ab!==undefined&&ba!==undefined)return (ab-ba)/2;
  return ab??(ba!==undefined?-ba:0);
}
export function suitability(b,mode='Gem Grab') {return WEIGHTS[mode]?.[b.class.name]??70;}
export function recommendation(b,mode,allies=[],enemies=[]) {
  const base=suitability(b,mode);
  const counter=enemies.length?enemies.reduce((s,e)=>s+matchup(b,e),0)/enemies.length:0;
  const diversity=allies.length?(allies.some(a=>a.class.name===b.class.name)?-7:5):0;
  return Math.max(0,Math.min(100,Math.round(base+counter+diversity)));
}
export function tier(score){return score>=85?'S':score>=75?'A':score>=65?'B':score>=55?'C':'D';}
export function teamScore(team,enemies,mode){
  if(!team.length)return null;
  const fit=Math.round(team.reduce((s,b)=>s+suitability(b,mode),0)/team.length);
  const variety=Math.round(new Set(team.map(x=>x.class.name)).size/team.length*100);
  const counter=Math.round(50+(enemies.length?team.reduce((s,b)=>s+enemies.reduce((t,e)=>t+matchup(b,e),0)/enemies.length,0)/team.length*2:0));
  return {total:Math.round(fit*.5+variety*.25+counter*.25),fit,variety,counter,complete:team.length===3};
}
export function steps(first='blue',rule='ranked'){
  const other=first==='blue'?'red':'blue';
  const bans=rule==='snake'?[first,other,other,first,first,other]:[first,first,first,other,other,other];
  return [...bans.map(team=>({type:'ban',team})),...[first,other,other,first,first,other].map(team=>({type:'pick',team}))];
}
export function applyChoice(history,id,brawlers,first='blue',rule='ranked'){
  if(history.length>=12||history.some(h=>h.id===id))return history;
  if(!brawlers.some(b=>b.id===id&&b.released))return history;
  return [...history,{...steps(first,rule)[history.length],id}];
}
