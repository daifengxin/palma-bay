'use strict';

// Render the rigs into the city's existing colour and depth buffers, before weather and bloom.
const CharacterPass=(()=>{
  // r160 stores four RGBA texels per bone. The city shares a WebGL 1 context,
  // so sample at texel centres instead of the GLSL 3 texelFetch instruction.
  const boneSide=Math.max(4,4*Math.ceil(Math.sqrt(4*CharacterBuilder.rigs.length)/4));
  THREE.ShaderChunk.skinning_pars_vertex=`
    #ifdef USE_SKINNING
    uniform mat4 bindMatrix,bindMatrixInverse;
    uniform highp sampler2D boneTexture;
    mat4 getBoneMatrix(const in float i){
      const float width=${boneSide.toFixed(1)};
      vec2 uv=(vec2(mod(i*4.,width),floor(i*4./width))+.5)/width;
      vec2 offset=vec2(1./width,0.);
      return mat4(texture2D(boneTexture,uv),texture2D(boneTexture,uv+offset),
                  texture2D(boneTexture,uv+2.*offset),texture2D(boneTexture,uv+3.*offset));
    }
    #endif`;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(2*Math.atan(1/1.55)*180/Math.PI,1,.55/2.00064,.55/.00064);
  const footfalls=new Footfalls(scene);let effectsVisible=false;
  const sky=new THREE.HemisphereLight('#f9e7d2','#b08676',1.75);
  const nightKey=new THREE.Color('#97a9cc'),dayKey=new THREE.Color('#ffe1be'),duskKey=new THREE.Color('#ffa787');
  const key=new THREE.DirectionalLight('#ffe1be',2.15),fill=new THREE.DirectionalLight('#ead8dc',.65);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-4.1,right:4.1,top:4.1,bottom:-4.1,near:.1,far:21});
  key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.00025;key.shadow.normalBias=.003;
  scene.add(sky,key,key.target,fill,fill.target);
  const receiver=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.ShadowMaterial({opacity:.26,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  receiver.receiveShadow=true;receiver.rotation.x=-Math.PI/2;scene.add(receiver);
  const environment=document.createElement('canvas');environment.width=256;environment.height=128;
  const env=environment.getContext('2d'),grad=env.createLinearGradient(0,0,0,128);
  for(const [t,c] of [[0,'#71aace'],[.39,'#f8dbc1'],[.48,'#f9ac87'],[.51,'#647c79'],[1,'#665650']])grad.addColorStop(t,c);
  env.fillStyle=grad;env.fillRect(0,0,256,128);
  for(let i=0;i<38;i++){const h=4+Math.abs(Math.sin(i*16.4))*21;env.fillStyle=i%3?'#4d585c':'#86979a';env.fillRect(i*7,66-h,5+i%4,h);}
  env.fillStyle='#fff7be';env.fillRect(52,40,12,9);
  const envTexture=new THREE.CanvasTexture(environment);envTexture.colorSpace=THREE.SRGBColorSpace;envTexture.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=envTexture;
  const blob=document.createElement('canvas');blob.width=blob.height=64;const bc=blob.getContext('2d');
  const soft=bc.createRadialGradient(32,32,0,32,32,31);soft.addColorStop(0,'rgba(33,26,31,.49)');soft.addColorStop(.44,'rgba(33,26,31,.30)');soft.addColorStop(1,'rgba(33,26,31,0)');
  bc.fillStyle=soft;bc.fillRect(0,0,64,64);
  const contactMap=new THREE.CanvasTexture(blob),contactGeo=new THREE.PlaneGeometry(.42,.49);
  const sole=new THREE.Vector3(),pools=Array.from({length:10},()=>[]),count=new Uint16Array(10),builders=[];
  let renderer=null,hero=null;
  const propMaterials=new Map();
  function prop(node,geometry,color,x,y,z){
    if(!propMaterials.has(color))propMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:.75}));
    const m=new THREE.Mesh(geometry,propMaterials.get(color));m.position.set(x,y,z);m.castShadow=true;node.add(m);return m;
  }
  function dress(actor,gear){
    if(!actor.pack){
      actor.pack=new THREE.Group();actor.nodes.chest.add(actor.pack);
      const sack=prop(actor.pack,new THREE.SphereGeometry(1,18,14),'#586959',0,.14,-.135);sack.scale.set(.163,.212,.085);
      for(const side of [-1,1]){
        const points=[[.091,.005,-.145],[.115,.32,-.11],[.12,.386,-.015],[.12,.33,.085],[.119,.13,.118],[.142,.014,.028]];
        const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(side*x,y,z)));
        prop(actor.pack,new THREE.TubeGeometry(curve,22,.011,7,false),'#a48e6e',0,0,0);
      }
      actor.items=[0,1,2].map(i=>{
        const grip=new THREE.Group();actor.nodes.wristR.add(grip);
        prop(grip,new THREE.BoxGeometry(.034,.09,.044),'#383f48',0,-.066,.037);
        prop(grip,new THREE.CapsuleGeometry(.026+i*.014,.13+i*.09,4,10),'#596875',0,-.084,.099+i*.032).rotation.x=Math.PI/2;
        return grip;
      });
    }
    actor.pack.visible=!!gear?.bag;actor.items.forEach((m,i)=>m.visible=gear?.weapon===i);
  }
  function actorAt(style,i){
    if(!builders[style])builders[style]=new CharacterBuilder(style%5,style>=5);
    if(pools[style][i])return pools[style][i];
    const actor=builders[style].create();scene.add(actor.root);
    actor.contacts=[-1,1].map(()=>{const m=new THREE.Mesh(contactGeo,new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));m.rotation.x=-Math.PI/2;m.renderOrder=2;scene.add(m);return m;});
    pools[style].push(actor);return actor;
  }
  function submit(style,x,z,yaw,phase,speed,carry,reach,y,lean,gear){
    const dx=x-camera.position.x,dz=-z-camera.position.z,range=Math.hypot(dx,dz);
    const ahead=-dx*Math.sin(camera.rotation.y)-dz*Math.cos(camera.rotation.y);
    const side=dx*Math.cos(camera.rotation.y)-dz*Math.sin(camera.rotation.y);
    if(ahead< -1.5||Math.abs(side)>Math.max(1.5,ahead)*camera.aspect*Math.tan(camera.fov*Math.PI/360)+1.5)return;
    const slot=style&&range>15?style+5:style;
    const actor=actorAt(slot,count[slot]++),ground=Town.floorAt(x,z);
    actor.root.visible=true;actor.root.position.set(x,y+ground,-z);
    actor.root.rotation.order='YXZ';actor.root.rotation.set(-lean,-yaw,0,'YXZ');actor.root.scale.z=-1;
    actor.outline.visible=range<20;actor.mesh.castShadow=range<8;
    const controlled=gear?.hero&&motion.ready&&!state.seat&&!Bay.swimmer();
    if(controlled)motion.pose(actor,player,carry,reach);
    else CharacterBuilder.pose(actor,phase,speed,carry,reach,performance.now()*.001+(style?x*.29+z*.13:0));
    if(gear?.hero||actor.pack)dress(actor,gear);
    if(gear?.hero)hero=actor;
    if(lean>.24&&!gear?.hero){
      const spread=Math.min(1,lean);actor.nodes.shoulderL.rotation.z=-1.05*spread;actor.nodes.shoulderR.rotation.z=1.25*spread;
      actor.nodes.hipL.rotation.x-=.36*spread;actor.nodes.kneeR.rotation.x+=.62*spread;
    }else if(gear?.wave!==undefined){
      actor.nodes.shoulderR.rotation.set(-.28,0,2.32);actor.nodes.elbowR.rotation.set(-.75,0,.25*Math.sin(gear.wave*12));
    }else if(gear?.clerk==='hands'){
      for(const [s,k] of [[-1,'L'],[1,'R']]){
        actor.nodes['shoulder'+k].rotation.set(-.42,0,s*1.66);
        actor.nodes['elbow'+k].rotation.set(-1.07,0,s*.52);
        if(s===1){actor.nodes.shoulderR.rotation.x-=gear.toss*1.03;actor.nodes.shoulderR.rotation.z-=gear.toss*1.12;}
      }
    }else if(gear?.clerk==='down'){
      actor.root.rotation.x=-1.42;actor.root.position.y=ground+.21;
    }
    actor.root.updateMatrixWorld(true);
    const seated=reach<-.5;
    // Maintain a planted shoe through the whole gait. Jump height stays relative to that pose.
    if(!controlled&&!seated&&lean<.5&&gear?.clerk!=='down'){
      let lowest=Infinity;
      for(const ankle of [actor.nodes.ankleL,actor.nodes.ankleR])for(const z of [-.078,.164]){
        sole.set(0,-.101,z);ankle.localToWorld(sole);lowest=Math.min(lowest,sole.y);
      }
      actor.root.position.y+=ground+y-lowest;actor.root.updateMatrixWorld(true);
    }
    const air=Math.max(0,actor.root.position.y-ground);
    for(let i=0;i<2;i++){
      const m=actor.contacts[i];m.visible=range<28&&lean<.5&&air<1.5;
      if(!m.visible)continue;
      sole.set(0,-.103,.038);actor.nodes[i?'ankleR':'ankleL'].localToWorld(sole);
      const footGround=Town.floorAt(sole.x,-sole.z);
      m.position.set(sole.x,footGround+.005,sole.z);m.rotation.z=yaw;
      m.material.opacity=seated?.55:Math.max(0,1-Math.max(0,sole.y-footGround)*1.8);
    }
  }
  function begin(c){
    hero=null;count.fill(0);for(const pool of pools)for(const a of pool){a.root.visible=false;for(const m of a.contacts)m.visible=false;}
    camera.position.set(c.x,c.y,-c.z);camera.rotation.set(-c.pitch,-c.yaw,0,'YXZ');
    camera.fov=(c.fov||Locomotion.baseFov)*180/Math.PI;
    camera.aspect=sceneCanvas.width/sceneCanvas.height;camera.updateProjectionMatrix();
    effectsVisible=footfalls.update(motion.contacts,elapsed,motion.time,camera);
  }
  const sceneCanvas=document.getElementById('scene');
  function flush(){
    if(!count.some(n=>n)&&!effectsVisible)return;
    Gfx.withCharacterContext(gl=>{
      if(!renderer){
        renderer=new THREE.WebGLRenderer({canvas:sceneCanvas,context:gl,antialias:true,alpha:false});
        renderer.autoClear=false;renderer.toneMapping=THREE.LinearToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      }
      renderer.resetState();renderer.setViewport(0,0,sceneCanvas.width,sceneCanvas.height);
      const [alt,dusk]=Climate.sky(),day=Math.max(0,Math.min(1,(alt+.25)/.52));
      renderer.toneMappingExposure=NightMarket.inside?.86:.12+.88*day;
      key.color.copy(nightKey).lerp(dayKey,day).lerp(duskKey,dusk*.57);

      sky.intensity=.82+day*.92;key.intensity=.86+day*1.86;fill.intensity=.65+day*.20;
      const nearHero=hero?hero.root.position:camera.position;
      const gx=nearHero.x,gz=nearHero.z,gy=Town.floorAt(gx,-gz);
      key.target.position.set(gx,gy+.9,gz);key.position.set(gx-4.3,gy+3.8+day*2.8,gz-4.9);
      fill.target.position.set(gx,gy+1,gz);fill.position.set(camera.position.x+2,camera.position.y+2,camera.position.z);
      receiver.position.set(gx,gy+.003,gz);receiver.visible=!!hero&&hero.root.position.y>-.35;
      renderer.render(scene,camera);renderer.resetState();
    });
  }
  return {begin,submit,flush,clearFootfalls:()=>footfalls.clear()};
})();
