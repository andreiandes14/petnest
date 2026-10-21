import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=(s,jsx=false)=>ts.transpileModule(s,{fileName:jsx?'hours.tsx':'hours.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}}).outputText;
const shared=await import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('../../../shared/business-hours.ts',import.meta.url),'utf8'))).toString('base64')}`);
const source=readFileSync(new URL('../src/components/business-hours.tsx',import.meta.url),'utf8');
const code=compile(source.slice(source.indexOf('export function')).replace('export function','function'),true);
function harness(isOpen24Hours=false, operatingDays){
 const cells=[],saves=[];let cursor=0,tree;
 const deps={defaultOperatingDays:[0,1,2,3,4,5,6],...shared,React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},useState(value){const i=cursor++;if(!(i in cells))cells[i]=typeof value==='function'?value():value;return[cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v];},useEffect(){}};
 const Component=new Function(...Object.keys(deps),code+';return BusinessHours;')(...Object.values(deps));
 const render=()=>{cursor=0;tree=Component({hours:'09:00-17:00',isOpen24Hours,operatingDays,saving:false,save:async(...args)=>saves.push(args)});};
 const elements=(node=tree)=>node&&typeof node==='object'?[node,...(node.props?.children??[]).flat(Infinity).flatMap(elements)]:[];
 render();return{render,saves,toggle: index=>{elements().filter(n=>n.type==='input'&&n.props.type==='checkbox')[index].props.onChange({target:{checked:false}});render();},mode:value=>{elements().find(n=>n.props.id==='provider-hours-mode').props.onChange({target:{value}});render();},selects:()=>elements().filter(n=>n.type==='select'),save:()=>elements().find(n=>n.type==='button').props.onClick(),text:()=>JSON.stringify(tree)};
}
test('24-hour selection hides clock fields and saves the flag without replacing custom hours',async()=>{
 const h=harness();h.mode('24');assert.equal(h.selects().length,1);assert.match(h.text(),/Open 24 Hours/);await h.save();assert.deepEqual(h.saves,[['09:00-17:00',true,[0,1,2,3,4,5,6]]]);
});
test('saved 24-hour setting restores custom clock selections when switched back',async()=>{
 const h=harness(true);h.mode('custom');assert.deepEqual(h.selects().slice(1).map(n=>n.props.value),['09:00','17:00']);await h.save();assert.deepEqual(h.saves,[['09:00-17:00',false,[0,1,2,3,4,5,6]]]);
});


test('weekly checkboxes save selected days alongside 24-hour hours and restore saved days',async()=>{
 const h=harness(true);h.toggle(6);await h.save();assert.deepEqual(h.saves,[['09:00-17:00',true,[1,2,3,4,5,6]]]);
 const restored=harness(true,[1,2,3,4,5,6]);assert.match(restored.text(),/Days of Operation/);
});
