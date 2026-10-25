import './style.css';
import {detectCards,findGrid,dayCell,labelFromText,proposal,type Card,type Grid,type Colour} from './card-data';
import {parseTsv} from './ocr-data';
import {inferDateAnchor,weekdayBand} from './auto-dates';
import {associateDates,validDate,validClock,reviewTiming,sortReview,type DateAnchor,type AssignedDate} from './date-review';
import {shiftTextOnly,planTimeBand} from './card-content';
import {isolateLabel,chooseLabel,pGlyphEvidence,pGlyphCheck,type LabelReading} from './label-data';
interface Worker {recognize(image:HTMLCanvasElement,options:object,output:object):Promise<{data:{text:string;tsv:string}}> ;setParameters(options:object):Promise<unknown>;terminate():Promise<unknown>}
interface Engine {createWorker(lang:string,oem:number,options:object):Promise<Worker>}
declare global {interface Window {Tesseract?:Engine}}
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const file=el<HTMLInputElement>('card-file'),detect=el<HTMLButtonElement>('detect-cards'),read=el<HTMLButtonElement>('read-cards'),view=el<HTMLCanvasElement>('card-image'),status=el('card-status'),progress=el<HTMLProgressElement>('card-progress'),list=el('card-results'),header=el<HTMLTextAreaElement>('header-evidence');
const anchorSelect=el<HTMLSelectElement>('anchor-card'),anchorDate=el<HTMLInputElement>('anchor-date'),weekOrder=el<HTMLInputElement>('week-order'),applyAnchor=el<HTMLButtonElement>('apply-anchor');
let dateAnchor:DateAnchor|undefined;
let anchorSource:'auto'|'manual'|undefined;let dateExplanation='Read the cards to detect dates automatically.';
const retryDates=el<HTMLButtonElement>('detect-dates'),anchorControls=el<HTMLDetailsElement>('anchor-controls');
const root=new URL(import.meta.env.BASE_URL+'ocr-assets/',location.origin).href;
let source:HTMLCanvasElement|undefined,cards:Card[]=[],grid:Grid|undefined,busy=false,generation=0,worker:Worker|undefined;
interface Result {card:Card;label?:string;confidence?:number;text:string;day?:string;error?:string;labelPreview?:HTMLCanvasElement;labelNote?:string;timeText?:string;timeReason?:string;manualDate?:string;manualStart?:string;manualEnd?:string;manualNextDay?:boolean;reviewed?:boolean}
let results:Result[]=[];let script:Promise<Engine>|undefined;
function controls(){retryDates.disabled=busy||!results.length||!header.value.trim();anchorSelect.disabled=busy;anchorDate.disabled=busy;weekOrder.disabled=busy;applyAnchor.disabled=busy||!results.length||!validDate(anchorDate.value);file.disabled=busy;detect.disabled=busy||!source;read.disabled=busy||!cards.length;}
function clear(){anchorSource=undefined;dateExplanation='Read the cards to detect dates automatically.';el('auto-date-status').textContent=dateExplanation;anchorControls.open=false;dateAnchor=undefined;anchorDate.value='';weekOrder.checked=false;anchorSelect.replaceChildren();el('date-results').replaceChildren();el('review-count').textContent='';el('date-anchor-status').textContent='No date anchor confirmed.';generation++;void worker?.terminate();worker=undefined;if(source){source.width=1;source.height=1;}source=undefined;cards=[];results=[];grid=undefined;view.width=view.height=1;list.replaceChildren();header.value='';el('card-count').textContent='';el('grid-status').textContent='No grid detected yet.';busy=false;progress.value=0;file.value='';controls();}
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

function labelFrames(card:Card):{normal:HTMLCanvasElement;binary:HTMLCanvasElement;multiple:boolean;shape?:LabelReading;diagnostic:string;bottom:number}|undefined{
 const unit=Math.max(.65,Math.min(3,card.width/90));
 const region=crop(card.x+2*unit,card.y+2*unit,Math.min(45*unit,card.width-4*unit),Math.min(24*unit,Math.max(20*unit,card.height*.35)),'original',1),ctx=region.getContext('2d',{willReadFrequently:true})!,pixels=ctx.getImageData(0,0,region.width,region.height);
 const isolated=isolateLabel(pixels.data,region.width,region.height,card.rgb);if(!isolated)return;
 const b=isolated.bounds,bg=.299*card.rgb[0]+.587*card.rgb[1]+.114*card.rgb[2];
 function frame(binary:boolean){const raw=document.createElement('canvas');raw.width=b.width;raw.height=b.height;const small=raw.getContext('2d')!,out=small.createImageData(b.width,b.height);
 for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){const src=((b.y+y)*region.width+b.x+x)*4,dst=(y*b.width+x)*4;const lum=.299*pixels.data[src]+.587*pixels.data[src+1]+.114*pixels.data[src+2];const v=binary?(isolated!.lightInk?(lum>Math.min(245,bg+45)?0:255):(lum<bg*.74?0:255)):Math.max(0,Math.min(255,Math.round(isolated!.lightInk?255-(lum-bg)/(255-bg)*255:(lum-bg*.1)/(bg*.9)*255)));out.data[dst]=out.data[dst+1]=out.data[dst+2]=v;out.data[dst+3]=255;}
 small.putImageData(out,0,0);const canvas=document.createElement('canvas');canvas.width=b.width*8+32;canvas.height=b.height*8+32;const large=canvas.getContext('2d')!;large.fillStyle='#fff';large.fillRect(0,0,canvas.width,canvas.height);large.imageSmoothingEnabled=!binary;large.drawImage(raw,16,16,b.width*8,b.height*8);return canvas;}
 return{normal:frame(false),binary:frame(true),multiple:isolated.components>1,bottom:Math.floor(card.y+2*unit)+b.y+b.height-2,shape:pGlyphEvidence(isolated),diagnostic:pGlyphCheck(isolated).reason+' '+JSON.stringify(pGlyphCheck(isolated).metrics||{})};
}

function render(){list.replaceChildren();for(const result of results){
 const card=result.card,section=document.createElement('article');section.className='shift-card';section.id='source-card-'+card.id;const title=document.createElement('h3');title.textContent='Card '+card.id;section.append(title);
 const thumb=crop(card.x-2,card.y-2,card.width+4,card.height+4,'original',2);thumb.className='card-thumb';section.append(thumb);
 const evidence=document.createElement('p');evidence.className='small';const cell=dayCell(card,grid);evidence.textContent='Original RGB '+card.rgb.join(', ')+'; hue '+card.hue+'°. '+(cell?'Grid column '+(cell.column+1)+(result.day?'; day OCR '+result.day+' (unverified)':' ; day unread/unconfirmed'):'Date grid unconfirmed')+'. No month/year assigned.';section.append(evidence);
 const colourLabel=document.createElement('label');colourLabel.textContent='Colour category ';const colour=document.createElement('select');colour.setAttribute('aria-label','Colour for card '+card.id);
 for(const [value,name] of [['uncertain','Uncertain - review'],['light','Light green: Educator shift'],['dark','Darker green: floor staff']]){const option=document.createElement('option');option.value=value;option.textContent=name;colour.append(option);}colour.value=card.colour;colour.disabled=busy;colourLabel.append(colour);section.append(colourLabel);
 const labelLabel=document.createElement('label');labelLabel.textContent='Shift label ';const label=document.createElement('select');label.setAttribute('aria-label','Shift label for card '+card.id);
 for(const value of ['', 'A','P','N','N10']){const option=document.createElement('option');option.value=value;option.textContent=value||'Unread / uncertain';label.append(option);}label.value=result.label||'';label.disabled=busy;labelLabel.append(label);section.append(labelLabel);
 if(result.labelPreview){const caption=document.createElement('p');caption.textContent='Enlarged label crop used for OCR:';section.append(caption);result.labelPreview.className='card-label-preview';result.labelPreview.setAttribute('aria-label','Enlarged top-left label for card '+card.id);section.append(result.labelPreview);}
 const labelNote=document.createElement('p');labelNote.textContent=result.labelNote||'';section.append(labelNote);
 const note=document.createElement('p');if(result.confidence!==undefined)note.textContent='Label reading score: '+result.confidence.toFixed(1)+' (not a probability or guarantee).';section.append(note);
 const proposed=document.createElement('p');proposed.className='proposal';const update=()=>{card.colour=colour.value as Colour;result.label=label.value||undefined;const p=proposal(result.label,card.colour,result.timeText??shiftTextOnly(result.text));const role=card.colour==='light'?'Educator shift - ':card.colour==='dark'?'Floor staff - ':'';proposed.textContent=role+(p.range?p.range.start+' to '+p.range.end+(p.range.nextDay?' (+1 day)':'')+' - '+p.basis+(p.warning?'. '+p.warning:''):p.basis+': '+p.warning);};colour.addEventListener('change',()=>{result.reviewed=false;update();renderDateReview();});label.addEventListener('change',()=>{result.reviewed=false;update();renderDateReview();});update();section.append(proposed);
 const raw=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Recognition diagnostics (raw OCR and rejection reasons)';raw.open=!!result.text&&!result.label;raw.append(summary);const text=document.createElement('pre');text.textContent=result.error||result.text||'Not read yet.';raw.append(text);section.append(raw);const back=document.createElement('a');back.href='#date-review';back.textContent='Back to chronological review';section.append(back);list.append(section);
 }
 syncAnchorOptions();renderDateReview();}
read.addEventListener('click',async()=>{if(busy||!source||!cards.length)return;const job=++generation;busy=true;for(const r of results){r.reviewed=false;r.error=undefined;}controls();render();progress.value=0;status.textContent='Loading the on-device card reader...';let current:Worker|undefined;
 try{const lib=await engine();if(job!==generation)return;current=await lib.createWorker('eng',1,{workerPath:root+'worker.min.js',corePath:root,langPath:root.replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none',gzip:true});if(job!==generation){await current.terminate();return;}worker=current;
 const active=results.slice(0,40);
 for(let index=0;index<active.length;index++){if(job!==generation)return;const result=active[index],c=result.card;status.textContent='Reading card '+(index+1)+' of '+active.length+'...';progress.value=index/active.length;
 try{
 const readings:LabelReading[]=[];const frames=labelFrames(c);
 if(frames){
  result.labelPreview=frames.binary;if(frames.shape)readings.push(frames.shape);
  for(const [name,canvas,mode] of [['isolated contrast',frames.normal,'7'],['isolated binary',frames.binary,frames.multiple?'7':'10']] as const){
   await current.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'APNapn10',user_defined_dpi:'300'});
   const result=await current.recognize(canvas,{}, {text:true,tsv:true});if(job!==generation)return;
   const tokens=parseTsv(result.data.tsv||'');readings.push({label:labelFromText(result.data.text),confidence:tokens.length?Math.min(...tokens.map(w=>w.confidence)):0,source:name,rawText:result.data.text,detail:!result.data.text.trim()?'Engine returned blank text':!labelFromText(result.data.text)?'Raw text did not match A/P/N/N10':!tokens.length?'No word-confidence record in TSV':'Valid label candidate'});
  }
 }
 await current.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'',preserve_interword_spaces:'1'});
 const full=await current.recognize(crop(c.x-2,c.y-2,c.width+4,c.height+4),{},{text:true,tsv:true});if(job!==generation)return;result.text=full.data.text;result.timeText=shiftTextOnly(full.data.text);
 const fullWords=parseTsv(full.data.tsv||'');readings.push({label:labelFromText(full.data.text),confidence:fullWords[0]?.confidence||0,source:'full card',rawText:full.data.text.trim().split(String.fromCharCode(10))[0],detail:!labelFromText(full.data.text)?'First line did not match a valid label':'Full-card candidate'});
 const decision=chooseLabel(readings);result.label=decision.label;result.confidence=decision.confidence;result.labelNote=decision.label==='P'&&frames?.shape?'P-shaped upper loop and lower stem support this label. Verify the enlarged crop.':decision.reason;
 result.text+='\nLabel readings: '+readings.map(r=>r.source+' = '+(r.label||'?')+' ('+r.confidence.toFixed(1)+'); raw '+JSON.stringify(r.rawText??'')+'; '+(r.detail||'')).join('\n');
 result.text+='\nGlyph isolation: '+(frames?frames.diagnostic:'No connected label crop found.');

 const unit=Math.max(.65,Math.min(3,c.width/90));
 const labelWord=fullWords.find(w=>labelFromText(w.text)&&w.bbox.y0<Math.max(90*unit,c.height));
 const labelBottom=frames?(frames.bottom-(c.y-2))*3:labelWord?.bbox.y1??60*unit;
 const band=planTimeBand(fullWords,labelBottom,(c.height+4)*3);result.timeReason=band.reason;
 if(band.metadataFound&&band.height>=Math.max(6,6*unit)){
  const timeCrop=crop(c.x+3*unit,c.y-2+band.top/3,c.width-6*unit,band.height/3,'original',4);
  const pixels=timeCrop.getContext('2d')!.getImageData(0,0,timeCrop.width,timeCrop.height).data,bg=.299*c.rgb[0]+.587*c.rgb[1]+.114*c.rgb[2];let ink=0;
  for(let i=0;i<pixels.length;i+=4){const lum=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];if(Math.abs(lum-bg)>Math.max(28,bg*.22))ink++;}
  if(ink>=Math.max(12,timeCrop.width*timeCrop.height*.012)){
   await current.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789:-. '});
   const timeLine=await current.recognize(timeCrop,{}, {text:true,tsv:true});if(job!==generation)return;
   const safeLine=shiftTextOnly(timeLine.data.text);
   if(/[0-9][:.][0-9]/.test(safeLine))result.timeText+='\n'+safeLine;
   result.text+='\nTime-line OCR above metadata:\n'+timeLine.data.text;
  }else result.timeReason+=' No text ink was found in that gap; metadata was not read as time.';
 }
 result.text+='\nTime boundary: '+result.timeReason;
 const cell=dayCell(c,grid);if(cell?.top!==undefined){await current.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789'});const day=await current.recognize(crop(grid!.columns[cell.column]+2,cell.top+2,Math.min(35,c.width*.45),Math.max(8,Math.min(21,c.y-cell.top-3))),{},{text:true,tsv:true});if(job!==generation)return;const digits=day.data.text.trim();if(/^(?:[1-9]|[12]\d|3[01])$/.test(digits)&&parseTsv(day.data.tsv||'').some(w=>w.confidence>=60))result.day=digits;}
 }catch(e){result.error=String(e);}render();
 }
 if(grid&&job===generation){
 await current.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
 const bottom=grid.rows[0]??Math.min(...cards.map(c=>c.y)),top=Math.max(0,bottom-520);
 const heading=await current.recognize(crop(grid.columns[0],top,grid.columns[7]-grid.columns[0],Math.max(1,bottom-top),'original',2),{},{text:true,tsv:false});if(job!==generation)return;header.value=heading.data.text;
 const pixels=source.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,source.width,source.height),band=weekdayBand(pixels.data,source.width,source.height,grid.columns[0],grid.columns[7],Math.min(...cards.map(c=>c.y)));
 if(band){await current.setParameters({tessedit_pageseg_mode:'7'});const weekdays=await current.recognize(crop(band.x,band.y,band.width,band.height,'original',3),{},{text:true,tsv:false});if(job!==generation)return;header.value+='\nWeekday row:\n'+weekdays.data.text;}
 }
 if(job===generation)applyAutomaticDates(false);
 if(job===generation){progress.value=1;status.textContent='Finished reading '+active.length+' card(s). Review colour, label, printed times and date evidence. No calendar events created.'+(results.length>40?' Only the first 40 cards were read to limit memory/time.':'');}
 }catch(e){if(job===generation)status.textContent='Card OCR failed: '+String(e);}
 finally{if(current)await current.terminate().catch(()=>{});if(job===generation){worker=undefined;busy=false;controls();render();}}
});

function syncAnchorOptions(){
 const value=anchorSelect.value;anchorSelect.replaceChildren();
 for(const result of results){const option=document.createElement('option');option.value=String(result.card.id);const cell=dayCell(result.card,grid);option.textContent='Card '+result.card.id+(result.day?' - day OCR '+result.day:' - day unread')+(cell?' (column '+(cell.column+1)+')':'');anchorSelect.append(option);}
 if(results.some(r=>String(r.card.id)===value))anchorSelect.value=value;
}
function dateDisplay(date:string|undefined){if(!validDate(date))return'Unassigned date';return new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
function reviewState(result:Result,assigned:AssignedDate|undefined){
 const p=proposal(result.label,result.card.colour,result.timeText??shiftTextOnly(result.text));
 const start=result.manualStart??p.range?.start,end=result.manualEnd??p.range?.end,nextDay=result.manualNextDay??p.range?.nextDay??false;
 const timing=reviewTiming(assigned?.date,start,end,nextDay);
 const error=timing.error||(!result.label?'Confirm the shift label in Card OCR details.':result.card.colour==='uncertain'?'Confirm the staff role/colour in Card OCR details.':result.error?'OCR reported an error; inspect the card.':undefined);
 return{p,start,end,nextDay,timing,error};
}
function renderDateReview(){
 const assignments=associateDates(results,grid,dateAnchor),map=new Map(assignments.map(a=>[a.cardId,a]));
 const ordered=sortReview(results.map(result=>({cardId:result.card.id,date:map.get(result.card.id)?.date,start:reviewState(result,map.get(result.card.id)).start,result})));
 const root=el('date-results');root.replaceChildren();let reviewed=0,dated=0;
 for(const entry of ordered){const result=entry.result,assignment=map.get(entry.cardId)!,state=reviewState(result,assignment);if(assignment.date)dated++;if(result.reviewed&&!state.error)reviewed++;
 const article=document.createElement('article');article.className='shift-card date-row';
 const heading=document.createElement('h3');heading.textContent=dateDisplay(assignment.date)+' - Card '+entry.cardId+' - '+(result.card.colour==='light'?'Educator':result.card.colour==='dark'?'Floor staff':'Role unclear')+' '+(result.label||'?');article.append(heading);
 const evidence=document.createElement('p');evidence.className='small';const timeBasis=result.manualStart!==undefined||result.manualEnd!==undefined||result.manualNextDay!==undefined?'Times manually edited - compare with original image':state.p.basis;evidence.textContent=assignment.basis+(assignment.warning?'. '+assignment.warning:'')+'. '+timeBasis;article.append(evidence);
 const fields=document.createElement('div');fields.className='date-fields';
 const dateLabel=document.createElement('label');dateLabel.textContent='Shift date ';const date=document.createElement('input');date.type='date';date.value=assignment.date||'';date.disabled=busy;date.setAttribute('aria-label','Date for card '+entry.cardId);dateLabel.append(date);fields.append(dateLabel);
 date.addEventListener('change',()=>{result.manualDate=date.value;result.reviewed=false;renderDateReview();});
 if(assignment.candidate){const use=document.createElement('button');use.textContent='Use proposed '+assignment.candidate+' after checking image';use.disabled=busy;use.addEventListener('click',()=>{result.manualDate=assignment.candidate;result.reviewed=false;renderDateReview();});article.append(use);}
 const startLabel=document.createElement('label');startLabel.textContent='Start ';const start=document.createElement('input');start.type='time';start.value=state.start||'';start.disabled=busy;start.setAttribute('aria-label','Start for card '+entry.cardId);startLabel.append(start);fields.append(startLabel);
 const endLabel=document.createElement('label');endLabel.textContent='End ';const end=document.createElement('input');end.type='time';end.value=state.end||'';end.disabled=busy;end.setAttribute('aria-label','End for card '+entry.cardId);endLabel.append(end);fields.append(endLabel);
 const changedTime=()=>{result.manualStart=start.value;result.manualEnd=end.value;if(validClock(start.value)&&validClock(end.value)&&start.value!==end.value)result.manualNextDay=end.value<start.value;result.reviewed=false;renderDateReview();};start.addEventListener('change',changedTime);end.addEventListener('change',changedTime);
 const overnightLabel=document.createElement('label'),overnight=document.createElement('input');overnight.type='checkbox';overnight.checked=state.nextDay;overnight.disabled=busy;overnight.setAttribute('aria-label','Ends next day for card '+entry.cardId);overnightLabel.append(overnight,document.createTextNode(' Ends next day'));fields.append(overnightLabel);
 overnight.addEventListener('change',()=>{result.manualNextDay=overnight.checked;result.reviewed=false;renderDateReview();});
 article.append(fields);
 const outcome=document.createElement('p');outcome.className='proposal';outcome.textContent=state.error?'Needs review: '+state.error:(dateDisplay(assignment.date)+' '+state.start+' to '+dateDisplay(state.timing.endDate)+' '+state.end+' (Australia/Sydney clock times; DST conversion not yet performed)');article.append(outcome);
 const checkLabel=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!result.reviewed&&!state.error;check.disabled=busy||!!state.error;check.setAttribute('aria-label','Reviewed card '+entry.cardId);checkLabel.append(check,document.createTextNode(' I checked this date, label, role and both times against the image'));check.addEventListener('change',()=>{result.reviewed=check.checked;renderDateReview();});article.append(checkLabel);
 const show=document.createElement('button');show.textContent='Show original card '+entry.cardId;show.addEventListener('click',()=>document.getElementById('source-card-'+entry.cardId)?.scrollIntoView({behavior:'smooth',block:'start'}));article.append(show);root.append(article);
 }
 el('review-count').textContent=results.length+' card(s); '+dated+' dated; '+reviewed+' manually reviewed. Preview only - nothing has been sent to Google.';
 const datedDates=assignments.flatMap(a=>a.date?[a.date]:[]).sort();
 el('auto-date-status').textContent=anchorSource==='auto'&&dateAnchor?dateExplanation+' Anchor: card '+dateAnchor.cardId+' = '+dateDisplay(dateAnchor.date)+'.'+(datedDates.length?' Review range: '+dateDisplay(datedDates[0])+' to '+dateDisplay(datedDates[datedDates.length-1])+'.':'')+' Use Change date anchor if this looks wrong.':anchorSource==='manual'?'Using your manual date anchor. Individual corrections remain available.':dateExplanation;
 el('date-anchor-status').textContent=dateAnchor?'Anchor: card '+dateAnchor.cardId+' = '+dateAnchor.date+'. Check any conflicts below. Manual date overrides are retained.':'No date anchor confirmed. Enter the exact date of one numbered card, or enter individual dates below.';
}
anchorDate.addEventListener('input',controls);
applyAnchor.addEventListener('click',()=>{
 if(busy||!validDate(anchorDate.value)){el('date-anchor-status').textContent='Enter a valid full date for the chosen numbered card.';return;}
 const id=Number(anchorSelect.value);if(!results.some(r=>r.card.id===id))return;
 anchorSource='manual';dateExplanation='Using the date anchor you selected.';dateAnchor={cardId:id,date:anchorDate.value,mondayFirst:weekOrder.checked,source:'manual'};for(const r of results)r.reviewed=false;renderDateReview();
});


function applyAutomaticDates(force:boolean){
 if(!force&&anchorSource==='manual')return;
 const detected=inferDateAnchor(results,grid,header.value);dateExplanation=detected.reason;
 for(const r of results)r.reviewed=false;
 if(detected.anchor){dateAnchor=detected.anchor;anchorSource='auto';syncAnchorOptions();anchorSelect.value=String(detected.anchor.cardId);anchorDate.value=detected.anchor.date;weekOrder.checked=true;anchorControls.open=false;}
 else{dateAnchor=undefined;anchorSource=undefined;anchorControls.open=true;}
 renderDateReview();
}
retryDates.addEventListener('click',()=>{if(!busy){applyAutomaticDates(true);controls();}});

async function offline(){const label=el('card-offline');if(!('serviceWorker'in navigator)||!import.meta.env.PROD){label.textContent='Offline cache requires the production deployment.';return;}
 try{await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL});await navigator.serviceWorker.ready;const info=await(await fetch(root+'assets.json')).json() as {files:string[]};const cached=await Promise.all(info.files.map(f=>caches.match(root+f)));
 label.textContent=navigator.serviceWorker.controller&&cached.every(Boolean)?'OCR assets cached. Close all app windows and reopen after an update; test this page in airplane mode.':'Offline assets installing. Keep online, then close app windows and reopen.';
 }catch{label.textContent='Offline readiness not confirmed. Reconnect and check again.';}}
el('card-offline-check').addEventListener('click',()=>void offline());navigator.serviceWorker?.addEventListener('controllerchange',()=>void offline());void offline();controls();
