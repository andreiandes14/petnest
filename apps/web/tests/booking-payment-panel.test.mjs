import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source.slice(source.indexOf('function BookingDepositPanel'),source.indexOf('function CustomerBookingStatusBadge')), {fileName:'panel.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(response={paid:false,retryAllowed:false}) {
 const cells=[],timers=new Map(),requests=[];let cursor=0,tree,nextTimer=0;
 const props={customer:true,booking:{id:7,status:'awaiting_payment',depositRequired:true,paymentStatus:'UNPAID',paymentAttemptState:'ACTIVE'}};
 const deps={React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
 useState(initial){const i=cursor++;if(!(i in cells))cells[i]=initial;return[cells[i],value=>cells[i]=typeof value==='function'?value(cells[i]):value];},
 useEffect(fn,values){const i=cursor++,old=cells[i];if(!old||values.some((v,j)=>v!==old.values[j])){old?.cleanup();cells[i]={values,cleanup:fn()};}},
 useMutation:()=>({isPending:false,isError:false,mutate(){throw Error('Unexpected checkout');}}),
 adminRequest:async(path,options)=>{requests.push({path,options});if(response instanceof Error)throw response;return response;},
 queryClient:{invalidateQueries:async()=>{}},getListBookingsQueryKey:()=>['bookings'],
 setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
 BOOKING_DEPOSIT:50,money:value=>String(value),remainingBookingBalance:()=>450,BookingDepositDialog:'dialog',BookingDepositNotice:'notice',AbortController};
 const Component=new Function(...Object.keys(deps),code+';return BookingDepositPanel;')(...Object.values(deps));
 const render=()=>{cursor=0;tree=Component(props);};
 const elements=(node=tree)=>node&&typeof node==='object'?[node,...(node.props?.children??[]).flat(Infinity).flatMap(elements)]:[];
 render();
 return{props,requests,timers,render,flush:async()=>{await Promise.resolve();await Promise.resolve();render();},text:()=>JSON.stringify(tree),button:()=>elements().find(n=>n.type==='button'),expire:()=>{const entry=[...timers].find(([,t])=>t.delay===120000);timers.delete(entry[0]);entry[1].fn();render();},unmount:()=>cells.forEach(cell=>cell?.cleanup?.())};
}
test('unpaid active checkout enables reopening without creating another checkout',async()=>{
 const h=harness({paid:false,retryAllowed:true});await h.flush();assert.match(h.text(),/Proceed to Payment/);assert.equal(h.button().props.disabled,false);assert.equal(h.requests.length,1);
 assert.equal([...h.timers.values()].filter(t=>t.delay===120000).length,0);h.unmount();
});
test('pending verification times out, offers explicit recheck, and aborts on unmount',async()=>{
 const h=harness();await h.flush();assert.match(h.text(),/Payment Processing/);h.expire();assert.match(h.text(),/Check Payment Status/);assert.match(h.text(),/couldn't confirm your payment yet/);assert.equal(h.button().props.disabled,false);
 assert.equal(h.requests[0].options.signal.aborted,true);
 h.button().props.onClick();h.render();await h.flush();assert.equal(h.requests.length,2);h.unmount();assert.equal(h.requests[1].options.signal.aborted,true);assert.equal(h.timers.size,0);
});
test('network failures do not unlock a new charge; refresh starts controlled verification',async()=>{
 const h=harness(new Error('offline'));await h.flush();h.expire();assert.match(h.text(),/Check Payment Status/);assert.doesNotMatch(h.text(),/Proceed to Payment/);h.unmount();
 const refreshed=harness({paid:true});await refreshed.flush();refreshed.props.booking={...refreshed.props.booking,paymentStatus:'PAID',status:'confirmed'};refreshed.render();refreshed.render();assert.doesNotMatch(refreshed.text(),/Proceed to Payment|Payment Processing|Check Payment Status/);refreshed.unmount();
});
