/**
 * Re-publish counted Brawl Atlas statistics; never consume its learned model.
 * Source compilation is MIT (Eli Fried, 2026); notice travels with each snapshot.
 * https://github.com/elixf7/brawlstars-data-pipeline/blob/main/src/bsetl/publish/card.py
 * https://github.com/elixf7/brawlstars-draft-agent/blob/main/LICENSE
 * No key, browser scraping, protected API, or unofficial authentication required.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const DATA_URL='https://brawlstars-atlas.pages.dev/assets/data.json';
const PROJECT=path.resolve(import.meta.dirname,'..');
const MODE_NAMES={bounty:'Bounty',brawlball:'Brawl Ball',gemgrab:'Gem Grab',heist:'Heist',hotzone:'Hot Zone',knockout:'Knockout'};
const DAY_MS=86400000;
const normalize=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const isoDay=value=>{
  if(/^\d{8}$/.test(String(value)))return `${String(value).slice(0,4)}-${String(value).slice(4,6)}-${String(value).slice(6,8)}`;
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value);
  throw Error('Invalid upstream day: '+value);
};
const timeOf=day=>Date.parse(day+'T00:00:00.000Z');
const dateOnly=time=>new Date(time).toISOString().slice(0,10);

const LICENSE_TEXT=`MIT License

Copyright (c) 2026 Eli Fried

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This project is not affiliated with, endorsed, sponsored, or specifically
approved by Supercell. Game data is derived from the public Brawl Stars API
and is fan content under https://supercell.com/en/fan-content-policy/`;

/** Count raw [appearances,wins] cells, preserving the publisher's date precision. */
export function buildSnapshot(payload,brawlers,maps,options={}){
  const fetchedAt=options.fetchedAt||new Date().toISOString();
  const patchCutoff=isoDay(options.patchCutoff||'2026-11-11');
  const windowDays=options.windowDays===undefined?7:Number(options.windowDays);
  if(!Number.isInteger(windowDays)||windowDays<1||windowDays>31)throw Error('windowDays must be 1–31');
  const season=payload?.season,characters=payload?.characters,daysRaw=payload?.ratings?.days;
  if(!season||!Array.isArray(characters)||!characters.length||!Array.isArray(daysRaw)||!daysRaw.length||!Array.isArray(season.maps)||!season.maps.length)throw Error('Unsupported Atlas counted-statistics schema');
  if(!Number.isFinite(Date.parse(payload.generated_utc)))throw Error('Missing source generation timestamp');
  const days=daysRaw.map(isoDay);
  if(new Set(days).size!==days.length||days.some((d,i)=>i&&d<=days[i-1]))throw Error('Upstream days are not unique and increasing');
  const lastDay=days.at(-1),patchApplied=lastDay>=patchCutoff;
  const windowStart=dateOnly(Math.max(timeOf(lastDay)-(windowDays-1)*DAY_MS,patchApplied?timeOf(patchCutoff):-Infinity));
  const selectedDays=days.map((d,i)=>({day:d,index:i})).filter(x=>x.day>=windowStart);
  const rankMin=Number(season.rank_min),rankMax=Number(season.rank_max),rankCount=rankMax-rankMin+1;
  if(!Number.isInteger(rankMin)||!Number.isInteger(rankMax)||rankCount<1||rankCount>100)throw Error('Invalid upstream rank axis');
  const minRank=options.minRank===undefined?rankMin:Math.max(rankMin,Number(options.minRank));
  const maxRank=options.maxRank===undefined?rankMax:Math.min(rankMax,Number(options.maxRank));
  if(!Number.isInteger(minRank)||!Number.isInteger(maxRank)||minRank>maxRank)throw Error('Rank filters do not intersect upstream ranks');
  const roster=new Map(brawlers.map(b=>[normalize(b.name),b]));
  const mapLookup=new Map();
  // Duplicate names can exist in other game modes; prefer the enabled same-mode map.
  for(const m of [...maps].sort((a,b)=>Number(a.disabled)-Number(b.disabled)||a.id-b.id)){
    const key=normalize(m.name)+'|'+normalize(m.gameMode?.name);
    if(!mapLookup.has(key))mapLookup.set(key,m);
  }
  const totals=new Map(),counts=new Map(),unknownBrawlers=[],unknownMaps=[],seen=new Set();
  const add=(id,mapId,mode,n,w)=>{
    const scope=JSON.stringify([mapId,mode]),key=JSON.stringify([id,mapId,mode]);
    const cell=counts.get(key)||{brawlerId:id,mapId,mode,battles:0,wins:0};
    cell.battles+=n;cell.wins+=w;counts.set(key,cell);totals.set(scope,(totals.get(scope)||0)+n);
  };
  for(const c of characters){
    const b=roster.get(normalize(c.name));if(!b){unknownBrawlers.push(c.name);continue;}
    if(seen.has(b.id))throw Error('Duplicated upstream brawler: '+c.name);seen.add(b.id);
    const grid=c.daily_rank_grid;
    if(!Array.isArray(grid)||grid.length!==days.length*season.maps.length*rankCount*2)throw Error('Daily count grid dimension mismatch: '+c.name);
    for(let mi=0;mi<season.maps.length;mi++){
      const name=season.maps[mi],rawMode=String(season.map_modes?.[name]||'').toLowerCase();
      const mode=MODE_NAMES[rawMode];if(!mode)throw Error('Unsupported ranked mode: '+rawMode);
      const m=mapLookup.get(normalize(name)+'|'+normalize(mode));
      if(!m&&!unknownMaps.includes(name))unknownMaps.push(name);
      let n=0,w=0;
      for(const day of selectedDays)for(let rank=minRank;rank<=maxRank;rank++){
        const at=((day.index*season.maps.length+mi)*rankCount+rank-rankMin)*2;
        const count=grid[at],wins=grid[at+1];
        if(!Number.isSafeInteger(count)||!Number.isSafeInteger(wins)||count<0||wins<0||wins>count)throw Error('Invalid measured count for '+c.name);
        n+=count;w+=wins;
      }
      if(n===0)continue;
      add(b.id,null,null,n,w);add(b.id,null,mode,n,w);
      if(m)add(b.id,m.id,mode,n,w);
    }
  }
  if(!counts.size)throw Error('No measured statistics in the chosen date/rank window');
  const records=[...counts.values()].map(c=>({brawlerId:c.brawlerId,mapId:c.mapId,mode:c.mode,winRate:c.wins/c.battles,battles:c.battles,wins:c.wins,pickRate:c.battles/totals.get(JSON.stringify([c.mapId,c.mode]))}));
  records.sort((a,b)=>(a.mapId||0)-(b.mapId||0)||String(a.mode).localeCompare(String(b.mode))||a.brawlerId-b.brawlerId);
  const rankedSets=Array.isArray(season.daily)?season.daily.filter(x=>isoDay(x.day)>=windowStart&&isoDay(x.day)<=lastDay).reduce((n,x)=>n+Number(x.games||0),0):null;
  return {
    version:1,fetchedAt,
    source:{
      name:'Brawl Atlas · EliF77/brawlstars-ranked',url:'https://brawlstars-atlas.pages.dev/',dataUrl:DATA_URL,
      datasetUrl:'https://huggingface.co/datasets/EliF77/brawlstars-ranked',revision:season.dataset,season:season.season,
      updatedAt:lastDay,updatedAtPrecision:'day',generatedAt:payload.generated_utc,
      window:{from:windowStart,to:lastDay,timeZone:'UTC',precision:'day',requestedPatchCutoff:patchCutoff,patchCutoffApplied:patchApplied},
      population:'ranked',populationDetail:`Publisher ranked sample, upstream Elo ${minRank}–${maxRank}; active/higher-ranked players overrepresented`,
      refreshCadence:'weekly publisher export; raw dataset normally twice weekly, daily early in a new season',
      unit:'brawler appearances in publisher ranked-set rows',pickRateDenominator:'all catalogue-mapped brawler appearances in the same date/rank/map/mode slice',
      outcomeHandling:'Measured upstream binary win counts are reused. No synthetic wins, Bayesian adjustment, or model score is added.',
      sampledRankedSets:minRank===rankMin&&maxRank===rankMax?rankedSets:null,
      sampledAppearances:totals.get('[null,null]')||0,
      stale:timeOf(dateOnly(Date.parse(fetchedAt)))-timeOf(lastDay)>3*DAY_MS,
      prePatch:!patchApplied,
      license:'MIT',licenseUrl:'https://github.com/elixf7/brawlstars-draft-agent/blob/main/LICENSE',
      datasetLicenseUrl:'https://github.com/elixf7/brawlstars-data-pipeline/blob/main/src/bsetl/publish/card.py',licenseText:LICENSE_TEXT,
      limitations:['Sampled community data, not all global battles.','No draft order or bans in the dataset.','Public Atlas export has no counted head-to-head or teammate outcomes. Model embeddings are deliberately ignored.','Day-level resolution cannot isolate the exact hour of a balance maintenance.'],
      unknownBrawlers,unknownMaps
    },
    capabilities:{winRates:true,mapWinRates:true,modeWinRates:true,counters:false,synergies:false,draftOrder:false,liveStreaming:false},
    records,counters:[],synergies:[]
  };
}

async function fetchText(url,maxBytes=24*1024*1024){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(90000),headers:{Accept:'application/json'}});
      if(!response.ok)throw Error(`Statistics source returned HTTP ${response.status}`);
      if(Number(response.headers.get('content-length')||0)>maxBytes)throw Error('Statistics export exceeds download limit');
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw Error('Statistics export exceeds download limit');}chunks.push(value);}
      return Buffer.concat(chunks).toString('utf8');
    }catch(e){lastError=e;if(attempt<2)await new Promise(r=>setTimeout(r,(attempt+1)*1000));}
  }
  throw lastError;
}

async function main(){
  const args=process.argv.slice(2),get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
  const input=get('--input',null),output=path.resolve(get('--output',path.join(PROJECT,'dist/data/live-stats.json')));
  const raw=input?await fs.readFile(path.resolve(input),'utf8'):await fetchText(DATA_URL);
  const [brawlers,maps]=await Promise.all(['brawlers','maps'].map(async k=>JSON.parse(await fs.readFile(path.join(PROJECT,'dist/data',k+'.json'),'utf8')).list));
  const snapshot=buildSnapshot(JSON.parse(raw),brawlers,maps,{patchCutoff:get('--patch-cutoff','2026-11-11'),windowDays:Number(get('--days','7')),minRank:get('--min-rank',undefined),maxRank:get('--max-rank',undefined)});
  snapshot.source.sha256=createHash('sha256').update(raw).digest('hex');
  await fs.mkdir(path.dirname(output),{recursive:true});
  const temporary=output+'.tmp';await fs.writeFile(temporary,JSON.stringify(snapshot));await fs.rename(temporary,output);
  console.log(JSON.stringify({output,records:snapshot.records.length,sourceUpdatedAt:snapshot.source.updatedAt,window:snapshot.source.window,sampledAppearances:snapshot.source.sampledAppearances,counters:0,synergies:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('Stats refresh failed; prior snapshot preserved:',e.message);process.exitCode=1;});
