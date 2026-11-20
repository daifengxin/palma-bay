const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(scope,name){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'),scope);
}

// The asphalt is a strip swept along each segment with a circular cap at each end.
function segmentClearance(rect,a,b){
  const [ax,az]=a,[bx,bz]=b,dx=bx-ax,dz=bz-az;
  const {x,z,w,d}=rect;
  const nearX=Math.abs(x-(ax+bx)/2)<=(w+Math.abs(dx))/2;
  const nearZ=Math.abs(z-(az+bz)/2)<=(d+Math.abs(dz))/2;
  if(nearX&&nearZ&&Math.abs((x-ax)*dz-(z-az)*dx)<=(w*Math.abs(dz)+d*Math.abs(dx))/2)return 0;
  const toRect=(px,pz)=>Math.hypot(Math.max(0,Math.abs(px-x)-w/2),Math.max(0,Math.abs(pz-z)-d/2));
  let distance=Math.min(toRect(ax,az),toRect(bx,bz));
  for(const px of [x-w/2,x+w/2])for(const pz of [z-d/2,z+d/2]){
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(px-ax-t*dx,pz-az-t*dz));
  }
  return distance;
}

test('buildings, collision walls and visible roadside props clear the full paved width',()=>{
  class Mesh{
    constructor(){this.props=[];}
    box(x,y,z,w,h,d){if(y<3&&y+h>.3)this.props.push({x,z,w,d});}
    sign(){} quad(){} plane(){} strip(){} seal(){return this;}
  }
  const scope=vm.createContext({makeCoupe(){},Gfx:{Mesh,label(){},uploadAtlas(){},bakeShadows(){},captureStreet(){}}});
  for(const module of ['beach','night-blocks','town'])load(scope,module);
  const {roads,blocks,world}=vm.runInContext('Town',scope);
  assert.ok(roads.length>=16&&blocks.length>=100&&world.props.length>100);
  for(const rect of [...blocks,...world.props]){
    for(const road of roads)for(let i=1;i<road.points.length;i++){
      const gap=segmentClearance(rect,road.points[i-1],road.points[i])-road.width/2;
      assert.ok(gap>=-1e-7,'Road overlap at '+JSON.stringify(rect)+' on segment '+JSON.stringify(road.points.slice(i-1,i+1)));
    }
  }
});

test('two active minutes advance the clock one hour, including across midnight',()=>{
  const scope=vm.createContext({});load(scope,'climate');
  const climate=vm.runInContext('Climate',scope);
  assert.equal(climate.time(),'17:39');
  for(let i=0;i<480;i++)climate.tick(.25);
  assert.equal(climate.time(),'18:39');
  climate.nextTime();assert.equal(climate.time(),'22:00');
  climate.tick(240);assert.equal(climate.time(),'00:00');
  climate.tick(48*60);assert.equal(climate.time(),'00:00');
});
