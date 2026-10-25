import{test}from'node:test';import assert from'node:assert/strict';import{isolateLabel,chooseLabel}from'../src/label-data.ts';
function sample(){const w=45,h=25,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)d.set([35,185,35,255],i*4);function rect(x,y,a,b){for(let yy=y;yy<y+b;yy++)for(let xx=x;xx<x+a;xx++)d.set([5,20,5,255],(yy*w+xx)*4);}return{w,h,d,rect};}
test('isolates top-left letter without lower time-line pixels',()=>{const p=sample();p.rect(4,3,7,9);p.rect(3,18,30,5);const r=isolateLabel(p.d,p.w,p.h,[35,185,35]);assert(r);assert(r.bounds.y+r.bounds.height<18);assert.equal(r.components,1);});
test('keeps neighbouring N10 glyphs on the same line',()=>{const p=sample();p.rect(4,3,7,9);p.rect(14,3,3,9);p.rect(20,3,6,9);const r=isolateLabel(p.d,p.w,p.h,[35,185,35]);assert.equal(r.components,3);assert(r.bounds.x+r.bounds.width>=26);});
test('blank colour patch and isolated noise do not become labels',()=>{const p=sample();p.rect(3,4,1,1);assert.equal(isolateLabel(p.d,p.w,p.h,[35,185,35]),undefined);});
test('two moderate matching readings can recover a short label',()=>{assert.equal(chooseLabel([{label:'P',confidence:45,source:'mono'},{label:'P',confidence:55,source:'normal'}]).label,'P');});
test('strong conflicting letters stay uncertain',()=>{assert.equal(chooseLabel([{label:'A',confidence:91,source:'mono'},{label:'P',confidence:90,source:'normal'}]).label,undefined);});
test('one weak reading or an unsupported N12 never creates a label',()=>{assert.equal(chooseLabel([{label:'N',confidence:42,source:'mono'}]).label,undefined);assert.equal(chooseLabel([{label:'N12',confidence:98,source:'mono'}]).label,undefined);});
test('N10 and a strong single letter are retained',()=>{assert.equal(chooseLabel([{label:'N10',confidence:94,source:'mono'}]).label,'N10');assert.equal(chooseLabel([{label:'A',confidence:95,source:'mono'}]).label,'A');});

test('white night-shift glyphs are isolated and marked for inversion',()=>{const p=sample();for(let y=3;y<12;y++)for(let x=4;x<11;x++)p.d.set([245,245,245,255],(y*p.w+x)*4);const r=isolateLabel(p.d,p.w,p.h,[35,185,35]);assert(r);assert.equal(r.lightInk,true);});
test('white rounded-corner fragments do not become a night label',()=>{const p=sample();for(let y=0;y<6;y++)for(let x=0;x<3;x++)p.d.set([250,250,250,255],(y*p.w+x)*4);assert.equal(isolateLabel(p.d,p.w,p.h,[35,185,35]),undefined);});

import {labelFromText} from '../src/card-data.ts';
test('lowercase OCR letters normalise without accepting duplicate glyphs',()=>{assert.equal(labelFromText('p'),'P');assert.equal(labelFromText('a'),'A');assert.equal(labelFromText('n10'),'N10');assert.equal(labelFromText('Pp'),undefined);});

import {pGlyphEvidence} from '../src/label-data.ts';
function glyph(rows){const w=12,h=16,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)d.set([35,185,35,255],i*4);rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')d.set([0,0,0,255],((y+3)*w+x+3)*4);}));return isolateLabel(d,w,h,[35,185,35]);}
test('clear P upper-loop and lower-stem contour supplies evidence',()=>{const p=glyph(['11110','11011','11011','11110','11000','11000','11000']);assert.equal(pGlyphEvidence(p)?.label,'P');});
test('A, N and closed-box shapes never get P evidence',()=>{for(const rows of [['00100','01110','11011','11011','11111','11011','11011'],['11011','11111','11111','11011','11011','11011','11011'],['11111','11011','11011','11011','11011','11011','11111']])assert.equal(pGlyphEvidence(glyph(rows)),undefined);});

import {pGlyphCheck} from '../src/label-data.ts';
test('P bowl extending into the lower 40 percent is not mistaken for a lower right leg',()=>{const p=glyph(['1111100','1111110','1100111','1100111','1111110','1111110','1100000','1100000','1100000']);const check=pGlyphCheck(p);assert.equal(check.reading?.label,'P');assert.equal(check.metrics.lowerRightInk,0);});
test('rejection diagnostics explain why unsupported glyphs fail',()=>{assert.match(pGlyphCheck(undefined).reason,/No isolated glyph/);const a=glyph(['00100','01110','11011','11011','11111','11011','11011']);assert.match(pGlyphCheck(a).reason,/rejected/);});

const contour={label:'P',confidence:93,source:'P glyph contour (upper loop and lower stem)'},rawRetry={label:'P',confidence:78.5,source:'retry raw line'},wordRetry={label:'P',confidence:74.4,source:'retry word'},moderateA={label:'A',confidence:67,source:'original binary'};
test('P contour plus two agreeing retry modes resolves the reproduced moderate A misread',()=>{assert.equal(chooseLabel([contour,rawRetry,wordRetry,moderateA]).label,'P');});
test('P retry recovery does not bypass absent geometry, a single retry, duplicate retry source, strong conflict or other labels',()=>{
 for(const readings of [[contour,rawRetry,moderateA],[rawRetry,wordRetry,moderateA],[contour,rawRetry,{...wordRetry,source:rawRetry.source},moderateA],[contour,rawRetry,wordRetry,{...moderateA,confidence:85}],[contour,rawRetry,wordRetry,{...moderateA,label:'N'}],[contour,rawRetry,wordRetry,moderateA,{label:'N',confidence:65,source:'other'}]])assert.equal(chooseLabel(readings).label,undefined);
});
