export function calendarFixture({columns=7,cell=100,rows=3,landscape=false,offsetX=20,offsetY=100}={}){
 const width=Math.ceil(landscape?Math.max(1200,offsetX+columns*cell+30):offsetX+columns*cell+30),height=offsetY+rows*150+30,data=new Uint8ClampedArray(width*height*4).fill(255);
 const put=(x,y,rgb)=>data.set([...rgb,255],(Math.round(y)*width+Math.round(x))*4),cards=[];
 for(let c=0;c<=columns;c++)for(let y=offsetY;y<=offsetY+rows*150;y++)put(offsetX+c*cell,y,[225,225,225]);
 for(let r=0;r<=rows;r++)for(let x=offsetX;x<=offsetX+columns*cell;x++)put(x,offsetY+r*150,[225,225,225]);
 for(let r=0;r<rows;r++)for(const c of [...new Set([0,columns-1])]){const rect={x:Math.round(offsetX+c*cell)+5,y:offsetY+r*150+30,width:Math.round(offsetX+(c+1)*cell)-Math.round(offsetX+c*cell)-10,height:80};cards.push(rect);for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++)put(x,y,[165,205,15]);}
 return{data,width,height,expectedCards:cards.length,expectedColumns:columns};
}
