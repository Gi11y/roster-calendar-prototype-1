// Flatten roster colour into black ink on white paper before time OCR.
// All pixels remain on-device; no source image or OCR is persisted.
export function timeInk(data:Uint8ClampedArray,background:readonly number[],lightInk=false):Uint8ClampedArray{
 if(data.length%4||background.length!==3||background.some(x=>!Number.isFinite(x)||x<0||x>255))throw Error('Invalid image pixels or background colour.');
 const bg=.299*background[0]+.587*background[1]+.114*background[2],out=new Uint8ClampedArray(data.length);
 for(let i=0;i<data.length;i+=4){
  const lum=.299*data[i]+.587*data[i+1]+.114*data[i+2];
  const ink=lightInk?lum>Math.min(245,bg+45):lum<Math.min(165,bg*.82);
  out[i]=out[i+1]=out[i+2]=ink?0:255;out[i+3]=255;
 }
 return out;
}
