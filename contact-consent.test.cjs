const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const source=fs.readFileSync('worker.js','utf8').replace(/export\s*\{\s*worker_default as default\s*\};?/,'globalThis.worker=worker_default;').replace('error: "Erreur Worker"','error: String(e.stack)');
const ctx={console,crypto,Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,FormData,Date,fetch:()=>{throw Error('Unexpected email');}};
vm.createContext(ctx);vm.runInContext(source,ctx);
ctx.init=async()=>{};
const contacts=[],messages=[];
const DB={prepare(sql){return {bind(...args){return {async first(){if(sql.includes('SELECT count'))return {count:1};throw Error(sql);},async run(){if(sql.includes('INSERT INTO public_request_limits'))return {};if(sql.includes('INSERT INTO contacts(')){if(!contacts.some(c=>c.email===args[3]))contacts.push({prenom:args[0],email:args[1],telephone:args[2],active:1});return {};}if(sql.includes('INSERT INTO messages(')){messages.push(args);return {};}throw Error(sql);}}}}}};
const env={DB,CONTACT_OPTIN_MODE:'direct'};
async function post(body,path='/api/contacts',extra={}){return ctx.worker.fetch(new Request('https://baleti-sauvage.baletisauvage.workers.dev'+path,{method:'POST',headers:{Origin:'https://baletisauvage.github.io','Content-Type':'application/json'},body:JSON.stringify(body)}),{...env,...extra});}
(async()=>{
const b={prenom:'Test',email:'test@example.invalid',consent:true};
const denied=await post({...b,consent:false});if(denied.status!==400)console.log(await denied.text());assert.equal(denied.status,400);
assert.equal((await post({...b,email:'invalid'})).status,400);
assert.equal((await post(b)).status,200);assert.equal(contacts.length,1);
await post({...b,prenom:'Overwrite'});assert.equal(contacts.length,1);assert.equal(contacts[0].prenom,'Test');
contacts[0].active=0;await post(b);assert.equal(contacts[0].active,0);
assert.equal((await post(b,'/api/contacts',{CONTACT_OPTIN_MODE:undefined})).status,503);
const r=await post({email:b.email},'/api/contacts/unsubscribe');assert.equal(r.status,200);assert.match((await r.json()).message,/encore être traitée/);assert.equal(messages.length,1);assert.equal(contacts[0].active,0);
console.log('OK: consent, validation, insertion, doublons, contacts désinscrits protégés, mode explicite, demande de désinscription en attente.');
})().catch(e=>{console.error(e);process.exitCode=1;});
