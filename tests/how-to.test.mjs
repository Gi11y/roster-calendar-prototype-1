import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{standardShiftHours}from'../src/manual-shift-defaults.ts';
const guide=readFileSync('how-to.html','utf8');
test('the guide shows the actual standard hours used by the manual shift form',()=>{for(const code of['A','P','N','N10']){const row=guide.match(new RegExp('<tr data-default-shift="'+code+'">([\\s\\S]*?)</tr>'))?.[1];assert(row,'Missing standard hours for '+code);const hours=standardShiftHours(code);assert(row.includes(hours.start));assert(row.includes(hours.end));assert.equal(row.includes('next day'),hours.nextDay);}});
test('guide topic links and local page links have real destinations',()=>{const ids=[...guide.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const[,href]of guide.matchAll(/<a\b[^>]*href="([^"]+)"/g)){if(href.startsWith('#'))assert(ids.includes(href.slice(1)),href);if(href.startsWith('%BASE_URL%')){const file=href.slice('%BASE_URL%'.length).split('#')[0]||'index.html';assert(existsSync(file)||existsSync('public/'+file),file);}}});
test('help from working screens opens separately to preserve the current review',()=>{for(const file of['index.html','cards.html','change.html','swap.html']){const text=readFileSync(file,'utf8'),links=[...text.matchAll(/<a\b[^>]*href="%BASE_URL%how-to\.html"[^>]*>/g)].map(m=>m[0]);assert(links.length,file);for(const link of links){assert(link.includes('target="_blank"'),file);assert(link.includes('rel="noopener"'),file);}}});

test('every guide screenshot has an enlarging link, caption and self-contained safe image',()=>{
 const images=[...guide.matchAll(/<figure class="help-screenshot"[^>]*>([\s\S]*?)<\/figure>/g)];assert.equal(images.length,8);
 let bytes=0;
 for(const[,figure]of images){
  const src=figure.match(/<img src="%BASE_URL%([^"]+)"/)?.[1];assert(src);assert(figure.includes('href="%BASE_URL%'+src+'"'));assert(figure.includes('target="_blank"'));assert(/alt="[^"]+"/.test(figure));assert(/<figcaption>.+<\/figcaption>/.test(figure));
  const svg=readFileSync('public/'+src,'utf8');bytes+=Buffer.byteLength(svg);assert(!/<script|<foreignObject|(?:href|src)="https?:/i.test(svg));
  const image=svg.match(/<image[^>]*width="(\d+)" height="(\d+)" href="data:image\/(png|jpeg);base64,([^"]+)"/);assert(image);
  const png=Buffer.from(image[4],'base64');let width,height;
  if(image[3]==='png'){assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');width=png.readUInt32BE(16);height=png.readUInt32BE(20);}
  else{assert.equal(png.readUInt16BE(0),0xffd8);let offset=2;while(offset<png.length){assert.equal(png[offset],255);while(png[offset]===255)offset++;const marker=png[offset++];if(marker===217||marker===218)break;const size=png.readUInt16BE(offset);if([192,193,194].includes(marker)){height=png.readUInt16BE(offset+3);width=png.readUInt16BE(offset+5);break;}offset+=size;}assert(width&&height);}
  assert.equal(width,Number(image[1]));assert.equal(height,Number(image[2]));
  const view=svg.match(/viewBox="([\d ]+)"/)[1].split(' ').map(Number);assert(view[0]>=0&&view[1]>=0&&view[0]+view[2]<=Number(image[1])&&view[1]+view[3]<=Number(image[2]));
  if(src.endsWith('crop-controls.svg'))assert.deepEqual([width,height],[624,290],'Only flattened controls, with no roster pixels, may be embedded');
 }
 assert(bytes<600_000,'Keep the screenshot guide lightweight for offline caching');
});
