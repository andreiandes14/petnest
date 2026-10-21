import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {Eye,EyeOff} from 'lucide-react';
const src=readFileSync(new URL('../src/components/password-recovery.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(src.slice(src.indexOf('export function PasswordRecovery'),src.indexOf('export function SecurityQuestionSettings')).replace('export function','function'),{fileName:'recovery.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
function harness(){let cursor=0;const requests=[],events=[];const values=[true,'person@example.test','Alice','new-password',false,false,'',''];const ref={current:false};
 const deps={React,Dialog,Eye,EyeOff,useState:()=>[values[cursor++],()=>{}],useRef:()=>ref,apiRequest:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return{message:'Generic response'};}};
 const Component=new Function(...Object.keys(deps),code+';return PasswordRecovery;')(...Object.values(deps));const tree=Component();
 const elements=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(elements)];
 return{requests,elements:elements(tree),event:{preventDefault(){events.push('prevent');},stopPropagation(){events.push('stop');}},events};
}

test('modal has exactly the three requested inputs, description and actions',()=>{
 const h=harness();const inputs=h.elements.filter(n=>n.type==='input');assert.equal(inputs.length,3);assert.deepEqual(inputs.map(n=>n.props.type),['email','password','password']);assert.ok(inputs.every(n=>n.props.required));
 const text=h.elements.filter(n=>n.type==='span').map(n=>n.props.children);assert.deepEqual(text,['Email','Who is your favorite person?','New Password']);
 assert.ok(h.elements.some(n=>n.type===Dialog.Description&&n.props.children==='Enter your email and answer the security question. Answer is case-insensitive. After 5 failed attempts, you will be locked out for 1 hour.'));
 const buttons=h.elements.filter(n=>n.type==='button');assert.ok(buttons.some(n=>n.props.children==='Cancel'));assert.ok(buttons.some(n=>n.props.children==='Reset Password'));
});
test('reset sends email, answer and new password in one request without triggering login',async()=>{
 const h=harness();await h.elements.find(n=>n.type==='form').props.onSubmit(h.event);assert.deepEqual(h.events,['prevent','stop']);assert.equal(h.requests[0].path,'/api/auth/password-recovery/reset');assert.deepEqual(h.requests[0].body,{email:'person@example.test',answer:'Alice',newPassword:'new-password'});
});
test('eye control is accessible, non-submitting, and password is hidden by default',()=>{
 const h=harness();const toggle=h.elements.find(n=>n.props['aria-controls']==='recovery-password');assert.equal(toggle.props.type,'button');assert.equal(toggle.props['aria-label'],'Show password');assert.equal(h.elements.find(n=>n.props.id==='recovery-password').props.type,'password');
});
