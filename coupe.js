'use strict';
// Cross sections run from the rear valance to the nose. Wheel arches are cut into the sill.
function makeCoupe(paint,plate,variant=null) {
  const body=new Gfx.Mesh(),wheelParts=[],door=new Gfx.Mesh();let m=body;
  const charcoal='#1c252d',chrome='#b8bdba';
  const sections=[
    [-2.44,.82,.75],[-2.34,.99,.87],[-2.12,1.065,.93],[-1.8,1.09,.98],
    [-1.54,1.11,1.0],[-1.28,1.09,.98],[-.96,1.04,.92],[-.62,1.015,.89],
    [.28,1.01,.88],[.83,1.04,.9],[1.16,1.09,.96],[1.43,1.105,.99],
    [1.70,1.09,.94],[1.98,1.04,.84],[2.25,.96,.73],[2.39,.85,.59]
  ];
  function ring([z,w,h]){
    const offset=Math.min(Math.abs(z+1.54),Math.abs(z-1.43));
    const arch=offset<.51?.414+Math.sqrt(.51*.51-offset*offset):.29;
    return [[-.83,.25],[-w*.97,arch],[-w,Math.max(arch+.02,h-.14)],[-w*.94,h],
      [-w*.72,h+.045],[-w*.38,h+.033],[0,h+.025],[w*.38,h+.033],[w*.72,h+.045],
      [w*.94,h],[w,Math.max(arch+.02,h-.14)],[w*.97,arch],[.83,.25]].map(([x,y])=>[x,y,z]);
  }
  const rings=sections.map(ring);
  function smoothRings(rings,colors) {
    const unit=v=>{const len=Math.hypot(...v)||1;return v.map(a=>a/len);};
    const normals=rings.map((r,i)=>r.map((p,j)=>{
      const left=r[Math.max(0,j-1)],right=r[Math.min(r.length-1,j+1)],
        back=rings[Math.max(0,i-1)][j],front=rings[Math.min(i+1,rings.length-1)][j];
      const a=front.map((v,k)=>v-back[k]),b=right.map((v,k)=>v-left[k]);
      return unit([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);
    }));
    for(let i=1;i<rings.length;i++)for(let j=1;j<rings[i].length;j++){
      const ids=[[i-1,j-1],[i,j-1],[i,j],[i-1,j]];
      const [color,material]=colors(i,j);m.material=material;
      m.quad(ids.map(([s,t])=>rings[s][t]),color,1,null,ids.map(([s,t])=>normals[s][t]));
    }
  }
  smoothRings(rings,()=>[paint,1]);
  for(const r of [rings[0],rings.at(-1)]){
    m.material=1;for(let j=1;j<r.length;j++){const center=[0,.50,r[0][2]];m.quad([r[j-1],r[j],center,center],paint);}
  }
  const roof=[[-1.62,.87,.94,.94],[-1.36,.87,.96,1.06],[-.79,.82,1.,1.48],
    [-.63,.80,1.,1.55],[-.14,.80,.99,1.58],[.24,.81,.98,1.54],[.86,.88,.94,1.01],[1.02,.89,.94,.95]];
  const glass=roof.map(([z,w,b,h])=>[[-w,b],[-w*.78,h-.042],[-w*.61,h],[0,h+.02],[w*.61,h],[w*.78,h-.042],[w,b]].map(([x,y])=>[x,y,z]));
  smoothRings(glass,(i,j)=>(i===2||i===6||j===1||j===6)?['#283e48',2]:[paint,1]);
  function trim(x,y,z,w,h,d,col,mat=0){m.material=mat;m.box(x,y,z,w,h,d,col);}
  for(const s of [-1,1]){
    trim(s*.96,.61,-.08,.07,.022,1.65,'#5c3739');trim(s*1.015,.31,-.05,.10,.09,1.65,charcoal);
    trim(s*.97,.82,-.55,.06,.047,.23,chrome,3);
    trim(s*.8,1.08,-.46,.085,.37,.072,charcoal);trim(s*1.01,.99,.55,.25,.075,.08,charcoal);
    trim(s*1.13,1.035,.55,.22,.13,.27,paint,1);
    for(const z of [-1.54,1.43]){
      if(variant!==null)m=new Gfx.Mesh();
      const centerY=.428;
      for(let j=0;j<28;j++){
        const u=j*Math.PI/14,v=(j+1)*Math.PI/14;
        const pt=(ang,r,x)=>[s*x,centerY+Math.sin(ang)*r,z+Math.cos(ang)*r];
        for(const [r1,x1,r2,x2,col,mat] of [[.37,.82,.416,.86,'#23262b',0],[.416,.86,.416,1.055,'#25262b',0],[.416,1.055,.372,1.082,'#353638',0],[.372,1.082,.289,1.084,'#282a2e',0],[.29,1.084,.255,1.091,chrome,3],[.255,1.091,.055,1.09,'#343b41',0]]){
          m.material=mat;m.quad([pt(u,r1,x1),pt(v,r1,x1),pt(v,r2,x2),pt(u,r2,x2)],col);}
      }
      for(let j=0;j<10;j++){const a=j*Math.PI/5,pt=(angle,r)=>[s*1.098,centerY+r*Math.sin(angle),z+r*Math.cos(angle)];
        m.material=3;m.quad([pt(a,.035),pt(a+.34,.10),pt(a+.14,.257),pt(a-.05,.24)],chrome);}
      if(variant!==null){
        for(let i=0;i<m.vertices.length;i+=12){m.vertices[i]-=s*.95;m.vertices[i+1]-=centerY;m.vertices[i+2]-=z;}
        wheelParts.push({mesh:m.seal(),s,f:Math.sign(z)});m=body;
      }
    }
    trim(s*.64,.64,-2.445,.42,.104,.055,'#ff4038',6);
    trim(s*.62,.53,2.395,.40,.085,.045,'#fff3d2',6);
    trim(s*.49,.286,-2.38,.21,.14,.2,chrome,3);
  }
  trim(0,.40,2.38,1.22,.14,.06,charcoal);
  for(let j=0;j<9;j++)trim((j-4)*.126,.405,2.416,.019,.13,.018,'#8b9392',3);
  // Recessed rear fascia, segmented light pipes, diffuser fins and twin exhaust outlets.
  trim(0,.655,-2.457,1.70,.193,.048,'#302c34',2);
  for(const s of [-1,1]){
    for(let j=0;j<7;j++)trim(s*(.41+j*.061),.687,-2.487,.048,.047,.019,'#ff5946',6);
    trim(s*.61,.624,-2.487,.46,.023,.018,'#d0493a',6);
    trim(s*.92,.76,-2.34,.13,.05,.21,'#b63737',1);
    for(let i=0;i<14;i++){
      const a=i*Math.PI/7,b=(i+1)*Math.PI/7,pt=(t,r,z)=>[s*.61+r*Math.cos(t),.323+r*.72*Math.sin(t),z];
      m.material=3;m.quad([pt(a,.103,-2.45),pt(b,.103,-2.45),pt(b,.103,-2.52),pt(a,.103,-2.52)],chrome);
      m.quad([pt(a,.104,-2.523),pt(b,.104,-2.523),pt(b,.075,-2.523),pt(a,.075,-2.523)],chrome);
      m.material=0;const center=[s*.61,.323,-2.514];m.quad([pt(a,.076,-2.514),pt(b,.076,-2.514),center,center],charcoal);
    }
    // Black rubber gasket outlines the quarter glass and windshield.
    const q=(x,y,z)=>[s*x,y,z];m.material=0;
    m.quad([q(.884,1.015,-1.22),q(.664,1.454,-.76),q(.682,1.456,-.71),q(.889,1.012,-1.14)],charcoal);
    m.quad([q(.825,1.011,-.97),q(.856,.99,.74),q(.878,.973,.76),q(.86,.978,-.99)],chrome);
    m.quad([q(1.019,.755,-.70),q(1.012,.746,.67),q(1.013,.735,.66),q(1.02,.744,-.69)],'#733d37');
  }
  for(let j=-2;j<=2;j++)trim(j*.17,.265,-2.39,.033,.12,.24,charcoal);
  trim(0,.741,-2.478,.18,.024,.019,chrome,3);
  trim(0,.51,-2.451,.53,.19,.035,'#e2cfac');m.material=0;m.sign(0,.522,-2.477,.51,.16,plate);
  trim(0,.40,-2.43,1.84,.055,.09,chrome,3);
  trim(0,.98,-1.99,1.72,.047,.24,paint,1);
  if(variant!==null){
    const p=Driving.type(variant);
    if(variant===0){
      for(const side of [-1,1])for(let j=0;j<5;j++)trim(side*.90,.71,-1.08+j*.10,.17,.038,.055,charcoal);
      trim(0,.99,-1.98,1.85,.06,.26,paint,1);
    }else if(variant===1){
      trim(0,1.01,1.30,.76,.12,.62,'#474a45',1);
      for(const side of [-1,1])trim(side*.42,.975,1.51,.19,.035,.90,'#e1bf89',0);
      trim(0,.45,2.44,1.89,.14,.08,chrome,3);
    }else{
      trim(0,1.59,-.16,1.13,.12,.26,'#26363d');
      trim(-.31,1.70,-.16,.48,.12,.24,'#aa3839');trim(.31,1.70,-.16,.48,.12,.24,'#447db5');
      for(const side of [-1,1]){trim(side*1.01,.49,0,.044,.40,1.50,'#ece5ce');trim(side*1.04,.66,0,.02,.07,1.43,'#374953');}
      trim(0,.34,2.46,1.34,.15,.12,charcoal);
    }
    const sx=p.halfW/1.02,sz=p.halfL/2.39,sy=variant===0?.89:variant===1?.96:1.06;
    for(let i=0;i<body.vertices.length;i+=12){
      body.vertices[i]*=sx;body.vertices[i+2]*=sz;
      const y=body.vertices[i+1];body.vertices[i+1]=y<.48?y:.48+(y-.48)*sy;
      if(variant===2&&y>1.2)body.vertices[i+2]*=1.22;
    }
    // The open panel pivots at its forward hinge, exposing the dark interior card.
    door.material=1;door.box(0,.03,-.57,.07,.46,1.15,variant===2?'#eae4d3':paint);
    door.material=2;door.box(.025,.50,-.56,.035,.30,1.04,'#48606b');
    door.material=3;door.box(-.035,.35,-.90,.045,.035,.18,chrome);
    return {body:body.seal(),wheelParts,door:door.seal(),sy,sz};
  }
  // Contact shadow fades in concentric layers against the asphalt.
  m.material=0;
  for(let i=0;i<3;i++)for(let j=0;j<32;j++){
    const pos=a=>[(1.36-.12*i)*Math.cos(a),.057+i*.002,(2.62-.12*i)*Math.sin(a)];
    const c=[0,.057+i*.002,0];m.quad([c,pos(j*Math.PI/16),pos((j+1)*Math.PI/16),c],['#484448','#37363b','#28292f'][i]);}
  return m.seal();
}
