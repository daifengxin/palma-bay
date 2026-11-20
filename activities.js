'use strict';
const Bay=(()=>{
  const venues=[
    {id:'plaza',symbol:'◇',name:'棕榈大街',x:-5.72,z:-11.2,angle:0,parking:[3.6,-5],desc:'沿街散步。街口有车，海堤大道通向沙滩。'},
    {id:'race',symbol:'⚑',name:'海堤计时赛',x:-3.5,z:24,angle:-.7,parking:[-.8,23],desc:'开车穿过五道旗门，从海堤弯道冲向运河大道。碰撞会损失时间。'},
    {id:'volley',symbol:'●',name:'南滩排球场',x:-66,z:52,angle:0,parking:[-44,58],desc:'走到沙地上的落点，在球落下时按空格回击。回击时按 A／D 可以打向两翼。先得三分获胜。'},
    {id:'photo',symbol:'◎',name:'海岸摄影漫游',x:-74,z:90,angle:-.62,parking:[-42,87],desc:'从灯塔拍到汽车影院。在地标附近按 F 举起相机，转动镜头，对准后按 F 拍摄。'},
    {id:'delivery',symbol:'▣',name:'潮汐冲印室',x:-5.85,z:123.7,angle:0,parking:[-.8,124],desc:'接下夜场配送，从柜台取片，在车尾装车，经港口验封后送到汽车影院。'},
    {id:'boulevard',sight:true,symbol:'═',name:'日落大道',x:46.4,z:28,angle:0,parking:[48,28],desc:'双向四车道试车段。北行经过信号灯与旅馆露台；T 切换时段，Y 切换天气。'}
  ];
  for(const v of NightBlocks.locations){const entry=NightBlocks.world(v,0,-2),park=NightBlocks.world(v,-2,-8);
    venues.push({...entry,id:v.id,sight:true,symbol:v.garage?'G':'24',name:v.name,angle:v.dir<0?Math.PI:0,parking:[park.x,park.z],desc:v.garage?'驾车驶入入口光圈，购买改装、喷漆或更换外观。':'步行穿过霓虹门框，G 拔枪，按住 R 瞄准。'});
  }
  const gates=[[-24,39],[-38,76],[0,110],[0,147],[-33,185]].map(([x,z])=>({x,z}));
  const shots=[
    {name:'西湾灯塔',x:-89,z:113,y:8,stand:{x:-74,z:90}},
    {name:'海角银幕',x:-54,z:364,y:7,stand:{x:-53,z:340}}
  ];
  let selected=0,pin=null,mapTime=0,index=0,raceStart=0,view=false,tilt=0,pendingPhoto=false;
  let score=0,away=0,rally=0,hit=0,leg=null,ball={x:-66,y:1,z:61},rival=-66,landing={x:-66,z:52},serve=0;
  const snapshots=new Map();
  const place=id=>venues.find(v=>v.id===id);
  const pos=()=>state.vehicle?car:player;
  const swimmer=()=>!state.vehicle&&player.x<Beach.shore(player.z)-.7;
  const nearby=()=>venues.find(v=>!v.sight&&v.id!=='plaza'&&dist(pos(),v)<(v.id==='race'?8:4));
  const ring=new Gfx.Mesh(),flag=new Gfx.Mesh(),landingMark=new Gfx.Mesh();
  for(let j=0;j<36;j++){const a=j*Math.PI/18,b=(j+1)*Math.PI/18;
    const pt=(r,t)=>[r*Math.cos(t),.02,r*Math.sin(t)];
    landingMark.quad([pt(.78,a),pt(.89,a),pt(.89,b),pt(.78,b)],'#fff1a0');}
  for(const side of [-1,1]){
    ring.box(side*3.3,0,0,.09,3.3,.09,'#f4d994');
    for(let j=0;j<4;j++)for(let k=0;k<3;k++)ring.box(side*(3.3-.1-j*.21),2.60+k*.21,0,.22,.22,.035,(j+k)%2?'#363533':'#ffdc95');
  }
  flag.box(0,0,0,.07,2.55,.07,'#a18a70');
  flag.quad([[0,2.55,0],[.86,2.47,0],[.69,1.98,0],[0,2.04,0]],'#ee986c');
  ring.seal();flag.seal();landingMark.seal();
  function target(){
    if(state.activity==='race')return gates[index];
    if(state.activity==='photo')return shots[index].stand;
    if(state.activity==='volley')return landing;
    return pin||nearby()||place('race');
  }
  function reset(){
    state.activity='roam';state.deadline=Infinity;state.remaining=Infinity;state.stage=0;state.cargo='none';state.parked=0;
    view=false;pendingPhoto=false;pin=null;leg=null;hit=0;
    $('finder').hidden=true;$('atlas').hidden=true;$('mapToggle').hidden=false;$('clockLabel').textContent='PALMA BAY';
  }
  function conclude(win,title,detail){
    state.phase=win?'won':'lost';car.speed=0;held.clear();view=false;$('finder').hidden=true;
    $('hud').hidden=true;$('result').hidden=false;$('mapToggle').hidden=true;
    $('outcome').textContent=place(state.activity).name;$('resultTitle').textContent=title;$('summary').textContent=detail;
  }
  function resume(){reset();state.phase='play';held.clear();$('result').hidden=true;$('hud').hidden=false;note('已回到自由探索');hud();}
  function begin(v){
    if(v.id==='race'&&!state.vehicle){note('先坐进车，再驶到旗子旁按 F 发车');return;}
    if(['photo','volley','delivery'].includes(v.id)&&state.vehicle){note('在附近停稳，按 E 下车后参加');return;}
    state.activity=v.id;pin=null;index=0;held.clear();toastUntil=0;
    if(v.id==='race'){
      raceStart=performance.now();state.deadline=raceStart+(mode==='expert'?32:48)*1000;
    }else if(v.id==='volley'){
      motion.reset();Object.assign(player,{x:-66,z:52,yaw:0,pace:0});footHeading=0;score=away=rally=serve=0;rival=-66;launch(true);
    }else if(v.id==='delivery'){
      state.deadline=performance.now()+modes[mode].limit*1000;state.health=100;state.hits=0;state.stage=0;state.cargo='none';
    }else if(v.id==='photo'){footHeading=Math.atan2(shots[0].x-player.x,shots[0].z-player.z);note('靠近灯塔，按 F 举起相机');}
    state.remaining=(state.deadline-performance.now())/1000;hud();
  }
  function action(){
    if(state.activity==='roam'){const v=nearby();if(v)begin(v);else note('按 M 找到附近活动');return;}
    if(state.activity!=='photo')return;
    if(state.vehicle){note('停车下车后举起相机');return;}
    if(!view){motion.reset();view=true;tilt=-.05;$('finder').hidden=false;return;}
    const s=shots[index],d=dist(player,s),a=Math.atan2(s.x-player.x,s.z-player.z),p=Math.atan2(1.65-s.y,d);
    if(d<8||d>52){note('取景距离需要在 8 至 52 米之间');return;}
    if(Math.abs(turn(camera.yaw,a))>.19||Math.abs(camera.pitch-p)>.17){note('将地标中心移进取景框 · Q/C 左右，↑↓ 俯仰');return;}
    pendingPhoto=true;
  }
  function capture(){
    if(!pendingPhoto)return;pendingPhoto=false;
    const s=shots[index],thumb=document.createElement('canvas');thumb.width=256;thumb.height=144;
    thumb.getContext('2d').drawImage($('scene'),0,0,256,144);snapshots.set(s.name,thumb.toDataURL('image/jpeg',.82));
    $('flash').classList.remove('fire');void $('flash').offsetWidth;$('flash').classList.add('fire');
    view=false;$('finder').hidden=true;index++;
    if(index===shots.length)conclude(true,'海湾明信片','两张实景照片已放进本次游玩的地图相册。');
    else note('已收录西湾灯塔。下一站是北端的海角汽车影院');
  }
  function launch(incoming){
    const lateral=[0,-1.7,2.0,-2.45,1.35,-.85];
    if(incoming)landing={x:-66+lateral[(serve+rally)%lateral.length],z:52+(rally%2)*1.25};
    const aim=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']);
    const crosscourt=clamp((player.x+66)*-1.45+(rally%2?1.4:-1.4),-4,4);
    const to=incoming?landing:{x:-66+(aim?aim*3.9:crosscourt),z:62};
    const from=incoming?{x:rival,z:62,y:1.5}:{...ball};
    leg={from,to,incoming,t:0,seconds:incoming?(mode==='expert'?1.65:2.12):1.64};
  }
  function point(mine){
    if(mine)score++;else away++;
    if(score===3||away===3){conclude(score===3,score===3?'拿下这一局。':'对手拿下这一局。','南滩排球　'+score+' : '+away);return;}
    note((mine?'你得分':'对手得分')+'　'+score+' : '+away);rally=0;serve++;launch(true);
  }
  function strike(){
    if(state.activity!=='volley'||!leg?.incoming||hit>.14)return;
    hit=.48;
    const phase=leg.t/leg.seconds;
    if(phase<.70||phase>1||dist(player,ball)>1.8){note(phase<.70?'再等球低一些':'向落点移动');return;}
    rally++;launch(false);note('回击成功');
  }
  function tick(dt){
    if(state.activity==='race'){
      if(state.vehicle&&dist(car,gates[index])<5.6){index++;
        if(index===gates.length){const sec=((performance.now()-raceStart)/1000).toFixed(1);conclude(true,'冲线！','完成五道旗门，用时 '+sec+' 秒。');}
        else note('通过旗门　'+index+' / '+gates.length);}
    }else if(state.activity==='volley'){
      hit=Math.max(0,hit-dt);leg.t+=dt;
      const t=Math.min(1,leg.t/leg.seconds);
      ball={x:leg.from.x+(leg.to.x-leg.from.x)*t,z:leg.from.z+(leg.to.z-leg.from.z)*t,
        y:leg.from.y*(1-t)+(leg.incoming?.22:1.4)*t+4*3.6*t*(1-t)};
      if(!leg.incoming){const dx=leg.to.x-rival,speed=(mode==='expert'?2.35:1.9)/(1+.27*rally);
        rival+=Math.sign(dx)*Math.min(Math.abs(dx),speed*dt);}
      if(t>=1){if(leg.incoming)point(false);else if(Math.abs(rival-leg.to.x)>.75)point(true);else launch(true);}
    }
  }
  function draw(){
    if(state.phase!=='play')return;
    for(const v of venues.slice(1))if(!v.sight&&dist(camera,v)<115&&v.id!=='volley'&&v.id!=='photo')Gfx.draw(flag,v.x+2,0,v.z,0);
    if(state.activity==='race'){const g=gates[index],prev=index?gates[index-1]:place('race');Gfx.draw(ring,g.x,0,g.z,Math.atan2(g.x-prev.x,g.z-prev.z));}
    if(dist(camera,place('volley'))<95){
      const playing=state.activity==='volley';
      People.drawModel(3,playing?rival:-66,62,Math.PI,elapsed*3,.13,.22,playing&&!leg.incoming&&ball.z>58?.85:.05);
      if(playing){Gfx.draw(Beach.ball,ball.x,ball.y,ball.z,elapsed*4);if(leg.incoming)Gfx.draw(landingMark,landing.x,0,landing.z);}
      else Gfx.draw(Beach.ball,-65.4,.19,62);
    }
  }
  function info(){
    const id=state.activity,v=nearby();
    let label='自由探索',title=pin?'前往'+pin.name:v?v.name:'帕尔马湾',hint=v?'按 F 参加活动':'M 打开海湾地图，选择一个目的地',meter=Climate.time(),sub=Climate.label,cap='南岸当地';
    if(pin&&!v)hint='目的地 '+Math.round(dist(pos(),pin))+' 米 · M 查看位置';
    if(!state.vehicle&&dist(player,driverDoor())<2.8)hint=state.owned?'按 E 上车':'等车停稳，在驾驶门旁按住 E';
    if(!state.vehicle&&!v&&spareNear())hint='按 E 驾驶'+Driving.type(spareNear().model).name;
    if(swimmer()){title='西湾海泳';hint='WASD 游动 · 向东回到沙滩';}
    if(id==='race'){label='海堤计时赛';title='穿过下一道黑白旗门';hint='距离 '+Math.round(dist(pos(),gates[index]))+' 米 · 空格制动';meter=Math.ceil(state.remaining)+' s';sub='旗门　'+index+' / '+gates.length;cap='剩余时间';}
    if(id==='volley'){label='南滩排球';title=leg?.incoming?'移动到金色落点':'对手接球';hint=leg?.incoming?'落点处按空格垫球 · A/D 瞄向两翼':'调整站位，准备下一次回球';meter=score+' : '+away;sub='先得三分';cap='你　/　对手';}
    if(id==='photo'){const s=shots[index];label='海岸摄影　'+(index+1)+' / '+shots.length;title='拍摄'+s.name;hint=view?'Q/C 左右 · ↑↓ 俯仰 · F 快门 · Esc 收起相机':'取景点 '+Math.round(dist(pos(),s.stand))+' 米 · 下车按 F 举起相机';meter=index+' / 2';sub='地图内查看相册';cap='明信片';}
    $('stage').textContent=label;$('goal').textContent=title;$('hint').textContent=performance.now()<toastUntil?toast:hint;
    $('clockLabel').textContent=cap;$('time').textContent=meter;$('time').style.color='';$('condition').textContent=sub;
  }
  function mapDraw(){
    const c=$('atlasMap'),g=c.getContext('2d'),w=c.width,h=c.height;
    const pt=(x,z)=>[(x+148)*1.09+10,h-(z+26)*1.02];
    g.fillStyle='#3b6464';g.fillRect(0,0,w,h);
    g.fillStyle='#a39e7b';g.beginPath();g.moveTo(w,0);for(let z=400;z>=-30;z-=2)g.lineTo(...pt(Beach.shore(z),z));g.lineTo(w,h);g.fill();
    g.fillStyle='#617264';g.fillRect(pt(-51,0)[0],0,w,h);
    g.strokeStyle='#d4caaa';g.lineJoin='round';for(const r of Town.roads){g.beginPath();r.points.forEach(([x,z],i)=>g[i?'lineTo':'moveTo'](...pt(x,z)));g.lineWidth=r.width*.55;g.stroke();}
    const dot=(x,z,color,r)=>{const [a,b]=pt(x,z);g.fillStyle=color;g.beginPath();g.arc(a,b,r,0,Math.PI*2);g.fill();};
    if(state.activity!=='roam'){const t=missionPoint();dot(t.x,t.z,'#ff994c',7);}
    venues.forEach((v,i)=>{dot(v.x,v.z,i===selected?'#f7db83':'#243f40',i===selected?8:6);});
    NightMarket.radar(g,pt,1.04);dot(pos().x,pos().z,'#fff8e5',3.5);
    g.font='12px monospace';g.fillStyle='#e3e3c9';g.fillText('N ↑',14,23);g.save();g.translate(26,290);g.rotate(-Math.PI/2);g.fillText('WEST BAY',0,0);g.restore();
  }
  function choose(i){selected=i;const v=venues[i];$('destination').textContent=v.desc;
    [...$('venues').children].forEach((el,j)=>el.setAttribute('aria-pressed',String(i===j)));mapDraw();}
  function closeMap(){
    if($('atlas').hidden)return;
    const pause=performance.now()-mapTime;if(Number.isFinite(state.deadline))state.deadline+=pause;
    if(state.activity==='race')raceStart+=pause;
    last=performance.now();$('atlas').hidden=true;held.clear();
  }
  function toggle(){
    if(state.phase!=='play'||state.seat||NightMarket.panel)return;if(!$('atlas').hidden){closeMap();return;}
    mapTime=performance.now();held.clear();$('atlas').hidden=false;$('travel').disabled=state.activity!=='roam'||NightMarket.locked;$('pin').disabled=state.activity!=='roam';
    $('album').replaceChildren(...Array.from(snapshots,([name,url])=>{const el=new Image();el.src=url;el.alt=name;el.title=name;return el;}));choose(selected);
  }
  function travel(){
    if(state.activity!=='roam'||NightMarket.locked)return;const v=venues[selected];closeMap();pin=null;motion.reset();
    state.seat=null;state.cockpit=false;player.height=0;player.vertical=0;Driving.reset(car);car.siren=false;state.vehicle=false;state.owned=true;state.taking=0;car.speed=0;
    Object.assign(car,{x:v.parking[0],z:v.parking[1],yaw:v.angle});Object.assign(player,{x:v.x,z:v.z,yaw:v.angle,pace:0});footHeading=v.angle;
    Object.assign(camera,aimAt(v.x-3.85*Math.sin(v.angle),2.1,v.z-3.85*Math.cos(v.angle),v.x,1.23,v.z));note('到达'+v.name);
  }
  function init(){
    for(const [i,v] of venues.entries()){const b=document.createElement('button');b.innerHTML='<b>'+v.symbol+'</b>'+v.name;b.onclick=()=>choose(i);$('venues').append(b);}
    $('mapToggle').onclick=toggle;$('closeAtlas').onclick=closeMap;$('travel').onclick=travel;
    $('pin').onclick=()=>{pin=venues[selected];closeMap();note('已标记'+pin.name);};
  }
  function cancel(){if(view){view=false;$('finder').hidden=true;return;}if(state.activity!=='roam')resume();}
  function lens(dt){footHeading+=axis(['KeyC','ArrowRight'],['KeyQ','ArrowLeft'])*dt*1.30;tilt=clamp(tilt+axis(['ArrowDown'],['ArrowUp'])*dt*.86,-1.1,.65);
    Object.assign(camera,{x:player.x,y:1.65,z:player.z,yaw:footHeading,pitch:tilt});}
  return {venues,swimmer,target,reset,conclude,resume,action,strike,tick,draw,info,capture,init,toggle,cancel,lens,
    pitch:delta=>{tilt=clamp(tilt+delta,-1.1,.65);},gateCount:()=>index,pinned:()=>pin,aiming:()=>view,reach:()=>hit/.48,volleyArea:(x,z)=>x>=-70.7&&x<=-61.3&&z>=48.6&&z<=56.2};
})();
