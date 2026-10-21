import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/product-categories.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {filterSupplyProducts,productCategoryLabel}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('All Products retains uncategorized records; category filters preserve order and source data',()=>{
 const products=[{id:1},{id:2,productCategory:'food'},{id:3,productCategory:'supplies'},{id:4,productCategory:'food'}];
 assert.equal(filterSupplyProducts(products,'all'),products);
 assert.deepEqual(filterSupplyProducts(products,'food').map(p=>p.id),[2,4]);assert.deepEqual(filterSupplyProducts(products,'supplies').map(p=>p.id),[3]);
 assert.deepEqual(filterSupplyProducts([products[0]],'food'),[]);assert.equal(products.length,4);
 assert.equal(productCategoryLabel(), 'Uncategorized');assert.equal(productCategoryLabel('food'),'Food');assert.equal(productCategoryLabel('supplies'),'Supplies');
});
