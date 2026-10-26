import type{Grid,Rect}from'./card-data.ts';
export interface CropCheck {blocked:boolean;partial:boolean;clipped:number;excluded:number;messages:string[]}
export function checkRosterCrop(rect:Rect,cards:Rect[],width:number,height:number,grid?:Grid,weekdays?:Rect):CropCheck{
 const right=rect.x+rect.width,bottom=rect.y+rect.height,contains=(r:Rect)=>r.x>=rect.x&&r.y>=rect.y&&r.x+r.width<=right&&r.y+r.height<=bottom;
 const intersects=(r:Rect)=>r.x<right&&r.x+r.width>rect.x&&r.y<bottom&&r.y+r.height>rect.y;
 const visible=cards.filter(intersects),clipped=visible.filter(c=>!contains(c)||c.x<=1||c.y<=1||c.x+c.width>=width-1||c.y+c.height>=height-1).length,excluded=cards.filter(c=>!intersects(c)).length;
 const cell=grid?(grid.columns.at(-1)!-grid.columns[0])/(grid.columns.length-1):0;
 const cutsGrid=!!grid&&(rect.x>grid.columns[0]+2||right<grid.columns.at(-1)!-2||rect.y>(grid.rows[0]??height)+2||bottom<(grid.rows.at(-1)??0)-2);
 const cutsWeekdays=!!weekdays&&!contains(weekdays),unbounded=!!grid&&visible.some(c=>!grid.rows.some(y=>y<=c.y)||!grid.rows.some(y=>y>c.y+c.height-3)),partial=!!grid?.partial||!grid&&cards.length>0||excluded>0||cutsGrid||cutsWeekdays||unbounded;
 const messages:string[]=[];
 if(clipped)messages.push(clipped+' '+(clipped===1?'shift card is':'shift cards are')+' cut off. Expand the crop, leave that card outside it, or choose a wider screenshot.');
 if(excluded)messages.push(excluded+' '+(excluded===1?'shift is':'shifts are')+' outside this crop. Only visible shifts will be imported.');
 if(grid?.partial)messages.push('Only '+(grid.columns.length-1)+' weekday columns are visible. You will confirm the first weekday and one date after reading.');
 if(cutsWeekdays)messages.push('The weekday heading is cut off. Include it where possible; otherwise dates need manual confirmation.');
 else if(weekdays&&rect.y>Math.max(0,weekdays.y-Math.max(80,cell)))messages.push('The month and year may be above this crop. Include the date heading where possible.');
 if(unbounded)messages.push('A week boundary is missing. Dates need review, and other calendar shifts will be kept.');
 if(!grid&&cards.length)messages.push('The calendar grid is unclear. You can still read the cards and enter dates manually.');
 if(!visible.length)messages.push(cards.length?'No complete shift cards are inside this crop. Expand it or choose another screenshot.':'No shift cards were detected in this preview. If the roster is small, crop closer before reading.');
 return{blocked:clipped>0||!visible.length&&cards.length>0,partial,clipped,excluded,messages};
}
export function removalCoverageAllowed(partial:boolean):boolean{return !partial;}
