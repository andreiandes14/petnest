import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/image-crop.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateCropFile, cropGeometry, croppedImage, MAX_IMAGE_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('image upload rejects unsupported types, empty and oversized files before cropping', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) assert.equal(validateCropFile({type, size: 100}), null);
  for (const file of [{type:'image/svg+xml',size:100}, {type:'text/plain',size:100}, {type:'image/png',size:0}, {type:'image/jpeg',size:MAX_IMAGE_BYTES+1}]) assert.ok(validateCropFile(file));
});

test('square and wide crops preserve aspect ratio, cap resolution and never upscale small images', () => {
  assert.deepEqual(cropGeometry({x:100,y:100,width:2000,height:2000},3000,3000,1200), {width:1200,height:1200});
  assert.deepEqual(cropGeometry({x:0,y:0,width:3200,height:1800},3200,2000,1600), {width:1600,height:900});
  assert.deepEqual(cropGeometry({x:0,y:0,width:80,height:80},80,80,1200), {width:80,height:80});
  for (const area of [{x:-1,y:0,width:10,height:10}, {x:0,y:0,width:0,height:10}, {x:0,y:0,width:NaN,height:10}, {x:95,y:0,width:10,height:10}]) assert.throws(() => cropGeometry(area,100,100,1200));
});

test('export draws only the selected rectangle and returns newly encoded pixels, not the original', async () => {
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  const calls = [];
  class TestImage { naturalWidth=1000; naturalHeight=800; set src(value) { this.source=value; queueMicrotask(() => this.onload()); } }
  const canvas = {width:0,height:0,getContext:()=>({drawImage:(...args)=>calls.push(args)}),toDataURL:(type, quality)=>{assert.equal(type,'image/webp');assert.equal(quality,0.9);return 'data:image/webp;base64,CROPPED';}};
  globalThis.Image=TestImage; globalThis.document={createElement:()=>canvas};
  try {
    const result=await croppedImage('blob:original',{x:250,y:100,width:600,height:600},300);
    assert.equal(result,'data:image/webp;base64,CROPPED');
    assert.deepEqual(calls[0].slice(1),[250,100,600,600,0,0,300,300]);
    assert.equal(canvas.width,300); assert.equal(canvas.height,300);
    globalThis.Image=class {set src(value) {queueMicrotask(()=>this.onerror());}};
    await assert.rejects(croppedImage('blob:broken',{x:0,y:0,width:1,height:1}),/could not be opened/);
  } finally {globalThis.Image=originalImage;globalThis.document=originalDocument;}
});
