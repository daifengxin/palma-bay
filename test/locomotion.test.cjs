const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../three-vendor.js');
const scope=vm.createContext({THREE,Town:{floorAt:()=>0},
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),turn:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a))});
function load(name,type){
  const text=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  return vm.runInContext(text+'\n'+type,scope);
}
const Builder=load('character-builder.js','CharacterBuilder');
const Locomotion=load('locomotion.js','Locomotion');
function simulation(){
  // The actual bind skeleton with an empty mesh; no GPU or texture generation required.
  const builder=Object.assign(Object.create(Builder.prototype),{geometry:new THREE.BufferGeometry(),drawMaterials:[]});
  const rig=builder.create(),p={x:0,z:0,yaw:0,height:0,vertical:0},motion=new Locomotion();
  function tick(x,z,dt=1/60,clear=()=>true){
    const delta=motion.move(p,dt,x,z,clear);
    motion.step(p,dt,delta,false);
    rig.root.scale.z=-1;rig.root.position.set(p.x,p.height,-p.z);rig.root.rotation.y=-p.yaw;
    motion.pose(rig,p,0,0);rig.root.updateMatrixWorld(true);
  }
  return {rig,p,motion,tick};
}
test('distance-driven cycle at 30, 60 and 120 Hz; no phase advance against a wall',()=>{
  const results=[];
  for(const hz of [30,60,120]){
    const {p,motion,tick}=simulation();
    for(let i=0;i<hz*2;i++)tick(0,5.5,1/hz);
    results.push([p.z,motion.walkCycle]);
    const prev=motion.walkCycle;
    for(let i=0;i<30;i++)tick(0,5.5,1/hz,()=>false);
    assert.equal(motion.currentSpeed,0);assert.equal(motion.walkCycle,prev);
  }
  for(const [distance,phase] of results){
    assert.ok(Math.abs(distance-10.725)<.00001);
    assert.ok(Math.abs(phase-results[0][1])<.012);
  }
});
test('stance pins heel and forefoot in world space through a sprint and corner',()=>{
  const {p,motion,rig,tick}=simulation(),previous=new Map(),sole=new THREE.Vector3();
  let samples=0,maxBank=0,contacts=0;
  for(let i=0;i<150;i++){
    tick(i<60?0:5.5,i<60?5.5:0);contacts+=motion.contacts.splice(0).length;
    maxBank=Math.max(maxBank,Math.abs(motion.bank));
    for(const f of motion.feet){
      if(!f.contact||i<15){previous.delete(f.side);continue;}
      const ankle=rig.nodes[f.side<0?'ankleL':'ankleR'];
      const down=[-.065,.13].map(z=>ankle.localToWorld(sole.set(0,-.105,z)).clone());
      if(previous.has(f.side)){
        for(const [j,v] of down.entries())assert.ok(v.distanceTo(previous.get(f.side)[j])<.001);
        samples++;
      }
      previous.set(f.side,down);
    }
  }
  assert.ok(samples>30&&contacts>=9&&maxBank>.1);
  assert.ok(Math.abs(rig.nodes.chest.rotation.x*180/Math.PI-17.5)<.1);
  const before=p.x;for(let i=0;i<9;i++)tick(0,0);
  assert.ok(p.x>before&&motion.currentSpeed<.35);
});
test('jump blend, landing and idle recovery',()=>{
  const {p,motion,tick}=simulation();
  for(let i=0;i<30;i++)tick(0,5.5);
  p.height=.3;p.vertical=1;tick(0,5.5);
  assert.ok(motion.weights.jump>0&&motion.weights.jump<.4);
  motion.contacts.length=0;
  for(let i=0;i<40;i++)tick(0,5.5);
  assert.equal(motion.contacts.length,0);
  p.height=p.vertical=0;tick(0,0);assert.ok(motion.weights.jump>.5);
  for(let i=0;i<90;i++)tick(0,0);
  assert.ok(motion.weights.idle>.999&&motion.feet.every(f=>f.contact));
  const sum=Object.values(motion.weights).reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<1e-9);
});
test('sprint contact effects expire and footprints only appear on sand',()=>{
  scope.Beach={shore:()=>-96};
  const Footfalls=load('footfalls.js','Footfalls');
  // Texture pixels are inspected in the browser. Here exercise the real event and material lifetime.
  Footfalls.prototype.texture=()=>new THREE.Texture();
  const fx=new Footfalls(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
  const contact={x:0,y:.025,z:0,side:1,yaw:.2,time:2};
  const events=[contact,{...contact,x:-70,y:-.06,time:2.1}];
  assert.ok(fx.update(events,4,2.1,camera));assert.equal(events.length,0);
  assert.equal(fx.clouds.length,6);assert.equal(fx.prints.length,1);
  assert.ok(fx.clouds.every(c=>c.mesh.material.opacity<1&&c.mesh.material.transparent));
  fx.update([],4.6,2.7,camera);assert.ok(fx.clouds.every(c=>!c.mesh.visible)&&fx.prints[0].mesh.visible);
  assert.equal(fx.update([],6.5,4.6,camera),false);
});
