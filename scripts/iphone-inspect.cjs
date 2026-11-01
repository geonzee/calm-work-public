// Read-only: evaluate an expression in a page on a USB-connected iPhone through ios_webkit_debug_proxy.
// Usage: ios_webkit_debug_proxy -c null:9221,:9222-9322 &  then  node scripts/iphone-inspect.cjs <page id from localhost:9222/json> "<expression>"
const page=process.argv[2]||'3';const expr=process.argv[3];
const ws=new WebSocket(`ws://localhost:9222/devtools/page/${page}`);
let id=0,target=null;const send=(m)=>ws.send(JSON.stringify(m));
const run=()=>{const inner={id:++id,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise:true}};
 if(target)send({id:++id,method:'Target.sendMessageToTarget',params:{targetId:target,message:JSON.stringify(inner)}});else send(inner);};
ws.onopen=()=>{setTimeout(()=>{if(!target)run();},800);};
ws.onmessage=(e)=>{const m=JSON.parse(e.data);
 if(m.method==='Target.targetCreated'&&!target){target=m.params.targetInfo.targetId;run();return;}
 if(m.method==='Target.dispatchMessageFromTarget'){const r=JSON.parse(m.params.message);if(r.result){console.log(JSON.stringify(r.result.result?.value??r.result,null,1));process.exit(0);}if(r.error){console.log(r.error);process.exit(1);}return;}
 if(m.result&&m.result.result){console.log(JSON.stringify(m.result.result.value??m.result.result,null,1));process.exit(0);}
 if(m.error){console.log(m.error);process.exit(1);}};
setTimeout(()=>{console.log('timeout');process.exit(2);},10000);
