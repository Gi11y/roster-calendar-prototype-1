import './style.css';
import {detectCards,findGrid,dayCell,labelFromText,proposal,type Card,type Grid,type Colour} from './card-data';
import {parseTsv} from './ocr-data';
interface Worker {recognize(image:HTMLCanvasElement,options:object,output:object):Promise<{data:{text:string;tsv:string}}> ;setParameters(options:object):Promise<unknown>;terminate():Promise<unknown>}
interface Engine {createWorker(lang:string,oem:number,options:object):Promise<Worker>}
declare global {interface Window {Tesseract?:Engine}}
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const file=el<HTMLInputElement>('card-file'),detect=el<HTMLButtonElement>('detect-cards'),read=el<HTMLButtonElement>('read-cards'),view=el<HTMLCanvasElement>('card-image'),status=el('card-status'),progress=el<HTMLProgressElement>('card-progress'),list=el('card-results'),header=el<HTMLTextAreaElement>('header-evidence');
const root=new URL(import.meta.env.BASE_URL+'ocr-assets/',location.origin).href;
let source:HTMLCanvasElement|undefined,cards:Card[]=[],grid:Grid|undefined,busy=false,generation=0,worker:Worker|undefined;
interface Result {card:Card;label?:string;confidence?:number;text:string;day?:string;error?:string}
let results:Result[]=[];let script:Promise<Engine>|undefined;
function controls(){file.disabled=busy;detect.disabled=busy||!source;read.disabled=busy||!cards.length;}
function clear(){generation++;void worker?.terminate();worker=undefined;if(source){source.width=1;source.height=1;}source=undefined;cards=[];results=[];grid=undefined;view.width=view.height=1;list.replaceChildren();header.value='';el('card-count').textContent='';el('grid-status').textContent='No grid detected yet.';busy=false;progress.value=0;file.value='';controls();}
el('clear-cards').addEventListener('click',()=>{clear();status.textContent='Image, crops and results cleared.';});window.addEventListener('pagehide',clear);
function engine():Promise<Engine>{if(window.Tesseract)return Promise.resolve(window.Tesseract);return script??=new Promise<Engine>((resolve,reject)=>{const s=document.createElement('script');s.src=root+'tesseract.min.js';s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR API missing'));s.onerror=()=>{script=undefined;reject(Error('Could not load OCR files. Check offline readiness.'));};document.head.append(s);});}
file.addEventListener('change',async()=>{const selected=file.files?.[0];clear();if(!selected)return;const job=generation,url=URL.createObjectURL(selected);try{
 if(selected.size>20_000_000)throw Error('Use a file smaller than 20 MB.');const image=new Image();image.src=url;await image.decode();if(job!==generation)return;
 if(image.naturalWidth*image.naturalHeight>25_000_000)throw Error('Use an image under 25 megapixels.');const scale=Math.min(1,Math.sqrt(3_000_000/(image.naturalWidth*image.naturalHeight)));
 source=document.createElement('canvas');source.width=Math.round(image.naturalWidth*scale);source.height=Math.round(image.naturalHeight*scale);source.getContext('2d')!.drawImage(image,0,0,source.width,source.height);scan();
 }catch(e){status.textContent=String(e);}finally{URL.revokeObjectURL(url);controls();}});
function draw(){if(!source)return;view.width=source.width;view.height=source.height;const ctx=view.getContext('2d')!;ctx.drawImage(source,0,0);
 if(grid){ctx.strokeStyle='#146b9d';ctx.lineWidth=1;for(const x of grid.columns){ctx.beginPath();ctx.moveTo(x,Math.min(...cards.map(c=>c.y))-40);ctx.lineTo(x,Math.max(...cards.map(c=>c.y+c.height))+35);ctx.stroke();}for(const y of grid.rows){ctx.beginPath();ctx.moveTo(grid.columns[0],y);ctx.lineTo(grid.columns[7],y);ctx.stroke();}}
 ctx.strokeStyle='#ee7300';ctx.lineWidth=3;ctx.font='bold 16px system-ui';for(const card of cards){ctx.strokeRect(card.x,card.y,card.width,card.height);ctx.fillStyle='#fff';ctx.fillRect(card.x,card.y,25,20);ctx.fillStyle='#000';ctx.fillText(String(card.id),card.x+3,card.y+16);}}
function scan(){if(!source)return;const pixels=source.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,source.width,source.height);cards=detectCards(pixels.data,source.width,source.height);grid=findGrid(pixels.data,source.width,source.height,cards);results=cards.map(card=>({card,text:''}));draw();render();header.value='';
 el('grid-status').textContent=grid?'Possible seven-column grid found. Check blue lines before trusting column/day evidence.':'Grid borders were not clear enough. Cards can still be inspected; date assignment stays unconfirmed.';
 el('card-count').textContent=cards.length+' green card(s) found. Separate cards on one day remain separate.';
 status.textContent=cards.length?'Cards detected. Check outlines, then read each card.':'No green cards found. Try a clearer or more tightly zoomed screenshot. No shifts were invented.';controls();}
detect.addEventListener('click',scan);
function crop(x:number,y:number,width:number,height:number,mode='original',scale=3):HTMLCanvasElement{
 const c=document.createElement('canvas'),left=Math.max(0,Math.floor(x)),top=Math.max(0,Math.floor(y)),w=Math.max(1,Math.min(source!.width-left,width)),h=Math.max(1,Math.min(source!.height-top,height));c.width=Math.round(w*scale);c.height=Math.round(h*scale);
 const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source!,left,top,w,h,0,0,c.width,c.height);
 if(mode==='threshold'){const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;for(let i=0;i<d.length;i+=4){const v=.299*d[i]+.587*d[i+1]+.114*d[i+2]>=85?255:0;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(pixels,0,0);}return c;
}
function render(){list.replaceChildren();for(const result of results){
 const card=result.card,section=document.createElement('article');section.className='shift-card';const title=document.createElement('h3');title.textContent='Card '+card.id;section.append(title);
 const thumb=crop(card.x-2,card.y-2,card.width+4,card.height+4,'original',2);thumb.className='card-thumb';section.append(thumb);
 const evidence=document.createElement('p');evidence.className='small';const cell=dayCell(card,grid);evidence.textContent='Original RGB '+card.rgb.join(', ')+'; hue '+card.hue+'°. '+(cell?'Grid column '+(cell.column+1)+(result.day?'; day OCR '+result.day+' (unverified)':' ; day unread/unconfirmed'):'Date grid unconfirmed')+'. No month/year assigned.';section.append(evidence);
 const colourLabel=document.createElement('label');colourLabel.textContent='Colour category ';const colour=document.createElement('select');colour.setAttribute('aria-label','Colour for card '+card.id);
 for(const [value,name] of [['uncertain','Uncertain - review'],['light','Lighter green: 12 hours (A/P)'],['dark','Darker green: 8 hours (A/P)']]){const option=document.createElement('option');option.value=value;option.textContent=name;colour.append(option);}colour.value=card.colour;colourLabel.append(colour);section.append(colourLabel);
 const labelLabel=document.createElement('label');labelLabel.textContent='Shift label ';const label=document.createElement('select');label.setAttribute('aria-label','Shift label for card '+card.id);
 for(const value of ['', 'A','P','N','N10']){const option=document.createElement('option');option.value=value;option.textContent=value||'Unread / uncertain';label.append(option);}label.value=result.label||'';labelLabel.append(label);section.append(labelLabel);
 const note=document.createElement('p');if(result.confidence!==undefined)note.textContent='Label OCR confidence: '+result.confidence.toFixed(1)+' (not a guarantee).';section.append(note);
 const proposed=document.createElement('p');proposed.className='proposal';const update=()=>{card.colour=colour.value as Colour;result.label=label.value||undefined;const p=proposal(result.label,card.colour,result.text);proposed.textContent=p.range?p.range.start+' to '+p.range.end+(p.range.nextDay?' (+1 day)':'')+' - '+p.basis+(p.warning?'. '+p.warning:''):p.basis+': '+p.warning;};colour.addEventListener('change',update);label.addEventListener('change',update);update();section.append(proposed);
 const raw=document.createElement('details'),summary=document.createElement('summary');summary.textContent='OCR evidence / errors';raw.append(summary);const text=document.createElement('pre');text.textContent=result.error||result.text||'Not read yet.';raw.append(text);section.append(raw);list.append(section);
 }}
read.addEventListener('click',async()=>{if(busy||!source||!cards.length)return;const job=++generation;busy=true;controls();progress.value=0;let current:Worker|undefined;
 try{const lib=await engine();if(job!==generation)return;current=await lib.createWorker('eng',1,{workerPath:root+'worker.min.js',corePath:root,langPath:root.replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none',gzip:true});if(job!==generation){await current.terminate();return;}worker=current;
 const active=results.slice(0,40);
 for(let index=0;index<active.length;index++){if(job!==generation)return;const result=active[index],c=result.card;status.textContent='Reading card '+(index+1)+' of '+active.length+'...';progress.value=index/active.length;
 try{
 await current.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'APN10',user_defined_dpi:'300'});
 const labelResult=await current.recognize(crop(c.x-2,c.y-2,Math.min(c.width,50),Math.min(22,Math.max(15,c.height*.3))+4),{},{text:true,tsv:true});
 if(job!==generation)return;const labelWords=parseTsv(labelResult.data.tsv||''),score=labelWords.length?Math.max(...labelWords.map(w=>w.confidence)):0;result.confidence=score;result.label=score>=55?labelFromText(labelResult.data.text):undefined;
 await current.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'',preserve_interword_spaces:'1'});
 const full=await current.recognize(crop(c.x-2,c.y-2,c.width+4,c.height+4),{},{text:true,tsv:true});if(job!==generation)return;result.text=full.data.text;
 if(!result.label){const candidate=labelFromText(full.data.text);const words=parseTsv(full.data.tsv||'');if(candidate&&words[0]?.confidence>=65){result.label=candidate;result.confidence=words[0].confidence;}}
 const cell=dayCell(c,grid);if(cell?.top!==undefined){await current.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789'});const day=await current.recognize(crop(grid!.columns[cell.column]+2,cell.top+2,Math.min(35,c.width*.45),Math.max(8,Math.min(21,c.y-cell.top-3))),{},{text:true,tsv:true});if(job!==generation)return;const digits=day.data.text.trim();if(/^(?:[1-9]|[12]\d|3[01])$/.test(digits)&&parseTsv(day.data.tsv||'').some(w=>w.confidence>=60))result.day=digits;}
 }catch(e){result.error=String(e);}render();
 }
 if(grid&&job===generation){await current.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});const top=grid.rows[0]??Math.min(...cards.map(c=>c.y));const heading=await current.recognize(crop(grid.columns[0],Math.max(0,top-100),grid.columns[7]-grid.columns[0],Math.min(95,top)),{},{text:true,tsv:false});if(job===generation)header.value=heading.data.text;}
 if(job===generation){progress.value=1;status.textContent='Finished reading '+active.length+' card(s). Review colour, label, printed times and date evidence. No calendar events created.'+(results.length>40?' Only the first 40 cards were read to limit memory/time.':'');}
 }catch(e){if(job===generation)status.textContent='Card OCR failed: '+String(e);}
 finally{if(current)await current.terminate().catch(()=>{});if(job===generation){worker=undefined;busy=false;controls();}}
});
async function offline(){const label=el('card-offline');if(!('serviceWorker'in navigator)||!import.meta.env.PROD){label.textContent='Offline cache requires the production deployment.';return;}
 try{await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL});await navigator.serviceWorker.ready;const info=await(await fetch(root+'assets.json')).json() as {files:string[]};const cached=await Promise.all(info.files.map(f=>caches.match(root+f)));
 label.textContent=navigator.serviceWorker.controller&&cached.every(Boolean)?'OCR assets cached. Close all app windows and reopen after an update; test this page in airplane mode.':'Offline assets installing. Keep online, then close app windows and reopen.';
 }catch{label.textContent='Offline readiness not confirmed. Reconnect and check again.';}}
el('card-offline-check').addEventListener('click',()=>void offline());navigator.serviceWorker?.addEventListener('controllerchange',()=>void offline());void offline();controls();
