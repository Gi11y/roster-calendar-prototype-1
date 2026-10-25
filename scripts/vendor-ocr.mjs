import {mkdirSync,copyFileSync,readdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
const target='public/ocr-assets'; mkdirSync(target,{recursive:true});
const files=[];
function copy(source,name){if(!existsSync(source))throw Error('Missing OCR asset: '+source);copyFileSync(source,join(target,name));files.push(name);}
copy('node_modules/tesseract.js/dist/tesseract.min.js','tesseract.min.js');
copy('node_modules/tesseract.js/dist/worker.min.js','worker.min.js');
for(const name of readdirSync('node_modules/tesseract.js-core').filter(x=>/\.wasm(\.js)?$/.test(x)))copy('node_modules/tesseract.js-core/'+name,name);
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const models=walk('node_modules/@tesseract.js-data/eng').filter(x=>x.endsWith('eng.traineddata.gz'));
const model=models.find(x=>x.includes('4.0.0_best_int'))||models[0];
if(!model)throw Error('English model missing');copy(model,'eng.traineddata.gz');
for(const [pkg,label] of [['tesseract.js','TESSERACT'],['tesseract.js-core','CORE'],['@tesseract.js-data/eng','ENGLISH']]){
 const root='node_modules/'+pkg;const license=walk(root).find(x=>/^licen[cs]e(?:\..*)?$/i.test(x.split(/[\\/]/).pop()));
 if(license)copy(license,label+'-LICENSE.txt');
}
writeFileSync(join(target,'assets.json'),JSON.stringify({files,versions:{tesseract:'6.0.1',english:'1.0.0'}}));
console.log('Self-hosted OCR assets prepared:',files.length);
