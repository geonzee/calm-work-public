import{test}from'node:test';import assert from'node:assert/strict';import{createOnline}from'../src/server.mjs';
const owner='synthetic-proxy-owner-token-long-enough';
test('rate limiting ignores untrusted forwarding and accepts only explicitly trusted proxy peers',async()=>{
 const plain=await createOnline({ownerToken:owner,store:{}}),trusted=await createOnline({ownerToken:owner,store:{},trustedProxy:['127.0.0.1']});
 try{
  let denied=0;for(let i=0;i<95;i++){const r=await plain.inject({url:'/health',remoteAddress:'198.51.100.1',headers:{'x-forwarded-for':'203.0.113.'+i}});if(r.statusCode===429)denied++;}assert.equal(denied,5);
  for(let i=0;i<95;i++){const r=await trusted.inject({url:'/health',remoteAddress:'127.0.0.1',headers:{'x-forwarded-for':'203.0.113.'+i}});assert.equal(r.statusCode,200);}
  await assert.rejects(createOnline({ownerToken:owner,store:{},trustedProxy:true}),/allowlist/);
 }finally{await plain.close();await trusted.close();}
});
