'use strict';

// Instances share geometry; only detached props receive an impulse and a gravity step.
const CityEffects=(()=>{
  const models={},props=[],particles=[],limit=1800;
  let time=0,shake=0,skidAt=0,noise=null;
  const dangerous=p=>p.kind==='drum'||p.kind==='canister';
  function round(m,y,r,topY,topR,color){
    for(let i=0;i<16;i++){
      const pt=(k,h,a)=>[a*Math.cos(k*Math.PI/8),h,a*Math.sin(k*Math.PI/8)];
      const a=pt(i,topY,topR),b=pt(i+1,topY,topR);
      m.quad([pt(i,y,r),a,b,pt(i+1,y,r)],color);
      m.quad([[0,topY,0],a,b,[0,topY,0]],color);
    }
  }
  function model(kind,build){const m=new Gfx.Mesh();build(m);models[kind]=m.seal();}
  model('lamp',m=>{
    round(m,0,.21,.29,.14,'#5d6e72');round(m,.25,.115,4.95,.065,'#859493');
    m.box(-.61,4.85,0,1.34,.12,.13,'#80908d');m.box(-1.23,4.78,0,.57,.15,.34,'#485f63');
    m.material=6;m.box(-1.23,4.75,0,.46,.04,.27,'#ffe5ad');
  });
  model('hydrant',m=>{
    round(m,0,.32,.12,.32,'#713e39');round(m,.1,.22,.77,.22,'#b84136');
    round(m,.75,.27,.88,.20,'#e46343');round(m,.88,.20,.99,.09,'#d75d41');
    m.box(0,.44,0,.72,.21,.25,'#c54837');m.box(0,.39,0,.25,.24,.52,'#e3a953');
  });
  model('mailbox',m=>{
    for(const s of [-1,1])m.box(s*.22,0,0,.09,.38,.37,'#44576b');
    m.box(0,.29,0,.70,.92,.52,'#36677b');m.box(0,1.20,0,.72,.10,.54,'#548592');
    m.box(0,.94,-.27,.50,.08,.04,'#182e39');m.box(0,.63,-.27,.25,.13,.025,'#eddebc');
  });
  model('umbrella',m=>{
    round(m,0,.068,2.28,.042,'#b39776');
    for(let i=0;i<16;i++){
      const edge=(j,h,r)=>[r*Math.cos(j*Math.PI/8),h,r*Math.sin(j*Math.PI/8)];
      const a=edge(i,1.92,1.78),b=edge(i+1,1.92,1.78),c=i%4<2?'#cb7466':'#fff0cb';
      m.quad([[0,2.51,0],a,b,[0,2.51,0]],c);m.quad([a,edge(i,1.80,1.78),edge(i+1,1.80,1.78),b],c);
    }
  });
  model('fence',m=>{
    for(const z of [-3.78,3.78])m.box(0,0,z,.22,1.16,.22,'#997b65');
    for(const y of [.39,.85])m.box(0,y,0,.13,.16,7.83,'#ddc298');
  });
  model('canister',m=>{
    round(m,0,.28,.12,.32,'#703a38');round(m,.12,.32,.81,.32,'#ca473c');
    round(m,.81,.32,1.01,.13,'#de6350');round(m,1.01,.09,1.16,.09,'#8e6a52');
    m.box(0,1.16,0,.27,.055,.09,'#d7a45e');round(m,.49,.326,.54,.326,'#f5c296');
  });
  model('drum',m=>{
    round(m,0,.42,1.17,.42,'#b4473a');
    for(const y of [.02,.32,.81,1.14])round(m,y,.44,y+.045,.44,'#753e38');
    round(m,.48,.424,.68,.424,'#dba563');m.box(.20,1.18,.1,.12,.03,.12,'#635754');
  });
  const colors={spark:[1,.71,.23],flame:[1,.37,.09],water:[.65,.91,1],wave:[1,.88,.57],smoke:[.41,.39,.39]};
  function emit(type,x,y,z,vx,vy,vz,life,size){
    if(particles.length>=limit)return;
    particles.push({type,x,y,z,vx,vy,vz,life,max:life,size});
  }
  function burst(type,p,count,power){
    for(let i=0;i<count;i++){
      const a=Math.random()*2*Math.PI,s=power*(.2+Math.random()*.8);
      emit(type,p.x,p.floor+.45,p.z,Math.sin(a)*s,power*(.2+Math.random()),Math.cos(a)*s,
        type==='spark'?.22+Math.random()*.40:.42+Math.random()*.45,type==='spark'?.11:.65+Math.random()*.7);
    }
  }
  function reset(){
    props.length=particles.length=0;time=shake=skidAt=0;
    function place(kind,x,z,yaw=0){
      const floor=Town.floorAt(x,z);
      props.push({kind,x,z,yaw,floor,homeX:x,homeZ:z,base:floor,state:'standing',tilt:0,y:0,water:0});
    }
    for(const p of Town.fixtures)place(p.kind,p.x,p.z,p.yaw);
    for(const [x,z] of [[60.7,41],[45,79],[-7.4,4],[7.9,119],[59.7,153],[99,214]])place('hydrant',x,z);
    for(const [x,z] of [[61.2,47],[44.4,86],[-7.7,12],[-37,91]])place('mailbox',x,z);
    // Choose from service bays beside the streets, with enough space for both props.
    for(const [x,z] of [[61.3,51],[76,69],[32,86],[63,137],[108,201],[-48,215]]){
      const offset=(Math.random()-.5)*1.4,swap=Math.random()<.5;
      for(const [i,kind] of (swap?['drum','canister']:['canister','drum']).entries()){
        const px=x+i*.62,pz=z+i*2.0+offset;
        if(Town.nearestRoad(px,pz).edge>.48&&!Town.blocks.some(b=>Math.abs(px-b.x)<b.w/2+.48&&Math.abs(pz-b.z)<b.d/2+.48))place(kind,px,pz);
      }
    }
  }
  function sound(kind,gain=1){
    if(!audio||$('sound').getAttribute('aria-pressed')!=='true')return;
    gain=Math.min(1,Math.max(0,gain));if(!gain)return;
    const now=audio.currentTime;
    function voice(node,volume,duration,delay=0,filter=null){
      const t=now+delay,env=audio.createGain();env.gain.setValueAtTime(.0001,t);
      env.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*gain),t+.008);
      env.gain.exponentialRampToValueAtTime(.0001,t+duration);
      if(filter){node.connect(filter);filter.connect(env);}else node.connect(env);
      env.connect(audio.destination);node.onended=()=>{node.disconnect();filter?.disconnect();env.disconnect();};
      node.start(t);node.stop(t+duration);
    }
    function tone(a,b,seconds,volume,delay=0,wave='sine'){
      const o=audio.createOscillator();o.type=wave;o.frequency.setValueAtTime(a,now+delay);
      o.frequency.exponentialRampToValueAtTime(b,now+delay+seconds);voice(o,volume,seconds,delay);
    }
    function hiss(freq,q,seconds,volume){
      if(!noise){noise=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);
        const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
      const n=audio.createBufferSource(),f=audio.createBiquadFilter();n.buffer=noise;f.type='bandpass';f.frequency.value=freq;f.Q.value=q;voice(n,volume,seconds,0,f);
    }
    if(kind==='blast'){tone(98,32,.74,.31);hiss(640,.65,.53,.22);}
    if(kind==='glass'){hiss(4200,1.6,.26,.16);for(let i=0;i<4;i++)tone(1700+i*600,860+i*370,.13,.045,i*.022);}
    if(kind==='metal'){tone(286,102,.24,.12,0,'triangle');tone(830,370,.14,.055);hiss(1100,1,.12,.16);}
    if(kind==='skid'){hiss(1450,4,.21,.22);tone(840,1110,.16,.032,0,'triangle');}
  }
  function arm(p){if(p.state==='standing'){p.state='armed';p.due=time+.5;}}
  function impact(p,yaw,speed){
    if(dangerous(p)){if(speed>=6)arm(p);return;}
    if(p.state!=='standing'||speed<3)return;
    p.state='flying';p.vx=Math.sin(yaw)*speed*.36;p.vz=Math.cos(yaw)*speed*.36;
    p.vy=Math.min(5,1.4+speed*.16);p.spin=2.8+Math.min(speed,24)*.09;
    p.fallYaw=yaw;burst('spark',p,14,3.3);
    const listener=state.vehicle?car:player;
    const near=Math.max(0,1-Math.hypot(listener.x-p.x,listener.z-p.z)/32);
    shake=Math.max(shake,.22*near*Math.min(1,speed/13));
    sound('metal',near*Math.min(1,speed/12));
    if(p.kind==='lamp')sound('glass',near*.75);
    if(p.kind==='hydrant')p.flow=true;
  }
  function vehicleHit(x,z,yaw,speed){
    let blocked=false;
    const spec=Driving.type(car.model),sn=Math.sin(yaw),cs=Math.cos(yaw);
    for(const p of props){
      if(p.state!=='standing')continue;
      const dx=p.x-x,dz=p.z-z;if(Math.abs(dx)>9||Math.abs(dz)>9)continue;
      const rad=dangerous(p)?.42:.27;
      const extent=p.kind==='fence'?3.9:0;
      // Intersect a fence segment (or a single prop axis) with the expanded vehicle footprint.
      const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
      let lo=-extent,hi=extent;
      for(const [v,k,half] of [[lx,-sn,spec.halfW+rad],[lz,cs,spec.halfL+rad]]){
        if(Math.abs(k)<1e-8){if(Math.abs(v)>half){hi=-Infinity;break;}continue;}
        const a=(-half-v)/k,b=(half-v)/k;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      }
      if(lo>hi)continue;
      if(Math.abs(speed)>=(dangerous(p)?6:3))impact(p,speed<0?yaw+Math.PI:yaw,Math.abs(speed));
      else{
        const nearZ=Math.max(p.z-extent,Math.min(p.z+extent,z));
        if(Math.hypot(x-p.x,z-nearZ)<Math.hypot(car.x-p.x,car.z-nearZ))blocked=true;
      }
    }
    return blocked;
  }
  function rayTarget(yaw,pitch,range,eye){
    let nearest=null;
    for(const p of props){
      if(!dangerous(p)||p.state==='spent')continue;
      const dx=p.x-player.x,dz=p.z-player.z,t=dx*Math.sin(yaw)+dz*Math.cos(yaw);
      if(t<=0||t>=range||Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))>.43)continue;
      const h=eye-t*Math.tan(pitch)-p.floor;
      if(h>.02&&h<1.25&&(!nearest||t<nearest.depth))nearest={prop:p,depth:t};
    }
    return nearest;
  }
  function blast(p){
    p.state='spent';const observer=state.vehicle?car:player,dist=Math.hypot(p.x-observer.x,p.z-observer.z);
    const strength=Math.max(0,1-dist/40);shake=Math.max(shake,strength);sound('blast',strength);
    burst('flame',p,62,5.3);burst('smoke',p,22,2.4);burst('spark',p,24,7);
    for(let i=0;i<80;i++){const a=i*Math.PI/40;emit('wave',p.x,p.floor+.18,p.z,Math.cos(a)*18,.25,Math.sin(a)*18,.45,.26);}
    for(const q of props)if(q.state==='standing'&&Math.hypot(p.x-q.x,p.z-q.z)<6){
      if(dangerous(q))arm(q);else impact(q,Math.atan2(q.x-p.x,q.z-p.z),9);
    }
    Street.blast(p);
  }
  function tick(dt){
    time+=dt;shake=Math.max(0,shake-dt*1.9);
    if(state.vehicle&&Math.abs(car.speed)>5&&(Math.abs(car.slide)>1.8||held.has('Space'))&&time>=skidAt){
      sound('skid',Math.min(1,Math.abs(car.speed)/14));skidAt=time+.17;
    }
    for(const p of props){
      if(p.state==='armed'&&time+1e-8>=p.due)blast(p);
      if(p.state==='flying'){
        p.vy-=11*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
        p.tilt=Math.min(1.52,p.tilt+dt*p.spin);
        if(p.y<=0&&p.vy<0){p.y=0;p.vx*=Math.exp(-6*dt);p.vz*=Math.exp(-6*dt);
          if(p.tilt>=1.52&&Math.hypot(p.vx,p.vz)<.18){p.floor=Town.floorAt(p.x,p.z);p.state='fallen';}}
      }
      if(p.flow&&Math.hypot(p.homeX-camera.x,p.homeZ-camera.z)<74){
        p.water+=dt*150;
        while(p.water>=1){p.water--;const a=Math.random()*6.283,r=Math.random();
          emit('water',p.homeX+.07*Math.sin(a),p.base+.13,p.homeZ+.07*Math.cos(a),Math.cos(a)*r*1.45,7+Math.random()*2.4,Math.sin(a)*r*1.45,1.65,.115+Math.random()*.19);}
      }
    }
    for(let i=particles.length-1;i>=0;i--){
      const q=particles[i];q.life-=dt;if(q.life<=0){particles[i]=particles[particles.length-1];particles.pop();continue;}
      if(q.type==='water'||q.type==='spark')q.vy-=10.5*dt;
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
    }
  }
  function draw(){
    for(const p of props){
      if(p.state==='spent'||Math.hypot(camera.x-p.x,camera.z-p.z)>115)continue;
      const rail=p.kind==='fence';
      Gfx.draw(models[p.kind],p.x,p.floor+p.y,p.z,p.tilt&&!rail?p.fallYaw:p.yaw,rail?0:p.tilt,rail?p.tilt:0);
      if(p.state==='armed'&&Math.sin(time*48)>0)Gfx.draw(flash,p.x,p.floor+1.19,p.z);
    }
  }
  const flash=new Gfx.Mesh();flash.material=6;round(flash,0,.18,.12,.11,'#fff2b1');flash.seal();
  function shaken(c){
    if(!shake)return c;
    return {...c,x:c.x+Math.sin(time*77)*.075*shake,y:c.y+Math.sin(time*98)*.06*shake,pitch:c.pitch+Math.cos(time*67)*.012*shake};
  }
  let cloud;
  function renderParticles(scene,height){
    if(!cloud){
      const geometry=new THREE.BufferGeometry();
      for(const [key,n] of [['position',3],['tint',3],['size',1],['opacity',1]])
        geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(limit*n),n).setUsage(THREE.DynamicDrawUsage));
      const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:1}},
        vertexShader:'attribute vec3 tint; attribute float size,opacity; uniform float scale; varying vec4 shade; void main(){vec4 pt=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*pt;gl_PointSize=clamp(size*scale/max(.1,-pt.z),1.,90.);shade=vec4(tint,opacity);}',
        fragmentShader:'varying vec4 shade; void main(){float r=length(gl_PointCoord-.5)*2.;if(r>=1.)discard;gl_FragColor=vec4(shade.rgb,shade.a*(1.-smoothstep(.35,1.,r)));}'});
      cloud=new THREE.Points(geometry,material);cloud.frustumCulled=false;cloud.renderOrder=8;scene.add(cloud);
    }
    cloud.visible=particles.length>0;if(!cloud.visible)return false;
    const a=cloud.geometry.attributes;cloud.material.uniforms.scale.value=height*.84;
    particles.forEach((q,i)=>{
      a.position.setXYZ(i,q.x,q.y,-q.z);const fade=q.life/q.max;
      if(q.type==='flame')a.tint.setXYZ(i,1,.20+.69*fade*fade,.035+.32*fade**3);
      else a.tint.setXYZ(i,...colors[q.type]);
      a.size.setX(i,q.size*(q.type==='smoke'?2.4-fade:q.type==='flame'?1.25-.55*fade:1));
      a.opacity.setX(i,Math.min(1,q.life/q.max*2)*(q.type==='water'?.47:q.type==='smoke'?.22:q.type==='wave'?.56:.93));
    });
    for(const attribute of Object.values(a))attribute.needsUpdate=true;
    cloud.geometry.setDrawRange(0,particles.length);return true;
  }
  reset();
  return {reset,tick,draw,vehicleHit,rayTarget,arm,renderParticles,shaken,sound,props};
})();
