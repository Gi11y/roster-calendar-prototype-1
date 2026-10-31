import{proposal}from'./card-data.ts';
interface TypeControl extends EventTarget {value:string}
interface ClockControl {value:string}
interface OvernightControl {checked:boolean}
export function standardShiftHours(label:string):{start:string;end:string;nextDay:boolean}|undefined{
 if(!['A','P','N','N10'].includes(label))return;
 const range=proposal(label,'uncertain','').range;
 return range?{start:range.start,end:range.end,nextDay:range.nextDay}:undefined;
}
export function bindStandardShiftHours(type:TypeControl,start:ClockControl,end:ClockControl,next:OvernightControl,onTypeChange:()=>void=()=>{}):()=>void{
 const apply=()=>{const hours=standardShiftHours(type.value);start.value=hours?.start??'';end.value=hours?.end??'';next.checked=hours?.nextDay??false;};
 type.addEventListener('change',()=>{apply();onTypeChange();});
 return apply;
}
