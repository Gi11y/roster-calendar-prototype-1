import{isLeave,isSpecial,entryName}from'./roster-entries.ts';
import{validDate,addDays}from'./date-review.ts';
import {sydneyRange,ROSTER_ZONE,type SydneyRange} from './sydney-time.ts';
export interface ReviewedShift {cardId:number;date:string;label:string;role:string;start:string;end:string;nextDay:boolean;reviewed:boolean;order:number;endDate?:string}
export type EventBoundary={date:string;dateTime?:never;timeZone?:never}|{dateTime:string;timeZone:string;date?:never};
export interface ApprovedEvent {id:string;summary:string;description:string;start:EventBoundary;end:EventBoundary;reminders:{useDefault:false;overrides?:{method:'popup';minutes:number}[]};extendedProperties:{private:{rosterImporter:string;rosterDate:string;rosterType:string;rosterOrdinal:string}}}
export interface PreparedShift {cardId:number;date:string;label:string;role:string;range?:SydneyRange;event:ApprovedEvent}
export const OWNER_MARKER='roster-calendar-v1';
export async function stableEventId(date:string,label:string,ordinal:number):Promise<string>{
 const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(date+'|'+label+'|'+ordinal));
 return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function prepareEvents(shifts:ReviewedShift[],reminder:number|null=null):Promise<PreparedShift[]>{
 if(!shifts.length)throw Error('Read and review at least one shift.');
 if(reminder!==null&&(!Number.isInteger(reminder)||reminder<0||reminder>40320))throw Error('Choose a valid reminder lead time.');
 if(new Set(shifts.map(s=>s.cardId)).size!==shifts.length)throw Error('Duplicate source card identifiers. Read the screenshot again.');
 const ordinals=new Map<string,number>(),prepared:PreparedShift[]=[];
 // Source-card order, never time order: changing times must not change identity.
 for(const shift of shifts.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order||a.cardId-b.cardId)){
  if(!shift.reviewed)throw Error('Every detected card must be checked before preparing events.');
  if(!['A','P','N','N10','ANNUAL','LWOP','COURSE'].includes(shift.label)||!isSpecial(shift.label)&&!['Educator','Floor staff'].includes(shift.role))throw Error('Confirm every shift label and staff role.');
  const allDay=isLeave(shift.label),through=shift.endDate??shift.date;
  if(allDay&&(!validDate(shift.date)||!validDate(through)||through<shift.date||(Date.parse(through)-Date.parse(shift.date))/86400000>=93))throw Error('Confirm a valid leave period of at most 93 days.');
  const validated:{range?:SydneyRange;error?:string}=allDay?{}:sydneyRange(shift.date,shift.start,shift.end,shift.nextDay);
  if(!allDay&&(validated.error||!validated.range))throw Error('Card '+shift.cardId+': '+validated.error);
  const key=shift.date+'|'+shift.label,ordinal=ordinals.get(key)??0;ordinals.set(key,ordinal+1);
  const name=shift.label==='A'?'Morning':shift.label==='P'?'Afternoon':'Night';
  const range=validated.range;
  const event:ApprovedEvent={id:await stableEventId(shift.date,shift.label,ordinal),summary:isSpecial(shift.label)?entryName(shift.label):shift.role+' — '+name+' shift',description:'Imported from reviewed roster. '+(isSpecial(shift.label)?entryName(shift.label):'Shift '+shift.label)+'.',start:allDay?{date:shift.date}:{dateTime:range!.start,timeZone:ROSTER_ZONE},end:allDay?{date:addDays(through,1)}:{dateTime:range!.end,timeZone:ROSTER_ZONE},reminders:reminder===null?{useDefault:false}:{useDefault:false,overrides:[{method:'popup',minutes:reminder}]},extendedProperties:{private:{rosterImporter:OWNER_MARKER,rosterDate:shift.date,rosterType:shift.label,rosterOrdinal:String(ordinal)}}};
  prepared.push({cardId:shift.cardId,date:shift.date,label:shift.label,role:shift.role,range,event});
 }
 return prepared;
}
