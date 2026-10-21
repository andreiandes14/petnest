import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const compile = s => ts.transpileModule(s, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url = s => `data:text/javascript;base64,${Buffer.from(compile(s)).toString('base64')}`;
const city = url(readFileSync(new URL('../../../shared/city-location.ts',import.meta.url),'utf8'));
const {classifyAddressFeatures,nominatimAddressResult,addressSearchQuery,addressSearchQueries} = await import(url(readFileSync(new URL('../../../shared/address-location.ts',import.meta.url),'utf8').replace('"./city-location.js"',JSON.stringify(city))));
const feature = (properties = {}, coordinates = [121.1,14.2]) => ({geometry:{type:'Point',coordinates},properties:{countrycode:'PH',city:'Calamba',state:'Laguna',...properties}});
const body = (...features) => ({features});
const {philippineCityCoordinates} = await import(url(readFileSync(new URL('../../../shared/philippine-city-coordinates.ts',import.meta.url),'utf8')));
const address = '12 National Highway 1, Real, Calamba, Laguna';
test('address detail selects building/street/barangay/city zoom without inventing precision', () => {
  const building=feature({housenumber:'12',street:'National Highway 1'});
  const street=feature({name:'National Highway 1',osm_key:'highway'});
  const area=feature({name:'Real',osm_key:'place',osm_value:'suburb'});
  const city=feature({name:'Calamba',osm_value:'city'});
  for(const [value,accuracy,zoom] of [[building,'building',18],[street,'street',16],[area,'area',14],[city,'city',12]]) {
    assert.deepEqual(classifyAddressFeatures(body(value),address,'Calamba City','Laguna'),{latitude:14.2,longitude:121.1,accuracy,zoom});
  }
  assert.equal(classifyAddressFeatures(body(city,area,street,building),address,'Calamba City','Laguna').accuracy,'building');
  assert.equal(classifyAddressFeatures(body(feature({housenumber:'99',street:'National Highway 1'})),address,'Calamba City','Laguna').accuracy,'street');
});
test('same street in another city/province, foreign and invalid points, unrelated POIs are rejected', () => {
  for(const value of [feature({city:'Santa Rosa',street:'National Highway 1'}),feature({state:'Misamis Occidental',street:'National Highway 1'}),feature({countrycode:'US',street:'National Highway 1'}),feature({street:'National Highway 1'},[NaN,14]),feature({street:'National Highway 1'},[181,14]),feature({name:'Unrelated Store',osm_key:'shop'}),feature({name:'Calamba',osm_key:'shop'})]) {
    assert.equal(classifyAddressFeatures(body(value),address,'Calamba City','Laguna'),null);
  }
  assert.equal(classifyAddressFeatures({},address,'Calamba City','Laguna'),null);
});

const routes=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
const start=routes.indexOf('router.post("/provider/location/resolve"');
const route=compile(routes.slice(start,routes.indexOf('router.patch("/provider/profile"',start)));
function harness({authorized=true,busy=false,endpoint,status=200,responses}={}) {
  let handler,fetches=0; const entries=new Map(),writes=[],queries=[],waits=[];
  const database={collection(name){return {
    async findOne({_id}) {return entries.get(_id);},
    async findOneAndUpdate(){if(busy)throw new Error('locked');},
    async updateOne({_id},{$set}){writes.push(name);if(name==='shopAddressGeocodingCache')entries.set(_id,$set);},
  };}};
  new Function('router','requireProvider','findPhilippineLocation','process','database','createHash','fetch','nominatimAddressResult','addressSearchQueries','philippineCityCoordinates','setTimeout',route)(
    {post(_path,fn){handler=fn;}},async()=>authorized?{providerId:1}:null,
    (city,province)=>city==='Calamba City'&&province==='Laguna'?{name:city,province,code:'0403405000'}:null,
    {env:{...(endpoint?{ADDRESS_GEOCODING_URL:endpoint}:{})}},database,createHash,
    async(url,options)=>{
      fetches++;queries.push(url.searchParams.get('q'));
      assert.equal(url.searchParams.get('countrycodes'),'ph');
      assert.ok(url.searchParams.get('q').includes('Laguna'));
      assert.ok(options.signal);assert.ok(options.headers['User-Agent'].startsWith('PetNest-'));
      assert.equal(url.searchParams.get('format'),'jsonv2');assert.equal(url.searchParams.get('addressdetails'),'1');
      return {ok:status===200,json:async()=>responses?responses[Math.min(fetches-1,responses.length-1)]:[nominatimHouse()]};
    },nominatimAddressResult,addressSearchQueries,philippineCityCoordinates,(fn,ms)=>{waits.push(ms);fn();return 0;});

  return {get fetches(){return fetches;},writes,queries,waits,async call(input={address,city:'Calamba City',province:'Laguna'}){const response={code:200,status(n){this.code=n;return this;},setHeader(){},json(value){this.body=value;}};await handler({body:input},response);return response;}};
}
test('authenticated lookup caches results, constrains city/province, and never writes provider coordinates',async()=>{
  const h=harness();assert.equal((await h.call()).body.result.accuracy,'building');await h.call();assert.equal(h.fetches,1);
  assert.ok(h.writes.every(name=>['shopAddressGeocodingCache','shopGeocodingLimits'].includes(name)));
  assert.equal((await h.call({address,city:'Unknown'})).code,400);
  const unauthorized=harness({authorized:false});await unauthorized.call();assert.equal(unauthorized.fetches,0);
});
test('rate limits and service errors preserve data; free Nominatim requires no keys',async()=>{
  const busy=harness({busy:true});assert.equal((await busy.call()).code,429);assert.equal(busy.fetches,0);
  const unavailable=harness({status:503});const fallback=await unavailable.call();assert.equal(fallback.code,200);assert.equal(fallback.body.result.accuracy,'city');assert.equal(fallback.body.unavailable,true);
  const free=harness();assert.equal((await free.call()).code,200);
});


test('the screenshot full address reaches the geocoder unchanged, with no redundant locality suffixes', () => {
  const full='4027 National Highway 1, Real, Calamba, 4027 Laguna, Philippines';
  assert.equal(addressSearchQuery(full,'Calamba City','Laguna'),full);
  assert.equal(addressSearchQuery('12 National Highway 1','Calamba City','Laguna'),'12 National Highway 1, calamba, Laguna, Philippines');
});


function nominatimHouse(overrides={}) {
  return {lat:'14.2',lon:'121.1',name:'12',category:'place',addresstype:'house',address:{
    country_code:'ph',city:'Calamba',state:'Laguna',road:'National Highway 1',house_number:'12',
  },...overrides};
}
test('Nominatim matches address precision while rejecting unrelated cities, foreign and invalid results',()=>{
  assert.equal(nominatimAddressResult([nominatimHouse()],address,'Calamba City','Laguna').accuracy,'building');
  assert.equal(nominatimAddressResult([nominatimHouse({addresstype:'road',category:'highway',name:'National Highway 1',address:{country_code:'ph',city:'Calamba',state:'Laguna'}})],address,'Calamba City','Laguna').zoom,16);
  for(const result of [nominatimHouse({lat:'NaN'}),nominatimHouse({lat:''}),nominatimHouse({address:{country_code:'ph',city:'Santa Rosa',state:'Laguna'}}),nominatimHouse({address:{country_code:'us',city:'Calamba',state:'Laguna'}})]) assert.equal(nominatimAddressResult([result],address,'Calamba City','Laguna'),null);
  assert.equal(nominatimAddressResult([],address,'Calamba City','Laguna'),null);
});


test('Palingon abbreviations and omitted commas produce full, barangay and city queries in order',()=>{
 const queries=addressSearchQueries('6270 Brgy. Palingon Calamba Laguna','Calamba City','Laguna');
 assert.deepEqual(queries,['6270 Barangay Palingon, Calamba, Laguna, Philippines','Barangay Palingon, calamba, Laguna, Philippines','Calamba City, Laguna, Philippines']);
 const result=nominatimAddressResult([{lat:'14.2142937',lon:'121.1846066',name:'Bulwagang Pambarangay ng Palingon',category:'amenity',addresstype:'amenity',address:{country_code:'ph',quarter:'Palingon',road:'Lingga Road',city:'Calamba',state:'Laguna'}}],queries[0],'Calamba City','Laguna');
 assert.equal(result.accuracy,'area');assert.equal(result.zoom,14);
 assert.equal(nominatimAddressResult([{lat:'14.2157362',lon:'121.1825384',name:'Lingga Road',category:'highway',addresstype:'tertiary',address:{country_code:'ph',quarter:'Lingga',road:'Lingga Road',city:'Calamba',state:'Laguna'}}],queries[0],'Calamba City','Laguna'),null);
});


test('actual route broadens Palingon lookup, respects upstream request gaps, caches the result and never writes provider data',async()=>{
 const wrong={lat:'14.2157362',lon:'121.1825384',name:'Lingga Road',category:'highway',addresstype:'tertiary',address:{country_code:'ph',quarter:'Lingga',road:'Lingga Road',city:'Calamba',state:'Laguna'}};
 const area={lat:'14.2142937',lon:'121.1846066',name:'Bulwagang Pambarangay ng Palingon',category:'amenity',addresstype:'amenity',address:{country_code:'ph',quarter:'Palingon',road:'Lingga Road',city:'Calamba',state:'Laguna'}};
 const h=harness({responses:[[wrong],[area]]});const input={address:'6270 Brgy. Palingon Calamba Laguna',city:'Calamba City',province:'Laguna'};
 const reply=await h.call(input);assert.equal(reply.body.result.accuracy,'area');assert.equal(h.fetches,2);
 assert.equal(h.queries[1],'Barangay Palingon, calamba, Laguna, Philippines');assert.deepEqual(h.waits,[1200]);
 await h.call(input);assert.equal(h.fetches,2);assert.ok(h.writes.every(name=>name!=='providers'));
});
