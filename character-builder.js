'use strict';

// Bind space is in metres, +Z faces forward. Geometry is shared by all actors of one style.
class CharacterBuilder {
  static height=1.80;
  static head=CharacterBuilder.height/7.5;
  static chin=CharacterBuilder.height-CharacterBuilder.head;
  static rigs=[
    ['pelvis',null,0,.91,-.012],['chest','pelvis',0,1.06,0],['head','chest',0,1.50,.012]
  ];
  static {
    for(const s of [-1,1]){
      const k=s<0?'L':'R';
      this.rigs.push(['hip'+k,'pelvis',s*.099,.91,-.012],['knee'+k,'hip'+k,s*.102,.505,.016],
        ['ankle'+k,'knee'+k,s*.106,.105,-.011],['shoulder'+k,'chest',s*.192,1.427,-.008],
        ['elbow'+k,'shoulder'+k,s*.238,1.125,-.018],['wrist'+k,'elbow'+k,s*.252,.902,.024]);
    }
  }
  static clothTexture(base,leaf,flower,seed){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,512,512);
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function sprig(){
      c.strokeStyle=leaf;c.lineWidth=1.5;c.beginPath();c.moveTo(-5,29);c.quadraticCurveTo(3,0,0,-35);c.stroke();
      for(let i=0;i<7;i++)for(const s of [-1,1]){
        const y=20-i*7,l=15*Math.sin((i+1)*.39)+5;c.fillStyle=leaf;c.beginPath();c.moveTo(1,y);
        c.quadraticCurveTo(s*l*.68,y-15,s*l,y-12-i*.7);c.quadraticCurveTo(s*l*.67,y-1,1,y);c.fill();
      }
    }
    function bloom(){
      for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*.4);c.fillStyle=flower;c.beginPath();c.moveTo(0,1);
        c.bezierCurveTo(-11,-4,-14,-19,-4,-22);c.bezierCurveTo(5,-25,17,-15,0,1);c.fill();
        c.strokeStyle='#eab997';c.lineWidth=1;c.beginPath();c.moveTo(0,-1);c.lineTo(-3,-12);c.stroke();c.restore();}
      c.fillStyle='#f7c467';c.beginPath();c.arc(0,0,3.4,0,Math.PI*2);c.fill();
    }
    for(let row=0;row<7;row++)for(let col=0;col<7;col++){
      const x=(col+(row%2)*.48+rand()*.40)*512/7,y=(row+rand()*.65)*512/7;
      const angle=rand()*Math.PI*2,size=.60+rand()*.65,isFlower=(row*3+col)%4===0;
      for(const ox of [-512,0,512])for(const oy of [-512,0,512]){
        c.save();c.translate(x+ox,y+oy);c.rotate(angle);c.scale(size,size);if(isFlower)bloom();else sprig();c.restore();
      }
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2.15,1.15);texture.anisotropy=4;return texture;
  }
  static patterns=new Map();
  constructor(style=0,distant=false){
    this.style=style;this.distant=distant;
    const palette=[
      ['#bf9275','#1f5554','#75a090','#eabb91','#354b62','#342624'],
      ['#ad7962','#a45847','#c98d69','#eacaa0','#384953','#352a28'],
      ['#895e47','#e0cb9b','#829076','#b26d55','#484c56','#262124'],
      ['#c39676','#536e7e','#87a5ab','#f1cdaa','#665748','#524039'],
      ['#ac795f','#884d60','#ae7986','#dec5ab','#374b50','#322529']
    ][style];
    const [skin,base,leaf,flower,denim,hair]=palette;
    if(!CharacterBuilder.patterns.has(style))CharacterBuilder.patterns.set(style,CharacterBuilder.clothTexture(base,leaf,flower,291+style));
    const mat=(color,roughness,metalness=0,opts={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...opts});
    this.materials={
      skin:mat(skin,.65),face:mat('#fff3e5',.65,0,{vertexColors:true}),
      hair:mat(hair,.53),locks:mat(new THREE.Color(hair).multiplyScalar(1.45),.50),
      tank:mat('#f5f1de',.88),shirt:mat('#ffffff',.83,0,{map:CharacterBuilder.patterns.get(style),side:THREE.DoubleSide}),
      trim:mat(base,.83),denim:mat(denim,.86),seam:mat(new THREE.Color(denim).multiplyScalar(1.55),.86),
      leather:mat('#493630',.51),shoe:mat('#dfd3b5',.68),gold:mat('#e3b66e',.26,.82),
      lens:mat('#495f66',.105,.86,{envMapIntensity:2.1}),mouth:mat('#986b60',.7)
    };
    for(const m of [this.materials.skin,this.materials.face]){
      m.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          float wrapLight=pow(clamp((dot(normal,directionalLights[0].direction)+.55)/1.55,0.,1.),1.7);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.21,.082,.042)*wrapLight*directionalLights[0].color;
        #endif`);
      };
    }
    this.boneIndex=Object.fromEntries(CharacterBuilder.rigs.map(([name],i)=>[name,i]));
    this.parts=new Map();this.body();this.face();this.hair();this.glasses();this.accessories();
    this.geometry=this.batch();this.parts.clear();
  }
  // Parametric surfaces supply continuous normals across the wrap seam.
  surface(fn,nu=32,nv=12){
    if(this.distant){nu=Math.max(3,Math.round(nu*.36));nv=Math.max(2,Math.round(nv*.45));}
    const p=[],n=[],uv=[],ix=[],eps=.0001;
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu,v=j/nv,a=fn(u,v);
      const du=fn(Math.min(1,u+eps),v).sub(fn(Math.max(0,u-eps),v));
      const dv=fn(u,Math.min(1,v+eps)).sub(fn(u,Math.max(0,v-eps)));
      p.push(...a.toArray());n.push(...du.cross(dv).normalize().toArray());uv.push(u,v);
      if(j<nv&&i<nu){const k=j*(nu+1)+i;ix.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1);}
    }
    const g=new THREE.BufferGeometry();g.setIndex(ix);
    for(const [name,data,width] of [['position',p,3],['normal',n,3],['uv',uv,2]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,width));
    return g;
  }
  add(mat,g,bone){
    if(!this.parts.has(mat))this.parts.set(mat,[]);
    this.parts.get(mat).push({g,bone});
  }
  ball(mat,bone,x,y,z,rx,ry,rz,angle=0){
    const g=new THREE.SphereGeometry(1,this.distant?8:20,this.distant?5:14);g.scale(rx,ry,rz);g.rotateZ(angle);g.translate(x,y,z);this.add(mat,g,bone);
  }
  tube(mat,bone,points,radius,closed=false){
    if(this.distant&&radius<.004)return;
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed);
    this.add(mat,new THREE.TubeGeometry(curve,Math.max(10,points.length*3),radius,7,closed),bone);
  }
  // Profile rows are [height, half-width, half-depth, x centre, z centre].
  profile(rows){
    const curves=[1,2,3,4].map(k=>new THREE.SplineCurve(rows.map(r=>new THREE.Vector2(r[0],r[k]||0))));
    return (a,t)=>{
      const [w,d,x,z]=curves.map(c=>c.getPoint(t));
      return new THREE.Vector3(x.y+Math.max(.0002,w.y)*Math.sin(a),w.x,z.y+Math.max(.0002,d.y)*Math.cos(a));
    };
  }
  lathe(mat,bone,rows,detail=32){
    const at=this.profile(rows);
    this.add(mat,this.surface((u,v)=>at(u*2*Math.PI,v),detail,Math.max(12,rows.length*3)),bone);
  }
  pair(low,high,y,half){
    return p=>{const t=THREE.MathUtils.smoothstep(p.y,y-half,y+half);return [low,high,1-t,t];};
  }
  body(){
    const spine=this.pair('pelvis','chest',1.075,.13);
    // A rearward pelvis, forward ribcage, and curved lumbar profile give the side silhouette its S curve.
    this.lathe('skin',spine,[[.89,.142,.10,0,-.023],[1.045,.143,.092,0,-.021],[1.20,.165,.112,0,-.004],
      [1.335,.184,.117,0,.006],[1.414,.192,.093,0,-.005],[1.464,.119,.071,0,-.012],[1.484,.063,.063]]);
    this.lathe('skin','head',[[1.438,.108,.077,0,-.012],[1.469,.084,.073,0,-.009],[1.495,.065,.064,0,-.004],[1.534,.056,.058,0,.005],[1.564,.056,.061,0,.012],[1.591,.054,.055,0,.015]]);
    const tank=this.profile([[.959,.153,.111,0,-.014],[1.06,.15,.102,0,-.012],[1.20,.175,.12,0,-.004],
      [1.33,.192,.127,0,.005],[1.414,.195,.101,0,-.001],[1.47,.112,.080,0,-.005]]);
    const tankAt=(a,t)=>{const p=tank(a,t);p.z+=.012*Math.max(0,-Math.cos(a))*t**3;p.y-=t**4*(.092*Math.max(0,Math.cos(a))**3+.055*Math.abs(Math.sin(a))**4);return p;};
    this.add('tank',this.surface((u,v)=>tankAt(u*2*Math.PI,v)),spine);
    this.tube('tank',spine,Array.from({length:29},(_,i)=>tankAt(i*Math.PI/14,1).toArray()).slice(0,-1),.003,true);
    const outer=this.profile([[.912,.173,.128,0,-.014],[.943,.184,.133,0,-.012],[1.035,.166,.117,0,-.013],
      [1.16,.172,.128,0,-.004],[1.306,.204,.146,0,.002],[1.402,.209,.112,0,-.004],[1.449,.17,.087,0,-.006],[1.481,.079,.073]]);
    const edge=t=>.46+.15*Math.cos(t*5.2)+.33*t**3;
    const shell=(u,t,lining=false)=>{
      const a=edge(t)+(2*Math.PI-2*edge(t))*u,p=outer(a,t);
      const fold=.0046*Math.sin(a*13+.6*Math.cos(t*4))*(1-.68*t);
      const r=fold-(lining?.0035:0);
      p.x+=r*Math.sin(a);p.z+=r*Math.cos(a);p.y+=.012*Math.cos(a*3+.42)*(1-t)**4;
      return p;
    };
    this.add('shirt',this.surface(shell,52,28),spine);
    this.add('trim',this.surface((u,t)=>shell(1-u,t,true),48,23),spine);
    for(const u of [0,1])this.tube('trim',spine,Array.from({length:13},(_,i)=>shell(u,i/12).toArray()),.0036);
    this.add('trim',this.surface((u,v)=>shell(u,0,true).lerp(shell(u,0),v),48,2),spine);
    for(const s of [-1,1]){
      // Folded collar panel from nape to a point on the chest.
      const corners=[[.013,1.481,.079],[.067,1.487,.045],[.13,1.424,.105],[.086,1.366,.146]];
      const p=corners.map(([x,y,z])=>new THREE.Vector3(s*x,y,z));
      const lapel=this.surface((u,v)=>p[0].clone().lerp(p[1],u).lerp(p[3].clone().lerp(p[2],u),v).add(new THREE.Vector3(0,0,.008*Math.sin(v*Math.PI))),12,12);
      const uv=lapel.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,.23+.11*uv.getX(i),.51+.22*uv.getY(i));
      this.add('shirt',lapel,spine);
      this.limbs(s);
    }
    // This waist ring meets the two trouser panels along their outer semicircles.
    this.lathe('denim','pelvis',[[.885,.177,.118,0,-.018],[.912,.173,.116,0,-.017],[.94,.162,.111,0,-.015],[.972,.154,.107,0,-.014]]);
  }
  limbs(s){
    const k=s<0?'L':'R',leg=p=>p.y<.28?this.pair('ankle'+k,'knee'+k,.123,.047)(p):this.pair('knee'+k,'hip'+k,.505,.10)(p);
    const arm=p=>p.y<.99?this.pair('wrist'+k,'elbow'+k,.909,.043)(p):this.pair('elbow'+k,'shoulder'+k,1.125,.074)(p);
    const legX=s*.10,rows=[
      [.082,.055,.062,.009,-.016],[.102,.064,.071,.008,-.019],[.120,.059,.065,.008,-.014],[.140,.067,.075,.008,-.015],
      [.165,.06,.065,.007,-.012],[.249,.062,.069,.009,-.013],[.351,.077,.087,.012,-.026],[.432,.069,.077,.009,-.004],
      [.491,.066,.075,.003,.018],[.523,.070,.079,.003,.014],[.551,.067,.076,.003,.005],[.662,.091,.102,.002,-.007],
      [.776,.095,.109,0,-.017]];
    this.lathe('denim',leg,rows.map(([y,w,d,dx,z])=>[y,w,d,legX+s*dx,z]));
    // Each panel opens into half of the hip ring. The two inner edges meet at the inseam.
    const joinWeight=p=>this.pair('hip'+k,'pelvis',.817,.035)(p);
    this.add('denim',this.surface((u,t)=>{
      const a=u*2*Math.PI,n=Math.sin(a),c=Math.cos(a),inner=Math.max(0,-s*n);
      const lower=new THREE.Vector3(legX+.095*n,.776,-.017+.109*c);
      const upper=new THREE.Vector3(s*.177*Math.max(0,s*n),.885-.083*inner,-.018+.118*c);
      return lower.lerp(upper,t);
    },32,12),joinWeight);
    this.tube('seam',leg,rows.slice(1,-1).map(([y,w,d,dx,z])=>[legX+s*(dx+w),y,z+.001]),.0015);
    this.lathe('shoe','ankle'+k,[[0,.060,.122,legX+s*.007,.044],[.009,.073,.148,legX+s*.007,.047],
      [.027,.074,.149,legX+s*.007,.046],[.045,.071,.142,legX+s*.007,.045],[.061,.064,.125,legX+s*.007,.035],
      [.087,.059,.090,legX+s*.007,.011],[.117,.054,.065,legX+s*.007,-.008]]);
    for(let j=0;j<3;j++)this.tube('tank','ankle'+k,[[legX-.030,.077+j*.006,.106-j*.017],[legX,.088+j*.007,.101-j*.017],[legX+.028,.079+j*.006,.096-j*.017]],.0025);
    this.lathe('skin',arm,[[.817,.019,.033,s*.252,.034],[.842,.030,.044,s*.252,.032],[.866,.031,.045,s*.252,.027],[.889,.028,.034,s*.252,.024],[.905,.032,.031,s*.252,.021],[.970,.043,.044,s*.251,.009],
      [1.047,.057,.060,s*.25,-.001],[1.11,.050,.055,s*.239,-.017],[1.151,.055,.061,s*.237,-.014],
      [1.243,.069,.074,s*.223,-.01],[1.334,.077,.080,s*.214,-.009],[1.417,.061,.061,s*.19,-.008],[1.438,.019,.026,s*.17,-.006]]);
    const sleeve=[[1.191,.073,.078,s*.239,-.014],[1.22,.079,.084,s*.235,-.012],[1.30,.081,.091,s*.222,-.012],
      [1.375,.081,.088,s*.208,-.01],[1.421,.064,.069,s*.186,-.008],[1.45,.026,.03,s*.169,-.005]];
    this.lathe('shirt','shoulder'+k,sleeve);
    this.lathe('trim','shoulder'+k,[[1.178,.068,.073,s*.24,-.014],[1.185,.080,.083,s*.24,-.014],
      [1.199,.08,.085,s*.239,-.014],[1.210,.077,.083,s*.238,-.014],[1.216,.079,.083,s*.237,-.014]]);
    const wrist='wrist'+k;
    for(let i=0;i<4;i++)this.ball('skin',wrist,s*(.255-.004*Math.sin(i)),.810+.007*Math.abs(i-1.25),.002+i*.016,.010,.041-.004*Math.abs(i-1),.009,s*.13);
    this.ball('skin',wrist,s*.229,.847,.063,.013,.034,.014,-s*.36);
  }
  face(){
    if(this.style===0){
      const v=Portrait.vertices,p=[],n=[],c=[];
      // The source scan's chin landmark is at 1.510 and its skull apex at 1.785.
      for(let i=0;i<v.length;i+=9){
        const y=CharacterBuilder.chin+(v[i+1]*.001-1.510)*.84;
        // Taper the cropped scan inside the procedural neck below the jaw.
        const back=1-THREE.MathUtils.smoothstep(v[i+2],-45,55);
        const gain=.40+.60*THREE.MathUtils.smoothstep(y,1.515+back*.037,1.56+back*.064);
        p.push(v[i]*.00086*gain,y,(v[i+2]*.00083-.006)*gain);
        n.push(v[i+3]/100,v[i+4]/100,v[i+5]/100);
        const color=new THREE.Color().setRGB(v[i+6]/255,v[i+7]/255,v[i+8]/255,THREE.SRGBColorSpace);c.push(...color.toArray());
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(Portrait.indices);this.add('face',g,'head');
    }else{
      this.lathe('skin','head',[[1.56,.026,.042,0,.040],[1.572,.049,.062,0,.034],[1.60,.065,.081,0,.015],[1.635,.077,.087,0,.009],
        [1.673,.082,.092,0,.011],[1.715,.083,.090,0,.007],[1.75,.076,.083],[1.778,.061,.063],[1.792,.025,.035]]);
      this.lathe('skin','head',[[1.633,.011,.010,0,.103],[1.644,.017,.020,0,.106],[1.654,.013,.021,0,.106],[1.675,.010,.013,0,.099],[1.69,.009,.009,0,.091]],22);
      for(const s of [-1,1])this.ball('skin','head',s*.08,1.656,-.002,.013,.029,.018);
      this.tube('mouth','head',[[-.023,1.619,.095],[0,1.618,.100],[.023,1.619,.095]],.0022);
    }
  }
  hair(){
    const pony=this.style===3||this.style===4;
    // Follow forehead, temples and occiput. A side part changes the crown silhouette.
    const skull=this.profile([[1.602,.066,.081,0,-.008],[1.64,.082,.101,0,-.003],
      [1.69,.087,.107,0,-.002],[1.72,.086,.106,0,.002],[1.747,.081,.100,0,.002],
      [1.77,.067,.086,-.002,.001],[1.785,.052,.065,-.005,.001],
      [1.795,.029,.043,-.007,0],[1.80,.0002,.0002,-.008,0]]);
    const cap=(a,t)=>{
      const front=Math.cos(a),line=1.62+.094*Math.max(0,front)**1.25+.011*Math.cos(2*a)+.005*Math.sin(3*a);
      const y=line+(1.80-line)*Math.sin(t*Math.PI*.5);
      // Map physical height into the unequal spline intervals.
      const h=[1.602,1.64,1.69,1.72,1.747,1.77,1.785,1.795,1.80];
      const i=Math.min(h.length-2,Math.max(0,h.findIndex(value=>value>=y-1e-7)-1));
      const v=(i+THREE.MathUtils.clamp((y-h[i])/(h[i+1]-h[i]),0,1))/(h.length-1),p=skull(a,v);
      const groove=Math.exp(-20*(Math.sin((a-.54+t*.64)/2))**2);
      const ridges=(.0005*Math.cos(a*34+t*7)+.0039*Math.sin(a-.7)-.0032*groove)*Math.sin(Math.PI*t);
      p.x+=ridges*Math.sin(a);p.z+=ridges*Math.cos(a);p.y=y;return p;
    };
    if(!CharacterBuilder.hairTexture){
      const c=document.createElement('canvas');c.width=512;c.height=256;
      const ctx=c.getContext('2d');ctx.fillStyle='#e9e4e2';ctx.fillRect(0,0,512,256);
      for(let i=-80;i<610;i++){
        const x=i*1.19,wave=Math.sin(i*27.73),tilt=25+wave*11;
        ctx.strokeStyle=wave>0?'rgba(72,55,51,.27)':'rgba(255,252,235,.62)';ctx.lineWidth=.65;
        ctx.beginPath();ctx.moveTo(x,256);ctx.bezierCurveTo(x+7,176,x+tilt*2,125,x+tilt,0);ctx.stroke();
      }
      CharacterBuilder.hairTexture=new THREE.CanvasTexture(c);CharacterBuilder.hairTexture.colorSpace=THREE.SRGBColorSpace;
    }
    this.materials.hair.map=CharacterBuilder.hairTexture;
    this.add('hair',this.surface((u,v)=>cap(u*2*Math.PI,v),44,18),'head');
    for(let i=0;i<22;i++){
      const a=(i+.32)*2*Math.PI/22;
      const points=Array.from({length:11},(_,j)=>{
        const t=j/10,p=cap(a+(pony?.18:.63)*t,.018+t*.75);
        const radius=.0021*Math.sin(Math.PI*t);p.x+=Math.sin(a)*radius;p.z+=Math.cos(a)*radius;return p.toArray();});
      this.tube(i%4===0?'locks':'hair','head',points,i%4===0?.0008:.0011);
    }
    if(pony){
      this.ball('leather','head',0,1.686,-.105,.030,.027,.027);
      this.ball('hair','head',0,1.595,-.132,.041,.099,.038,-.08);
      this.tube('locks','head',[[.014,1.668,-.134],[.016,1.611,-.167],[.022,1.53,-.144]],.003);
    }else{
      // A visible part and swept forelock give the crown an asymmetric profile from both sides.
      for(let i=0;i<5&&!this.distant;i++){
        const points=Array.from({length:14},(_,j)=>{const t=j/13;
          const p=cap(.49-1.55*t,.023+.145*Math.sin(t*Math.PI)+i*.018);
          p.z+=.0006-.004*Math.abs(2*t-1)**4;return p.toArray();
        });
        this.tube(i===2?'locks':'hair','head',points,.0012);
      }
    }
  }
  glasses(){
    const lens=new THREE.Shape();lens.moveTo(-.036,.015);
    lens.bezierCurveTo(-.024,.027,.018,.025,.035,.016);lens.bezierCurveTo(.043,.008,.029,-.022,.010,-.031);
    lens.bezierCurveTo(-.007,-.038,-.027,-.020,-.036,.001);lens.bezierCurveTo(-.039,.006,-.039,.010,-.036,.015);
    for(const s of [-1,1]){
      const shape=new THREE.ExtrudeGeometry(lens,{depth:.0018,bevelEnabled:true,bevelThickness:.0013,bevelSize:.0012,bevelSegments:2,curveSegments:12});
      // Mirror the left lens without flipping winding. Both surfaces are visible through the glasses frame.
      const transform=(x,y,z)=>[s*(.042+x*.92),1.675+y*.88,.114+z-x*.20-.005*((x/.038)**2+(y/.034)**2)];
      const pos=shape.attributes.position;
      for(let i=0;i<pos.count;i++)pos.setXYZ(i,...transform(pos.getX(i),pos.getY(i),pos.getZ(i)));
      if(s<0){for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i+1),b=new THREE.Vector3().fromBufferAttribute(pos,i+2);pos.setXYZ(i+1,...b.toArray());pos.setXYZ(i+2,...a.toArray());}}
      shape.computeVertexNormals();
      // Smooth the shallow optical dome over the triangulated lens cap.
      const norms=shape.attributes.normal;
      for(let i=0;i<pos.count;i++)if(norms.getZ(i)>.78){
        const x=s*pos.getX(i)-.042,y=pos.getY(i)-1.675;
        const n=new THREE.Vector3(s*(.21+x*9),y*12,1).normalize();norms.setXYZ(i,n.x,n.y,n.z);
      }
      this.add('lens',shape,'head');
      const rim=lens.getPoints(9).slice(0,-1).map(p=>transform(p.x,p.y,.0025));this.tube('gold','head',rim,.0022,true);
      this.tube('gold','head',[[s*.081,1.685,.107],[s*.086,1.682,.069],[s*.094,1.675,.008],[s*.090,1.658,-.025]],.0023);
    }
    this.tube('gold','head',[[-.014,1.682,.122],[0,1.690,.124],[.014,1.682,.122]],.0022);
    this.tube('gold','head',[[-.031,1.697,.122],[0,1.699,.122],[.031,1.697,.122]],.0018);
  }
  accessories(){
    this.lathe('leather','pelvis',[[.94,.154,.111,0,-.01],[.945,.161,.117,0,-.01],[.968,.160,.115,0,-.01],[.973,.153,.110,0,-.01]]);
    this.tube('gold','pelvis',[[-.019,.945,.108],[.017,.945,.108],[.023,.949,.108],[.021,.966,.108],[.015,.97,.108],[-.021,.967,.108],[-.023,.960,.108]],.0029,true);
    this.tube('gold','pelvis',[[-.007,.958,.112],[.018,.958,.112]],.0018);
    const chain=[[-.056,1.481,.041],[-.052,1.454,.080],[-.031,1.424,.103],[0,1.398,.122],[.032,1.423,.104],[.054,1.458,.079],[.057,1.479,.040]];
    this.tube('gold','chest',chain,.0029);
    this.ball('gold','chest',0,1.391,.126,.009,.012,.0028);
  }
  batch(){
    const g=new THREE.BufferGeometry(),positions=[],normals=[],colors=[],uvs=[],bones=[],weights=[],indices=[];
    this.drawMaterials=[];
    for(const [name,parts] of this.parts){
      const start=indices.length,startVertex=positions.length/3;
      for(const {g:src,bone} of parts){
        const a=src.attributes,offset=positions.length/3;
        for(let i=0;i<a.position.count;i++){
          const p=new THREE.Vector3().fromBufferAttribute(a.position,i);
          positions.push(p.x,p.y,p.z);normals.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));
          colors.push(a.color?.getX(i)??1,a.color?.getY(i)??1,a.color?.getZ(i)??1);uvs.push(a.uv?.getX(i)??0,a.uv?.getY(i)??0);
          const [b1,b2,w1,w2]=typeof bone==='function'?bone(p):[bone,bone,1,0];
          bones.push(this.boneIndex[b1],this.boneIndex[b2],0,0);weights.push(w1,w2,0,0);
        }
        for(let i=0;i<(src.index?.count??a.position.count);i++)indices.push(offset+(src.index?src.index.getX(i):i));
        src.dispose();
      }
      if(name==='denim'){
        // Average normals across the trouser panels' shared edges, preserving UVs and rig weights.
        const seams=new Map();
        for(let i=startVertex;i<positions.length/3;i++){
          const key=positions.slice(i*3,i*3+3).map(x=>Math.round(x*100000)).join(',');
          if(!seams.has(key))seams.set(key,[]);seams.get(key).push(i);
        }
        const n=new THREE.Vector3(),sample=new THREE.Vector3();
        for(const vertices of seams.values())if(vertices.length>1){
          n.set(0,0,0);for(const i of vertices)n.add(sample.fromArray(normals,i*3));
          n.normalize();for(const i of vertices)n.toArray(normals,i*3);
        }
      }
      g.addGroup(start,indices.length-start,this.drawMaterials.length);this.drawMaterials.push(this.materials[name]);
    }
    g.setIndex(indices);
    for(const [key,data,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uvs,2],['skinWeight',weights,4]])g.setAttribute(key,new THREE.Float32BufferAttribute(data,size));
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(bones,4));g.computeBoundingSphere();return g;
  }
  create(){
    const nodes={},bones=[],root=new THREE.Group(),mesh=new THREE.SkinnedMesh(this.geometry,this.drawMaterials);
    const rest={};
    for(const [name,parent,x,y,z] of CharacterBuilder.rigs){
      const b=new THREE.Bone();b.name=name;rest[name]=new THREE.Vector3(x,y,z);b.position.copy(rest[name]);
      if(parent){b.position.sub(rest[parent]);nodes[parent].add(b);}else mesh.add(b);
      nodes[name]=b;bones.push(b);
    }
    mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);
    const outlineMat=new THREE.MeshBasicMaterial({color:'#292329',side:THREE.BackSide});
    outlineMat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed += normal * 0.0019;');};
    const outline=new THREE.SkinnedMesh(this.geometry,outlineMat);
    outline.bind(mesh.skeleton,mesh.bindMatrix);outline.frustumCulled=false;outline.renderOrder=1;root.add(outline);
    return {root,mesh,nodes,outline};
  }
  static pose(actor,phase,speed,carry,reach,time){
    const b=actor.nodes,breath=Math.sin(time*1.54),idle=1-Math.min(1,speed),sway=idle*Math.sin(time*.79);
    b.pelvis.position.x=.008*sway;b.pelvis.position.y=.91+.016*speed*(1-Math.cos(2*phase));
    b.pelvis.rotation.set(-.022,.035*Math.sin(phase)*speed,.018*sway);
    b.chest.scale.set(1+.011*breath,1+.004*breath,1+.027*breath);
    b.chest.rotation.set(-.014*breath,-.09*Math.sin(phase)*speed,-.022*sway);
    b.head.rotation.set(.010*Math.sin(time*1.1),.038*Math.sin(time*.64)*idle,.006*sway);
    for(const s of [-1,1]){
      const k=s<0?'L':'R',swing=s*Math.sin(phase)*speed,flex=Math.max(0,-s*Math.cos(phase))*speed,seated=reach<-.5;
      b['hip'+k].rotation.set(seated?-1.42:.54*swing+.018*s,0,0);
      b['knee'+k].rotation.set(seated?1.42:.76*flex,0,0);
      b['ankle'+k].rotation.set(seated?.12:-.26*flex,0,0);
      b['shoulder'+k].rotation.set(-.53*swing*(1-carry)-.34*carry-.92*Math.max(0,reach)+.037*s+.025*breath,0,s*(.054+.014*Math.cos(time+s)*idle));
      b['elbow'+k].rotation.set(-.14-.94*carry-.32*flex-.26*Math.max(0,reach),0,0);
      b['wrist'+k].rotation.set(.12+.065*Math.sin(time*1.25+s)*idle+.08*swing,.045*s,.045*s);
    }
  }
}
