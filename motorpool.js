'use strict';
const Motorpool=(()=>{
  const fleet=Town.fleet;
  const makeLamp=(color,w,h,d)=>{const m=new Gfx.Mesh();m.material=6;m.box(0,0,0,w,h,d,color);return m.seal();};
  const brake=makeLamp('#ff241b',.52,.10,.055),red=makeLamp('#ff2348',.52,.13,.27),blue=makeLamp('#268fff',.52,.13,.27);
  const spark=makeLamp('#ffca72',.035,.035,.12);
  const patch=new Gfx.Mesh();patch.material=16;patch.plane(0,0,2.78,5.46,.064,'#211f25');patch.seal();
  const sparks=[];
  function draw(car,opening,time){
    const id=car.model,p=Driving.type(id),cs=Math.cos(car.yaw),sn=Math.sin(car.yaw);
    const world=(x,z)=>[car.x+x*cs+z*sn,car.z-x*sn+z*cs];
    const lamp=(mesh,dx,y,dz)=>{const [x,z]=world(dx,dz);Gfx.draw(mesh,x,y+(car.lift||0),z,car.yaw);};
    if(id===-1||id===undefined)HeroCar.draw(car,opening);
    else{
      Gfx.contact(patch,car.x,car.z,car.yaw);
      const m=fleet[id];Gfx.draw(m.body,car.x,car.lift||0,car.z,car.yaw,car.pitch||0,car.bank||0);
      for(const w of m.wheelParts){
        const {s,f}=w,[x,z]=world(s*p.track,f*p.axle);
        const idx=(f>0?0:2)+(s>0?1:0),contact=car.crash?(car.lift||0)-f*p.axle*Math.sin(car.pitch||0)+s*p.track*Math.sin(car.bank||0):(car.springs?.[idx]?.road||0);
        Gfx.draw(w.mesh,x,.428+contact,z,car.yaw+(f>0?(car.steering||0)*.44:0),car.roll||0);
      }
      if(opening>.015){const [x,z]=world(-p.halfW,.55);Gfx.draw(m.door,x,.44+(car.lift||0),z,car.yaw+opening*1.08);}
      if(id===2&&car.siren){
        const phase=time*6%2;
        if(phase<.76)lamp(red,-.31,1.84,-.17);
        if(phase>1&&phase<1.76)lamp(blue,.31,1.84,-.17);
      }
    }
    if(car.brake){for(const s of [-1,1])lamp(brake,s*.68,.68,-p.halfL-.11);}
  }
  function impact(car,speed){
    const dir=car.speed<0?-1:1;
    for(let i=0;i<Math.min(18,Math.ceil(speed));i++){
      const side=(Math.random()-.5)*1.55,sn=Math.sin(car.yaw),cs=Math.cos(car.yaw),nose=Driving.type(car.model).halfL*dir;
      sparks.push({x:car.x+sn*nose+cs*side,y:.46,z:car.z+cs*nose-sn*side,
        vx:(Math.random()-.5)*4,vy:1+Math.random()*2.6,vz:(Math.random()-.5)*4,life:.28+Math.random()*.28});
    }
  }
  function tick(dt){for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.life-=dt;if(s.life<=0){sparks.splice(i,1);continue;}
    s.vy-=9.8*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}}
  function drawSparks(){for(const s of sparks)Gfx.draw(spark,s.x,Math.max(.06,s.y),s.z,Math.atan2(s.vx,s.vz));}
  const dash=new Gfx.Mesh();dash.box(0,.75,.98,1.82,.19,.48,'#303339');
  dash.material=1;dash.box(0,.65,1.78,1.82,.15,.89,'#54545c');
  dash.material=0;dash.box(-.39,.91,.84,.53,.09,.13,'#31383a');
  for(let j=0;j<36;j++){const pt=(k,r)=>[-.39+r*Math.cos(k*Math.PI/18),1.04+r*Math.sin(k*Math.PI/18),.88];
    dash.quad([pt(j,.183),pt(j+1,.183),pt(j+1,.154),pt(j,.154)],'#292b2b');}
  dash.box(-.39,1.02,.87,.15,.06,.04,'#747573');dash.seal();
  function cabin(car){Gfx.draw(dash,car.x,car.lift||0,car.z,car.yaw,car.pitch||0,car.bank||0);}
  return {draw,cabin,impact,tick,drawSparks,reset:()=>{sparks.length=0;}};
})();
