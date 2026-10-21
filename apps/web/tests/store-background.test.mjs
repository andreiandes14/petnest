import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const start=source.indexOf('  const saveBackground = async');
const code=ts.transpileModule(source.slice(start,source.indexOf('  const [',start)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(fails=false){
 let resolve,requests=0,draft={imageUrl:'old'},cache={imageUrl:'old'},open=true,busy=false,notice='',error='';
 const pending=new Promise(r=>resolve=r);
 const deps={backgroundRequest:{current:false},setBackgroundSaving:v=>busy=v,setBackgroundError:v=>error=v,
 adminRequest:async(path,opts)=>{requests++;await pending;if(fails)throw Error('offline');return {imageUrl:JSON.parse(opts.body).imageUrl};},
 setDraft:fn=>draft=fn(draft),queryClient:{cancelQueries:async()=>{},setQueryData:(key,fn)=>cache=fn(cache),invalidateQueries:async()=>{}},
 getListProvidersQueryKey:()=>['providers'],getGetProviderQueryKey:id=>['provider',id],query:{data:{id:7}},setNotice:v=>notice=v,setShowBackgroundForm:v=>open=v};
 const save=new Function(...Object.keys(deps),code+';return saveBackground;')(...Object.values(deps));
 return{save,resolve,state:()=>({requests,draft,cache,open,busy,notice,error})};
}
test('slow first upload awaits persistence, rejects repeated submissions and updates saved cache once',async()=>{
 const h=harness();const saving=h.save('cropped-image');await h.save('duplicate');assert.equal(h.state().requests,1);assert.equal(h.state().open,true);assert.equal(h.state().busy,true);assert.equal(h.state().draft.imageUrl,'old');
 h.resolve();await saving;assert.equal(h.state().draft.imageUrl,'cropped-image');assert.equal(h.state().cache.imageUrl,'cropped-image');assert.equal(h.state().open,false);assert.equal(h.state().notice,'Store background uploaded successfully.');
});
test('failed replacement preserves saved image and leaves dialog open to retry',async()=>{
 const h=harness(true);const saving=h.save('cropped-image');h.resolve();await assert.rejects(saving,/Failed to upload store background/);assert.equal(h.state().draft.imageUrl,'old');assert.equal(h.state().cache.imageUrl,'old');assert.equal(h.state().open,true);assert.equal(h.state().busy,false);assert.equal(h.state().notice,'');
});
