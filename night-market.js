'use strict';
const NightMarket=(()=>{
  const {locations,shops,garage,local,world}=NightBlocks;
  const names=['手枪','霰弹枪','RPG'];
  const catalog=[
    ['paint','午夜喷漆',180,'更换车色，清空本次警星'],
    ['tires','防弹轮胎',260,'抵消追击无人机的轮胎干扰'],
    ['nitro','氮气加速',380,'驾驶时按住 Shift，松开后回充'],
    ['shotgun','霰弹枪',440,'近距离脉冲，可使追击无人机暂时离线'],
    ['rpg','RPG',690,'远距离脉冲，可使追击无人机长时间离线'],
    ['skin','更换角色皮肤',120,'切换下一套角色外观，共五套']
  ];
  const colors=[[.25,.72,.68],[.31,.42,.74],[.72,.36,.51],[.82,.61,.30]];
  const storage='palma-bay-night-market-v1';
  function load(){
    const defaults={cash:400,skin:0,weapons:[0],cars:{}};
    try{const data=JSON.parse(localStorage.getItem(storage));
      if(Number.isSafeInteger(data?.cash)&&data.cash>=0&&Number.isInteger(data.skin)&&data.skin>=0&&data.skin<5&&Array.isArray(data.weapons)&&data.cars&&typeof data.cars==='object')return data;
    }catch{}return defaults;
  }
  const wallet=load(),cooldowns=new Map();
  let job=null,inside=null,armed=false,weapon=0,pitch=0,mouseAim=false,flash=0,reload=0,charge=1,pulse=0;
  let sublevel=false,panel=false,latch=false,alert=null;
  function save(){try{localStorage.setItem(storage,JSON.stringify(wallet));}catch{}}
  const kit=(v=car)=>wallet.cars[v.garageId]||{};
  const aiming=()=>state.phase==='play'&&state.activity==='roam'&&!state.vehicle&&!state.seat&&armed&&(mouseAim||held.has('KeyR'));
  function reset(){job=inside=alert=null;armed=mouseAim=sublevel=panel=latch=false;charge=1;weapon=0;flash=reload=pulse=pitch=0;cooldowns.clear();$('market').hidden=true;$('sight').hidden=true;$('pressure').hidden=true;}
  function shopAt(p){return shops.find(v=>{const q=local(v,p);return Math.abs(q.x)<4.43&&q.z>.02&&q.z<8.08;})||null;}
  function cashier(v){return world(v,0,6.65);}
  function facing(target,height,width){
    const dx=target.x-player.x,dz=target.z-player.z,d=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    return Math.abs(turn(footHeading,angle))<Math.atan2(width,d)+.025&&Math.abs(pitch-Math.atan2(1.52+(player.height||0)-height,d))<Math.atan2(.47,d)+.035;
  }
  function begin(v){
    if(job)return job.store===v;
    if((cooldowns.get(v)||0)>elapsed){note('本店正在补货');return false;}
    const hard=mode==='expert';
    job={store:v,progress:0,opened:0,stunned:false,bag:0,stars:2,left:hard?22:16,limit:hard?22:16,exposure:0,
      response:hard?3:5,beep:0,throws:[],amount:600+v.index*70,drone:{...world(v,5,-11),sleep:0}};
    return true;
  }
  function tone(hz,seconds,type='triangle'){
    if(!audio||$('sound').getAttribute('aria-pressed')!=='true')return;
    const o=audio.createOscillator(),volume=audio.createGain(),now=audio.currentTime;
    o.type=type;o.frequency.setValueAtTime(hz,now);o.frequency.exponentialRampToValueAtTime(hz*.6,now+seconds);
    volume.gain.setValueAtTime(.034,now);volume.gain.exponentialRampToValueAtTime(.0001,now+seconds);
    o.connect(volume);volume.connect(audio.destination);o.onended=()=>{o.disconnect();volume.disconnect();};o.start(now);o.stop(now+seconds);
  }
  function advance(n){
    const old=Math.floor(job.progress*3);job.progress=Math.min(1,job.progress+n);
    for(let i=old;i<Math.floor(job.progress*3);i++)job.throws.push(elapsed);
  }
  function registerNear(){return inside&&dist(player,world(inside,.45,5.25))<2.15;}
  function stun(){
    if(!inside||!registerNear()||!begin(inside)||job.stunned||job.progress>=1)return;
    job.stunned=true;note('收银员倒下 · 柜台交互已切换');
  }
  function shoot(){
    if(!aiming()||reload>0||panel)return;
    reload=[.42,.82,1.55][weapon];flash=.16;tone([175,120,82][weapon],.14,'sawtooth');
    if(inside&&(!job||job.store===inside)){
      if(pitch<-.45&&begin(inside)&&!job.stunned){advance([.14,.19,.23][weapon]);return;}
      if(facing(cashier(inside),1.48,.42)&&begin(inside)&&job.progress<1){job.stunned=true;note('收银员倒下 · 靠近收银机');}
    }else if(job&&!job.response&&job.drone.sleep<=0&&dist(player,job.drone)<[12,19,48][weapon]&&facing(job.drone,2.35,weapon===2?2.1:.9)){
      job.drone.sleep=[1.4,4,7][weapon];job.exposure=0;note('追击无人机离线');return;
    }
    if(!inside)Street.fire(footHeading,pitch,[23,17,32][weapon]);
  }
  function interact(){
    if(!inside||state.vehicle||state.activity!=='roam')return false;
    if(job?.store===inside&&!job.bag&&registerNear()){
      if(job.progress>=1&&elapsed-job.throws.at(-1)>.45){job.bag=job.amount;armed=false;mouseAim=false;note('已背起现金袋');}
      else if(job.stunned)note('按住 E 打开收银机');
    }return true;
  }
  function clearJob(success){
    const j=job;if(!j)return;
    job=null;cooldowns.set(j.store,elapsed+28);
    if(success&&j.bag){wallet.cash+=j.bag;save();alert={text:'现金已入账　+$'+j.bag,until:elapsed+5};}
    else alert={text:success?'警戒解除':'追击截获 · 本次现金袋已失去',until:elapsed+4};
    note(alert.text);
  }
  function pursuit(dt){
    const j=job,where=state.vehicle?car:player,d=dist(where,j.store);
    j.response=Math.max(0,j.response-dt);
    if(inside===j.store){j.beep-=dt;if(j.beep<=0){tone(730,.11);j.beep=1.35;}return;}
    if(j.response>0)return;
    const bot=j.drone;bot.sleep=Math.max(0,bot.sleep-dt);
    const range=dist(where,bot),speed=mode==='expert'?4:3;
    if(!bot.sleep&&range>.35){
      const step=Math.min(range,speed*dt);
      bot.x+=(where.x-bot.x)*step/range;bot.z+=(where.z-bot.z)*step/range;
    }
    const close=range<3.1&&!bot.sleep;
    j.exposure=Math.max(0,j.exposure+(close?1:-1.8)*dt);
    if(state.vehicle&&close&&!kit().tires&&pulse<=0){car.speed*=.55;pulse=3;note('轮胎受到脉冲干扰');}
    if(j.exposure>4.5){clearJob(false);return;}
    if(d>17&&!close){j.left=Math.max(0,j.left-dt);j.stars=j.left>j.limit*.45?2:j.left>0?1:0;if(!j.stars)clearJob(true);}
  }
  function tick(dt){
    if(panel||sublevel)return;
    inside=state.vehicle?null:shopAt(player);
    flash=Math.max(0,flash-dt);reload=Math.max(0,reload-dt);pulse=Math.max(0,pulse-dt);
    if(state.activity!=='roam')return;
    if(aiming()){player.yaw=footHeading;pitch=clamp(pitch+axis(['KeyK'],['KeyI'])*dt*1.2,-1.22,.75);
      if(inside&&facing(cashier(inside),1.48,.42)&&begin(inside)&&!job.stunned)advance(dt/(mode==='expert'?7:5));}
    if(job){
      if(job.stunned&&inside===job.store&&job.progress<1&&registerNear()&&held.has('KeyE')){
        job.opened=Math.min(1,job.opened+dt/(mode==='expert'?12:9));
        if(job.opened>=1)advance(1);
      }else if(job.stunned&&job.progress<1)job.opened=0;
      pursuit(dt);
    }
    const q=local(garage,state.vehicle?car:player),r=Math.hypot(q.x,q.z-2.8);
    if(r>3.5)latch=false;
    if(state.vehicle&&!state.seat&&!latch&&r<2.75){sublevel=panel=latch=true;car.speed=car.slide=0;Object.assign(car,{x:garage.x,z:garage.z,yaw:Math.PI});held.clear();mouseAim=false;showPanel();}
  }
  function boost(dt,go,stopping){
    const active=!stopping&&kit().nitro&&go>0&&(held.has('ShiftLeft')||held.has('ShiftRight'))&&charge>0;
    if(active)charge=Math.max(0,charge-dt*.30);
    else if(!held.has('ShiftLeft')&&!held.has('ShiftRight'))charge=Math.min(1,charge+dt*.16);
    return !!active;
  }
  function equipped(id){
    if(id==='tires'||id==='nitro')return !!kit()[id];
    if(id==='shotgun'||id==='rpg')return wallet.weapons.includes(id==='shotgun'?1:2);
    return false;
  }
  function buy(id){
    const line=catalog.find(([key])=>key===id);if(!panel||!state.vehicle||!line||equipped(id)||wallet.cash<line[2])return;
    wallet.cash-=line[2];
    const item=wallet.cars[car.garageId]??={};
    if(id==='paint'){item.paint=((item.paint??-1)+1)%colors.length;if(job)clearJob(true);}
    else if(id==='skin')wallet.skin=(wallet.skin+1)%5;
    else if(id==='tires'||id==='nitro')item[id]=true;
    else{weapon=id==='shotgun'?1:2;wallet.weapons.push(weapon);}
    save();showPanel(line[1]+'已完成');hud();
  }
  function showPanel(message=''){
    $('market').hidden=false;$('marketCash').textContent='$'+wallet.cash;
    $('marketNote').textContent=message||Driving.type(car.model).name;
    const buttons=catalog.map(([id,title,price,detail])=>{const b=document.createElement('button');b.dataset.item=id;
      const label=document.createElement('strong'),desc=document.createElement('small'),cost=document.createElement('b');
      label.textContent=title;desc.textContent=detail;cost.textContent=equipped(id)?'已拥有':'$'+price;
      b.append(label,desc,cost);b.disabled=equipped(id)||wallet.cash<price;b.onclick=()=>buy(id);return b;});
    $('marketItems').replaceChildren(...buttons);$('marketExit').focus();
  }
  function leave(){panel=sublevel=false;$('market').hidden=true;held.clear();mouseAim=false;last=performance.now();
    const out=world(garage,0,-3.4);Object.assign(car,out,{yaw:Math.PI,speed:0,slide:0});footHeading=car.yaw;hud();}
  function inspect(){panel=false;$('market').hidden=true;held.clear();last=performance.now();hud();}
  function garageDrive(dt){
    const go=axis(['KeyW','ArrowUp'],['KeyS','ArrowDown']),steer=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']);
    const v=Driving.step(car,dt,go,steer,held.has('Space'),false,0);
    const p=local(garage,v);
    if(Math.abs(p.x)<7.6&&Math.abs(p.z)<10.1)Object.assign(car,v);else car.speed=0;
    car.speed=clamp(car.speed,-3,4.5);
    if(p.z< -8.6&&Math.abs(p.x)<3.0){leave();return;}
    const r=Math.hypot(p.x,p.z);if(r>3.2)latch=false;
    if(!latch&&r<2.55){panel=latch=true;car.speed=0;held.clear();showPanel();}
  }
  function key(code){
    if(sublevel){if(code==='KeyE'){panel=true;car.speed=0;held.clear();showPanel();}return true;}
    if(state.activity!=='roam'||state.seat)return false;
    if(code==='KeyG'&&!state.vehicle){armed=!armed;pitch=.035;mouseAim=false;return true;}
    if(code==='KeyR'&&!state.vehicle){if(armed)pitch=.04;return true;}
    if(['Digit1','Digit2','Digit3'].includes(code)&&!state.vehicle){const n=Number(code.at(-1))-1;
      if(wallet.weapons.includes(n)){weapon=n;armed=true;}else note('此武器可在地下车库购买');return true;}
    if(code==='KeyJ'){shoot();return true;}
    if(code==='KeyB'&&armed&&!state.vehicle){stun();return true;}
    if((inside||job)&&(code==='KeyF'||code==='KeyX'))return true;
    return false;
  }
  function cameraView(){
    if(!aiming())return false;
    Object.assign(camera,{x:player.x,y:Town.floorAt(player.x,player.z)+1.52+(player.height||0),z:player.z,yaw:footHeading,pitch});
    return true;
  }
  function draw(){
    const v=garage,ring=world(v,0,2.8);
    if(dist(camera,ring)<130)Gfx.draw(NightBlocks.circle,ring.x,0,ring.z);
    for(const s of shops){if(dist(camera,s)>55)continue;
      const j=job?.store===s?job:null,c=cashier(s),g=Town.floorAt(c.x,c.z);
      const down=!!j?.stunned,toss=j?.throws.length?clamp((elapsed-j.throws.at(-1))/.45,0,1):1;
      CharacterPass.submit(2,c.x,c.z,Math.PI+(s.dir<0?Math.PI:0),elapsed,0,0,0,down?.04:0,0,{clerk:down?'down':j?'hands':'',toss:Math.sin(toss*Math.PI)});
      if(!j)continue;
      if(Math.sin(elapsed*11)>0){const a=world(s,-1.15,7.79);Gfx.draw(NightBlocks.glow,a.x,2.38,a.z);}
      if(!j.bag)j.throws.forEach((t,i)=>{const f=clamp((elapsed-t)/.45,0,1),p=world(s,(i-1)*.67*f,6.55-1.08*f);
        Gfx.draw(NightBlocks.bag,p.x,g+1.07+.50*Math.sin(f*Math.PI),p.z,i*.46);});
    }
    if(job&&!inside&&!job.response&&!job.drone.sleep){const d=job.drone;Gfx.draw(NightBlocks.drone,d.x,2.28+.09*Math.sin(elapsed*4),d.z,elapsed*.8);}
  }
  function viewWeapon(){
    const sn=Math.sin(camera.yaw),cs=Math.cos(camera.yaw),up=Math.sin(pitch),fw=Math.cos(pitch),depth=.67;
    const horizontal=depth*fw-.18*up,x=camera.x+.24*cs+horizontal*sn,z=camera.z-.24*sn+horizontal*cs;
    const y=camera.y-.18*fw-depth*up+(flash>0?.022:0);
    Gfx.draw(NightBlocks.weapons[weapon],x,y,z,camera.yaw,pitch);
    if(flash>0)Gfx.draw(NightBlocks.spark,x+.22*fw*sn,y-.22*up,z+.22*fw*cs);
  }
  function garageView(){
    const p=local(garage,car),bx=clamp(p.x-4.7*Math.sin(car.yaw-.72),-8.8,8.8),bz=clamp(p.z-5.8*Math.cos(car.yaw-.72),-11.2,11.2);
    const c=panel?aimAt(3.95,1.92,-6.35,1.55,.76,.70):aimAt(bx,2.28,bz,p.x,.90,p.z);Gfx.begin([c.x,c.y,c.z],c.yaw,c.pitch,-1,true);Gfx.draw(NightBlocks.bunker);
    Gfx.draw(NightBlocks.circle);drawCar({...car,x:p.x,z:p.z});return true;
  }
  function paint(v){return colors[kit(v).paint]||null;}
  function ui(){
    const j=job,scope=state.activity==='roam',a=aiming();
    $('money').textContent='$'+wallet.cash;$('pendingBag').textContent=j?.bag?'待入账　$'+j.bag:'';
    $('weaponTag').textContent=armed&&!state.vehicle?names[weapon]:'';
    $('stars').textContent=j?'★'.repeat(j.stars)+'☆'.repeat(2-j.stars)+'　'+(j.response>0?'出警 '+Math.ceil(j.response):'搜寻 '+Math.ceil(j.left))+'s':'';
    $('sight').hidden=!a;$('sight').classList.toggle('shot',flash>0);
    $('pressure').hidden=!(inside&&scope&&!j?.bag&&(j?.store===inside||a));
    $('pressureText').textContent=j?.stunned?'收银机':'威慑度';
    $('pressureBar').value=j?.stunned?j.opened:j?.progress||0;
    if(!scope)return;
    let title='',hint='';
    if(inside){title=inside.name;hint='G 拔枪 · 按住 R 瞄准 · Q/C 转向 · I/K 俯仰 · J 射击';
      if(j?.store===inside)hint=j.bag?'现金袋已背好 · 从店门离开':j.progress>=1?'现金袋已落到柜台 · 走近按 E 拾取':j.stunned?'靠近柜台，按住 E 直到收银机打开':'持续对准收银员 · I/K 抬高或降低准星 · J 发射 · B 近身击晕';
      else if((cooldowns.get(inside)||0)>elapsed)hint='本店补货中　'+Math.ceil(cooldowns.get(inside)-elapsed)+' 秒';
    }else if(j){title=j.bag?'带走现金袋':'店内警报已响';hint=j.exposure>0?'无人机扫描　'+Math.ceil(j.exposure/4.5*100)+'%':'离开红色警戒圈，倒计时归零后结算';}
    else if(alert&&elapsed<alert.until){title=alert.text;hint='M 查看便利店和地下车库';}
    else if(sublevel){title='地下车库 · B1';hint='WASD 驾驶 · E 工位服务 · 驶向卷帘门离场';}
    else if(dist(state.vehicle?car:player,garage)<14){title=garage.name;hint='驾驶车辆驶入薄荷色光圈';}
    if(title){$('stage').textContent='PALMA AFTER HOURS';$('goal').textContent=title;$('hint').textContent=performance.now()<toastUntil?toast:hint;}
    if(state.vehicle&&kit().nitro)$('vehicleName').textContent+=' · 氮气 '+Math.round(charge*100)+'% / Shift';
    if(inside||a)$('controls').textContent='G 收放武器　·　R / 鼠标右键瞄准　·　J / 左键射击　·　1–3 切换　·　E 互动';
  }
  function radar(ctx,pt,scale){
    for(const v of locations){const [x,y]=pt(v.x,v.z);ctx.fillStyle=v.tint;ctx.font='bold 10px monospace';ctx.fillText(v.garage?'G':'24',x-5,y+3);}
    if(!job)return;
    const [x,y]=pt(job.store.x,job.store.z);ctx.beginPath();ctx.arc(x,y,17*scale,0,Math.PI*2);ctx.lineWidth=1.5;ctx.strokeStyle='#ff6b76';ctx.stroke();
    const [a,b]=pt(job.drone.x,job.drone.z);ctx.fillStyle='#ff7582';ctx.fillRect(a-2,b-2,4,4);
  }
  return {credit(amount){wallet.cash+=amount;save();},horn(){tone(265,.25);tone(345,.24);},locations,reset,tick,boost,interact,key,ui,draw,garageView,viewWeapon,leave,cameraView,paint,radar,aiming,shoot,
    mouse:on=>{mouseAim=on;if(on)pitch=.04;},look:dy=>{pitch=clamp(pitch+dy*.004,-1.22,.75);},
    inspect,garageDrive,get sublevel(){return sublevel;},get locked(){return !!(job||sublevel);},get panel(){return panel;},get inside(){return inside;},
    get skin(){return wallet.skin;},get gear(){return {hero:true,weapon:armed?weapon:-1,bag:!!job?.bag};},
    get activeWeapon(){return armed;},get firing(){return flash>0;}};
})();
