import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../../shared/business-hours.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parseBusinessHours, bookingDuration, businessTimeOptions, savedBusinessTimes, selectedBusinessHours } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('common clock formats normalize without changing hours', () => {
  for (const value of ['8AM - 9PM', '8:00 AM - 9:00 PM', '08:00-21:00']) {
    const hours = parseBusinessHours(value);
    assert.equal(hours.open, 480); assert.equal(hours.close, 1260);
    assert.equal(hours.normalized, '08:00-21:00'); assert.equal(hours.workingDays.size, 7);
    assert.deepEqual(parseBusinessHours(hours.normalized), hours);
  }
  assert.equal(parseBusinessHours('9AM-6PM').close, 1080);
  assert.equal(parseBusinessHours('10:30 AM - 7:30 PM').open, 630);
  assert.equal(parseBusinessHours('12AM-12PM').open, 0);
  assert.equal(parseBusinessHours('12AM-12PM').close, 720);
});
test('working day ranges, overnight-week ranges and explicit lists stay accurate', () => {
  assert.deepEqual([...parseBusinessHours('Mon-Sat 9AM-5PM').workingDays], [1,2,3,4,5,6]);
  assert.deepEqual([...parseBusinessHours('Tue\u2013Sun \u00b7 10:00 AM\u20138:00 PM').workingDays], [2,3,4,5,6,0]);
  assert.deepEqual([...parseBusinessHours('Mon, Wed, Fri 9AM-5PM').workingDays], [1,3,5]);
  assert.deepEqual([...parseBusinessHours('Sunday 9AM-5PM').workingDays], [0]);
});
test('unconfigured and malformed hours fail closed instead of guessing a range', () => {
  for (const value of ['', '8-9', '13AM-9PM', '8:90AM-9PM', '9PM-8AM', '9AM-9AM', '9AM-5PM garbage', '9AM-12PM and 1PM-5PM', 'Mon-Tue-Wed 8AM-9PM', '8AM until 9PM', 'Unknown 8AM-9PM']) assert.equal(parseBusinessHours(value), null, value);
});
test('only missing duration uses the existing 30-minute rule', () => {
  assert.equal(bookingDuration(undefined), 30); assert.equal(bookingDuration(null), 30);
  assert.equal(bookingDuration(90), 90);
  for (const value of [0,-30,NaN,Infinity,1.5]) assert.equal(bookingDuration(value), null);
});

test('time selectors cover every half-hour with readable labels', () => {
  assert.equal(businessTimeOptions.length, 48);
  assert.deepEqual(businessTimeOptions[0], { value: '00:00', label: '12:00 AM' });
  assert.deepEqual(businessTimeOptions[47], { value: '23:30', label: '11:30 PM' });
  assert.equal(businessTimeOptions[16].label, '8:00 AM');
});
test('saved selectors preserve old hours and weekdays, and reject incomplete/invalid ranges', () => {
  assert.deepEqual(savedBusinessTimes('8AM - 9PM'), { opening: '08:00', closing: '21:00' });
  assert.deepEqual(savedBusinessTimes('Mon-Sat 10:15 AM-6PM'), { opening: '10:15', closing: '18:00' });
  const normalized = selectedBusinessHours('10:00', '18:00', 'Mon-Sat 8AM-9PM');
  assert.equal(parseBusinessHours(normalized).workingDays.has(0), false);
  assert.equal(parseBusinessHours(normalized).open, 600);
  assert.equal(parseBusinessHours(normalized).close, 1080);
  for (const [opening, closing] of [['', '18:00'], ['08:00', ''], ['18:00', '08:00'], ['08:00', '08:00'], ['24:00', '25:00']]) assert.equal(selectedBusinessHours(opening, closing, ''), null);
});


test('24-hour schedule retains custom hours and working days and includes all 48 start times', () => {
  const hours='Mon-Sat 09:00-17:00';
  const allDay=parseBusinessHours(hours,true);
  assert.equal(allDay.open,0);assert.equal(allDay.close,1440);assert.equal(allDay.normalized,hours);
  assert.equal(allDay.workingDays.has(0),false);
  const slots=[];for(let minute=allDay.open;minute<=allDay.close-30;minute+=30)slots.push(minute);
  assert.equal(slots.length,48);assert.equal(slots[0],0);assert.equal(slots.at(-1),1410);
  assert.equal(parseBusinessHours(hours).close,1020);
  assert.equal(parseBusinessHours('',true).workingDays.size,7);
});

test('actual availability route exposes overnight slots but preserves closures, conflicts and custom cutoff',async()=>{
 const routeSource=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
 const start=routeSource.indexOf('router.get("/providers/:providerId/availability"');
 const route=ts.transpileModule(routeSource.slice(start,routeSource.indexOf('router.get("/services"',start)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 async function run(open24,closed=false){
  let handler;
  const provider={id:1,hours:'Mon-Sat 09:00-17:00',isOpen24Hours:open24,operatingDays:[1,2,3,4,5,6],categories:['grooming'],services:[{id:1,name:'Bath',category:'grooming',available:true,durationMinutes:30}]};
  const deps={router:{get(path,fn){handler=fn;}},providerCollection:{findOne:async()=>provider},providerSchedule:(hours,flag,days)=>parseBusinessHours(hours,flag,days??[0,1,2,3,4,5,6]),bookingDuration,shopClosed:()=>closed,manilaNow:()=>({date:'2026-10-01',minutes:0}),
   bookingCollection:{find(){return{project(){return{toArray:async()=>[{date:'2026-10-02',time:'01:00',serviceName:'Bath',serviceCategory:'grooming'}]};}};}},
   timeToMinutes:value=>Number(value.slice(0,2))*60+Number(value.slice(3)),minutesToTime:value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')};
  new Function(...Object.keys(deps),route)(...Object.values(deps));
  const res={code:200,status(value){this.code=value;return this;},json(value){this.body=value;}};
  await handler({params:{providerId:'1'},query:{serviceId:'1',month:'2026-10'}},res);return res;
 }
 const allDay=await run(true);assert.ok(allDay.body.dates['2026-10-02'].includes('00:00'));assert.ok(allDay.body.dates['2026-10-02'].includes('23:30'));assert.ok(!allDay.body.dates['2026-10-02'].includes('01:00'));assert.deepEqual(allDay.body.dates['2026-10-04'],[]);
 const custom=await run(false);assert.equal(custom.body.dates['2026-10-02'].at(-1),'16:30');assert.ok(!custom.body.dates['2026-10-02'].includes('00:00'));
 assert.equal((await run(true,true)).code,409);
});


test('direct booking validation rejects a closed weekday and permits an operating day at 23:30',()=>{
 const src=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
 const start=src.indexOf('  const requestedWeekday =');
 const snippet=ts.transpileModule(src.slice(start,src.indexOf('  if (parsed.data.recordId',start)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const check=new Function('parsed','schedule','requestedStart','res',snippet+';return "accepted";');
 const schedule=parseBusinessHours('09:00-17:00',true,[1,2,3,4,5,6]);
 const res={status(code){this.code=code;return this;},json(){}};
 check({data:{date:'2026-10-25'}},schedule,1410,res);assert.equal(res.code,409);
 assert.equal(check({data:{date:'2026-10-26'}},schedule,1410,res),'accepted');
});
