import type{Rect}from'./card-data.ts';
export type Rotation=0|90|180|270;
export function rotatedSize(width:number,height:number,rotation:Rotation){return rotation===90||rotation===270?{width:height,height:width}:{width,height};}
export function rotationMatrix(width:number,height:number,rotation:Rotation):[number,number,number,number,number,number]{
 return rotation===90?[0,1,-1,0,height,0]:rotation===180?[-1,0,0,-1,width,height]:rotation===270?[0,-1,1,0,0,width]:[1,0,0,1,0,0];
}
export function drawOriented(ctx:CanvasRenderingContext2D,image:HTMLImageElement,rotation:Rotation,rect:Rect,width:number,height:number){
 if(rotation===0){ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,width,height);return;}
 ctx.save();const sx=width/rect.width,sy=height/rect.height;ctx.setTransform(sx,0,0,sy,-rect.x*sx,-rect.y*sy);ctx.transform(...rotationMatrix(image.naturalWidth,image.naturalHeight,rotation));ctx.drawImage(image,0,0);ctx.restore();
}
export function textFrameSize(width:number,height:number,targetHeight=64){
 if(![width,height,targetHeight].every(Number.isFinite)||width<=0||height<=0||targetHeight<=0)throw Error('Invalid text crop.');
 const scale=Math.min(6,targetHeight/height,800/width,Math.sqrt(250_000/(width*height)));
 return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),padding:12};
}
export function normaliseTextCanvas(input:HTMLCanvasElement,targetHeight=64):HTMLCanvasElement{
 const size=textFrameSize(input.width,input.height,targetHeight),output=document.createElement('canvas');output.width=size.width+size.padding*2;output.height=size.height+size.padding*2;const ctx=output.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,output.width,output.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(input,size.padding,size.padding,size.width,size.height);return output;
}
