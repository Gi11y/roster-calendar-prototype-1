import './style.css';
import {makeCrop,parseTsv,sourceBox,type Crop,type Word} from './ocr-data';
interface Worker {recognize(image:HTMLCanvasElement,options:object,output:object):Promise<{data:{text:string;tsv:string}}> ;setParameters(options:object):Promise<unknown>;terminate():Promise<unknown>}
interface Engine {createWorker(lang:string,oem:number,options:object):Promise<Worker>}
declare global {interface Window {Tesseract?:Engine}}
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=el<HTMLInputElement>('image-file'),run=el<HTMLButtonElement>('run'),preview=el<HTMLButtonElement>('preview'),clear=el<HTMLButtonElement>('clear');
const canvas=el<HTMLCanvasElement>('ocr-canvas'),status=el('ocr-status'),progress=el<HTMLProgressElement>('ocr-progress');
const text=el<HTMLTextAreaElement>('ocr-text'),rows=el('words'),summary=el('summary'),confidence=el<HTMLInputElement>('confidence');
const assetRoot=new URL(import.meta.env.BASE_URL+'ocr-assets/',location.origin).href;
let image:HTMLImageElement|undefined,work:HTMLCanvasElement|undefined,crop:Crop|undefined,words:Word[]=[],selected=-1,worker:Worker|undefined,busy=false,generation=0;
let script:Promise<Engine>|undefined;
function engine():Promise<Engine>{
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 return script??=(new Promise<Engine>((resolve,reject)=>{const s=document.createElement('script');s.src=assetRoot+'tesseract.min.js';s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR library unavailable'));s.onerror=()=>reject(Error('OCR files could not load. Check offline readiness.'));document.head.append(s);})).catch(e=>{script=undefined;throw e;});
}
function controls(){run.disabled=busy||!image;preview.disabled=busy||!image;input.disabled=busy;for(const id of ['crop-left','crop-top','crop-right','crop-bottom','preprocess','psm','threshold'])el<HTMLInputElement>(id).disabled=busy;}
function reset(){generation++;void worker?.terminate();worker=undefined;image=undefined;words=[];crop=undefined;if(work){work.width=1;work.height=1;}work=undefined;canvas.width=1;canvas.height=1;rows.replaceChildren();text.value='';summary.textContent='No results yet.';progress.value=0;input.value='';busy=false;controls();}
clear.addEventListener('click',()=>{reset();status.textContent='Image and results cleared from this page.';});
window.addEventListener('pagehide',reset);
input.addEventListener('change',async()=>{
 const file=input.files?.[0];reset();if(!file)return;
 const job=generation,url=URL.createObjectURL(file);
 try{
 if(file.size>20_000_000)throw Error('Choose an image smaller than 20 MB.');
 const img=new Image();img.src=url;await img.decode();
 if(job!==generation)return;
 if(img.naturalWidth*img.naturalHeight>25_000_000)throw Error('Choose an image smaller than 25 megapixels.');
 image=img;prepare();status.textContent='Preview ready. Adjust the crop if needed, then run OCR.';
 }catch(e){status.textContent=String(e);}finally{URL.revokeObjectURL(url);controls();}
});
function prepare(){
 if(!image)throw Error('Choose an image first.');
 crop=makeCrop(image.naturalWidth,image.naturalHeight,['crop-left','crop-top','crop-right','crop-bottom'].map(id=>Number(el<HTMLInputElement>(id).value)));
 work=document.createElement('canvas');work.width=Math.max(1,Math.round(crop.width*crop.scale));work.height=Math.max(1,Math.round(crop.height*crop.scale));
 const ctx=work.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,work.width,work.height);
 const mode=el<HTMLSelectElement>('preprocess').value;
 if(mode!=='original'){
 const pixels=ctx.getImageData(0,0,work.width,work.height),d=pixels.data;
 for(let i=0;i<d.length;i+=4){let gray=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);if(mode==='threshold')gray=gray>=Math.min(220,Math.max(30,Number(el<HTMLInputElement>('threshold').value)||85))?255:0;d[i]=d[i+1]=d[i+2]=gray;}
 ctx.putImageData(pixels,0,0);
 }
 words=[];text.value='';rows.replaceChildren();summary.textContent='Crop preview. No OCR results yet.';draw();return work;
}
function draw(){
 if(!work)return;canvas.width=work.width;canvas.height=work.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(work,0,0);
 words.forEach((word,index)=>{if(word.confidence<Number(confidence.value))return;const b=word.bbox;ctx.strokeStyle=index===selected?'#0066ff':word.confidence<60?'#b00020':'#007c3d';ctx.lineWidth=index===selected?5:2;ctx.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);});
}
function render(){
 rows.replaceChildren();const fragment=document.createDocumentFragment();
 words.forEach((word,index)=>{
 if(word.confidence<Number(confidence.value))return;
 const row=document.createElement('tr'),cell=document.createElement('td'),button=document.createElement('button');button.className='word-button';button.textContent=word.text;button.addEventListener('click',()=>{selected=index;draw();});cell.append(button);row.append(cell);
 const score=document.createElement('td');score.textContent=word.confidence.toFixed(1);row.append(score);
 const box=document.createElement('td');box.textContent=Object.values(sourceBox(word.bbox,crop!)).join(', ');row.append(box);fragment.append(row);
 });rows.append(fragment);draw();
}
confidence.addEventListener('input',render);
preview.addEventListener('click',()=>{try{prepare();status.textContent='Crop preview updated.';}catch(e){status.textContent=String(e);}});
run.addEventListener('click',async()=>{
 if(busy||!image)return;const job=++generation;busy=true;controls();progress.value=0;status.textContent='Loading the on-device OCR engine...';
 let current:Worker|undefined;
 try{
 const prepared=prepare(),library=await engine();if(job!==generation)return;
 current=await library.createWorker('eng',1,{workerPath:assetRoot+'worker.min.js',corePath:assetRoot,langPath:assetRoot.replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none',gzip:true,logger:(message:{status?:string;progress?:number})=>{if(job===generation){status.textContent=message.status||'Working...';progress.value=message.progress||0;}}});
 if(job!==generation){await current.terminate();return;}worker=current;
 await current.setParameters({tessedit_pageseg_mode:el<HTMLSelectElement>('psm').value,preserve_interword_spaces:'1',user_defined_dpi:'300'});
 const result=await current.recognize(prepared,{}, {text:true,tsv:true});if(job!==generation)return;
 words=parseTsv(result.data.tsv||'');text.value=result.data.text||'';selected=-1;render();progress.value=1;
 summary.textContent=`${words.length} words recognised. Confidence filter: ${confidence.value}+. Original image ${image.naturalWidth} x ${image.naturalHeight}; processed crop ${prepared.width} x ${prepared.height}.`;
 status.textContent=words.length?'OCR finished. Check the words and boxes against the screenshot; this is not a shift import.':'No words recognised. Try a tighter crop, another preparation setting, or a higher-resolution screenshot.';
 }catch(e){if(job===generation)status.textContent=`OCR failed: ${e instanceof Error?e.message:String(e)}. Check offline readiness or try a smaller crop.`;}
 finally{if(current)await current.terminate().catch(()=>{});if(job===generation){worker=undefined;busy=false;controls();}}
});
async function offline(){
 const label=el('offline');
 if(!('serviceWorker'in navigator)||!import.meta.env.PROD){label.textContent='Offline caching is available in the deployed production app.';return;}
 try{
 await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL});await navigator.serviceWorker.ready;
 const controller=navigator.serviceWorker.controller;if(!controller){label.textContent='OCR files are installing. Keep this page open, then close all app windows and reopen before testing offline.';return;}
 const expected=await (await fetch(import.meta.env.BASE_URL+'build-info.json')).json() as {version:string};
 const version=await new Promise<string|undefined>(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(undefined),2500);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);channel.port1.close();};controller.postMessage({type:'GET_VERSION'},[channel.port2]);});
 const manifest=await(await fetch(assetRoot+'assets.json')).json() as {files:string[]};
 const cached=await Promise.all(manifest.files.map(f=>caches.match(assetRoot+f)));
 label.textContent=version===expected.version&&cached.every(Boolean)?'Offline OCR files are ready. Test by relaunching this app in airplane mode.':'An update is installing. Close all app windows and reopen, then check again. Do not clear website data.';
 }catch{label.textContent='Offline files are not confirmed ready. Connect to the internet, reopen the app, and check again.';}
}
el('offline-check').addEventListener('click',()=>void offline());navigator.serviceWorker?.addEventListener('controllerchange',()=>void offline());void offline();controls();
