'use strict';
const $=id=>document.getElementById(id);
const held=new Set(), state={phase:'cover',vehicle:false,deadline:0,remaining:60,route:'',parked:0};
const car={x:0,z:0,yaw:-2.76,speed:0},player={x:-4.6,z:-.12,yaw:0};
const showroom=[{x:45.6,z:36,yaw:0,model:0},{x:45.6,z:44,yaw:0,model:1},{x:45.6,z:52,yaw:0,model:2}];
const parked=[];
function resetParked(){parked.splice(0,parked.length,...showroom.map(o=>({...o})),...[[-3.8,-11.2,0,0],[-3.8,-3.75,0,1],[-3.8,4.1,0,2],[4.4,-11,0,0],[-43,62,0,1],[4.3,125,0,2],[-61,340,0,0]].map(([x,z,yaw,model])=>({x,z,yaw,model})));}
function spareNear(){return parked.find(o=>!o.crash&&dist(player,{x:o.x-1.48*Math.cos(o.yaw),z:o.z+1.48*Math.sin(o.yaw)})<1.65);}
function drawCar(o,door=0){Gfx.paint(NightMarket.paint(o));Motorpool.draw(o,door,elapsed);Gfx.paint(null);}
const motion=new Locomotion();
const camera={fov:Locomotion.baseFov,x:0,y:0,z:0,yaw:0,pitch:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const modes={regular:{limit:82,damage:1},expert:{limit:57,damage:1.4}};
const counter=Town.filmCounter;
const onFootSpeed={walk:2.5,run:5.5,loaded:2.12};
function trunk(){return {x:car.x-2.82*Math.sin(car.yaw),z:car.z-2.82*Math.cos(car.yaw)};}
function missionPoint(){
  if(state.activity!=='delivery')return Bay.target();
  if(!state.owned&&state.cargo!=='none')return driverDoor();
  if(state.cargo==='hand')return trunk();
  if(!state.vehicle)return state.stage?driverDoor():counter;
  return Town.targets[state.stage];
}
let footHeading=0,orbitHeight=2.13,orbitDistance=3.85;
let dragPoint=null;
let mode='regular',elapsed=0;
const ctx=$('map').getContext('2d');
let last=performance.now(), intro=0, toast='',toastUntil=0, audio=null,engine,gain,sirenOsc,sirenGain;
function soundToggle(){
  if(!audio){
    audio=new AudioContext();engine=audio.createOscillator();gain=audio.createGain();const filter=audio.createBiquadFilter();
    engine.type='sawtooth';filter.type='lowpass';filter.frequency.value=170;gain.gain.value=0;
    engine.connect(filter);filter.connect(gain);gain.connect(audio.destination);engine.start();sirenOsc=audio.createOscillator();sirenGain=audio.createGain();sirenGain.gain.value=0;
    sirenOsc.type='triangle';sirenOsc.connect(sirenGain);sirenGain.connect(audio.destination);sirenOsc.start();
  }
  const active=$('sound').getAttribute('aria-pressed')!=='true';
  audio.resume();$('sound').setAttribute('aria-pressed',String(active));$('sound').textContent='声音　'+(active?'开':'关');
}
function note(message){toast=message;toastUntil=performance.now()+1800;}
function audioTick(){
  if(!audio)return;
  const active=$('sound').getAttribute('aria-pressed')==='true'&&state.phase==='play'&&state.vehicle;
  engine.frequency.setTargetAtTime(41+Math.abs(car.speed)*2.6,audio.currentTime,.12);
  gain.gain.setTargetAtTime(active?.038:0,audio.currentTime,.1);
  const sounding=active&&car.model===2&&car.siren;
  sirenGain.gain.setTargetAtTime(sounding?.045:0,audio.currentTime,.04);
  sirenOsc.frequency.setTargetAtTime(785+225*Math.sin(elapsed*4.5),audio.currentTime,.03);
}
function start(){
  motion.reset();CharacterPass.clearFootfalls();camera.fov=Locomotion.baseFov;
  Object.assign(car,{garageId:'coupe',x:3.7,z:-6,yaw:0,speed:5,model:-1,steering:0,roll:0});
  Object.assign(player,{x:44.06,z:36,yaw:0,stride:0,pace:0,stamina:100,wind:false});
  Driving.reset(car);car.siren=false;Motorpool.reset();
  Object.assign(player,{height:0,vertical:0,life:100,action:'idle'});state.seat=null;state.cockpit=false;
  People.reset();Street.reset();Traffic.reset();resetParked();parked.forEach((v,i)=>v.garageId='bay-'+i);NightMarket.reset();
  const limit=modes[mode].limit;
  elapsed=0;footHeading=0;orbitHeight=2.13;orbitDistance=3.85;Traffic.update(0);
  Object.assign(state,{phase:'play',vehicle:false,remaining:limit,deadline:performance.now()+limit*1000,stage:0,health:100,hits:0,lastHit:-10,parked:0,reason:'',inContact:false,hitCar:null,owned:false,cargo:'none',taking:0,door:0,stopClock:0,yieldUntil:-10,lastYield:-10});
  Object.assign(camera,{x:44.06,y:2.25,z:32.15,yaw:0,pitch:.29});held.clear();toastUntil=0;
  Bay.reset();$('cover').hidden=true;$('result').hidden=true;$('hud').hidden=false;document.activeElement?.blur();hud();
}
function finish(win,reason='timeout'){
  $('mapToggle').hidden=true;
  if(state.activity==='race'){Bay.conclude(false,'计时结束。','完成 '+Bay.gateCount()+' 道旗门。');return;}
  state.reason=win?'delivered':reason;
  state.phase=win?'won':'lost';car.speed=0;held.clear();
  $('hud').hidden=true;$('result').hidden=false;
  $('outcome').textContent=win?'NOW SHOWING  /  正在放映':'FINAL REPORT  /  配送结束';
  $('resultTitle').textContent=win?'赶上首映了。':reason==='damage'?'胶片损毁。':'错过了开场。';
  $('summary').textContent=win?'剩余 '+state.remaining.toFixed(1)+' 秒 · 胶片完好度 '+state.health+'% · 碰撞 '+state.hits+' 次。':
    reason==='damage'?'片盒在撞击中损毁。进窄巷前先收油，转弯留出对向车道。':'时间耗尽。已完成 '+state.stage+' / 3 站，下一站是'+Town.targets[state.stage].name+'。';
}
function driverDoor(){return {x:car.x-1.48*Math.cos(car.yaw),z:car.z+1.48*Math.sin(car.yaw)};}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function driveable(x,z,radius){
  if(x<(state.vehicle?Beach.shore(z)+2:-140)+radius||x>148-radius||z<-19+radius||z>362-radius)return false;
  return !Town.blocks.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
function atStop(){
  const t=Town.targets[state.stage];
  const spec=Driving.type(car.model),cs=Math.abs(Math.cos(car.yaw)),sn=Math.abs(Math.sin(car.yaw));
  const halfX=spec.halfW*cs+spec.halfL*sn,halfZ=spec.halfL*cs+spec.halfW*sn;
  return Math.abs(car.x-t.x)+halfX<=t.w/2&&Math.abs(car.z-t.z)+halfZ<=t.d/2;
}
function impact(speed,traffic){
  if(elapsed-state.lastHit<1.35||speed<2.8)return;
  state.hits++;state.lastHit=elapsed;Motorpool.impact(car,speed);
  player.life=Math.max(1,player.life-Math.round(Math.max(0,speed-8)*.65));
  const loss=Math.min(65,Math.round((speed*2.0+(traffic?6:0))*modes[mode].damage));
  if(state.activity==='roam'||state.activity==='photo'){note('车身擦碰');return;}
  if(state.stage>0){
    state.health=Math.max(0,state.health-loss);
    note('片盒受到撞击　−'+loss+'%');
    if(!state.health)finish(false,'damage');
  }else{state.deadline-=1600;note('车身擦碰，耽误了 1.6 秒');}
}
function seatTransition(enter,curb){
  motion.reset();
  const target={x:car.x-.42*Math.cos(car.yaw),z:car.z+.42*Math.sin(car.yaw)};
  state.seat={enter,t:0,from:enter?{x:player.x,z:player.z}:target,to:enter?target:curb,yaw:player.yaw};
  state.vehicle=false;state.cockpit=false;car.speed=0;car.slide=0;car.brake=true;car.siren=false;
  Object.assign(player,{height:0,vertical:0,pace:0,action:enter?'enter':'exit'});
}
function seatStep(dt){
  const m=state.seat;
  if(m.pull>0){
    m.pull=Math.max(0,m.pull-dt);const f=1-m.pull/.42;
    player.yaw=m.yaw+turn(m.yaw,car.yaw+Math.PI/2)*f;
    state.door=Math.sin(f*Math.PI/2);if(!m.pull){m.yaw=player.yaw;m.opened=true;}return;
  }
  m.t=Math.min(1,m.t+dt/.88);
  const t=m.t,e=t*t*(3-2*t),progress=m.enter?e:1-e;
  player.x=m.from.x+(m.to.x-m.from.x)*e;player.z=m.from.z+(m.to.z-m.from.z)*e;
  player.yaw=m.yaw+turn(m.yaw,car.yaw)*e;player.height=-progress*.39;
  state.door=m.opened?Math.cos(t*Math.PI/2):Math.sin(Math.PI*t)**.7;
  if(t>=1){state.vehicle=m.enter;state.seat=null;state.door=0;player.height=0;player.action=m.enter?'drive':'idle';footHeading=car.yaw;}
}
function jump(){
  if(state.vehicle||state.seat||Bay.aiming()||Bay.swimmer()||state.cargo==='hand'||player.height>.001||player.vertical>0||player.stamina<8)return;
  player.vertical=4.65;player.stamina-=8;player.action='jump';
}
function interact(){
  if(state.phase!=='play'||state.seat||player.height>.04)return;
  if(NightMarket.interact()||Street.interact())return;
  const door=driverDoor();
  if(Bay.aiming()||state.activity==='volley')return;
  const spare=!state.vehicle&&spareNear();
  if(spare&&state.cargo==='none'){
    const old={garageId:car.garageId,x:car.x,z:car.z,yaw:car.yaw,model:car.model};
    Object.assign(car,spare,{speed:0,roll:0,steering:0});Object.assign(spare,old);
    Driving.reset(car);state.owned=true;state.taking=0;toastUntil=0;seatTransition(true);return;
  }
  if(state.vehicle){
    if(state.activity==='delivery'&&state.stage===1&&atStop()){
      if(Math.abs(car.speed)>.55){note('先停稳，再验封');return;}
      if(elapsed%6>3.8){note('查验灯是红色，等变绿再按 E');return;}
      state.stage=2;note('封条核验通过，赶往影院');return;
    }
    if(Math.abs(car.speed)>1.3){note('先刹住车，再下车');return;}
    const exits=[door,{x:2*car.x-door.x,z:2*car.z-door.z}];
    const free=exits.find(v=>driveable(v.x,v.z,.35));
    if(!free){note('车门被挡住了');return;}
    seatTransition(false,free);return;
  }
  if(state.activity==='delivery'&&!state.stage&&state.cargo==='none'&&dist(player,counter)<2){
    if(!state.owned){note('先在冲印室门前选一辆车，再到柜台取片');return;}
    state.cargo='hand';note('片盒已领取，拿到车尾按 E 装车');return;
  }
  if(state.cargo==='hand'&&state.owned){
    if(dist(player,trunk())>1.75){note('携片走到车尾再按 E');return;}
    state.cargo='trunk';state.stage=1;note('胶片已装车，回驾驶座');return;
  }
  if(!state.owned)return;
  if(dist(player,door)>1.55){note('走近驾驶座一侧再按 E');return;}
  seatTransition(true);toastUntil=0;
}
function axis(pos,neg){return Number(pos.some(k=>held.has(k)))-Number(neg.some(k=>held.has(k)));}
function physics(dt){
  const go=axis(['KeyW','ArrowUp'],['KeyS','ArrowDown']),steer=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']);
  if(state.seat){seatStep(dt);return;}
  state.door=Math.max(0,state.door-dt*1.8);
  if(!state.owned){
    // Occupied coupe rolls up to the first light, then on to a second, permanent taxi stand.
    const stop=state.stopClock>8?23:13.5, gap=stop-car.z;
    car.speed=gap>.03?Math.min(5,Math.max(.3,gap*1.5)):0;
    car.z+=Math.min(Math.max(0,gap),car.speed*dt);car.roll+=car.speed*dt/.36;
    if(!car.speed&&stop===13.5&&!state.taking)state.stopClock+=dt;
    const claim=held.has('KeyE')&&dist(player,driverDoor())<1.55&&car.speed<.45&&!go&&!steer;
    state.taking=claim?Math.min(1,state.taking+dt/1.12):0;
    state.door=state.taking?Math.sin(state.taking*Math.PI*.77):0;
    if(state.taking>=1){
      const d=driverDoor();People.release(d.x-.42,d.z);
      state.owned=true;state.taking=0;car.speed=0;seatTransition(true);
      note(state.activity==='delivery'?'已夺车，赶往冲印室':'跑车到手，自由驾驶 · M 海湾地图');return;
    }
  }
  if(!state.vehicle){
    footHeading+=axis(['KeyC'],['KeyQ'])*dt*1.9;
    const len=Math.hypot(go,steer),loaded=state.cargo==='hand';
    const run=len&&!loaded&&(held.has('ShiftLeft')||held.has('ShiftRight'))&&player.stamina>1&&!player.wind;
    player.stamina=clamp(player.stamina+dt*(run?-16:10),0,100);
    if(run&&player.stamina<2)player.wind=true;if(player.stamina>24)player.wind=false;
    const swim=Bay.swimmer(),velocity=swim?(run?3.2:2.05):loaded?onFootSpeed.loaded:run?onFootSpeed.run:onFootSpeed.walk;
    const sn=Math.sin(camera.yaw),cs=Math.cos(camera.yaw),gain=velocity/(len||1);
    const clear=(px,pz)=>{const dx=px-car.x,dz=pz-car.z;
      return (state.activity!=='volley'||Bay.volleyArea(px,pz))&&driveable(px,pz,.30)&&!parked.some(o=>Traffic.overlap(px,pz,0,o)&&Math.hypot(px-o.x,pz-o.z)<1.25)&&(Math.abs(dx*Math.cos(car.yaw)-dz*Math.sin(car.yaw))>1.16||Math.abs(dx*Math.sin(car.yaw)+dz*Math.cos(car.yaw))>2.44)
        &&!Traffic.cars.some(o=>{const gap=Math.hypot(o.x-px,o.z-pz);return gap<1.72&&gap<=dist(player,o);});};
    const travel=motion.move(player,dt,(steer*cs+go*sn)*gain,(go*cs-steer*sn)*gain,clear);
    if(player.height>0||player.vertical>0){player.height=Math.max(0,player.height+player.vertical*dt-4.9*dt*dt);player.vertical=player.height?player.vertical-9.8*dt:0;}
    motion.step(player,dt,travel,swim);
    player.stride=motion.walkCycle;player.pace=motion.weights.walk*.88+motion.weights.sprint*1.35;
    player.action=player.height>0?'jump':swim?'swim':motion.currentSpeed<.08?'idle':motion.weights.sprint>.5?'sprint':'walk';
    return;
  }
  const road=Town.nearestRoad(car.x,car.z);
  // Busy crossings reward braking in advance. The car stops before a pedestrian's path.
  const nearPed=state.activity!=='roam'&&People.citizens.some(p=>{
    if(!p.cross||Math.abs(p.x)>5.5)return false;
    const dx=p.x-car.x,dz=p.z-car.z,along=dx*Math.sin(car.yaw)+dz*Math.cos(car.yaw);
    return along>0&&along<5.8&&Math.abs(dx*Math.cos(car.yaw)-dz*Math.sin(car.yaw))<2.6;
  });
  if(nearPed&&car.speed>6&&elapsed-state.lastYield>3){
    state.lastYield=elapsed;state.yieldUntil=elapsed+1;state.deadline-=1400;
    note(Number.isFinite(state.deadline)?'斑马线急停　−1.4 秒':'斑马线礼让');car.speed=0;
  }
  if((elapsed<state.yieldUntil||nearPed)&&car.speed>0)car.speed=0;
  const stopping=(elapsed<state.yieldUntil||nearPed)&&go>=0;
  const boost=NightMarket.boost(dt,go,stopping||held.has('Space'));
  const {x:nx,z:nz,yaw}=Driving.step(car,dt,stopping?0:go,steer,held.has('Space')||stopping,road.edge>1,Climate.wet,boost);
  const spec=Driving.type(car.model);
  const parkedHit=parked.find(o=>Traffic.overlap(nx,nz,yaw,o,car));
  const fits=(!parkedHit||state.activity==='roam')&&[-1,0,1].every(end=>{
    const arm=end*(spec.halfL-spec.halfW);
    return driveable(nx+Math.sin(yaw)*arm,nz+Math.cos(yaw)*arm,spec.halfW);
  });
  if(state.hitCar&&dist(car,state.hitCar)>8)state.hitCar=null;
  const collider=Traffic.cars.find(other=>Traffic.overlap(nx,nz,yaw,other,car))||(state.activity==='roam'&&parkedHit);
  if(collider){
    // A stopped driver can reverse away while the other vehicle completes its turn.
    const relative=Math.hypot(Math.sin(yaw)*car.speed-Math.sin(collider.yaw)*(collider.pace||0),
      Math.cos(yaw)*car.speed-Math.cos(collider.yaw)*(collider.pace||0));
    const separating=Math.hypot(nx-collider.x,nz-collider.z)>Math.hypot(car.x-collider.x,car.z-collider.z);
    if(state.hitCar!==collider&&relative>2.8){impact(relative,true);if(state.activity==='roam')Street.bumpVehicle(collider,relative);state.hitCar=collider;}
    state.inContact=true;
    if(separating&&fits){car.x=nx;car.z=nz;car.yaw=yaw;}else car.speed*=Math.exp(-dt*18);
  }else{
    state.inContact=false;
    if(fits){car.x=nx;car.z=nz;car.yaw=yaw;}
    else{impact(Math.abs(car.speed),false);car.speed=0;car.slide=0;}
  }
  if(state.phase!=='play')return;
  if(state.activity==='roam')Street.hitWalkers();
  state.parked=state.activity==='delivery'&&state.stage===2&&atStop()&&Math.abs(car.speed)<.45?state.parked+dt:0;
  if(state.parked>.55)finish(true);
}
function minimap(){
  const map=$('map'),w=map.width,h=map.height,p=state.vehicle?car:player,t=missionPoint();
  // The full network remains visible so a player can plan the next junction.
  const point=state.vehicle?(x,z)=>[56+x*.65,h-12-z*.455]:(x,z)=>[w/2+(x-p.x)*3.05,h*.63-(z-p.z)*3.05];
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#394b43';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#436d72';ctx.beginPath();ctx.moveTo(-1000,-1000);
  for(let z=450;z>=-160;z-=6)ctx.lineTo(...point(Beach.shore(z),z));ctx.lineTo(-1000,2000);ctx.fill();
  ctx.fillStyle='#8d896b';ctx.beginPath();ctx.moveTo(...point(-49,450));for(let z=450;z>=-160;z-=6)ctx.lineTo(...point(Beach.shore(z),z));ctx.lineTo(...point(-49,-160));ctx.fill();
  for(const r of Town.roads){ctx.beginPath();r.points.forEach(([x,z],i)=>ctx[i?'lineTo':'moveTo'](...point(x,z)));ctx.lineWidth=r.width*(state.vehicle?.35:2.8);ctx.strokeStyle='#9d9499';ctx.lineJoin='round';ctx.stroke();}
  for(const stop of Bay.venues){const [x,y]=point(stop.x,stop.z);ctx.fillStyle='#e8c88e';ctx.fillRect(x-3,y-3,6,6);}
  if(!state.vehicle){ctx.fillStyle='#dfac91';for(const citizen of People.citizens){const [px,pz]=point(citizen.x,citizen.z);ctx.fillRect(px-1,pz-1,2,2);}}
  if(state.activity!=='roam'||Bay.pinned()){
    const [gx,gy]=point(t.x,t.z);ctx.strokeStyle='#fff1a4';ctx.strokeRect(clamp(gx,6,w-6)-4,clamp(gy,6,h-6)-4,8,8);
  }
  if(!state.vehicle){ctx.fillStyle='#b5ddd7';for(const o of [car,...parked]){const [cx,cy]=point(o.x,o.z);ctx.fillRect(cx-2,cy-3,4,6);}}
  NightMarket.radar(ctx,point,state.vehicle?.53:3.05);
  const [x,y]=point(p.x,p.z);ctx.save();ctx.translate(x,y);ctx.rotate(p.yaw);ctx.fillStyle='#fff6da';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
}
function hud(){
  const near=dist(player,driverDoor())<=1.55,road=Town.nearestRoad(car.x,car.z),target=Town.targets[state.stage];
  const point=missionPoint(),range=Math.round(dist(state.vehicle?car:player,point));
  if(state.activity!=='delivery')Bay.info();
  else{
  let title,hint;
  if(!state.owned){
    title='找一辆车运片';
    hint=near?(car.speed>.45?'等它停稳':'站定，按住 E 夺车　'+Math.round(state.taking*100)+'%'):'到路边找车，按 E 上车 · 柜台旁按 E 取片';
  }else if(state.cargo==='hand'){
    title='把片盒装进车尾';hint=range<=2?'按 E 装车':'手提片盒步行　'+range+' 米';
  }else if(!state.vehicle){
    const byCounter=dist(player,counter)<2;
    title=state.stage===0?'到冲印室柜台取片':'回驾驶座';
    hint=near?'按 E 上车':byCounter&&!state.stage?'按 E 领取片盒':'步行靠近'+(state.stage?'驾驶门':'柜台')+'，按 E 互动';
  }else if(state.stage===0){
    title='去潮汐冲印室取片';hint=range<19?'刹停按 E 下车，走到门前柜台':'目标 '+range+' 米 · 到店后下车取片';
  }else{
    title=target.action+' · '+target.name;
    hint=range<18?(state.stage===1?(elapsed%6>3.8?'查验红灯 · 稍候':'查验绿灯 · 框内停稳按 E'):target.hint):'目标 '+range+' 米 · 路口注意行人';
  }
  $('clockLabel').textContent='距开场';
  $('stage').textContent=state.owned?'夜场配送　'+(state.stage+1)+' / 3':'开场　/　夺车';
  $('goal').textContent=title;$('hint').textContent=performance.now()<toastUntil?toast:hint;
  const sec=Math.ceil(state.remaining);$('time').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  $('time').style.color=sec<12?'#ff9586':'';
  $('condition').textContent=state.stage?'胶片完好度　'+state.health+'%':state.cargo==='hand'?'片盒在手':'片盒待领取';
  }
  $('controls').textContent=state.vehicle?'W/S 油门制动　·　A/D 转向　·　空格 手刹　·　V 视角　·　E 下车　·　M 地图'+(car.model===2?'　·　H 警笛':''):
    'WASD 移动　·　Shift 跑　·　空格 跳 / 接球　·　拖动环视　·　E 上下车　·　F 活动　·　M 地图'+(state.activity!=='roam'?'　·　X 退出':'');
  $('lifeBar').value=player.life;$('staminaBar').value=player.stamina;
  $('environment').textContent=Climate.time()+'　'+Climate.label;
  if(state.vehicle)$('vehicleName').textContent=Driving.type(car.model).name;
  else $('vehicleName').textContent=state.seat?(state.seat.enter?'上车中':'下车中'):'';
  $('hud').classList.toggle('impact',elapsed-state.lastHit<.4);
  $('speed').textContent=state.vehicle?Math.round(Math.abs(car.speed)*3.6):Math.round(player.stamina);$('unit').textContent=state.vehicle?'KM/H':'% 体力';$('street').textContent=Town.streets[state.vehicle?road.index:Town.nearestRoad(player.x,player.z).index];if(!state.vehicle&&player.x<-51)$('street').textContent=Bay.swimmer()?'西湾近海':'南滩海岸';NightMarket.ui();Street.ui();minimap();
}
function aimAt(x,y,z,tx,ty,tz){
  const dx=tx-x,dz=tz-z;return {x,y,z,yaw:Math.atan2(dx,dz),pitch:Math.atan2(y-ty,Math.hypot(dx,dz))};
}
function render(dt){
  if(NightMarket.sublevel){NightMarket.garageView();return;}
  if(state.phase==='cover'){
    intro+=dt;Object.assign(camera,aimAt(53.4+Math.sin(intro*.10)*.55,1.65,28.3,47.2,1.84,42.8));
  }else if(state.vehicle&&state.cockpit){
    const sn=Math.sin(car.yaw),cs=Math.cos(car.yaw);
    Object.assign(camera,{x:car.x-.39*cs+.19*sn,y:1.37+(car.lift||0),z:car.z+.39*sn+.19*cs,yaw:car.yaw,pitch:.065+car.pitch});
  }else if(Bay.aiming()){Bay.lens(dt);}
  else if(NightMarket.aiming()){NightMarket.cameraView();}
  else if(state.phase==='won'&&state.activity==='delivery')Object.assign(camera,aimAt(-46,3.4,338,-54,5.6,362));
  else{
    const o=state.vehicle?car:player, angle=state.vehicle?car.yaw:footHeading,back=state.vehicle?7.5:orbitDistance;
    const target=aimAt(o.x-Math.sin(angle)*back,state.vehicle?3.5:orbitHeight,o.z-Math.cos(angle)*back,o.x+Math.sin(angle)*(state.vehicle?2.4:.60)+(state.vehicle?0:.13),state.vehicle?1.05:1.25,o.z+Math.cos(angle)*(state.vehicle?2.4:.60));
    if(!state.vehicle){
      const dx=target.x-o.x,dz=target.z-o.z;
      for(let u=.12;u<=1;u+=.08){if(!driveable(o.x+u*dx,o.z+u*dz,.18)){
        const safe=Math.max(.04,u-.10);target.x=o.x+dx*safe;target.z=o.z+dz*safe;break;}}
      target.y+=(player.height||0)*.4;if(NightMarket.inside)target.y=Math.min(target.y,3.12);
    }
    const t=1-Math.exp(-dt*6.5);for(const k of ['x','y','z','pitch'])camera[k]+=(target[k]-camera[k])*t;
    camera.yaw+=turn(camera.yaw,target.yaw)*t;
  }
  const sprintView=state.phase==='play'&&!state.vehicle&&!state.seat&&!Bay.aiming()&&!NightMarket.aiming()&&!Bay.swimmer()?motion.weights.sprint:0;
  const targetFov=Locomotion.baseFov+sprintView*7*Math.PI/180;
  camera.fov+=(targetFov-camera.fov)*(-Math.expm1(-10*dt));
  CharacterPass.begin(camera);Gfx.begin([camera.x,camera.y,camera.z],camera.yaw,camera.pitch,-1,false,1/Math.tan(camera.fov/2));Gfx.draw(Town.world);
  for(const other of Traffic.cars)if(Math.hypot(other.x-camera.x,other.z-camera.z)<145){
    drawCar(other);
    if(!other.crash&&dist(other,camera)<32){
      // Show the same occupant moving out through the driver's door during a takeover.
      const c=Math.cos(other.yaw),s=Math.sin(other.yaw);
      People.drawModel(1+(other.model+1)%4,other.x-.43*c,other.z+.43*s,other.yaw,0,0,.35,-1,-.46);
    }
  }
  Town.drawSignals(elapsed);Motorpool.drawSparks();People.draw(camera);Street.drawCash();Bay.draw();NightMarket.draw();
  for(const o of (state.phase==='cover'?showroom:parked))if(dist(camera,o)<125)drawCar(o);
  if(state.phase==='play'&&!Bay.aiming()&&dist(state.vehicle?car:player,missionPoint())>5&&state.activity!=='volley'&&state.activity!=='race'&&(state.activity!=='roam'||Bay.pinned())){const target=missionPoint();Gfx.draw(Town.marker,target.x,2+Math.sin(elapsed*3)*.16,target.z,camera.yaw);}
  if(state.phase==='won'&&state.activity==='delivery')Gfx.draw(Town.lit);if(state.vehicle&&state.cockpit)Motorpool.cabin(car);else drawCar(car,state.door||0);
  if(state.stage>0&&state.phase!=='cover')Gfx.draw(Town.canister,car.x-1.63*Math.sin(car.yaw),0,car.z-1.63*Math.cos(car.yaw),car.yaw);
  if(state.stage===2&&state.phase!=='cover')Gfx.draw(Town.seal,car.x-1.63*Math.sin(car.yaw),0,car.z-1.63*Math.cos(car.yaw),car.yaw);
  if(!state.owned&&state.phase==='play'&&state.taking>.25){
    const d=driverDoor();People.drawModel(1,d.x-state.taking*.4,d.z+.32,-1.4,state.taking*4,.4,0,.6);
  }
  if(!state.vehicle&&!Bay.aiming()&&!NightMarket.aiming()&&state.phase!=='cover'){
    const swim=Bay.swimmer();
    const carry=state.cargo==='hand',pose=state.seat?(state.seat.pull>0?Math.sin((1-state.seat.pull/.42)*Math.PI):Math.sin(state.seat.t*Math.PI)):state.taking||0;
    CharacterPass.submit(NightMarket.skin,player.x,player.z,player.yaw,player.stride||0,player.pace||0,carry?1:0,swim?.75:Math.max(pose,Bay.reach()*1.65),swim?-.79+.06*Math.sin(elapsed*4):(player.height||0)+Bay.reach()*.16,swim?.83:0,NightMarket.gear);
    if(carry)Gfx.draw(Town.canister,player.x+Math.sin(player.yaw)*.39,Town.floorAt(player.x,player.z)+(player.height||0)-.12,player.z+Math.cos(player.yaw)*.39,player.yaw);
  }
  CharacterPass.flush();
  if(NightMarket.aiming())NightMarket.viewWeapon();
}
function frame(now){
  const dt=clamp((now-last)/1000,0,.25);last=now;
  if(state.phase==='cover'){Traffic.update(intro);People.update(dt,null);}
  if(state.phase==='play'&&$('atlas').hidden&&!NightMarket.panel){
    elapsed+=dt;Climate.tick(dt);Motorpool.tick(dt);Traffic.update(elapsed,car,parked);People.update(dt,car,state.vehicle?null:player);
    state.remaining=Math.max(0,(state.deadline-now)/1000);
    if(!state.remaining)finish(false);
    else{for(let rest=dt;rest>1e-9&&state.phase==='play'&&!NightMarket.panel;rest-=1/60){const step=Math.min(rest,1/60);if(NightMarket.sublevel)NightMarket.garageDrive(step);else if(!Bay.aiming())physics(step);if(state.phase==='play'){Bay.tick(step);NightMarket.tick(step);Street.tick(step);}}if(state.phase==='play')hud();}
  }
  render(dt);Gfx.finishFrame();Bay.capture();audioTick();requestAnimationFrame(frame);
}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{
  mode=b.dataset.mode;for(const opt of document.querySelectorAll('[data-mode]'))opt.setAttribute('aria-pressed',String(opt===b));b.blur();
};
$('start').onclick=start;$('again').onclick=Bay.resume;
$('back').onclick=()=>{Bay.reset();$('mapToggle').hidden=true;parked.length=0;car.model=-1;state.phase='cover';$('result').hidden=true;$('hud').hidden=true;$('cover').hidden=false;
  Object.assign(car,{x:0,z:0,yaw:-2.76,speed:0});Object.assign(player,{x:-4.6,z:-.12,yaw:0});state.vehicle=false;state.cargo='none';state.taking=0;state.door=0;held.clear();};$('sound').onclick=soundToggle;
const keys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyF','KeyT','KeyY','KeyH','KeyV','KeyM','KeyX','Escape','Enter','KeyQ','KeyC','ShiftLeft','ShiftRight','KeyG','KeyR','KeyI','KeyK','KeyB','KeyJ','KeyN','KeyZ','Digit1','Digit2','Digit3']);
addEventListener('keydown',e=>{
  if(NightMarket.panel){if(e.code==='Escape'){e.preventDefault();NightMarket.leave();}return;}
  if(!keys.has(e.code))return;
  if(!$('atlas').hidden&&['KeyT','KeyY'].includes(e.code)){e.preventDefault();if(!e.repeat)preset(e.code==='KeyT'?'time':'weather');return;}
  if(!$('atlas').hidden&&e.code!=='KeyM'&&e.code!=='Escape')return;
  if(e.code==='Enter'&&e.target.tagName==='BUTTON')return;
  e.preventDefault();held.add(e.code);if(e.repeat)return;
  if(e.code==='KeyM'&&state.seat)return;
  if(e.code==='KeyM'){Bay.toggle();return;}
  if(!$('atlas').hidden){if(e.code==='Escape')Bay.toggle();return;}
  if(e.code==='Enter'&&state.phase==='cover')start();
  else if(e.code==='Enter'&&['won','lost'].includes(state.phase))Bay.resume();
  else if(state.phase==='play'){
    if(NightMarket.key(e.code)||Street.key(e.code))return;
    if(e.code==='KeyE')interact();
    if(e.code==='KeyF'&&!state.seat)Bay.action();
    if(e.code==='KeyV'&&state.vehicle)state.cockpit=!state.cockpit;
    if(e.code==='KeyH'&&state.vehicle&&car.model===2){car.siren=!car.siren;if(car.siren&&$('sound').getAttribute('aria-pressed')!=='true')soundToggle();}
    if(e.code==='KeyT')preset('time');
    if(e.code==='KeyY')preset('weather');
    if(e.code==='Space'){if(state.activity==='volley')Bay.strike();else jump();}
    if(e.code==='KeyX'||e.code==='Escape')Bay.cancel();
  }
});
addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>{held.clear();NightMarket.mouse(false);});
const scene=$('scene');
scene.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointerup',e=>{if(e.button===2)NightMarket.mouse(false);});
scene.addEventListener('pointerdown',e=>{
  if(state.phase!=='play'||state.vehicle||!$('atlas').hidden)return;
  if(NightMarket.panel)return;
  if(e.button===2&&NightMarket.activeWeapon){NightMarket.mouse(true);}
  else if(e.button===0&&NightMarket.aiming()){NightMarket.shoot();return;}
  scene.setPointerCapture(e.pointerId);dragPoint=[e.clientX,e.clientY];
});
scene.addEventListener('pointermove',e=>{
  if(!dragPoint)return;
  const dx=e.clientX-dragPoint[0],dy=e.clientY-dragPoint[1];dragPoint=[e.clientX,e.clientY];
  footHeading+=dx*.006;
  if(NightMarket.aiming())NightMarket.look(dy);
  else if(Bay.aiming())Bay.pitch(dy*.004);
  else orbitHeight=clamp(orbitHeight+dy*.014,1.20,4.8);
});
scene.addEventListener('lostpointercapture',()=>{dragPoint=null;NightMarket.mouse(false);});
scene.addEventListener('wheel',e=>{
  if(state.phase!=='play'||state.vehicle||Bay.aiming())return;
  e.preventDefault();orbitDistance=clamp(orbitDistance+e.deltaY*.009,1.68,7.5);
},{passive:false});
function preset(kind){
  if(kind==='time')Climate.nextTime();else Climate.nextWeather();
  $('environment').textContent=Climate.time()+'　'+Climate.label;
}
$('timePreset').onclick=()=>preset('time');$('weatherPreset').onclick=()=>preset('weather');
$('marketExit').onclick=NightMarket.leave;$('inspectBay').onclick=NightMarket.inspect;
Bay.init();requestAnimationFrame(frame);
