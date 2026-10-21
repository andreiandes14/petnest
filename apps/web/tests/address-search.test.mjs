import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/lib/address-search.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {scheduleAddressSearch}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function clock(){let id=0;const queue=new Map();return {setTimeout(fn,delay){queue.set(++id,{fn,delay});return id;},clearTimeout(id){queue.delete(id);},get size(){return queue.size;},async next(){const [id,event]=queue.entries().next().value;queue.delete(id);await event.fn();return event.delay;}};}
test('explicit searches abort obsolete lookups and reject late replies after manual pin placement',async()=>{
  const timers=clock(),results=[];let calls=0,release,signal;
  const request=s=>{signal=s;calls++;return new Promise(resolve=>release=resolve);};
  const cancel=scheduleAddressSearch(request,value=>results.push(value),()=>assert.fail(),()=>{},timers);
  cancel();assert.equal(timers.size,0);assert.equal(calls,0);
  const stop=scheduleAddressSearch(request,value=>results.push(value),()=>assert.fail(),()=>{},timers);
  const pending=timers.next();assert.equal(calls,1);stop();assert.equal(signal.aborted,true);
  release({result:{latitude:14,longitude:121,accuracy:'street',zoom:16}});await pending;assert.equal(results.length,0);
});
test('shared rate limits retry with backoff, settle once, and outages preserve the existing pin',async()=>{
  const timers=clock(),results=[];let calls=0,settled=0,failed=0;
  scheduleAddressSearch(async()=>{if(++calls<3)throw {status:429};return {result:null};},v=>results.push(v),()=>failed++,()=>settled++,timers);
  assert.equal(await timers.next(),0);assert.equal(await timers.next(),2000);assert.equal(await timers.next(),4000);
  assert.deepEqual(results,[null]);assert.equal(settled,1);assert.equal(failed,0);
  scheduleAddressSearch(async()=>{throw new Error('offline');},()=>assert.fail(),()=>failed++,()=>settled++,timers);
  await timers.next();assert.equal(failed,1);assert.equal(settled,2);
});

const mapSource=readFileSync(new URL('../src/components/shop-pin-map.tsx',import.meta.url),'utf8');
const mapCode=ts.transpileModule(mapSource.slice(mapSource.indexOf('export function ShopPinMap')).replace('export function','function').replace('import.meta.env.VITE_MAP_TILE_URL','""'),{fileName:'map.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
function mapHarness(props) {
  const effects=[],views=[],events={},pinEvents={};let refs=0,selected;
  const map={setView:(point,zoom)=>views.push({point,zoom}),on:(name,fn)=>events[name]=fn,remove(){},invalidateSize(){}};
  const marker={addTo(){return marker;},on:(name,fn)=>pinEvents[name]=fn,setLatLng(){},remove(){},getLatLng:()=>({wrap:()=>({lat:14.25,lng:121.15})}),dragging:{enable(){},disable(){}}};
  const layer={on(){return layer;},addTo(){return layer;}};
  const deps={React:{createElement(){},Fragment:'fragment'},useRef(value){return {current:refs++===0?{}:value};},useState(v){return [v,()=>{}];},useEffect(fn){effects.push(fn);},L:{map:()=>map,tileLayer:()=>layer,marker:()=>marker,divIcon(){}},ResizeObserver:class{observe(){}disconnect(){}}};
  const Component=new Function(...Object.keys(deps),mapCode+';return ShopPinMap;')(...Object.values(deps));
  Component({...props,disabled:false,onSelect:point=>selected=point});const cleanup=effects[0]();effects[1]();effects[2]();
  return {views,cleanup,drag(){pinEvents.dragend();return selected;}};
}
test('actual Leaflet component restores saved shop zoom ahead of city center and uses lookup precision',()=>{
  const pin={latitude:14.2,longitude:121.1},center={latitude:14,longitude:121};
  const saved=mapHarness({pin,center});assert.deepEqual(saved.views.at(-1),{point:[14.2,121.1],zoom:17});
  assert.deepEqual(saved.drag(),{latitude:14.25,longitude:121.15});saved.cleanup();
  const address=mapHarness({pin,center,focus:{latitude:14.3,longitude:121.2,zoom:18}});assert.deepEqual(address.views.at(-1),{point:[14.3,121.2],zoom:18});address.cleanup();
});
