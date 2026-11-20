'use strict';

// Street events use game metres and advance on the physics clock, including while a door opens.
const Street=(()=>{
  const reactions=new Map(),greetings=new Map(),drops=[];
  const cash=new Gfx.Mesh();
  cash.box(0,.02,0,.34,.045,.17,'#458965');
  cash.box(0,.046,0,.09,.012,.18,'#eedca2');
  cash.seal();
  let flagged=null,hornAt=-10;
  const open=()=>state.activity==='roam'&&!NightMarket.inside&&!NightMarket.sublevel&&!Bay.swimmer();
  function reset(){reactions.clear();greetings.clear();drops.length=0;flagged=null;hornAt=-10;}
  const door=v=>({x:v.x-1.5*Math.cos(v.yaw),z:v.z+1.5*Math.sin(v.yaw)});
  function nearest(list,p,limit){
    let best=null;
    for(const v of list){const d=dist(p,v);if(d<limit){best=v;limit=d;}}
    return best;
  }
  function candidate(){
    return nearest(Traffic.cars.filter(v=>!v.crash),player,8);
  }
  function interact(){
    if(!open()||state.vehicle||state.seat)return false;
    const bill=nearest(drops,player,1.8);
    if(bill){
      drops.splice(drops.indexOf(bill),1);NightMarket.credit(bill.value);
      note('捡到现金　+$'+bill.value);return true;
    }
    // Preserve the original active and parked door actions when both are within reach.
    if(spareNear()||dist(player,driverDoor())<1.55)return false;
    const v=flagged&&dist(player,flagged)<9?flagged:candidate();
    if(!v)return false;
    if(v===flagged&&v.pace<.65&&dist(player,door(v))<2.25){
      const slot=Traffic.cars.indexOf(v);if(slot<0)return false;
      Traffic.cars.splice(slot,1);flagged=null;
      parked.push({garageId:car.garageId,model:car.model,x:car.x,z:car.z,yaw:car.yaw});
      People.eject(v);
      Object.assign(car,{garageId:v.garageId,model:v.model,x:v.x,z:v.z,yaw:v.yaw,speed:0});
      Driving.reset(car);state.owned=true;state.taking=0;seatTransition(true);state.seat.pull=.42;
      note('司机已离开驾驶座');return true;
    }
    flagged=v;v.waitUntil=elapsed+8;note('已示意停车 · 到左侧车门按 E 接管');return true;
  }
  function knock(p,yaw,speed){
    if(reactions.has(p)||p.exit)return false;
    reactions.set(p,{x:p.x,z:p.z,y:0,yaw,vx:Math.sin(yaw)*speed*.44,vz:Math.cos(yaw)*speed*.44,
      vy:Math.min(8,1.7+speed*.31),tilt:0,time:0,rest:0});
    greetings.delete(p);return true;
  }
  function hitWalkers(){
    const speed=Math.abs(car.speed);if(speed<3.7)return;
    const sn=Math.sin(car.yaw),cs=Math.cos(car.yaw),spec=Driving.type(car.model);
    for(const p of People.actors()){
      const dx=p.x-car.x,dz=p.z-car.z;
      if(Math.abs(dx*cs-dz*sn)<spec.halfW+.24&&Math.abs(dx*sn+dz*cs)<spec.halfL+.2){
        if(knock(p,car.yaw+(car.speed<0?Math.PI:0),speed))car.speed*=.94;
      }
    }
  }
  function fire(yaw,pitch,range){
    if(!open())return;
    const sn=Math.sin(yaw),cs=Math.cos(yaw),eye=Town.floorAt(player.x,player.z)+1.52+player.height;
    let target=null,depth=range;
    for(const p of People.actors()){
      if(reactions.has(p)||p.exit)continue;
      const dx=p.x-player.x,dz=p.z-player.z,along=dx*sn+dz*cs;
      if(along<0||along>=depth||Math.abs(dx*cs-dz*sn)>.38)continue;
      const height=eye-along*Math.tan(pitch)-Town.floorAt(p.x,p.z);
      if(height<.05||height>(p.seat?1.37:1.83))continue;
      depth=along;target=p;
    }
    const hazard=CityEffects.rayTarget(yaw,pitch,depth,eye);
    if(hazard)depth=hazard.depth;
    if(!target&&!hazard)return;
    const blockers=[car,...Traffic.cars,...parked];
    for(let s=.2;s<depth;s+=.24){
      const x=player.x+sn*s,z=player.z+cs*s;
      if(Town.blocks.some(b=>Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2))return;
      if(blockers.some(v=>{
        const dx=x-v.x,dz=z-v.z,c=Math.cos(v.yaw),n=Math.sin(v.yaw);
        return eye-s*Math.tan(pitch)<Town.floorAt(x,z)+1.6+(v.lift||0)&&Math.abs(dx*c-dz*n)<1.04&&Math.abs(dx*n+dz*c)<2.28;
      }))return;
    }
    if(hazard){CityEffects.arm(hazard.prop);return;}
    if(knock(target,yaw,3)){
      drops.push({x:target.x,z:target.z,value:12+target.model*7,life:45});
      note('现金掉落 · 靠近按 E 拾取');
    }
  }
  function bumpVehicle(v,relative){
    if(relative<6||Math.abs(car.speed)<5||v.crash)return;
    launchVehicle(v,car,Math.min(21,relative));car.speed*=.7;
    note('撞击！车辆失去平衡');
  }
  function launchVehicle(v,origin,power){
    const dx=v.x-origin.x,dz=v.z-origin.z,d=Math.hypot(dx,dz)||1;
    v.crash={vx:dx/d*power*.62,vz:dz/d*power*.62,vy:2.2+power*.26,y:v.lift||0,age:0,
      twist:dx*Math.cos(v.yaw)-dz*Math.sin(v.yaw)>=0?1:-1};
    if(flagged===v)flagged=null;
    if(Traffic.cars.includes(v))People.eject(v);
  }
  function blast(origin){
    for(const p of People.actors()){
      const d=dist(p,origin);if(d<11)knock(p,Math.atan2(p.x-origin.x,p.z-origin.z),5+(11-d)*1.3);
    }
    for(const v of [car,...parked,...Traffic.cars]){
      const d=dist(v,origin);if(d<10&&!v.crash){launchVehicle(v,origin,7+(10-d)*1.25);if(v===car)v.speed=0;}
    }
  }
  function slide(o,b,dt,radius){
    const x=o.x+b.vx*dt,z=o.z+b.vz*dt;
    if(driveable(x,o.z,radius))o.x=x;else b.vx*=-.24;
    if(driveable(o.x,z,radius))o.z=z;else b.vz*=-.24;
  }
  function tick(dt){
    if(flagged&&(elapsed>=flagged.waitUntil||state.activity!=='roam'||state.vehicle||dist(player,flagged)>13)){
      flagged.waitUntil=0;flagged=null;
    }
    for(const v of [car,...Traffic.cars,...parked]){
      const b=v.crash;if(!b)continue;
      b.age+=dt;slide(v,b,dt,1.15);b.vy-=12*dt;b.y=Math.max(0,b.y+b.vy*dt);
      const drag=Math.exp(-dt*(b.y>0?.75:5));b.vx*=drag;b.vz*=drag;
      v.yaw+=b.twist*Math.min(1.35,Math.hypot(b.vx,b.vz)*.22)*dt;
      v.lift=b.y;v.pitch=Math.min(.38,b.y*.3);v.bank=b.twist*Math.min(.63,b.y*.68);
      if(b.y===0&&Math.hypot(b.vx,b.vz)<.22){
        v.crash=null;v.lift=v.pitch=v.bank=0;
        const index=Traffic.cars.indexOf(v);
        if(index>=0){Traffic.cars.splice(index,1);parked.push({x:v.x,z:v.z,yaw:v.yaw,model:v.model,garageId:v.garageId});}
      }
    }
    for(const [p,b] of reactions){
      b.time+=dt;
      if(b.rest===0){
        slide(b,b,dt,.25);b.vy-=10*dt;b.y+=b.vy*dt;b.tilt=Math.min(1.43,b.tilt+dt*4.3);
        if(b.y<=0&&b.vy<0){b.y=0;b.rest=dt;}
      }else{
        b.rest+=dt;
        if(b.rest>3){
          b.tilt=Math.max(0,b.tilt-dt*2.4);
          const dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz);
          if(!b.tilt){if(d<.12){reactions.delete(p);continue;}
            const stride=Math.min(d,dt*2.9);b.x+=dx/d*stride;b.z+=dz/d*stride;b.yaw=Math.atan2(dx,dz);}
        }
      }
    }
    for(let i=drops.length-1;i>=0;i--){if((drops[i].life-=dt)<=0)drops.splice(i,1);}
    for(const [p,until] of greetings)if(elapsed>until)greetings.delete(p);
  }
  function drawReaction(p){
    const b=reactions.get(p);
    if(b){People.drawModel(p.model,b.x,b.z,b.yaw,b.time*6,b.rest>3?.8:.2,0,.3,b.y+.18*Math.sin(b.tilt),b.tilt);return true;}
    if(!greetings.has(p))return false;
    const source=state.vehicle?car:player,yaw=Math.atan2(source.x-p.x,source.z-p.z);
    CharacterPass.submit(p.model,p.x,p.z,yaw,elapsed,0,0,p.seat?-1:0,p.seat?-.44:0,0,{wave:elapsed});
    return true;
  }
  function drawCash(){for(const b of drops)Gfx.draw(cash,b.x,Town.floorAt(b.x,b.z)+.12+.04*Math.sin(elapsed*4),b.z,elapsed*1.6);}
  function key(code){
    if(!open()||state.seat)return false;
    if(code==='KeyN'&&state.vehicle&&elapsed-hornAt>.65){
      hornAt=elapsed;NightMarket.horn();for(const p of People.actors())if(dist(car,p)<10)greetings.set(p,elapsed+1.2);
      note('鸣笛');return true;
    }
    if(code==='KeyZ'&&!state.vehicle){
      const p=nearest(People.actors().filter(v=>!reactions.has(v)),player,3.2);
      if(p){greetings.set(p,elapsed+2);note('路人：嗨，海边见！');}
      return true;
    }
    return false;
  }
  function ui(){
    if(!open()||NightMarket.aiming()||state.seat)return;
    if(state.vehicle){$('controls').textContent+='　·　N 鸣笛';return;}
    $('controls').textContent+='　·　G 武器　·　Z 招呼';
    let hint='';
    if(nearest(drops,player,1.8))hint='E 拾取掉落现金';
    else if(flagged)hint='已拦停 · 到左侧车门按 E 拉出司机';
    else if(!spareNear()&&dist(player,driverDoor())>1.55&&candidate())hint='E 示意来车停车';
    if(hint&&performance.now()>=toastUntil)$('hint').textContent=hint;
  }
  return {blast,reacting:p=>reactions.has(p),reset,interact,hitWalkers,bumpVehicle,fire,tick,drawReaction,drawCash,key,ui};
})();
