'use strict';
const Traffic=(()=>{
  const roads=Town.roads;
  const forward=i=>roads[i].points;
  const reverse=i=>[...forward(i)].reverse();
  function loop(...sections){
    const points=sections.flat().filter((v,i,a)=>!i||v[0]!==a[i-1][0]||v[1]!==a[i-1][1]);
    const path=[];let length=0;
    for(let i=0;i<points.length-1;i++){
      const [x,z]=points[i],[X,Z]=points[i+1],dx=X-x,dz=Z-z,len=Math.hypot(dx,dz);
      path.push({x,z,dx:dx/len,dz:dz/len,len,at:length});length+=len;
    }return {path,length};
  }
  const loops=[loop(forward(1),reverse(2)),loop(forward(4),reverse(5)),loop(forward(6).slice(0,-1),reverse(7).slice(1))];
  const cars=[];
  loops.forEach((track,index)=>{
    for(let j=0;j<3;j++)cars.push({track,offset:track.length*(j+.36)/3,velocity:(j%2?-1:1)*(4.7+index+j*.46),model:j%3,x:0,z:0,yaw:0});
  });
  const boulevard=loop([[53,25],[53,116]],reverse(14));
  for(let i=0;i<4;i++)cars.push({track:boulevard,offset:48+i*38,velocity:(i%2?-1:1)*(5+i*.5),lane:i<2?1.78:5.18,model:i%3,x:0,z:0,yaw:0});
  const fleet=cars.slice();
  fleet.forEach((v,i)=>{v.garageId='traffic-'+i;});
  function reset(){
    cars.splice(0,cars.length,...fleet);
    for(const v of cars){delete v.distance;v.waitUntil=0;v.crash=null;v.lift=v.pitch=v.bank=0;}
    update(0);
  }
  let lastTime=0;
  function update(t,player=null,parked=[]){
    const dt=Math.max(0,Math.min(.1,t-lastTime));lastTime=t;

    for(const car of cars){
      if(car.crash)continue;
      const {path,length}=car.track;
      if(!player||car.distance===undefined){car.distance=car.offset+t*car.velocity;car.pace=Math.abs(car.velocity);}
      else{
        // Brake for a stopped car in this lane and resume when the junction clears.
        const fx=Math.sin(car.yaw),fz=Math.cos(car.yaw);
        let target=Math.abs(car.velocity);
        if(car.track===boulevard&&Math.abs(car.x-53)<6.9&&Math.abs(fz)>.9&&Town.signal(t,0)!==2){
          const gap=(fz>0?56.5-car.z:car.z-69.5);
          if(gap>=-.25&&gap<11)target=Math.min(target,Math.max(0,gap*.95));
        }
        for(const obstacle of [player,...cars,...parked]){
          if(obstacle===car)continue;
          const dx=obstacle.x-car.x,dz=obstacle.z-car.z,ahead=dx*fx+dz*fz;
          if(ahead>0&&ahead<13&&Math.abs(dx*fz-dz*fx)<2.15)
            target=Math.min(target,Math.max(0,(ahead-5)*.96));
        }
        if(t<car.waitUntil)target=0;
        car.pace+=Math.max(-12*dt,Math.min(4.2*dt,target-car.pace));
        car.distance+=Math.sign(car.velocity)*car.pace*dt;
      }
      const d=((car.distance%length)+length)%length;
      const s=path.find(segment=>d<segment.at+segment.len)||path.at(-1),u=d-s.at,side=Math.sign(car.velocity);
      const lane=car.track===boulevard&&s.x===53&&s.dx===0?car.lane:1.85;
      car.x=s.x+s.dx*u+s.dz*lane*side;car.z=s.z+s.dz*u-s.dx*lane*side;
      car.yaw=Math.atan2(s.dx*side,s.dz*side);
    }
  }
  function overlap(x,z,yaw,other,self=null){
    const dx=other.x-x,dz=other.z-z;
    if(Math.abs(dx)>6.1||Math.abs(dz)>6.1)return false;
    // Separating axes for two oriented vehicle footprints.
    const ax=[Math.cos(yaw),-Math.sin(yaw)],az=[Math.sin(yaw),Math.cos(yaw)];
    const bx=[Math.cos(other.yaw),-Math.sin(other.yaw)],bz=[Math.sin(other.yaw),Math.cos(other.yaw)];
    const dot=(a,b)=>Math.abs(a[0]*b[0]+a[1]*b[1]);
    const a=self?Driving.type(self.model):{halfW:1.03,halfL:2.30},b=other.track?{halfW:1.03,halfL:2.30}:Driving.type(other.model);
    return [ax,az,bx,bz].every(n=>Math.abs(dx*n[0]+dz*n[1])<a.halfW*dot(n,ax)+a.halfL*dot(n,az)+b.halfW*dot(n,bx)+b.halfL*dot(n,bz));
  }
  update(0);
  return {cars,reset,update,overlap};
})();
