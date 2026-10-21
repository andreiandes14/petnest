import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/routes/petnest.ts',import.meta.url),'utf8');
const start=source.indexOf('router.post("/provider/products"');
const code=ts.transpileModule(source.slice(start,source.indexOf('router.delete("/provider/products',start)),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(){
 const routes={},provider={id:7,products:[],fulfillmentMethods:['PICKUP']};
 const db={async findOne(filter){return filter.id===7?structuredClone(provider):null;},async findOneAndUpdate(filter,update){provider.products.push(update.$push.products);return structuredClone(provider);},async updateOne(filter,update){const id=filter.products.$elemMatch.id;const index=provider.products.findIndex(p=>p.id===id);if(index<0)return{matchedCount:0};provider.products[index]=update.$set['products.$'];return{matchedCount:1};}};
 new Function('router','requireProvider','validText','providerCollection','nextId','hasValidFulfillmentConfiguration',code)({post(path,fn){routes.post=fn;},patch(path,fn){routes.patch=fn;}},async()=>({providerId:7}),v=>typeof v==='string'&&v.trim().length>0,db,async()=>12,()=>true);
 return{provider,async call(method,body){const res={code:200,status(n){this.code=n;return this;},json(value){this.body=value;}};await routes[method]({body,params:{productId:'12'}},res);return res;}};
}
const body={name:'Product',description:'Description',price:80,stock:5,category:'pet-supplies'};
test('product creation requires an explicit valid category, never infers from names',async()=>{
 for(const category of [undefined,'','Food','other',['food']]){const h=harness();assert.equal((await h.call('post',{...body,productCategory:category})).code,400);assert.equal(h.provider.products.length,0);}
 for(const category of ['food','supplies']){const h=harness();const result=await h.call('post',{...body,productCategory:category});assert.equal(result.code,201);assert.equal(h.provider.products[0].productCategory,category);assert.equal(result.body.category,'pet-supplies');}
});
test('editing persists category, rejects invalid categories, and leaves price and stock intact',async()=>{
 const h=harness();h.provider.products.push({id:12,providerId:7,...body,active:true});
 assert.equal((await h.call('patch',{productCategory:'supplies'})).code,200);assert.equal(h.provider.products[0].productCategory,'supplies');
 await h.call('patch',{productCategory:'food'});assert.equal(h.provider.products[0].productCategory,'food');
 assert.equal((await h.call('patch',{productCategory:'invalid'})).code,400);
 assert.equal(h.provider.products[0].price,80);assert.equal(h.provider.products[0].stock,5);
});
