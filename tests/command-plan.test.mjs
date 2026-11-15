import test from 'node:test';
import assert from 'node:assert/strict';
import { commandProvider, compileCommand, COMMAND_PLAN_SCHEMA } from '../server/commands.ts';
import { applyCommands, emptyScene, newObject, validateScene } from '../src/physics/scene.ts';
import { geometryParts } from '../src/physics/geometry.ts';
import { add, rotate } from '../src/physics/math.ts';
import { COMMAND_3D, INTERPRET_3D } from '../src/input/prompt.ts';
import { COMMAND_3D_SCHEMA } from '../src/input/schema.ts';

function fixture(kind='block') {
  const scene=emptyScene();
  const floor=Object.assign(newObject('platform','floor'),{width:20,height:.2,depth:20,position:{x:0,y:-.1,z:0},fixed:true});
  const part=Object.assign(newObject(kind,'part'),{width:2,height:1,depth:1,position:{x:0,y:.5,z:0}});
  scene.objects=[floor,part];
  return {scene:validateScene(scene),target:{experimentId:'e',versionId:'v',sourceId:'s',sourceRevision:0,sceneRevision:0,epoch:0},requestId:'r',transcript:'Make it a bit more inclined',selection:[],answers:[]};
}
const plan=operations=>JSON.stringify({requestId:'r',status:'proposed',operations,summary:['Propose 5 degrees more incline.'],questions:[],message:'Shall I apply this tilt?'});
function minimumY(body) {
  return Math.min(...geometryParts(body).flatMap(p=>{
    const points=p.vertices??[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>({x:x*p.size.x/2,y:y*p.size.y/2,z:z*p.size.z/2}))));
    return points.map(v=>add(body.position,rotate(body.rotation,add(p.position,rotate(p.rotation,v)))).y);
  }));
}

test('degrees compile to exact world rotations for every axis; floating objects retain position',async()=>{
  for(const axis of ['x','y','z']) {
    const req=fixture(), delta={x:0,y:0,z:0};delta[axis]=5;
    const result=JSON.parse(await compileCommand(plan([{type:'rotate-degrees',id:'part',deltaDegrees:delta,supportId:null}]),req));
    assert.equal(result.operations.length,1);const q=result.operations[0].rotation;
    assert.ok(Math.abs(q[axis]-Math.sin(5*Math.PI/360))<1e-12);
    assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-12);
    const next=applyCommands(req.scene,{baseSceneRevision:0,operations:result.operations});
    assert.deepEqual(next.objects[1].position,req.scene.objects[1].position);
  }
});

test('real shape casts keep tilted boxes, convex wedges and offset compounds on their support',async()=>{
  for(const kind of ['block','ramp','compound']) {
    const req=fixture(kind==='compound'?'block':kind);
    if(kind==='compound') req.scene.objects[1].geometry=[{shape:'box',size:{x:1,y:1,z:1},position:{x:.2,y:.3,z:0},rotation:{x:0,y:0,z:0,w:1}},{shape:'box',size:{x:.3,y:1,z:.3},position:{x:-.4,y:-.3,z:0},rotation:{x:0,y:0,z:0,w:1}}];
    const result=JSON.parse(await compileCommand(plan([{type:'rotate-degrees',id:'part',deltaDegrees:{x:0,y:0,z:-5},supportId:'floor'}]),req));
    assert.deepEqual(result.operations.map(o=>o.type),['rotate','move']);
    const next=applyCommands(req.scene,{baseSceneRevision:0,operations:result.operations});
    assert.ok(Math.abs(minimumY(next.objects[1]))<2e-5,`${kind}: ${minimumY(next.objects[1])}`);
    assert.equal(next.objects[1].position.x,req.scene.objects[1].position.x);
    assert.equal(next.objects[1].position.z,req.scene.objects[1].position.z);
  }
});

test('declared seating uses the changed support and scalar edits retain their canonical contract',async()=>{
  const req=fixture('ramp');const ball=Object.assign(newObject('ball','ball'),{width:.5,height:.5,depth:.5,position:{x:-.4,y:3,z:0}});req.scene.objects.push(ball);
  const result=JSON.parse(await compileCommand(plan([{type:'rotate-degrees',id:'part',deltaDegrees:{x:0,y:0,z:-5},supportId:'floor'},{type:'seat-on-support',id:'ball',supportId:'part'},{type:'set-property',id:'ball',property:'mass',value:1.25}]),req));
  assert.deepEqual(result.operations.map(o=>o.type),['rotate','move','move','set-property']);
  const next=applyCommands(req.scene,{baseSceneRevision:0,operations:result.operations});
  assert.equal(next.objects[2].mass,1.25);assert.ok(next.objects[2].position.y<3 && next.objects[2].position.y>.25);
  assert.deepEqual(req.scene.objects[2].position,ball.position,'Compiler must not mutate the user scene');
});

test('bad IDs, self/absent supports, missing/invalid degrees, unrelated fields and rejected quaternions fail closed',async()=>{
  const good={type:'rotate-degrees',id:'part',deltaDegrees:{x:0,y:0,z:-5},supportId:'floor'};
  for(const op of [{...good,id:'absent'},{...good,supportId:'part'},{...good,supportId:'absent'},{...good,deltaDegrees:undefined},{...good,deltaDegrees:{x:0,y:0,z:361}},{...good,deltaDegrees:{x:0,y:0,z:'five'}},{...good,repair:true},{type:'rotate',id:'part',rotation:{x:.087155,y:0,z:-.087155,w:.992403}}]) await assert.rejects(compileCommand(plan([op]),fixture()));
  const req=fixture();req.scene.objects[0].position.x=100;
  await assert.rejects(compileCommand(plan([good]),req),/not beneath/);
  await assert.rejects(compileCommand(plan([{type:'set-property',id:'part',property:'mass',value:101}]),fixture()),/Mass/);
});

test('only free-provider command generation gets the degrees schema; canonical schema is untouched',async()=>{
  const inputs=[];const provider=commandProvider({complete:async input=>{inputs.push(input);return plan([{type:'set-property',id:'part',property:'mass',value:1.25}]);}});
  const input={instructions:COMMAND_3D,request:fixture(),outputSchema:COMMAND_3D_SCHEMA,signal:new AbortController().signal};
  const reply=JSON.parse(await provider.complete(input));assert.equal(reply.status,'proposed');
  assert.equal(inputs[0].outputSchema,COMMAND_PLAN_SCHEMA);assert.match(inputs[0].instructions,/NEVER emit a body rotate operation/);
  assert.ok(COMMAND_3D_SCHEMA.$defs.operation.anyOf.some(b=>b.properties.type.enum[0]==='rotate'));
  await provider.complete({...input,instructions:INTERPRET_3D});assert.equal(inputs[1].outputSchema,COMMAND_3D_SCHEMA);
});
