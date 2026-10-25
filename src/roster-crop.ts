import {detectCards,findGrid,type Rect,type Grid}from'./card-data.ts';
import {weekdayBand}from'./auto-dates.ts';
export interface RosterCrop {rect:Rect;automatic:boolean;reason:string;cards:Rect[]}
export function clampCrop(rect:Rect,width:number,height:number):Rect{
 const x=Math.max(0,Math.min(width-1,Math.floor(Number.isFinite(rect.x)?rect.x:0))),y=Math.max(0,Math.min(height-1,Math.floor(Number.isFinite(rect.y)?rect.y:0)));
 return{x,y,width:Math.max(1,Math.min(width-x,Math.ceil(Number.isFinite(rect.width)?rect.width:width))),height:Math.max(1,Math.min(height-y,Math.ceil(Number.isFinite(rect.height)?rect.height:height)))};
}
export function scaleCrop(rect:Rect,fromWidth:number,fromHeight:number,toWidth:number,toHeight:number):Rect{
 const x=Math.floor(rect.x*toWidth/fromWidth),y=Math.floor(rect.y*toHeight/fromHeight),right=Math.ceil((rect.x+rect.width)*toWidth/fromWidth),bottom=Math.ceil((rect.y+rect.height)*toHeight/fromHeight);
 return clampCrop({x,y,width:right-x,height:bottom-y},toWidth,toHeight);
}
export function excludedCards(rect:Rect,cards:Rect[]):number{return cards.filter(c=>c.x<rect.x||c.y<rect.y||c.x+c.width>rect.x+rect.width||c.y+c.height>rect.y+rect.height).length;}
export function cropFromGrid(width:number,height:number,cards:Rect[],grid:Grid|undefined,weekdays:Rect|undefined):RosterCrop{
 const full={x:0,y:0,width,height},fallback=(reason:string):RosterCrop=>({rect:full,automatic:false,reason,cards});
 if(!cards.length)return fallback('No clear shift cards found. The full image is kept.');
 if(!grid||grid.columns.length!==8||grid.rows.length<2||!weekdays)return fallback('The grid and heading are uncertain. The full image is kept.');
 const columns=grid.columns,cell=(columns[7]-columns[0])/7;
 if(cell<20||columns.some((x,i)=>!Number.isFinite(x)||x<0||x>=width||(i>0&&Math.abs(x-columns[i-1]-cell)>cell*.15)))return fallback('The calendar columns are uncertain. The full image is kept.');
 if(!grid.rows.every((y,i)=>Number.isFinite(y)&&y>=0&&y<height&&(i===0||y>grid.rows[i-1]))||weekdays.y>=Math.min(...cards.map(c=>c.y)))return fallback('The calendar heading is uncertain. The full image is kept.');
 const pad=Math.max(8,Math.ceil(cell*.12)),left=Math.max(0,columns[0]-pad),right=Math.min(width,columns[7]+pad+1);
 // Keep generous space ABOVE weekday headings for the selected date and month/year.
 const top=Math.max(0,weekdays.y-Math.max(160,Math.ceil(cell*2)));
 const bottom=Math.min(height,Math.max(grid.rows[grid.rows.length-1],...cards.map(c=>c.y+c.height))+pad+1);
 const rect=clampCrop({x:left,y:top,width:right-left,height:bottom-top},width,height);
 if(excludedCards(rect,cards))return fallback('A detected card falls outside the proposed crop. The full image is kept.');
 if(rect.width*rect.height>width*height*.94)return fallback('The roster already fills this image. The full image is kept.');
 return{rect,automatic:true,reason:'Roster grid found. Check that the date heading and every shift are visible.',cards};
}
export function proposeRosterCrop(data:Uint8ClampedArray,width:number,height:number):RosterCrop{
 const cards=detectCards(data,width,height),grid=findGrid(data,width,height,cards);
 const weekdays=grid&&cards.length?weekdayBand(data,width,height,grid.columns[0],grid.columns[7],Math.min(...cards.map(c=>c.y))):undefined;
 return cropFromGrid(width,height,cards,grid,weekdays);
}
