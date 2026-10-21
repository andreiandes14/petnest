import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>`data:text/javascript;base64,${Buffer.from(compile(s)).toString('base64')}`;
const cityUrl=url(readFileSync(new URL('../../../shared/city-location.ts',import.meta.url),'utf8'));
const city=await import(cityUrl);
const data=url(readFileSync(new URL('../../../shared/philippine-locations-data.ts',import.meta.url),'utf8'));
const nationwide=await import(url(readFileSync(new URL('../../../shared/philippine-locations.ts',import.meta.url),'utf8').replace('"./city-location.js"',JSON.stringify(cityUrl)).replace('"./philippine-locations-data.js"',JSON.stringify(data))));
const {philippineCityCoordinates}=await import(url(readFileSync(new URL('../../../shared/philippine-city-coordinates.ts',import.meta.url),'utf8')));
const source=readFileSync(new URL('../src/components/shop-location.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source.slice(source.indexOf('export function BusinessLocation')).replace('export function','function').replace('import.meta.env.BASE_URL','"/"'),{fileName:'location.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const fullAddress='4027 National Highway 1, Real, Calamba, 4027 Laguna, Philippines';
function harness(profile={}) {
  const cells=[],jobs=[],saves=[],requests=[];let cursor=0,pending=[],tree;
  const props={provider:{id:1,location:fullAddress,locationCity:'Calamba City',locationProvince:'Laguna',locationAccuracy:'city',latitude:null,longitude:null,...profile},saving:false,save:async p=>{saves.push(p);}};
  const deps={
    ...city,...nationwide,philippineCityCoordinates,
    React:{Fragment:'fragment',createElement:(type,props,...children)=>({type,props:{...props,children}})},
    useState(value){const i=cursor++;if(!(i in cells))cells[i]=typeof value==='function'?value():value;return [cells[i],next=>{cells[i]=typeof next==='function'?next(cells[i]):next;}];},
    useRef(value){const i=cursor++;return cells[i]??=( {current:value} );},
    useEffect(effect,deps){const i=cursor++,prior=cells[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j]))){pending.push(()=>{prior?.cleanup?.();cells[i]={deps,cleanup:effect()};});}},
    apiRequest:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return {result:null};},
    scheduleAddressSearch(request,result,failure,settled){const job={request,result,failure,settled,cancelled:false};jobs.push(job);return ()=>{job.cancelled=true;};},
    validCoordinates:p=>typeof p.latitude==='number'&&Number.isFinite(p.latitude)&&typeof p.longitude==='number'&&Number.isFinite(p.longitude),
    ShopPinMap:function ShopPinMap(){},window:{confirm:()=>true},
  };
  const Component=new Function(...Object.keys(deps),code+';return BusinessLocation;')(...Object.values(deps));
  function render(){cursor=0;pending=[];tree=Component(props);const effects=pending;pending=[];effects.forEach(fn=>fn());}
  function elements(node=tree){if(!node||typeof node!=='object')return [];return [node,...(node.props?.children??[]).flat(Infinity).flatMap(elements)];}
  render();render();
  return {props,jobs,saves,requests,render,map:()=>elements().find(n=>typeof n.type==='function'&&n.type.name==='ShopPinMap').props,
    input:()=>elements().find(n=>n.type==='textarea').props,
    search:()=>elements().find(n=>n.type==='button'&&n.props.className.includes('btn-secondary')).props.onClick(),
    save:()=>elements().find(n=>n.type==='button'&&n.props.className.includes('btn-primary')).props.onClick(),
    text:()=>JSON.stringify(tree),
  };
}
test('precise full-address lookup and marker survive a background city-center/profile refresh',async()=>{
  const h=harness();assert.equal(h.jobs.length,0);h.search();h.render();assert.equal(h.saves.length,0,'location lookup must not trigger background profile writes');
  await h.jobs[0].request(new AbortController().signal);assert.equal(h.requests[0].body.address,fullAddress);
  const precise={latitude:14.21,longitude:121.16,accuracy:'building',zoom:18};
  h.jobs[0].result(precise);h.jobs[0].settled();h.render();assert.deepEqual(h.map().focus,precise);
  h.props.provider={...h.props.provider,latitude:14.2,longitude:121.1,cityLatitude:14.2,cityLongitude:121.1};h.render();h.render();
  assert.deepEqual(h.map().focus,precise);assert.deepEqual(h.map().pin,{latitude:14.21,longitude:121.16});
});
test('manual pin cancels late searches, survives profile refresh, and saves the selected coordinates',async()=>{
  const h=harness();h.search();h.render();const manual={latitude:14.22,longitude:121.17};
  h.map().onSelect(manual);h.render();assert.equal(h.jobs[0].cancelled,true);
  h.jobs[0].result({latitude:14,longitude:121,accuracy:'city',zoom:12});h.render();assert.deepEqual(h.map().pin,manual);
  h.props.provider={...h.props.provider,latitude:14.2,longitude:121.1};h.render();h.render();assert.deepEqual(h.map().pin,manual);
  await h.save();assert.equal(h.saves[0].shopPinSelected,true);assert.equal(h.saves[0].latitude,manual.latitude);assert.equal(h.saves[0].longitude,manual.longitude);
  const refreshed=harness({...h.saves[0],locationAccuracy:'shop'});assert.deepEqual(refreshed.map().pin,manual);assert.equal(refreshed.jobs.length,0);
});
test('city-only and failed lookup display the exact requested warning; edits survive profile refresh',()=>{
  const h=harness();h.search();h.render();h.jobs[0].result({latitude:14.2,longitude:121.1,accuracy:'city',zoom:12});h.jobs[0].settled();h.render();
  assert.match(h.text(),/Exact address not found\. Please adjust the pin to your shop's location\./);
  h.input().onChange({target:{value:'New street, Calamba, Laguna'}});h.render();
  h.props.provider={...h.props.provider,latitude:14.25,longitude:121.15};h.render();h.render();assert.equal(h.input().value,'New street, Calamba, Laguna');
  assert.equal(h.jobs.length,1);h.search();h.render();
  h.jobs.at(-1).failure();h.jobs.at(-1).settled();h.render();assert.match(h.text(),/Exact address not found/);
});


test('opening or typing never geocodes; the Search Address button starts a lookup',()=>{
 const h=harness();assert.equal(h.jobs.length,0);
 h.input().onChange({target:{value:'New street, Calamba, Laguna'}});h.render();assert.equal(h.jobs.length,0);
 h.search();h.render();assert.equal(h.jobs.length,1);
 h.input().onChange({target:{value:'Another street, Calamba, Laguna'}});h.render();assert.equal(h.jobs[0].cancelled,true);assert.equal(h.jobs.length,1);
});


test('all selectable Philippine cities have sourced offline coordinates; Calamba never needs a world fallback',()=>{
 assert.equal(Object.keys(philippineCityCoordinates).length,nationwide.philippineLocations.length);
 for(const city of nationwide.philippineLocations){const point=philippineCityCoordinates[city.code];assert.ok(Number.isFinite(point.latitude)&&Math.abs(point.latitude)<=90);assert.ok(Number.isFinite(point.longitude)&&Math.abs(point.longitude)<=180);}
 const h=harness();assert.deepEqual(h.map().center,philippineCityCoordinates['0403405000']);
 h.input().onChange({target:{value:'6270 Brgy. Palingon Calamba Laguna'}});h.render();
 assert.deepEqual(h.map().center,philippineCityCoordinates['0403405000']);
 h.search();h.render();h.jobs[0].failure();h.jobs[0].settled();h.render();assert.deepEqual(h.map().center,philippineCityCoordinates['0403405000']);
 assert.equal(h.map().pin,null,'city overview must not invent a shop pin');
});

test('city-only search focuses the map without creating an exact shop marker',()=>{
 const h=harness();h.search();h.render();
 const result={...philippineCityCoordinates['0403405000'],accuracy:'city',zoom:12};h.jobs[0].result(result);h.jobs[0].settled();h.render();
 assert.deepEqual(h.map().focus,result);assert.equal(h.map().pin,null);
 h.map().onSelect({latitude:14.21,longitude:121.18});h.render();assert.deepEqual(h.map().pin,{latitude:14.21,longitude:121.18});
});
