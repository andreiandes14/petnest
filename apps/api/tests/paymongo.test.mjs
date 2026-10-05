import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/paymongo.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createOrderCheckout, processPaidWebhook, verifyPaymongoSignature, orderLineItems, checkoutEligible, paymentWebUrl, deliverPaymentNotifications } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
// Synthetic fixtures only. Never load .env, call PayMongo, or touch the real database in these tests.
const config = { secretKey: 'sk_test_synthetic_fixture', webUrl: 'http://localhost:5173' };
const initial = () => ({ id: 30, ownerId: 'customer-a', customerId: 'customer-a', providerId: 10,
  status: 'CONFIRMED', paymentStatus: 'UNPAID', total: 13,
  items: [{ productName: 'A', price: 4, quantity: 2 }, { productName: 'B', price: 5, quantity: 1 }] });
function matches(order, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === 'object') {
      if ('$ne' in expected) return order[key] !== expected.$ne;
      if ('$nin' in expected) return !expected.$nin.includes(order[key]);
      if ('$in' in expected) return expected.$in.includes(order[key]);
    }
    return order[key] === expected;
  });
}
function repository(value = initial()) {
  const state = { order: value, paidUpdates: 0 };
  return { state, async findOne(filter) { return state.order && matches(state.order, filter) ? structuredClone(state.order) : null; },
    async updateOne(filter, update) {
      if (!state.order || !matches(state.order, filter)) return { modifiedCount: 0 };
      Object.assign(state.order, update.$set ?? {});
      for (const key of Object.keys(update.$unset ?? {})) delete state.order[key];
      if (update.$set?.paymentStatus === 'PAID') state.paidUpdates++;
      return { modifiedCount: 1 };
    } };
}
function provider(capture = []) {
  return async (url, options) => {
    capture.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ data: { id: 'cs_fixture', attributes: {
      livemode: false, checkout_url: 'https://checkout.paymongo.com/fixture',
    } } }) };
  };
}
function event(order, overrides = {}) {
  return { data: { id: 'evt_fixture', attributes: { type: 'checkout_session.payment.paid', livemode: false,
    data: { id: 'cs_fixture', type: 'checkout_session', attributes: {
      reference_number: order.paymentAttemptId,
      metadata: { petnest_order_id: '30', petnest_attempt_id: order.paymentAttemptId },
      payments: [{ id: 'pay_fixture', attributes: { amount: 1300, currency: 'PHP', status: 'paid',
        livemode: false, source: { type: 'gcash' }, ...overrides } }],
    } } } } };
}
test('saved snapshots produce exact centavos and never read request amounts or current product prices', async () => {
  const repo = repository(); const calls = [];
  assert.equal(orderLineItems(repo.state.order).amount, 1300);
  const result = await createOrderCheckout(repo, 30, 'customer-a', config, provider(calls));
  assert.equal(result.checkout_url, 'https://checkout.paymongo.com/fixture');
  assert.equal(calls[0].url, 'https://api.paymongo.com/v2/checkout_sessions');
  const a = calls[0].body.data.attributes;
  assert.deepEqual(a.line_items.map(x => x.amount * x.quantity), [800, 500]);
  assert.deepEqual(a.payment_method_types, ['gcash']); assert.equal(a.pass_on_fees, false);
  assert.match(a.success_url, /orders\?payment=success&order=30$/);
  assert.equal(repo.state.order.paymentStatus, 'UNPAID');
  assert.equal(repo.state.paidUpdates, 0);
});
test('ownership, missing order, pending, cancelled, paid, archived and invalid totals are rejected before PayMongo', async () => {
  const noCall = () => { throw new Error('Upstream must not be called'); };
  await assert.rejects(createOrderCheckout(repository(null), 30, 'customer-a', config, noCall), {status:404});
  await assert.rejects(createOrderCheckout(repository(), 30, 'customer-b', config, noCall), {status:403});
  for (const status of ['PENDING','CANCELLED','COMPLETED']) {
    assert.equal(checkoutEligible({...initial(),status}), false);
    await assert.rejects(createOrderCheckout(repository({...initial(),status}),30,'customer-a',config,noCall),{status:409});
  }
  for (const fields of [{paymentStatus:'PAID'},{archived:true},{total:1}]) {
    await assert.rejects(createOrderCheckout(repository({...initial(),...fields}),30,'customer-a',config,noCall),{status:409});
  }
});
test('missing and live keys fail closed; missing production return URL fails before a lock', async () => {
  for (const secretKey of [undefined,'','sk_live_synthetic_fixture']) {
    await assert.rejects(createOrderCheckout(repository(),30,'customer-a',{...config,secretKey},provider()),{status:503});
  }
  const repo=repository();
  await assert.rejects(createOrderCheckout(repo,30,'customer-a',{...config,webUrl:''},provider()),{status:503});
  assert.equal(repo.state.order.paymentStatus,'UNPAID');
});
test('parallel clicks create only one session, subsequent requests reuse checkout', async () => {
  const repo=repository(); const calls=[];
  const results=await Promise.allSettled(Array.from({length:8},()=>createOrderCheckout(repo,30,'customer-a',config,provider(calls))));
  assert.equal(calls.length,1); assert.ok(results.some(x=>x.status==='fulfilled'));
  await createOrderCheckout(repo,30,'customer-a',config,provider(calls)); assert.equal(calls.length,1);
});
test('definitive API rejection is retryable; uncertain timeouts do not create duplicate sessions', async () => {
  const repo=repository();
  await assert.rejects(createOrderCheckout(repo,30,'customer-a',config,async()=>({ok:false,status:400})),{status:502});
  assert.equal(repo.state.order.paymentStatus,'FAILED');
  await createOrderCheckout(repo,30,'customer-a',config,provider());
  const uncertain=repository();
  await assert.rejects(createOrderCheckout(uncertain,30,'customer-a',config,async()=>{throw new Error('timeout');}),{status:502});
  assert.equal(uncertain.state.order.paymentAttemptState,'UNCERTAIN');
  await assert.rejects(createOrderCheckout(uncertain,30,'customer-a',config,provider()),{status:409});
});
test('invalid/live checkout responses never redirect or mark paid', async () => {
  for (const attributes of [{livemode:true,checkout_url:'https://checkout.paymongo.com/test'},
    {livemode:false,checkout_url:'https://attacker.example/'}]) {
    const repo=repository();
    await assert.rejects(createOrderCheckout(repo,30,'customer-a',config,async()=>({ok:true,json:async()=>({data:{id:'cs_fixture',attributes}})})),{status:502});
    assert.equal(repo.state.paidUpdates,0);
  }
});
test('raw-body HMAC uses test signature; rejects missing secret, tampering, stale and live-only signatures', () => {
  const raw=Buffer.from(JSON.stringify({data:{example:true}})); const secret='synthetic_webhook_fixture';
  const t=Math.floor(Date.now()/1000); const te=createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex');
  const header=`t=${t},te=${te},li=`;
  verifyPaymongoSignature(raw,header,secret);
  assert.throws(()=>verifyPaymongoSignature(raw,header,undefined),{status:503});
  assert.throws(()=>verifyPaymongoSignature(Buffer.from('{}'),header,secret),{status:400});
  assert.throws(()=>verifyPaymongoSignature(raw,header,secret,Date.now()+600000),{status:400});
  assert.throws(()=>verifyPaymongoSignature(raw,`t=${t},te=,li=${te}`,secret),{status:400});
});
test('paid event validates session, amount, method, currency, test mode; duplicates create one paid transition and notifications', async () => {
  const repo=repository(); await createOrderCheckout(repo,30,'customer-a',config,provider());
  const notices=new Set(); const notify=async order=>{notices.add(`customer:${order.id}`);notices.add(`provider:${order.id}`);};
  for (const overrides of [{amount:100},{currency:'USD'},{livemode:true},{source:{type:'card'}}]) {
    await assert.rejects(processPaidWebhook(repo,event(repo.state.order,overrides),notify),{status:400});
  }
  const wrongSession=event(repo.state.order);wrongSession.data.attributes.data.id='cs_other';
  await assert.rejects(processPaidWebhook(repo,wrongSession,notify),{status:400});
  const live=event(repo.state.order);live.data.attributes.livemode=true;
  await assert.rejects(processPaidWebhook(repo,live,notify),{status:400});
  const correct=event(repo.state.order);
  await Promise.all(Array.from({length:6},()=>processPaidWebhook(repo,correct,notify)));
  assert.equal(repo.state.order.paymentStatus,'PAID');assert.equal(repo.state.paidUpdates,1);assert.equal(notices.size,2);
  assert.ok(repo.state.order.paidAt);assert.equal(repo.state.order.paymongoPaymentReference,'pay_fixture');
  await assert.rejects(createOrderCheckout(repo,30,'customer-a',config,provider()),{status:409});
});
test('early webhook reconciles creating session, V2 envelope works, notification failures recover on redelivery', async () => {
  const repo=repository({...initial(),paymentStatus:'PENDING',paymentAttemptId:'PETNEST-30-fixture',paymentAttemptState:'CREATING',paymentAmountCentavos:1300});
  const old=event(repo.state.order);const payload={event_type:'send.webhook',data:old.data.attributes};
  const result=await processPaidWebhook(repo,payload,async()=>{throw new Error('notification write failed');});
  assert.equal(result.notificationsPending,true);assert.equal(repo.state.order.paymentNotificationStatus,'PENDING');
  assert.equal(repo.state.paidUpdates,1);
  let notifications=0;await processPaidWebhook(repo,payload,async()=>{notifications++;});
  assert.equal(repo.state.paidUpdates,1);assert.equal(notifications,1);
});
test('legacy orders default unpaid; pickup and delivery use the same confirmed-order eligibility', async () => {
  for (const fulfillmentMethod of ['PICKUP','DELIVERY']) {
    const order={...initial(),fulfillmentMethod,deliveryAddress:fulfillmentMethod==='DELIVERY'?{streetAddress:'Synthetic fixture'}:undefined};
    delete order.paymentStatus;
    const repo=repository(order);await createOrderCheckout(repo,30,'customer-a',config,provider());
    assert.equal(repo.state.order.fulfillmentMethod,fulfillmentMethod);
    assert.deepEqual(repo.state.order.deliveryAddress,order.deliveryAddress);
  }
});

function paymentRoutes(repo, calls=[], webhookSecret=undefined) {
  const registered = new Map(); const notifications = new Map();
  const routeSource=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('petnest.ts',routeSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const wanted=['/orders/:orderId/payment','/webhooks/paymongo'];
  const statements=ast.statements.filter(statement=>(ts.isFunctionDeclaration(statement)&&statement.name?.text==='notifyPaidOrder')||(ts.isExpressionStatement(statement)&&
    ts.isCallExpression(statement.expression)&&statement.expression.expression.getText(ast)==='router.post'&&
    wanted.includes(statement.expression.arguments[0]?.text)));
  assert.equal(statements.length,3);
  const code=ts.transpileModule(statements.map(s=>s.getText(ast)).join('\n'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{
    router:{post:(path,handler)=>registered.set(path,handler)},Buffer,JSON,Number,String,
    process:{env:{PAYMONGO_SECRET_KEY:config.secretKey,PAYMONGO_WEBHOOK_SECRET:webhookSecret,NODE_ENV:'development'}},
    requireCustomer:async(req,res)=>{if(req.customer)return{userId:req.customer,role:'customer'};res.status(401).json({error:'Authentication required'});return null;},
    orderCollection:repo,PaymentError:(awaitedModule.PaymentError),verifyPaymongoSignature,processPaidWebhook,paymentWebUrl,deliverPaymentNotifications,
    createOrderCheckout:(orders,id,user,configuration)=>createOrderCheckout(orders,id,user,configuration,provider(calls)),
    createNotification:async(input,strict)=>{assert.equal(strict,true);notifications.set(`${input.recipientUserId}:${input.eventKey}`,input);},
    userCollection:{findOne:async()=>({id:'provider-account'})},
  });
  return {registered,notifications};
}
const awaitedModule=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
async function invoke(handler,req){const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler(req,res);return res;}
test('actual payment route validates IDs/auth and ignores a manipulated frontend amount', async()=>{
  const repo=repository();const calls=[];const {registered}=paymentRoutes(repo,calls);
  const route=registered.get('/orders/:orderId/payment');
  assert.equal((await invoke(route,{params:{orderId:'30'}})).code,401);
  assert.equal((await invoke(route,{customer:'customer-a',params:{orderId:'30x'}})).code,400);
  assert.equal((await invoke(route,{customer:'customer-b',params:{orderId:'30'}})).code,403);
  const res=await invoke(route,{customer:'customer-a',params:{orderId:'30'},body:{amount:1,items:[{price:1}]}});
  assert.equal(res.code,200);assert.deepEqual(Object.keys(res.body),['checkout_url']);
  assert.equal(calls[0].body.data.attributes.line_items.reduce((s,i)=>s+i.amount*i.quantity,0),1300);
});
test('actual webhook route fails safely without signing secret; signed retries produce exactly two notifications', async()=>{
  const repo=repository();await createOrderCheckout(repo,30,'customer-a',config,provider());
  const raw=Buffer.from(JSON.stringify(event(repo.state.order)));
  const missing=paymentRoutes(repo).registered.get('/webhooks/paymongo');
  assert.equal((await invoke(missing,{body:raw,get:()=>undefined})).code,503);assert.equal(repo.state.paidUpdates,0);
  const secret='synthetic_fixture';const t=Math.floor(Date.now()/1000);const te=createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex');
  const routes=paymentRoutes(repo,[],secret);const handler=routes.registered.get('/webhooks/paymongo');
  assert.equal((await invoke(handler,{body:raw,get:()=>`t=${t},te=${te},li=`})).code,200);
  assert.equal((await invoke(handler,{body:raw,get:()=>`t=${t},te=${te},li=`})).code,200);
  assert.equal(repo.state.paidUpdates,1);assert.equal(routes.notifications.size,2);
  assert.deepEqual([...routes.notifications.values()].map(n=>n.message),[
    'Payment for Pet Supplies order #30 was successful.','Payment received for Pet Supplies order #30.',
  ]);
});

test('Order 39 facts match 4000 centavos; wrong order metadata and unmatched attempts are rejected', async()=>{
  // Regression fixture from the reported facts, never a write to the real Order #39.
  const order={...initial(),id:39,total:40,items:[{productName:'int4egra',price:10,quantity:4}],
    paymentAttemptId:'PETNEST-39-synthetic',paymentAttemptState:'ACTIVE',paymentAmountCentavos:4000,
    paymongoCheckoutSessionId:'cs_69015bb872679a57319bf43d'};
  const repo=repository(order);const payload=event(order,{amount:4000});
  const resource=payload.data.attributes.data;resource.id=order.paymongoCheckoutSessionId;
  resource.attributes.status='active';resource.attributes.metadata.petnest_order_id='39';
  const wrongOrder=structuredClone(payload);wrongOrder.data.attributes.data.attributes.metadata.petnest_order_id='40';
  await assert.rejects(processPaidWebhook(repo,wrongOrder,async()=>{}),{status:400});
  const unmatched=structuredClone(payload);unmatched.data.attributes.data.attributes.reference_number='unmatched';
  await assert.rejects(processPaidWebhook(repo,unmatched,async()=>{}),{status:409});
  assert.equal(repo.state.paidUpdates,0);
  await processPaidWebhook(repo,payload,async()=>{});assert.equal(repo.state.paidUpdates,1);
  const paidAt=repo.state.order.paidAt;repo.state.order.status='COMPLETED';repo.state.order.archived=true;
  await processPaidWebhook(repo,payload,async()=>{});assert.equal(repo.state.paidUpdates,1);assert.equal(repo.state.order.paidAt,paidAt);
});
test('notification failure is deferred durably and retried without another paid transition', async()=>{
  const repo=repository();await createOrderCheckout(repo,30,'customer-a',config,provider());
  const payload=event(repo.state.order);let delivered=0;
  const result=await processPaidWebhook(repo,payload,async()=>{throw new Error('fixture failure');});
  assert.equal(result.notificationsPending,true);assert.equal(repo.state.order.paymentStatus,'PAID');
  assert.equal(await deliverPaymentNotifications(repo,repo.state.order,async()=>{delivered++;}),true);
  assert.equal(repo.state.order.paymentNotificationStatus,'SENT');
  await processPaidWebhook(repo,payload,async()=>{delivered++;});
  assert.equal(delivered,1);assert.equal(repo.state.paidUpdates,1);
});
test('deployed return URLs require APP_URL with HTTPS; local default remains Vite',()=>{
  assert.equal(paymentWebUrl({}),'http://localhost:5173');
  assert.throws(()=>paymentWebUrl({VERCEL:'1'}),{status:503});
  assert.throws(()=>paymentWebUrl({NODE_ENV:'production',APP_URL:'http://localhost:5173'}),{status:503});
  assert.throws(()=>paymentWebUrl({VERCEL:'1',APP_URL:'https://localhost'}),{status:503});
  assert.equal(paymentWebUrl({VERCEL:'1',APP_URL:'https://frontend.example'}),'https://frontend.example');
});
test('production raw-body middleware verifies the exact bytes while normal JSON endpoints still work',async()=>{
  const express=require('express');const app=express();
  const appSource=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const middleware=ast.statements.filter(s=>ts.isExpressionStatement(s)&&
    (s.getText(ast).includes('express.raw(')||s.getText(ast).includes('app.use(express.json(')));
  assert.equal(middleware.length,2);
  vm.runInNewContext(middleware.map(s=>s.getText(ast)).join('\n'),{app,express});
  const repo=repository();await createOrderCheckout(repo,30,'customer-a',config,provider());
  const secret='synthetic_fixture';const handler=paymentRoutes(repo,[],secret).registered.get('/webhooks/paymongo');
  app.post('/api/webhooks/paymongo',handler);app.post('/ordinary-json',(req,res)=>res.json({parsed:req.body.example===true}));
  const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const raw=JSON.stringify(event(repo.state.order),null,2)+'\n';const t=Math.floor(Date.now()/1000);
    const te=createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex');
    const headers={'Content-Type':'application/json','Paymongo-Signature':`t=${t},te=${te},li=`};
    const invalid=await fetch(base+'/api/webhooks/paymongo',{method:'POST',headers,body:raw+' '});
    assert.equal(invalid.status,400);assert.equal(repo.state.paidUpdates,0);
    const valid=await fetch(base+'/api/webhooks/paymongo',{method:'POST',headers,body:raw});
    assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{received:true});
    const unrelated=await fetch(base+'/ordinary-json',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"example":true}'});
    assert.deepEqual(await unrelated.json(),{parsed:true});
  }finally{await new Promise(resolve=>server.close(resolve));}
});
