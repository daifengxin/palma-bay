'use strict';
const Driving=(()=>{
  // Axle offsets, footprint and longitudinal speed are in metres and seconds.
  const sport={name:'海风 GT · 复古跑车',max:36,accel:11.2,grip:7.9,handGrip:1.28,turn:1.79,halfW:1.02,halfL:2.39,spring:86,track:.94,axle:1.47};
  const muscle={name:'棕榈 V8 · 肌肉车',max:29,accel:10.1,grip:11.8,handGrip:2.8,turn:1.46,halfW:1.14,halfL:2.69,spring:66,track:1.03,axle:1.61};
  const police={name:'海湾巡逻 · 警车',max:32,accel:10.6,grip:10.1,handGrip:2.0,turn:1.56,halfW:1.09,halfL:2.58,spring:76,track:.99,axle:1.51};
  const type=id=>id===1?muscle:id===2?police:sport;
  const corners=[[-1,1],[1,1],[-1,-1],[1,-1]];
  function reset(car){
    Object.assign(car,{slide:0,pitch:0,bank:0,lift:0,brake:false,spin:0,steering:0,roll:0,
      springs:corners.map(()=>({h:0,v:0,road:0}))});
  }
  function roadHeight(x,z,offroad){
    const grain=.009*Math.sin(z*2.27+x*.63)+.006*Math.cos(x*2.67-z*.61);
    return grain*(offroad?3:1)+.038*Math.exp(-(((z-4)/.52)**2));
  }
  function step(car,dt,go,steer,hand,offroad,wet,boost=false){
    if(!car.springs)reset(car);
    const p=type(car.model),old=car.speed;
    car.brake=hand||go*old<-.2;
    const resistance=hand?16:go?1.1:3.5;
    car.speed-=Math.sign(old)*Math.min(Math.abs(old),resistance*dt);
    if(!hand)car.speed+=go*dt*(go*old<-.2?16:p.accel*(boost?1.86:1));
    const top=p.max*(boost?1.32:1),cap=offroad?4.1:top;
    if(car.speed>cap)car.speed=Math.max(cap,car.speed-dt*17);
    car.speed=clamp(car.speed,-6,Math.max(top,old));
    car.steering+=(steer-car.steering)*(1-Math.exp(-dt*8));
    const grip=(hand?p.handGrip:p.grip)*(1-wet*.31)*(offroad?.76:1);
    const yawRate=car.steering*p.turn*clamp(car.speed/4,-1,1)/(1+Math.max(0,Math.abs(car.speed)-9)*.05)*(hand?1.32:1);
    // Rotate body-space velocity into the new heading, then let tyre grip remove lateral slip.
    car.slide=(car.slide-car.speed*yawRate*dt)*Math.exp(-grip*dt);
    if(Math.abs(car.speed)<.2)car.slide*=Math.exp(-12*dt);
    const yaw=car.yaw+yawRate*dt,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const x=car.x+(sn*car.speed+cs*car.slide)*dt,z=car.z+(cs*car.speed-sn*car.slide)*dt;
    const loadForward=clamp((car.speed-old)/dt*.004,-.085,.07),loadSide=clamp(car.speed*yawRate*.006,-.11,.11);
    for(let i=0;i<4;i++){
      const [s,f]=corners[i],w=car.springs[i],dx=s*p.track,dz=f*p.axle;
      w.road=roadHeight(x+dx*cs+dz*sn,z-dx*sn+dz*cs,offroad);
      const rest=w.road+loadForward*f+loadSide*s;
      w.v+=((rest-w.h)*p.spring-2*Math.sqrt(p.spring)*.72*w.v)*dt;
      w.h+=w.v*dt;
    }
    const h=car.springs.map(w=>w.h);
    car.lift=(h[0]+h[1]+h[2]+h[3])*.25;
    car.pitch=(h[2]+h[3]-h[0]-h[1])/(4*p.axle);
    car.bank=(h[1]+h[3]-h[0]-h[2])/(4*p.track);
    car.roll+=car.speed*dt/.416;
    return {x,z,yaw};
  }
  return {step,reset,type,corners};
})();
