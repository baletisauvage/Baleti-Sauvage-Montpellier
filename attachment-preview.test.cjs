const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.open=false;}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}querySelector(tag){return this.children.find(x=>x.tag===tag);}addEventListener(n,f){this.events[n]=f;}showModal(){this.open=true;}close(){this.open=false;this.events.close();}pause(){this.paused=true;}load(){}removeAttribute(n){delete this[n];}}
const ids=Object.fromEntries(['attachmentPreview','attachmentPreviewContent','attachmentPreviewStatus','attachmentPreviewTitle','attachmentPreviewDownload','attachmentPreviewClose'].map(k=>[k,new Element()]));
const dialog=ids.attachmentPreview,content=ids.attachmentPreviewContent,status=ids.attachmentPreviewStatus;
let data=new Uint8Array([255,216,255,1]).buffer,calls=0,revoked=0,lastOptions;
const ctx={window:{},document:{getElementById:id=>ids[id],createElement:t=>new Element(t)},URL:{createObjectURL:()=> 'blob:private',revokeObjectURL:()=>revoked++},Blob,Uint8Array,TextDecoder,AbortController,fetch:async(u,o)=>{calls++;lastOptions=o;return {ok:true,arrayBuffer:async()=>data}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('attachment-preview.js','utf8'),ctx);
async function show(name){await ctx.window.previewAttachment({id:1,attachment_name:name},()=>{});}
(async()=>{
await show('photo.jpg');assert.equal(content.children[0].tag,'img');assert.equal(lastOptions.credentials,'include');assert.equal(lastOptions.cache,'no-store');dialog.close();assert.equal(revoked,1);assert.equal(content.children.length,0);
data=new TextEncoder().encode('%PDF-1.7\n').buffer;await show('doc.pdf');assert.equal(content.children[0].tag,'iframe');dialog.close();
data=new TextEncoder().encode('<script>bad()</script>').buffer;await show('note.txt');assert.equal(content.children[0].tag,'pre');assert.equal(content.children[0].textContent,'<script>bad()</script>');dialog.close();
data=new Uint8Array([1,2,3]).buffer;await show('clip.mp4');const video=content.children[0];assert.equal(video.tag,'video');assert(video.controls);dialog.close();assert(video.paused);
const before=calls;await show('doc.docx');assert.equal(calls,before);assert.match(status.textContent,/ne peut pas être affiché/);
await show('fake.pdf');assert.match(status.textContent,/ne correspond pas à un PDF/);assert.equal(content.children.length,0);
ctx.fetch=async()=>({status:401,ok:false});await show('photo.jpg');assert.match(status.textContent,/Session expirée/);
let resolve;ctx.fetch=()=>new Promise(r=>resolve=r);const pending=show('photo.jpg');dialog.close();resolve({ok:true,arrayBuffer:async()=>new Uint8Array([255,216,255]).buffer});await pending;assert.equal(content.children.length,0);
console.log('OK : images, PDF, vidéo, texte sans HTML, formats non pris en charge, accès expiré, fermeture et nettoyage des aperçus.');
})().catch(e=>{console.error(e);process.exitCode=1;});
