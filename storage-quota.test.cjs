const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const worker=fs.readFileSync('worker.js','utf8');
const start=worker.indexOf('// Storage monitoring:');
const end=worker.indexOf('var COOKIE =',start);
assert(start>=0 && end>start);
const source=worker.slice(start,end);
const ctx={console,Date,Number,JSON,Set,Math,btoa:s=>Buffer.from(s).toString('base64')};
vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.testQuota={storageBudget,storageB2,storageCached};',ctx);
const {storageBudget,storageB2,storageCached}=ctx.testQuota;
const response=data=>({ok:true,json:async()=>data});
(async()=>{
 for(const [n,level] of [[799,'ok'],[800,'warning'],[949,'warning'],[950,'critical'],[999,'critical'],[1000,'exceeded'],[1100,'exceeded']])assert.equal(storageBudget(n,1000).level,level);
 assert.equal(storageBudget(1100,1000).remainingBytes,0);assert.equal(storageBudget(1100,1000).overBytes,100);assert.throws(()=>storageBudget(NaN,1000));
 const env={B2_KEY_ID:'key',B2_APPLICATION_KEY:'secret',B2_BUCKET_ID:'bucket'};
 let versionCalls=0,partCalls=0;
 ctx.fetch=async(url,options)=>{
  if(url.includes('b2_authorize_account'))return response({accountId:'account',authorizationToken:'token',apiInfo:{storageApi:{apiUrl:'https://example.test',allowed:{bucketId:'bucket'}}}});
  const body=JSON.parse(options.body);
  if(url.endsWith('b2_list_file_versions')){
   versionCalls++;if(versionCalls===1)return response({files:[{fileName:'media/photos/a',action:'hide',contentLength:0}],nextFileName:'media/photos/a',nextFileId:'old'});
   assert.equal(body.startFileId,'old');return response({files:[{fileName:'media/photos/a',action:'upload',contentLength:8},{fileName:'media/photos/a',action:'upload',contentLength:2},{fileName:'test-v71/t',action:'upload',contentLength:3}],nextFileName:null});
  }
  if(url.endsWith('b2_list_unfinished_large_files'))return response({files:[{fileId:'large',fileName:'messages/large'}],nextFileId:null});
  if(url.endsWith('b2_list_parts')){partCalls++;return response({parts:[{contentLength:partCalls===1?1:3}],nextPartNumber:partCalls===1?2:null});}
  throw Error('Unexpected request');
 };
 const scan=await storageB2(env);assert.equal(scan.usedBytes,17);assert.equal(scan.oldVersionBytes,10);assert.equal(scan.unfinishedBytes,4);assert.equal(scan.groups.gallery,10);assert.equal(scan.groups.test,3);assert.equal(scan.groups.messages,4);assert.equal(scan.accountComplete,false);assert.equal(scan.scope,'bucket');assert.equal(versionCalls,2);assert.equal(partCalls,2);assert(!JSON.stringify(scan).includes('secret'));
 let bucketReads=0;
 ctx.fetch=async(url)=>{
  if(url.includes('b2_authorize_account'))return response({accountId:'account',authorizationToken:'token',apiInfo:{storageApi:{apiUrl:'https://example.test',allowed:{}}}});
  if(url.endsWith('b2_list_buckets'))return response({buckets:[{bucketId:'a'},{bucketId:'b'}]});
  if(url.endsWith('b2_list_file_versions')){bucketReads++;return response({files:[{fileName:'same-name',action:'upload',contentLength:5}],nextFileName:null});}
  return response({files:[],nextFileId:null});
 };
 const account=await storageB2(env);assert.equal(account.accountComplete,true);assert.equal(account.usedBytes,10);assert.equal(account.oldVersionBytes,0);assert.equal(bucketReads,2);
 const cached={checkedAt:new Date().toISOString(),usedBytes:123};
 const cacheEnv={DB:{prepare(){return {bind(){return this},async first(){return {payload:JSON.stringify(cached)}},async run(){}}}}};
 const hit=await storageCached(cacheEnv,'b2',true,()=>{throw Error('must not rescan within one minute')});assert.equal(hit.usedBytes,123);assert.equal(hit.cached,true);
 cached.checkedAt='2000-01-01T00:00:00Z';const stale=await storageCached(cacheEnv,'b2',false,()=>{throw Error('B2 denied')});assert.equal(stale.stale,true);assert.equal(stale.usedBytes,123);
 console.log('OK: thresholds, overage, paginated versions, hidden history, unfinished parts, full/restricted account scope, no secret disclosure, cached and stale reports');
})().catch(e=>{console.error(e);process.exit(1)});
