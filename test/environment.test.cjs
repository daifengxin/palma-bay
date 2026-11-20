const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../three-vendor.js');

function simulation(){
  class Mesh{box(){} quad(){} seal(){return this;}}
  const ped={x:62,z:52,model:1};
  const scope=vm.createContext({Gfx:{Mesh,draw(){}},THREE,
    Town:{fixtures:['lamp','umbrella','fence'].map((kind,i)=>({kind,x:i*12,z:10})),floorAt:()=>0,nearestRoad:()=>({edge:1}),blocks:[]},
    People:{actors:()=>[ped],eject(){}},Traffic:{cars:[]},Driving:{type:()=>({halfW:1,halfL:2})},
    camera:{x:61,z:50},car:{x:64,z:52,yaw:0,speed:0},player:{x:61.3,z:46,height:0},
    state:{activity:'roam',vehicle:false},held:new Set(),NightMarket:{},Bay:{swimmer:()=>false},audio:null,
    driveable:()=>true,dist:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),parked:[],elapsed:0});
  for(const f of ['street','city-effects'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f+'.js'),'utf8'),scope);
  const [fx,street]=vm.runInContext('[CityEffects,Street]',scope);
  const tick=n=>{for(let i=0;i<n;i++){street.tick(1/60);fx.tick(1/60);}};
  return {fx,street,scope,ped,tick};
}

test('a struck hydrant keeps emitting translucent water at its original base after landing',()=>{
  const {fx,scope,tick}=simulation();
  const h=fx.props.find(p=>p.kind==='hydrant');
  Object.assign(scope.car,{x:h.x,z:h.z-3});
  assert.ok(fx.vehicleHit(h.x,h.z-2,0,1));assert.equal(h.state,'standing');
  fx.vehicleHit(h.x,h.z-2,0,14);tick(360);
  assert.equal(h.state,'fallen');assert.ok(h.flow&&h.z>h.homeZ+2);
  const scene=new THREE.Scene();assert.ok(fx.renderParticles(scene,720));
  const cloud=scene.children[0];assert.ok(cloud.material.transparent&&!cloud.material.depthWrite);
  const g=cloud.geometry;assert.ok(g.drawRange.count>100);
  const fresh=Array.from({length:g.drawRange.count},(_,i)=>i).some(i=>Math.abs(g.attributes.position.getX(i)-h.homeX)<.2&&g.attributes.position.getY(i)<.5&&g.attributes.opacity.getX(i)<.6);
  assert.ok(fresh);
  for(const p of fx.props.filter(p=>['umbrella','mailbox','fence','lamp'].includes(p.kind))){
    fx.vehicleHit(p.x,p.z,0,12);assert.equal(p.state,'flying');
  }
  fx.reset();assert.equal(fx.renderParticles(scene,720),false);assert.ok(fx.props.every(p=>p.state==='standing'));
});

test('shots respect walls and each member of a chain waits its own half second',()=>{
  const {fx,street,scope,ped,tick}=simulation();
  const [a,b]=fx.props.filter(p=>p.kind==='canister'||p.kind==='drum');
  Object.assign(scope.player,{x:a.x,z:a.z-4});scope.Town.blocks.push({x:a.x,z:a.z-2,w:1,d:.5});
  street.fire(0,.17,20);assert.equal(a.state,'standing');scope.Town.blocks=[];
  street.fire(0,.17,20);assert.equal(a.state,'armed');tick(29);assert.equal(a.state,'armed');
  tick(1);assert.equal(a.state,'spent');assert.equal(b.state,'armed');
  assert.ok(street.reacting(ped)&&scope.car.crash);
  const view={x:60,y:3,z:54,pitch:.1};assert.notDeepEqual(fx.shaken(view),view);
  tick(29);assert.ok(scope.car.lift>0);assert.equal(b.state,'armed');
  tick(1);assert.equal(b.state,'spent');tick(260);assert.equal(scope.car.crash,null);
  fx.reset();const hit=fx.props.find(p=>p.kind==='drum');fx.vehicleHit(hit.x,hit.z,.3,16);tick(30);assert.equal(hit.state,'spent');
});
