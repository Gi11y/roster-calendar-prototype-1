export function shiftCount(count:number):string{return count+' '+(count===1?'Shift':'Shifts');}
export function shiftSaveSummary(items:{kind:string}[]):{headline:string;detail:string}{
 const groups=[['created','Added'],['updated','Updated'],['removed','Removed'],['restored','Restored']]as const;
 const counts=groups.map(([kind,verb])=>({verb,count:items.filter(item=>item.kind===kind).length})).filter(item=>item.count);
 const total=counts.reduce((sum,item)=>sum+item.count,0);
 const failed=items.filter(item=>item.kind==='failed').length,skipped=items.filter(item=>item.kind==='unchanged').length,pending=items.filter(item=>item.kind==='not-attempted').length;
 const headline=total?shiftCount(total)+' '+(counts.length===1?counts[0].verb:'Saved'):failed||pending?'No Shifts Confirmed Saved':skipped?shiftCount(skipped)+' Unchanged':'No Shifts Saved';
 const detail=[...counts.map(item=>shiftCount(item.count)+' '+item.verb),...(skipped?[shiftCount(skipped)+' Unchanged']:[]),...(failed?[shiftCount(failed)+(failed===1?' Needs Checking':' Need Checking')]:[]),...(pending?[shiftCount(pending)+' Not Attempted']:[])].join(' · ');
 return{headline,detail};
}
