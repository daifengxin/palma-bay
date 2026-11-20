'use strict';
const People=(()=>{
  const phone=new Gfx.Mesh();phone.box(0,0,0,.083,.145,.015,'#1e292f');phone.material=6;phone.box(0,.009,-.01,.07,.12,.006,'#9db5b9');phone.seal();
  const cup=new Gfx.Mesh();
  for(let i=0;i<12;i++){
    const at=(j,y,r)=>[r*Math.cos(j*Math.PI/6),y,r*Math.sin(j*Math.PI/6)];
    cup.quad([at(i,0,.033),at(i,.11,.043),at(i+1,.11,.043),at(i+1,0,.033)],'#d8c49b');
  }
  cup.seal();
  const locals=[
    {x:9,z:.58,angle:0,model:2,seat:true}, {x:12.4,z:2.82,angle:Math.PI,model:3,seat:true},
    {x:-9.1,z:-2.45,angle:2.7,model:1,seat:false}, {x:113.5,z:202.75,angle:.35,model:4,seat:false}
  ];
  let streetTime=0;
  const paths=[
    [[-6.9,-14],[-6.9,10],[-7.2,19]],[[7.3,-10],[7.1,4],[7.25,14]], [[-7.2,16],[7.2,16]],
    [[-15,-1.9],[-10,-1.9],[-6.9,3]],[[-27,33],[-36,45],[-43,58] ],
    [[10.9,57],[10.8,79]], [[-6.8,114],[-6.8,123],[-10,124.6]],
    [[6.9,118],[7.1,131],[6.9,143]],[[-4.8,114],[5.8,114]],
    [[99,242],[104,244],[110,244]],[[114,232],[118,237],[125,242]],
    [[-61,348],[-59,339],[-51,331]], [[-43.7,349],[-48,356]],
    [[-82,16],[-85,38],[-83,60]],[[-58,42],[-58,72]],[[-88,76],[-86,98]],[[-81,119],[-83,144]],
    [[44.5,30],[44.5,55]],[[61,32],[61,67]],[[45,62],[61,62]]
  ];
  const citizens=[];
  function resident(path,i,offset){const segments=[];let duration=0;
    for(let k=1;k<path.length;k++){
      const [x,z]=path[k-1],[X,Z]=path[k],len=Math.hypot(X-x,Z-z);
      segments.push({x,z,dx:(X-x)/len,dz:(Z-z)/len,len,start:duration});duration+=len;
    }
    return {segments,length:duration,speed:.92+(i%5)*.13,offset,model:1+i%4,t:0,x:0,z:0,yaw:0,walk:0,phase:0,cross:i===2||i===8};
  }
  paths.forEach((p,i)=>{citizens.push(resident(p,i,2.1+i*1.73));if(i===0||i===1||i===6||i===10)citizens.push(resident(p,i+13,15.6));});
  function updateOne(a,dt,car){
    const delay=2.8,period=2*a.length+2*delay;
    const t=(a.t+a.offset)%period,reverse=t>=a.length+delay;
    const d=Math.max(0,Math.min(a.length,reverse?2*a.length+delay-t:t));
    const s=a.segments.find(v=>d<v.start+v.len)||a.segments.at(-1),sign=reverse?-1:1;
    a.x=s.x+(d-s.start)*s.dx;a.z=s.z+(d-s.start)*s.dz;
    const moving=t<a.length||reverse&&t<2*a.length+delay;
    const blocked=car&&!a.cross&&Math.hypot(car.x-a.x,car.z-a.z)<3.1;
    a.walk=moving&&!blocked?.80:0;a.yaw=Math.atan2(s.dx*sign,s.dz*sign);
    if(!blocked)a.t+=dt*a.speed;
    if(a.walk)a.phase+=dt*4.75*a.speed;
  }
  const owner=resident([[0,0],[1,0]],1,0);
  let ownerActive=false;
  const drivers=[];
  function actors(){return [...citizens,...locals,...drivers,...(ownerActive?[owner]:[])];}
  function eject(v){
    const c=Math.cos(v.yaw),s=Math.sin(v.yaw);
    const pt=(side,fwd)=>[v.x-side*c+fwd*s,v.z+side*s+fwd*c];
    const path=[pt(1.85,0),pt(2.9,-1),pt(3.3,-7)];
    const a=resident(path,v.model+1,0);a.exit={x:v.x-.43*c,z:v.z+.43*s,t:0};a.age=0;
    drivers.push(a);a.x=a.exit.x;a.z=a.exit.z;a.yaw=v.yaw;return a;
  }
  function reset(){drivers.length=0;ownerActive=false;streetTime=0;for(const a of citizens){a.t=0;a.phase=a.offset;updateOne(a,0,null);}}
  function release(x,z){Object.assign(owner,resident([[x,z],[x-2.4,z-.6],[-6.9,z+1.3],[-6.9,21]],0,0));ownerActive=true;}
  function update(dt,car,walker=null){
    for(const a of citizens){
      if(Street.reacting(a))continue;
      updateOne(a,dt,car);
      const dx=walker?a.x-walker.x:0,dz=walker?a.z-walker.z:0,dist=walker?Math.hypot(dx,dz):Infinity;
      if(dist<.65){const side=dx*Math.cos(a.yaw)-dz*Math.sin(a.yaw)>=0?1:-1;
        a.x+=Math.cos(a.yaw)*side*(.65-dist);a.z-=Math.sin(a.yaw)*side*(.65-dist);}
    }
    for(let i=drivers.length-1;i>=0;i--){
      const a=drivers[i];a.age+=dt;if(a.age>24){drivers.splice(i,1);continue;}
      if(a.exit){
        const start=a.exit;a.exit.t=Math.min(1,start.t+dt/.65);
        const t=start.t*start.t*(3-2*start.t);a.x=start.x+(a.segments[0].x-start.x)*t;a.z=start.z+(a.segments[0].z-start.z)*t;
        a.walk=.25;a.phase+=dt*4;if(start.t>=1)a.exit=null;
      }else if(!Street.reacting(a))updateOne(a,dt*1.55,car);
    }
    if(ownerActive&&!Street.reacting(owner))updateOne(owner,dt,car);streetTime+=dt;
  }
  function drawModel(index,x,z,yaw,phase=0,speed=0,carry=0,reach=0,y=0,lean=0){CharacterPass.submit(index,x,z,yaw,phase,speed,carry,reach,y,lean);}
  function draw(camera){
    for(const a of locals){
      if(Math.hypot(a.x-camera.x,a.z-camera.z)>48||Street.drawReaction(a))continue;
      const y=a.seat?-.44:0;
      drawModel(a.model,a.x,a.z,a.angle,streetTime*.9+a.x,0,.84,a.seat?-1:0,y);
      const s=Math.sin(a.angle),c=Math.cos(a.angle),dx=.24,dz=.28;
      Gfx.draw(a.seat?cup:phone,a.x+c*dx+s*dz,Town.floorAt(a.x,a.z)+y+1.05,a.z-s*dx+c*dz,a.angle);
    }
    for(const a of [...citizens,...drivers,...(ownerActive?[owner]:[])]){
      if(Math.hypot(a.x-camera.x,a.z-camera.z)<80&&!Street.drawReaction(a))drawModel(a.model,a.x,a.z,a.yaw,a.phase,a.walk,0,a.exit?.t||0,a.exit?-.43*(1-a.exit.t):0);
    }}
  reset();return {citizens,actors,eject,reset,release,update,draw,drawModel};
})();
