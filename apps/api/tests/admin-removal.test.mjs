import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness() {
  const providers = [1,2,3].map(id => ({id, name: `Provider ${id}`, active: id !== 2, categories: ['grooming'], services: [], products: []}));
  const users = [
    { id: 'p1', providerId: 1, role: 'provider', isActive: true, email: 'p1@example.test', passwordHash: 'test-hash' },
    { id: 'p2', providerId: 2, role: 'provider', isActive: false, email: 'p2@example.test', passwordHash: 'test-hash' },
    { id: 'c1', role: 'customer', isActive: true },
    { id: 'c2', role: 'customer', isActive: false, removedAt: 'previous' },
  ];
  const sessions = [{userId:'p1'}, {userId:'p2'}, {userId:'c1'}];
  const history = { bookings: [{providerId:1}], records: [{providerId:1}], payments: [{providerId:1}] };
  const matches = (row, filter) => Object.entries(filter).every(([key,value]) => value && typeof value === 'object' ? ('$in' in value ? value.$in.includes(row[key]) : '$ne' in value ? row[key] !== value.$ne : '$exists' in value ? (key in row) === value.$exists : true) : row[key] === value);
  const apply = (row, update) => { const values = Array.isArray(update) ? update[0].$set : update.$set; for (const [key,value] of Object.entries(values ?? {})) row[key] = value && typeof value === 'object' && '$ifNull' in value ? row[value.$ifNull[0].slice(1)] ?? value.$ifNull[1] : value; };
  const collection = rows => ({
    find(filter) { return { sort() { return this; }, async toArray() { return rows.filter(row => matches(row,filter)).map(row=>({...row})); } }; },
    async findOne(filter) { return rows.find(row=>matches(row,filter)) ?? null; },
    async findOneAndUpdate(filter, update) { const row=rows.find(row=>matches(row,filter)); if(!row)return null;apply(row,update);return {...row}; },
    async updateMany(filter,update) { for(const row of rows.filter(row=>matches(row,filter)))apply(row,update); },
    async deleteMany(filter) { for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],filter))rows.splice(i,1); },
  });
  const handlers = new Map(); let admin=true; let loginSessions=0;
  const deps = {
    router: Object.fromEntries(['get','post','patch','delete'].map(method=>[method,(path,fn)=>handlers.set(`${method} ${path}`,fn)])),
    requireAdmin: async(req,res)=>{if(!admin){res.status(403).json({error:'Admin required'});return null;}return {userId:'admin'};},
    providerCollection:collection(providers), userCollection:collection(users), sessionCollection:collection(sessions),
    isValidAccountId:value=>typeof value==='string'&&value.length>0,
    notifyAdmins:async()=>{}, notifyProvider:async()=>{}, statusLabelForLog:value=>value,
    providerInput:(body,existing)=>({...existing}), verifyPassword:async()=>true,
    startSession:async()=>{loginSessions++;}, publicUser:user=>({id:user.id,role:user.role}),
  };
  const install=(a,b,tail='')=>new Function(...Object.keys(deps), compile(source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a))))+tail)(...Object.values(deps));
  deps.removeProviderAccess=install('async function removeProviderAccess(', 'router.delete("/admin/accounts/:userId"', ';return removeProviderAccess;');
  install('router.get("/admin/accounts"', 'async function removeProviderAccess(');
  install('router.delete("/admin/accounts/:userId"', 'router.get("/admin/', '');
  install('router.get("/admin/providers"', 'router.post("/admin/providers"');
  install('router.patch("/admin/providers/:providerId"', 'async function requireProviderModule(');
  install('router.post("/auth/login"', 'router.post("/auth/logout"');
  return {providers,users,sessions,history,setAdmin(value){admin=value;},get loginSessions(){return loginSessions;},async request(method,path,params={},body={}){const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handlers.get(`${method} ${path}`)({params,body},res);return res;}};
}
test('provider removal persists, removes linked accounts/sessions and preserves history', async()=>{
 const api=harness();const historical=JSON.stringify(api.history);
 assert.equal((await api.request('get','/admin/providers')).body.length,3);
 assert.equal((await api.request('get','/admin/accounts')).body.length,2);
 assert.equal((await api.request('delete','/admin/providers/:providerId',{providerId:'1'})).code,200);
 assert.ok(api.providers[0].removedAt); assert.equal(api.providers[0].active,false);
 assert.equal(api.users[0].isActive,false);assert.ok(api.users[0].removedAt);assert.ok(!api.sessions.some(session=>session.userId==='p1'));
 assert.equal((await api.request('get','/admin/providers')).body.length,2);
 assert.equal((await api.request('get','/admin/accounts')).body.length,1);
 assert.equal((await api.request('delete','/admin/providers/:providerId',{providerId:'1'})).code,200);
 assert.equal((await api.request('patch','/admin/providers/:providerId',{providerId:'1'},{active:true})).code,409);
 assert.equal(JSON.stringify(api.history),historical);
 const login=await api.request('post','/auth/login',{}, {email:'p1@example.test',password:'test-password'});assert.equal(login.code,401);assert.equal(api.loginSessions,0);
});
test('account removal synchronizes profile while deactivation remains reversible', async()=>{
 const api=harness();
 assert.equal((await api.request('patch','/admin/providers/:providerId',{providerId:'1'},{active:false})).code,200);
 assert.equal(api.users[0].isActive,false);assert.equal(api.providers[0].removedAt,undefined);
 assert.ok((await api.request('get','/admin/providers')).body.some(p=>p.id===1));
 assert.equal((await api.request('patch','/admin/providers/:providerId',{providerId:'1'},{active:true})).code,200);assert.equal(api.users[0].isActive,true);
 assert.equal((await api.request('delete','/admin/accounts/:userId',{userId:'p1'})).code,200);
 assert.ok(api.providers[0].removedAt);assert.ok(!(await api.request('get','/admin/providers')).body.some(p=>p.id===1));
});
test('missing accounts are flagged, not assumed removed; only admins can remove', async()=>{
 const api=harness();const list=(await api.request('get','/admin/providers')).body;
 assert.equal(list.find(p=>p.id===3).accountState,'missing');assert.equal(list.find(p=>p.id===2).accountState,'inactive');
 assert.equal((await api.request('patch','/admin/providers/:providerId',{providerId:'3'},{active:true})).code,409);
 api.setAdmin(false);assert.equal((await api.request('delete','/admin/providers/:providerId',{providerId:'3'})).code,403);assert.equal(api.providers[2].removedAt,undefined);
});

test('existing provider sessions fail closed after removal or deactivation, even before account cleanup', async()=>{
 const api=harness();
 const body=compile(source.slice(source.indexOf('async function getAccess('),source.indexOf('async function requireAdmin(')));
 const getAccess=new Function('sessionCookie','sessionId','sessionCollection','userCollection','providerCollection',body+';return getAccess;')('session',value=>value,{async findOne(){return {userId:'p1'};}},{async findOne(){return api.users[0];}},{async findOne(filter){return api.providers.find(provider=>provider.id===filter.id&&provider.active!==false&&!provider.removedAt)??null;}});
 const response=()=>({code:200,status(code){this.code=code;return this;},json(){},clearCookie(){}});
 api.providers[0].active=false;
 let res=response();assert.equal(await getAccess({cookies:{session:'test-token'}},res),null);assert.equal(res.code,403);
 api.providers[0].active=true;api.providers[0].removedAt='removed';
 res=response();assert.equal(await getAccess({cookies:{session:'test-token'}},res),null);assert.equal(res.code,403);
});
