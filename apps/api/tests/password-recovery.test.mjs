import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {registerPasswordRecovery,normalizeSecurityAnswer,validSecurityAnswer}=await import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('../src/lib/password-recovery.ts',import.meta.url),'utf8'))).toString('base64')}`);
const routesSource=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
const hashCode=compile(routesSource.slice(routesSource.indexOf('async function hashPassword('),routesSource.indexOf('function sessionId(')));
const {hashPassword,verifyPassword}=new Function('randomBytes','scrypt','Buffer','timingSafeEqual',hashCode+';return {hashPassword,verifyPassword};')(randomBytes,promisify(scryptCallback),Buffer,timingSafeEqual);
function match(row,filter){return Object.entries(filter).every(([key,value])=>{
 const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof Date))return Object.entries(value).every(([op,v])=>op==='$exists'?(actual!==undefined)===v:op==='$ne'?actual!==v:op==='$in'?v.includes(actual):op==='$lte'?actual<=v:false);return actual===value;
});}
async function fixture({legacy=false,role='customer'}={}){
 const rows={users:[{id:'user',email:'person@example.test',role,passwordHash:await hashPassword('old-password'),...(!legacy?{securityAnswerHash:await hashPassword(normalizeSecurityAnswer('Alice'))}: {})}],sessions:[{userId:'user'}]},handlers={};
 const database={collection(name){const list=rows[name]??=[];return {
 async findOne(filter){return structuredClone(list.find(row=>match(row,filter))??null);},
 async updateOne(filter,update,opts={}){let row=list.find(row=>match(row,filter));if(!row&&opts.upsert){row={...filter,...update.$setOnInsert};list.push(row);}if(!row)return{modifiedCount:0,matchedCount:0};Object.assign(row,update.$set);for(const [key,n]of Object.entries(update.$inc??{}))row[key]=(row[key]??0)+n;return{modifiedCount:1,matchedCount:1};},
 async findOneAndUpdate(filter,update,opts={}){let row=list.find(row=>match(row,filter));if(!row&&opts.upsert){row={...filter};list.push(row);}if(!row)return null;Object.assign(row,update.$set);for(const [key,n]of Object.entries(update.$inc??{}))row[key]=(row[key]??0)+n;return structuredClone(row);},
 async deleteMany(filter){for(let i=list.length-1;i>=0;i--)if(match(list[i],filter))list.splice(i,1);}
 };}};
 registerPasswordRecovery({post(path,handler){handlers[path]=handler;}},database,async()=>({userId:'user',role}),{hashPassword,verifyPassword,secret:'synthetic-test-secret'});
 return{rows,async call(action,body){const response={code:200,status(code){this.code=code;return this;},json(body){this.body=body;}};await handlers['/auth/'+action]({body,ip:'127.0.0.1',socket:{}},response);return response;}};
}
const body={email:'person@example.test',answer:'  aLiCe  ',newPassword:'new-password'};
test('case-insensitive answer resets directly, changes password and invalidates sessions without email configuration',async()=>{
 const f=await fixture();const result=await f.call('password-recovery/reset',body);assert.equal(result.code,200);assert.equal(result.body.message,'Password reset successfully. You can now log in.');
 assert.ok(await verifyPassword('new-password',f.rows.users[0].passwordHash));assert.equal(await verifyPassword('old-password',f.rows.users[0].passwordHash),false);assert.equal(f.rows.sessions.length,0);assert.ok(f.rows.users[0].passwordChangedAt);
 assert.equal(Object.keys(f.rows).some(name=>/token/i.test(name)),false);
});
test('five failures lock recovery for one hour, persist across requests, then expire',async()=>{
 const f=await fixture();for(let n=0;n<5;n++)assert.equal((await f.call('password-recovery/reset',{...body,answer:'wrong'})).code,400);
 const gate=f.rows.passwordRecoveryLimits[0];assert.equal(gate.failures,5);assert.ok(gate.lockedUntil.getTime()>Date.now()+3590000);assert.equal((await f.call('password-recovery/reset',body)).code,400);
 assert.ok(await verifyPassword('old-password',f.rows.users[0].passwordHash));gate.lockedUntil=new Date(0);gate.windowUntil=new Date(0);
 assert.equal((await f.call('password-recovery/reset',body)).code,200);
});
test('unknown, incorrect, inactive and unenrolled accounts have the same generic failure and never reset',async()=>{
 const f=await fixture();const unknown=await f.call('password-recovery/reset',{...body,email:'unknown@example.test'});const wrong=await f.call('password-recovery/reset',{...body,answer:'wrong'});assert.deepEqual(unknown.body,wrong.body);
 for(const options of [{legacy:true},{role:'admin'}]){const h=await fixture(options);const result=await h.call('password-recovery/reset',body);assert.deepEqual(result.body,wrong.body);assert.ok(await verifyPassword('old-password',h.rows.users[0].passwordHash));}
 f.rows.users[0].isActive=false;assert.deepEqual((await f.call('password-recovery/reset',body)).body,wrong.body);
});
test('provider recovery uses the same answer checks; enrollment requires the current password',async()=>{
 const f=await fixture({role:'provider'});assert.equal((await f.call('password-recovery/reset',body)).code,200);
 assert.equal((await f.call('security-question',{currentPassword:'wrong',answer:'Bob'})).code,400);
 assert.equal((await f.call('security-question',{currentPassword:'new-password',answer:' Bob '})).code,200);assert.ok(await verifyPassword('bob',f.rows.users[0].securityAnswerHash));
});
test('parallel submissions cannot both reset and IP throttling rejects excessive requests',async()=>{
 const f=await fixture();const results=await Promise.all([f.call('password-recovery/reset',body),f.call('password-recovery/reset',body)]);assert.deepEqual(results.map(r=>r.code).sort(),[200,400]);
 f.rows.passwordRecoveryIpLimits[0].count=30;assert.equal((await f.call('password-recovery/reset',body)).code,400);
});
test('answers reject blank/oversized values and invalid new passwords cannot mutate accounts',async()=>{
 assert.equal(normalizeSecurityAnswer('  ALICE  '),'alice');assert.equal(validSecurityAnswer('   '),false);assert.equal(validSecurityAnswer('a'.repeat(201)),false);
 const f=await fixture();for(const newPassword of ['short','x'.repeat(1025)])assert.equal((await f.call('password-recovery/reset',{...body,newPassword})).code,400);assert.ok(await verifyPassword('old-password',f.rows.users[0].passwordHash));
});
const publicCode=compile(routesSource.slice(routesSource.indexOf('function publicUser('),routesSource.indexOf('async function hashPassword(')));
const publicUser=new Function(publicCode+';return publicUser;')();
test('registration requires a security answer and never returns its hash in public account data',async()=>{
 const registerCode=compile(routesSource.slice(routesSource.indexOf('async function register('),routesSource.indexOf('router.post("/auth/register"')));
 let stored;
 const deps={randomUUID:()=> 'registered',hashPassword,normalizeSecurityAnswer,validSecurityAnswer,publicUser,userCollection:{findOne:async()=>null,insertOne:async user=>stored=user,deleteOne:async()=>{}},sessionCollection:{deleteMany:async()=>{}},startSession:async()=>{},notifyAdmins:async()=>{}};
 const register=new Function(...Object.keys(deps),registerCode+';return register;')(...Object.values(deps));
 const res=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;}});
 for(const securityAnswer of [undefined,'','   ']){const response=res();await register({body:{name:'Customer',email:'person@example.test',password:'password',securityAnswer}},response);assert.equal(response.code,400);}
 const response=res();await register({body:{name:'Customer',email:'person@example.test',password:'password',securityAnswer:'  ALICE '}},response);assert.equal(response.code,201);assert.match(stored.securityAnswerHash,/^scrypt\$/);assert.ok(await verifyPassword('alice',stored.securityAnswerHash));assert.equal('securityAnswerHash' in response.body.user,false);assert.equal('passwordHash' in response.body.user,false);
});

test('password-change timestamp invalidates previously issued sessions even if session cleanup is interrupted',async()=>{
 const start=routesSource.indexOf('async function getAccess(');
 const code=compile(routesSource.slice(start,routesSource.indexOf('async function requireAdmin(',start)));
 const now=Date.now(), session={userId:'user',expiresAt:new Date(now+12*3600000-1000)};
 const deps={sessionCookie:'session',sessionId:()=> 'id',sessionLifetimeMs:12*3600000,sessionCollection:{findOne:async()=>session},userCollection:{findOne:async()=>({id:'user',role:'customer',passwordChangedAt:new Date(now).toISOString()})},providerCollection:{}};
 const access=new Function(...Object.keys(deps),code+';return getAccess;')(...Object.values(deps));
 const response={status(n){this.code=n;return this;},json(){},clearCookie(){}};
 assert.equal(await access({cookies:{session:'opaque'}},response),null);assert.equal(response.code,401);
 session.expiresAt=new Date(now+12*3600000+1000);assert.equal((await access({cookies:{session:'new'}},response)).userId,'user');
});
