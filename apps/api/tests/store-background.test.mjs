import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
const start=src.indexOf('router.patch("/provider/background"');
const code=ts.transpileModule(src.slice(start,src.indexOf('router.patch("/provider/profile"',start)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const image='data:image/png;base64,iVBORw0KGgo=';
function harness({authorized=true,fails=false}={}){
 let handler,writes=0;const saved={imageUrl:'previous',hours:'8AM - 9PM',location:'Original'};
 new Function('router','requireProvider','providerCollection','Buffer',code)({patch(path,fn){handler=fn;}},async()=>authorized?{providerId:7}:null,{async findOneAndUpdate(filter,update,options){assert.equal(filter.id,7);assert.equal(options.returnDocument,'after');writes++;if(fails)throw Error('database failed');Object.assign(saved,update.$set);return {...saved};}},Buffer);
 return{saved,get writes(){return writes;},async call(value=image){const res={code:200,status(n){this.code=n;return this;},json(body){this.body=body;}};await handler({body:{imageUrl:value,providerId:99}},res);return res;}};
}
test('first upload and replacement persist in the authenticated provider without touching other profile fields',async()=>{
 const h=harness();assert.deepEqual((await h.call()).body,{imageUrl:image});assert.equal(h.saved.imageUrl,image);assert.equal(h.saved.hours,'8AM - 9PM');assert.equal(h.saved.location,'Original');
 await h.call('data:image/gif;base64,R0lGODlh');assert.equal(h.saved.imageUrl,'data:image/gif;base64,R0lGODlh');
});
test('unauthorized and invalid images cannot replace the saved background',async()=>{
 const h=harness({authorized:false});await h.call();assert.equal(h.writes,0);
 for(const value of [null,'https://example.com/a.png','data:image/svg+xml;base64,AAAA','data:image/png;base64,AAAA','x'.repeat(8000001)]){const invalid=harness();assert.equal((await invalid.call(value)).code,400);assert.equal(invalid.saved.imageUrl,'previous');}
});
test('database failure does not return success or erase the previous image',async()=>{
 const h=harness({fails:true});await assert.rejects(h.call(),/database failed/);assert.equal(h.saved.imageUrl,'previous');
});
