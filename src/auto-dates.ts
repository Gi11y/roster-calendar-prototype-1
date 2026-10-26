import {addDays,validDate,type DateAnchor,type DateCard} from './date-review.ts';
import {dayCell,type Grid,type Rect} from './card-data.ts';
export interface AutoDates {anchor?:DateAnchor;reason:string;matches?:number;conflicts?:number}
export function mondayFirstHeader(text:string):boolean{
 for(const line of text.split(/\r?\n/)){
  const days=[...line.matchAll(/\b(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/gi)].map(m=>['MON','TUE','WED','THU','FRI','SAT','SUN'].indexOf(m[1].toUpperCase().slice(0,3)));
  if(days.length>=4&&days[0]===0&&days[days.length-1]===6&&days.every((v,i)=>i===0||v>days[i-1]))return true;
 }
 return false;
}
export function headerMonths(text:string):{year:number;month:number}[]{
 const names=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],out=new Map<string,{year:number;month:number}>();
 const pattern=/(?:^|[^A-Z])(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|[O0]CT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s*[,.-]?\s*((?:19|20|21|22)\d{2})(?!\d)/gi;
 for(const m of text.matchAll(pattern)){const name=m[1].toUpperCase().replace(/^0CT/,'OCT'),month=names.indexOf(name.slice(0,3)),year=Number(m[2]);if(month>=0&&validDate(year+'-'+String(month+1).padStart(2,'0')+'-01'))out.set(year+'-'+month,{year,month});}
 return[...out.values()];
}
function position(item:DateCard,grid:Grid){const cell=dayCell(item.card,grid);if(!cell||cell.top===undefined||cell.bottom===undefined)return;const row=grid.rows.indexOf(cell.top);if(row<0||grid.rows[row+1]!==cell.bottom)return;return{row,column:cell.column};}
export function inferDateAnchor(items:DateCard[],grid:Grid|undefined,header:string):AutoDates{
 if(!grid||grid.columns.length!==8)return{reason:'The date grid is unclear. Change the anchor manually.'};
 const refs=headerMonths(header);if(!refs.length)return{reason:'No reliable month and year were read from the screenshot header. Enter an anchor manually.'};
 if(!mondayFirstHeader(header))return{reason:'Monday-to-Sunday column headings were not clear enough. Confirm an anchor manually.'};
 const years=refs.map(r=>r.year);if(Math.max(...years)-Math.min(...years)>1)return{reason:'Conflicting header years need manual review.'};
 const known=items.flatMap(item=>{const p=position(item,grid);return p&&item.day&&/^(?:[1-9]|[12]\d|3[01])$/.test(item.day)?[{item,p,day:Number(item.day)}]:[];});
 const cells=new Map<string,{row:number;column:number;days:Set<number>}>();
 for(const k of known){const key=k.p.row+':'+k.p.column;const cell=cells.get(key)||{...k.p,days:new Set<number>()};cell.days.add(k.day);cells.set(key,cell);}
 if(cells.size<3)return{reason:'Fewer than three distinct grid days were read clearly. Use the manual anchor.'};
 const months=new Map<string,{year:number;month:number}>();
 for(const ref of refs)for(const delta of [-1,0,1]){const d=new Date(Date.UTC(ref.year,ref.month+delta,1));const year=d.getUTCFullYear(),month=d.getUTCMonth();months.set(year+':'+month,{year,month});}
 const bases=new Set<string>();
 for(const k of known)for(const ref of months.values()){const date=ref.year+'-'+String(ref.month+1).padStart(2,'0')+'-'+String(k.day).padStart(2,'0');if(!validDate(date)||(new Date(date+'T00:00:00Z').getUTCDay()+6)%7!==k.p.column)continue;try{bases.add(addDays(date,-k.p.row*7-k.p.column));}catch{}}
 const ranked=[...bases].map(base=>{let matches=0,conflicts=0;for(const cell of cells.values()){try{const expected=Number(addDays(base,cell.row*7+cell.column).slice(-2));if(cell.days.size===1&&cell.days.has(expected))matches++;else conflicts++;}catch{conflicts++;}}return{base,matches,conflicts};}).sort((a,b)=>b.matches-a.matches||a.conflicts-b.conflicts);
 const best=ranked[0],second=ranked[1];
 if(!best||best.matches<3||best.matches/cells.size<.7)return{reason:'Header and grid day numbers do not agree strongly enough. Change the anchor manually.'};
 if(second&&second.matches>=3&&best.matches-second.matches<2)return{reason:'More than one calendar period fits the grid. Choose an anchor to resolve it.'};
 const seed=known.find(k=>{try{return Number(addDays(best.base,k.p.row*7+k.p.column).slice(-2))===k.day;}catch{return false;}});
 if(!seed)return{reason:'No trustworthy anchor card could be selected.'};
 const date=addDays(best.base,seed.p.row*7+seed.p.column);
 return{anchor:{cardId:seed.item.card.id,date,mondayFirst:true,source:'auto'},matches:best.matches,conflicts:best.conflicts,reason:'Dates detected from header month/year, weekday order and '+best.matches+' matching grid day(s).'+(best.conflicts?' '+best.conflicts+' day conflict(s) still need review.':'')};
}
export function weekdayBand(data:Uint8ClampedArray,width:number,height:number,left:number,right:number,firstCardY:number):Rect|undefined{
 const start=Math.max(0,Math.floor(firstCardY-Math.max(650,(right-left)*1.1))),end=Math.min(height,Math.floor(firstCardY)),span=right-left;if(span<=0)return;
 const groups:Rect[]=[];let y=start;
 while(y<end){let coverage=0;for(let x=Math.max(0,Math.floor(left));x<Math.min(width,right);x++){const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.max(r,g,b)-Math.min(r,g,b)<14&&r>=180&&r<=240)coverage++;}
 if(coverage/span<.65){y++;continue;}const top=y;y++;
 while(y<end){let n=0;for(let x=Math.max(0,Math.floor(left));x<Math.min(width,right);x++){const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.max(r,g,b)-Math.min(r,g,b)<14&&r>=180&&r<=240)n++;}if(n/span<.65)break;y++;}
 const h=y-top;if(h>=8&&h<=Math.max(45,span/14))groups.push({x:left,y:top,width:span,height:h});
 }
 return groups.pop();
}
