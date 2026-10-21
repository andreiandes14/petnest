import test from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const gatewayUrl = moduleUrl(readFileSync(new URL('../src/lib/paymongo.ts', import.meta.url), 'utf8'));
const sharedUrl = moduleUrl(readFileSync(new URL('../../../shared/booking-deposit.ts', import.meta.url), 'utf8'));
const { createOrderCheckout, processPaidWebhook, paymentEventReference, verifyPaymongoSignature, PaymentError, reconcileCheckout } = await import(gatewayUrl);
const { remainingBookingBalance } = await import(sharedUrl);
const adapterSource = readFileSync(new URL('../src/lib/booking-payments.ts', import.meta.url), 'utf8').replace('"./paymongo.js"', JSON.stringify(gatewayUrl)).replace('"../../../../shared/booking-deposit.js"', JSON.stringify(sharedUrl));
const { bookingPaymentRepository } = await import(moduleUrl(adapterSource));
const config = {secretKey:'sk_test_synthetic_fixture',webUrl:'http://localhost:5173'};
function fixture(changes={}) {
 const row={id:7,providerId:1,ownerId:'customer',serviceName:'Bath',price:500,status:'awaiting_payment',depositRequired:true,paymentStatus:'UNPAID',date:'2026-10-16',time:'09:00',...changes};
 let paidWrites=0;
 const matches=filter=>Object.entries(filter).every(([key,wanted])=>wanted&&typeof wanted==='object' ? ('$ne' in wanted ? row[key]!==wanted.$ne : '$nin' in wanted ? !wanted.$nin.includes(row[key]) : '$in' in wanted ? wanted.$in.includes(row[key]) : true) : row[key]===wanted);
 const store={async findOne(filter){return matches(filter)?structuredClone(row):null;},async updateOne(filter,update){if(!matches(filter))return {modifiedCount:0};if(update.$set?.paymentStatus==='PAID')paidWrites++;Object.assign(row,update.$set);for(const key of Object.keys(update.$unset??{}))delete row[key];return{modifiedCount:1};}};
 const calls=[];const request=async(url,options)=>{calls.push(JSON.parse(options.body));return{ok:true,json:async()=>({data:{id:'cs_booking',attributes:{livemode:false,checkout_url:'https://checkout.paymongo.com/test-booking'}}})};};
 return {row,store,repo:bookingPaymentRepository(store),calls,request,get paidWrites(){return paidWrites;}};
}
function event(row,changes={}) {return {data:{attributes:{livemode:false,type:'checkout_session.payment.paid',data:{id:'cs_booking',type:'checkout_session',attributes:{livemode:false,reference_number:row.paymentAttemptId,metadata:{petnest_booking_id:String(row.id),petnest_attempt_id:row.paymentAttemptId},payments:[{id:'pay_booking',attributes:{status:'paid',amount:5000,currency:'PHP',livemode:false,source:{type:'gcash'},...changes}}]}}}}};}
test('accepted booking checkout charges exactly PHP 50, uses distinct metadata/returns and reuses active session',async()=>{
 const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
 const attributes=f.calls[0].data.attributes;assert.equal(attributes.line_items[0].amount,5000);assert.equal(attributes.line_items[0].quantity,1);
 assert.equal(attributes.metadata.petnest_booking_id,'7');assert.equal(attributes.metadata.petnest_order_id,undefined);assert.ok(attributes.reference_number.startsWith('PETNEST-BOOKING-7-'));
 assert.match(attributes.success_url,/\/bookings\?payment=success&booking=7/);assert.match(attributes.cancel_url,/payment=cancel/);
 assert.equal(f.row.status,'awaiting_payment');assert.equal(f.row.paymentStatus,'UNPAID');assert.equal(remainingBookingBalance(f.row),500);
 await createOrderCheckout(f.repo,7,'customer',config,f.request);assert.equal(f.calls.length,1);
});
test('verified paid event confirms once and credits deposit once, retaining price and payment reference',async()=>{
 const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);const payload=event(f.row);
 assert.ok(paymentEventReference(payload).startsWith('PETNEST-BOOKING-'));
 let notifications=0;await processPaidWebhook(f.repo,payload,async()=>{notifications++;});await processPaidWebhook(f.repo,payload,async()=>{notifications++;});
 assert.equal(f.row.status,'confirmed');assert.equal(f.row.paymentStatus,'PAID');assert.equal(f.row.bookingDepositPaid,50);assert.equal(f.row.remainingServiceBalance,450);assert.equal(f.row.price,500);assert.equal(remainingBookingBalance(f.row),450);assert.equal(f.paidWrites,1);assert.equal(notifications,1);assert.equal(f.row.paymongoPaymentReference,'pay_booking');
 await assert.rejects(createOrderCheckout(f.repo,7,'customer',config,f.request),{status:409});
});
test('ownership, provider acceptance, prices below deposit, legacy bookings and invalid paid amounts fail closed',async()=>{
 const f=fixture();await assert.rejects(createOrderCheckout(f.repo,7,'another',config,f.request),{status:403});
 for(const changes of [{status:'pending'},{status:'cancelled'},{price:49},{depositRequired:false}]){const f=fixture(changes);await assert.rejects(createOrderCheckout(f.repo,7,'customer',config,f.request));assert.equal(f.calls.length,0);}
 await createOrderCheckout(f.repo,7,'customer',config,f.request);
 for(const changes of [{amount:50000},{currency:'USD'},{livemode:true},{status:'failed'}])await assert.rejects(processPaidWebhook(f.repo,event(f.row,changes),async()=>{}));
 assert.equal(f.row.paymentStatus,'UNPAID');assert.equal(f.row.status,'awaiting_payment');
 const wrong=event(f.row);wrong.data.attributes.data.attributes.metadata={petnest_order_id:'7',petnest_attempt_id:f.row.paymentAttemptId};await assert.rejects(processPaidWebhook(f.repo,wrong,async()=>{}));
 assert.equal(remainingBookingBalance({price:10,depositRequired:true,paymentStatus:'PAID',status:'confirmed'}),0);
});
test('failed checkout stays unpaid/awaiting; uncertain attempts cannot create another charge',async()=>{
 const failed=fixture();await assert.rejects(createOrderCheckout(failed.repo,7,'customer',config,async()=>({ok:false,status:422})));assert.equal(failed.row.paymentStatus,'FAILED');assert.equal(failed.row.status,'awaiting_payment');
 const uncertain=fixture();await assert.rejects(createOrderCheckout(uncertain.repo,7,'customer',config,async()=>{throw Error('Synthetic timeout');}));assert.equal(uncertain.row.paymentAttemptState,'UNCERTAIN');await assert.rejects(createOrderCheckout(uncertain.repo,7,'customer',config,uncertain.request));assert.equal(uncertain.calls.length,0);
});

for (const category of ['grooming', 'vaccination']) test(`${category}: paid confirmed bookings allow deliberate, nonfuture, atomic No-Show while retaining payment history`, async()=>{
 const routeSource = readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
 const start=routeSource.indexOf('router.patch("/provider/bookings/:bookingId/status"');const end=routeSource.indexOf('router.patch("/provider/bookings/:bookingId/archive"',start);
 const row={id:7,providerId:1,ownerId:'customer',status:'pending',depositRequired:true,paymentStatus:'UNPAID',serviceCategory:category,price:500,date:'2026-10-16',time:'09:00'};
 let handler,writes=0,providerId=1;
 const match=filter=>filter.id===row.id&&filter.providerId===row.providerId&&(!filter.status||filter.status===row.status);
 const deps={BOOKING_DEPOSIT:50,router:{patch(path,fn){handler=fn;}},requireProvider:async()=>({providerId,userId:"provider-user"}),bookingCollection:{async findOne(filter){return match(filter)?{...row}:null;},async findOneAndUpdate(filter,update){if(!match(filter))return null;Object.assign(row,update.$set);writes++;return {...row};}},providerCollection:{async findOne(){return {categories:[category]};}},recordCollection:{async findOne(){return null;},async insertOne(){}},nextId:async()=>1,createNotification:async()=>{},statusLabelForLog:value=>value,manilaNow:()=>({date:'2026-10-16',minutes:600}),timeToMinutes:value=>Number(value.slice(0,2))*60+Number(value.slice(3))};
 new Function(...Object.keys(deps),compile(routeSource.slice(start,end)))(...Object.values(deps));
 const request=async(status,extra={})=>{const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({params:{bookingId:'7'},body:{status,...extra}},res);return res;};
 assert.equal((await request('confirmed')).code,200);assert.equal(row.status,'awaiting_payment');
 assert.equal((await request('confirmed')).code,409);assert.equal((await request('completed')).code,409);
 assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);
 row.status='confirmed';row.paymentStatus='PAID';row.date='2026-10-17';Object.assign(row,{bookingDepositPaid:50,remainingServiceBalance:450,paymongoPaymentReference:'pay_preserved',paidAt:'2026-10-15T00:00:00Z'});
 assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);
 row.date='2026-10-16';row.cancellationReason='Prior notice';assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);delete row.cancellationReason;assert.equal((await request('no_show')).code,400);
 providerId=2;assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,404);providerId=1;
 assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,200);assert.equal(row.status,'no_show');assert.equal(row.paymentStatus,'PAID');assert.ok(row.noShowAt);assert.ok(row.depositForfeitedAt);
 assert.equal(row.bookingDepositPaid,50);assert.equal(row.remainingServiceBalance,0);assert.equal(row.depositDisposition,"forfeited");assert.equal(row.noShowProviderId,1);assert.equal(row.noShowMarkedByUserId,"provider-user");assert.equal(row.paymongoPaymentReference,'pay_preserved');assert.equal(row.paidAt,'2026-10-15T00:00:00Z');
 assert.equal((await request('completed')).code,409);
 const count=writes;assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);assert.equal(writes,count);
 for(const status of ['completed','cancelled','rejected']){row.status=status;assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);assert.equal(writes,count);}
 row.status='confirmed';delete row.depositDisposition;delete row.depositForfeitedAt;
 assert.equal((await request('completed')).code,200);assert.equal(row.depositDisposition,'credited');assert.ok(row.depositCreditedAt);assert.equal(row.remainingServiceBalance,450);assert.equal(row.paymentStatus,'PAID');assert.equal(row.paymongoPaymentReference,'pay_preserved');
 assert.equal((await request('no_show',{noShowWithoutNotice:true})).code,409);assert.equal((await request('completed')).code,409);
});

test('actual signed webhook dispatches booking payments to bookings, never to same-numbered supply orders',async()=>{
 const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
 const routeSource=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');const start=routeSource.indexOf('router.post("/webhooks/paymongo"');const end=routeSource.indexOf('router.patch("/orders/:orderId/cancel"',start);
 let handler,notifications=0;const secret='synthetic-webhook-secret';
 const deps={router:{post(path,fn){handler=fn;}},Buffer,process:{env:{PAYMONGO_WEBHOOK_SECRET:secret}},PaymentError,verifyPaymongoSignature,paymentEventReference,bookingPaymentRepository,bookingCollection:f.store,processPaidWebhook,notifyPaidBooking:async()=>{notifications++;},orderCollection:{async findOne(){throw Error('Booking event routed to orders');}},notifyPaidOrder:async()=>{throw Error('Wrong notification type');}};
 new Function(...Object.keys(deps),compile(routeSource.slice(start,end)))(...Object.values(deps));
 const raw=Buffer.from(JSON.stringify(event(f.row)));const time=Math.floor(Date.now()/1000);const signature=createHmac('sha256',secret).update(`${time}.`).update(raw).digest('hex');
 const request=async(body,header)=>{const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({body,get:()=>header},res);return res;};
 assert.equal((await request(raw,'invalid')).code,400);assert.equal(f.row.status,'awaiting_payment');
 assert.equal((await request(raw,`t=${time},te=${signature}`)).code,200);
 assert.equal((await request(raw,`t=${time},te=${signature}`)).code,200);
 assert.equal(f.row.paymentStatus,'PAID');assert.equal(f.row.status,'confirmed');assert.equal(notifications,1);assert.equal(f.paidWrites,1);
});


test('server retrieval safely reconciles an existing successful deposit and duplicate/racing deliveries', async()=>{
 const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
 const get=async(url,options)=>{assert.match(url,/v1\/checkout_sessions\/cs_booking$/);assert.equal(options.method,'GET');return {ok:true,json:async()=>({data:event(f.row).data.attributes.data})};};
 assert.deepEqual(await reconcileCheckout(f.repo,7,'customer',config.secretKey,async()=>{},get),{paid:true});
 await processPaidWebhook(f.repo,event(f.row),async()=>{});
 assert.equal(f.paidWrites,1);assert.equal(f.row.remainingServiceBalance,450);
 assert.deepEqual(await reconcileCheckout(f.repo,7,'customer',config.secretKey,async()=>{},async()=>{throw Error('Must not request twice');}),{paid:true});
 await assert.rejects(reconcileCheckout(f.repo,7,'other',config.secretKey,async()=>{},get),{status:404});
});
test('return before webhook, failed/cancelled payment, bad association, amount and unavailable verification never mark paid',async()=>{
 for(const mode of ['pending','wrong-session','wrong-reference','wrong-mode','wrong-amount','unavailable']){
  const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
  const data=event(f.row).data.attributes.data;
  if(mode==='pending')data.attributes.payments=[];
  if(mode==='wrong-session')data.id='cs_other';
  if(mode==='wrong-reference')data.attributes.reference_number='untrusted';
  if(mode==='wrong-mode')data.attributes.livemode=true;
  if(mode==='wrong-amount')data.attributes.payments[0].attributes.amount=1;
  const get=async()=>({ok:mode!=='unavailable',json:async()=>({data})});
  if(mode==='pending')assert.deepEqual(await reconcileCheckout(f.repo,7,'customer',config.secretKey,async()=>{},get),{paid:false,retryAllowed:false});
  else await assert.rejects(reconcileCheckout(f.repo,7,'customer',config.secretKey,async()=>{},get));
  assert.equal(f.row.paymentStatus,'UNPAID');assert.equal(f.paidWrites,0);
  if(mode==='pending'){await processPaidWebhook(f.repo,event(f.row),async()=>{});assert.equal(f.row.status,'confirmed');}
 }
});

test('verification route requires customer ownership, validates IDs, and never accepts browser payment proof',async()=>{
 const source=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
 const start=source.indexOf('router.post("/bookings/:bookingId/payment/verify"');
 const end=source.indexOf('router.post("/bookings/:bookingId/payment"',start);
 const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
 let handler,authorized=true;
 const deps={router:{post(path,fn){handler=fn;}},requireCustomer:async(req,res)=>{if(!authorized){res.status(401).json({error:'Unauthorized'});return null;}return {userId:'other'};},reconcileCheckout,bookingPaymentRepository,bookingCollection:f.store,process:{env:{PAYMONGO_SECRET_KEY:config.secretKey}},notifyPaidBooking:async()=>{},PaymentError};
 new Function(...Object.keys(deps),compile(source.slice(start,end)))(...Object.values(deps));
 const call=async(id)=>{const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({params:{bookingId:id},body:{paid:true,amount:5000,payment:'success'}},res);return res;};
 assert.equal((await call('invalid')).code,400);
 assert.equal((await call('7')).code,404);
 authorized=false;assert.equal((await call('7')).code,401);
 assert.equal(f.paidWrites,0);
});


test('abandoned active checkout is reusable, processing is blocked, expired checkout is safely replaceable', async()=>{
 for (const mode of ['active','processing','expired','unknown']) {
  const f=fixture();await createOrderCheckout(f.repo,7,'customer',config,f.request);
  const data=event(f.row).data.attributes.data;
  data.attributes.payments=[];data.attributes.status=mode==='processing'?'active':mode;
  if(mode==='processing')data.attributes.payment_intent={attributes:{status:'processing'}};
  const result=await reconcileCheckout(f.repo,7,'customer',config.secretKey,async()=>{},async()=>({ok:true,json:async()=>({data})}));
  assert.equal(result.paid,false);assert.equal(result.retryAllowed,['active','expired'].includes(mode));
  assert.equal(f.row.status,'awaiting_payment');assert.equal(f.paidWrites,0);
  if(mode==='active'){await createOrderCheckout(f.repo,7,'customer',config,f.request);assert.equal(f.calls.length,1);}
  if(mode==='expired'){assert.equal(f.row.paymongoCheckoutSessionId,undefined);await createOrderCheckout(f.repo,7,'customer',config,f.request);assert.equal(f.calls.length,2);}
 }
});
