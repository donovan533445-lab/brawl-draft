import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const B=JSON.parse(await fs.readFile(path.join(root,'dist/data/brawlers.json'),'utf8')).list;
const M=JSON.parse(await fs.readFile(path.join(root,'dist/data/maps.json'),'utf8')).list;
const modes=[...new Map(M.map(m=>[m.gameMode.id,m.gameMode])).values()];
const paths=[...B.map(b=>['brawlers',b.id,`brawlers/borderless/${b.id}.png`]),...modes.map(m=>['modes',m.id,`game-modes/regular/${m.id}.png`]),...M.map(m=>['maps',m.id,`maps/regular/${m.id}.png`])];
const fallback=process.env.ASSET_ORIGIN||'https://testingcf.jsdelivr.net/gh/Brawlify/CDN@master/';
let done=0,failed=[];
async function worker(){while(paths.length){const [type,id,p]=paths.shift(),out=path.join(root,'dist/assets',type,id+'.png');try{await fs.access(out);done++;continue;}catch{}let error;for(let attempt=0;attempt<4;attempt++){try{const r=await fetch(fallback+p,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(r.status);const bytes=Buffer.from(await r.arrayBuffer());if(bytes[0]!==137||bytes[1]!==80)throw Error('Not a PNG');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,bytes);error=null;done++;if(done%100===0)console.log('Downloaded',done);break;}catch(e){error=e.message;await new Promise(r=>setTimeout(r,300+attempt*400));}}if(error)failed.push({type,id,path:p,error});}}
await Promise.all(Array.from({length:6},worker));
await fs.writeFile(path.join(root,'asset-report.json'),JSON.stringify({done,failed},null,2));
console.log('Assets complete:',done,'failed:',failed.length);
