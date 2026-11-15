import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenRouterProvider, OPENROUTER_FREE_MODEL } from '../server/openrouter.ts';
import { buildProviders } from '../server/providers.ts';

const key='PRIVATE_KEY_SENTINEL';
const signal=new AbortController().signal;
const image='data:image/png;base64,YWJj';
const envelope=(content='{}',extra={})=>JSON.stringify({model:'nvidia/nemotron-3.5-super-vl',usage:{cost:0},choices:[{message:{role:'assistant',content},finish_reason:'stop'}],...extra});
const input={instructions:'Trusted instructions',request:{requestId:'r',source:{kind:'photo',image}},signal};

test('pinned free vision request has zero price ceilings, no fallback/plugin, actual image input and no duplicated data URL',async()=>{
  let calls=0;
  const provider=createOpenRouterProvider(key,async(url,init)=>{
    calls++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(init.redirect,'error');assert.equal(init.headers.authorization,`Bearer ${key}`);assert.equal(init.signal,signal);
    const body=JSON.parse(init.body);assert.equal(body.model,OPENROUTER_FREE_MODEL);assert.match(body.model,/:free$/);
    assert.deepEqual(body.provider,{allow_fallbacks:false,require_parameters:true,max_price:{prompt:0,completion:0,image:0,request:0}});
    assert.equal(body.models,undefined);assert.equal(body.plugins,undefined);assert.equal(body.stream,false);assert.equal(body.max_tokens,16384);
    assert.deepEqual(body.response_format,{type:'json_object'});assert.deepEqual(body.reasoning,{enabled:true,max_tokens:2048,exclude:true});
    assert.deepEqual(body.messages[1].content[0],{type:'image_url',image_url:{url:image}});assert.ok(!body.messages[1].content[1].text.includes(image));
    return {ok:true,status:200,text:async()=>envelope()};
  });
  assert.equal(await provider.complete(input),'{}');assert.equal(calls,1);
});

test('free response requires verified zero cost, complete assistant text, no tool/refusal/truncation and bounded output',async()=>{
  for(const raw of ['bad','null',envelope('',{}),envelope('{}',{usage:{cost:.01}}),envelope('{}',{usage:{}}),envelope('{}',{choices:[{message:{role:'assistant',content:'{}'},finish_reason:'length'}]}),envelope('{}',{choices:[{message:{role:'assistant',content:'{}',tool_calls:[{}]},finish_reason:'stop'}]})]) {
    const provider=createOpenRouterProvider(key,async()=>({ok:true,status:200,text:async()=>raw}));
    await assert.rejects(provider.complete(input),{kind:raw==='bad'||raw==='null'||!raw.includes('length')?'invalid':'truncated'});
  }
});

test('errors never retry, follow redirects or expose credentials; caller abort reaches the free transport',async()=>{
  assert.throws(()=>createOpenRouterProvider(''),/key/);
  for(const status of [401,402,403,429,500]){
    let calls=0;const provider=createOpenRouterProvider(key,async()=>{calls++;return {ok:false,status,text:async()=>assert.fail('Do not read private error body')};});
    await assert.rejects(provider.complete(input),error=>error.kind==='http'&&!error.safeMessage.includes(key));assert.equal(calls,1);
  }
  const controller=new AbortController();let calls=0;
  const provider=createOpenRouterProvider(key,async(url,init)=>{calls++;controller.abort();throw new Error(key);});
  await assert.rejects(provider.complete({...input,signal:controller.signal}));assert.equal(calls,1);
  await assert.rejects(provider.complete({...input,signal:controller.signal}));assert.equal(calls,1);
});

test('free provider requires explicit name, live-call opt-in and server key; unrelated providers remain untouched',()=>{
  assert.deepEqual(buildProviders({NOX_MODEL_PROVIDER:'openrouter',NOX_OPENROUTER_API_KEY:key}),{});
  assert.deepEqual(buildProviders({NOX_LIVE_CALLS:'enabled',NOX_MODEL_PROVIDER:'openrouter'}),{});
  assert.deepEqual(Object.keys(buildProviders({NOX_LIVE_CALLS:'enabled',NOX_MODEL_PROVIDER:'openrouter',NOX_OPENROUTER_API_KEY:key})),['openrouter']);
});

test('free native schema passes the trusted bounds while compound-connection guidance applies only to drawings',async()=>{
  const schema={type:'object',properties:{scale:{type:'number',minimum:5,maximum:500}},required:['scale'],additionalProperties:false};
  const requests=[];const provider=createOpenRouterProvider(key,async(url,init)=>{requests.push(JSON.parse(init.body));return{ok:true,status:200,text:async()=>envelope()};});
  await provider.complete({...input,outputSchema:schema});
  assert.deepEqual(requests[0].response_format,{type:'json_schema',json_schema:{name:'nox_response',strict:true,schema}});
  assert.match(requests[0].messages[0].content,/one compound body/);
  await provider.complete({...input,request:{requestId:'command',transcript:'Change the ball'},outputSchema:schema});
  assert.equal(requests[1].messages[0].content,input.instructions);
  assert.deepEqual(requests[1].reasoning,{enabled:false});
});

test('a free-pivot claim without a real hinge asks a critical question instead of silently simulating contact only',async()=>{
  const complete=async(plan,notes='The lever rotates freely about the drawn pivot. No motor.',answers=[])=>JSON.parse(await createOpenRouterProvider(key,async()=>({ok:true,status:200,text:async()=>envelope(JSON.stringify(plan))})).complete({...input,request:{...input.request,notes,answers}}));
  const missing={status:'ready',constraints:null,message:'The lever is hinged freely.'};
  const guarded=await complete(missing);assert.equal(guarded.status,'needs-clarification');assert.deepEqual(guarded.bodies,[]);assert.match(guarded.questions[0].prompt,/two parts/);
  const stillMissing=await complete(missing,undefined,[{question:guarded.questions[0].prompt,answer:guarded.questions[0].options[0]}]);assert.equal(stillMissing.status,'rejected');assert.deepEqual(stillMissing.questions,[],'Do not repeat an already answered question forever');
  const hinge={status:'ready',constraints:[{type:'hinge'}]};assert.deepEqual(await complete(hinge),hinge);
  assert.deepEqual(await complete(missing,'Use a rigid display model without a hinge or pivot.'),missing);
});
