'use strict';
const Town=(()=>{
  const mesh=new Gfx.Mesh(), blocks=[], fixtures=[];
  const start=[[0,-18],[0,25]], coast=[[0,25],[-24,39],[-38,58],[-38,79],[-25,97],[0,110]],
        alley=[[0,25],[16,46],[16,90],[0,110]],finish=[[0,110],[0,135]];
  const roads=[{points:start,width:13},{points:coast,width:12},{points:alley,width:7},{points:finish,width:13}];
  const targets=[
    {x:0,z:128,w:8,d:10,name:'潮汐冲印室',action:'领取冷藏胶片',hint:'在青色装卸框停稳，按 E 取片'},
    {x:102,z:237,w:7.6,d:11,name:'平码头',action:'核验封条',hint:'驶入港区青色验片框，停车按 E 核验'},
    {x:-54,z:352,w:6,d:9,name:'海角汽车影院',action:'停车交片',hint:'整车停入影院黄框，保持静止'}
  ];
  roads[3].points=[[0,110],[0,128],[0,148]];
  roads.push(
    {points:[[0,148],[-30,168],[-35,191],[-7,212],[39,219],[75,237],[101,225]],width:14},
    {points:[[0,148],[33,149],[60,167],[64,198],[95,205],[101,225]],width:8},
    {points:[[101,225],[122,246],[124,280],[92,305],[45,312],[8,333],[-37,329],[-54,352]],width:14},
    {points:[[101,225],[75,237],[49,249],[48,273],[19,276],[8,302],[-24,306],[-39,326],[-54,352]],width:8},
    {points:[[-35,191],[-64,218],[-66,265],[-47,289],[-24,306]],width:12},
    {points:[[64,198],[65,219],[49,249]],width:9},
    {points:[[-7,212],[-8,247],[19,276]],width:10},
    {points:[[101,225],[102,237],[101,244],[90,244],[75,237]],width:8},
    {points:[[101,244],[111,249],[122,246]],width:8},
    {points:[[0,25],[53,25],[53,146],[33,149]],width:14,lanes:4},
    {points:[[53,25],[85,25],[85,116],[53,116]],width:8},
    {points:[[53,63],[85,63]],width:8});
  roads[0].lanes=4;roads[3].lanes=4;
  const streets=['棕榈大街','海堤大道','洗车巷','冲印街','运河大道','冷库巷','滨港环路','船厂近道','西湾海滨','起重机路','中央大街','港务查验区','港务东出口','日落大道','露台街','露台横街'];
  const names={};
  for(const [k,txt,bg,fg] of [
    ['shop','PALMA  VIDEO','#254254','#fbe7a6'],['motel','MOTEL  SOL','#b74e67','#fff0bb'],
    ['wash','CAR  WASH','#286562','#caffbd'],['cinema','PALMA  DRIVE-IN','#432844','#ffc696'],
    ['movie','THE  LAST  REEL','#f1ba7c','#713c68'],['junction','← 海堤    洗车巷 →','#354861','#fff0b7'],
    ['lab','TIDE  FILM  LAB','#154f51','#ffeac7'],['dock','PALMA  FREIGHT','#bc673d','#ffedd4'],
    ['hotel','HOTEL  MIRAMAR','#814759','#ffe1a0'],['plate','P A L M A   7 9','#e2cfac','#1f343d'],
    ['kiosk','CAFÉ   •   07–22','#e5cb9b','#4c5546'],['sodas','COLD   SODAS','#994b3b','#f1d9b3'],
    ['counter','FILM   COLLECTION','#315552','#eee2b6'],['market','FRUTA  FRESCA','#e9a05e','#623952'],['radio','MAR  FM  89.1','#db7972','#382c55'],
    ['solana','S O L A N A','#51424e','#ffcab5'],['casa','C A S A   M A R','#375555','#a5f8db'],['coral','C O R A L   C L U B','#67435b','#f8c4db']
  ])names[k]=Gfx.label(txt,bg,fg);
  Gfx.uploadAtlas();
  let seed=3539;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const groundPatches=[];
  const ground=(x,z,w,d,y,c)=>{
    mesh.plane(x,z,w,d,y,c);
    if(y<=.031)groundPatches.push({x,z,halfW:w/2,halfD:d/2,y});
  };
  function nearestRoad(x,z){
    let best={distance:Infinity,index:0,edge:Infinity};
    roads.forEach((r,index)=>{
      for(let i=1;i<r.points.length;i++){
        const [a,b]=r.points[i-1],[c,d]=r.points[i],u=c-a,v=d-b;
        const t=Math.max(0,Math.min(1,((x-a)*u+(z-b)*v)/(u*u+v*v))),distance=Math.hypot(x-a-u*t,z-b-v*t);
        if(distance-r.width/2<best.edge)best={distance,index,edge:distance-r.width/2};
      }
    });return best;
  }
  function floorAt(x,z){
    let y=x>=Beach.shore(z)&&x<=-49&&z>=-180&&z<=500?-.06:-.21;
    const edge=nearestRoad(x,z).edge;
    if(edge<=1.75)y=Math.max(y,edge<=0?.025:0);
    for(const p of groundPatches)if(Math.abs(p.x-x)<=p.halfW&&Math.abs(p.z-z)<=p.halfD)y=Math.max(y,p.y);
    return y;
  }
  ground(0,25,700,650,-.21,'#c79887');mesh.material=7;ground(-220,145,286,810,-.12,'#73b2ac');mesh.material=0;
  for(let i=0;i<76;i++){
    const x=-120+random()*370,z=394+random()*85,w=7+random()*10,h=12+random()*62;
    mesh.material=5;mesh.box(x,0,z,w,h,8+random()*10,['#acc1bd','#899da6','#bdaca9'][i%3]);
    const cap=2+random()*4;mesh.material=0;mesh.box(x,h,z,w*.89,.36,7.9,'#d6c6af');
    mesh.material=5;mesh.box(x,h+.36,z,w*.70,cap,6,'#8fa9ae');mesh.material=0;
    if(i%3===0){mesh.box(x,h+cap+.36,z,w*.48,2.8,4.1,'#b7afa3');mesh.box(x,h+cap+3.16,z,.18,3.9,.18,'#9dabb1');}
  }
  function disk(m,x,y,z,rx,rz,color,count=18){for(let j=0;j<count;j++){let a=j*2*Math.PI/count,b=(j+1)*2*Math.PI/count;
    const center=[x,y,z];m.quad([center,[x+rx*Math.cos(a),y,z+rz*Math.sin(a)],[x+rx*Math.cos(b),y,z+rz*Math.sin(b)],center],color);}}
  function ribbon(points,width,y,color){for(let i=1;i<points.length;i++)mesh.strip(points[i-1],points[i],width,y,color);
    for(const [x,z] of points)disk(mesh,x,y,z,width/2,width/2,color);}
  mesh.material=8;roads.forEach(r=>ribbon(r.points,r.width+3.5,0,'#b5a99c'));mesh.material=0;
  mesh.material=4;roads.forEach(r=>ribbon(r.points,r.width,.025,'#565861'));mesh.material=0;
  for(const r of roads){for(let i=1;i<r.points.length;i++){let [x,z]=r.points[i-1],[X,Z]=r.points[i],len=Math.hypot(X-x,Z-z);
    const dx=(X-x)/len,dz=(Z-z)/len;
    function line(from,to,offset,width,color){
      const at=t=>[x+dx*t+dz*offset,z+dz*t-dx*offset];mesh.strip(at(from),at(to),width,.048,color);
    }
    if(r.lanes===4){
      for(const side of [-1,1]){
        line(.6,len-.6,side*.11,.11,'#ecc46e');
        for(let t=1;t<len-1;t+=6.0)line(t,Math.min(len-1,t+2.8),side*r.width/4,.13,'#e5dfcf');
      }
    }else for(let t=2;t<len-1;t+=5.8)line(t,Math.min(t+2,len),0,.15,'#ead3ac');
  }}
  const cross=(z)=>{for(let x=-5.6;x<6;x+=1.4)ground(x,z,.65,2,.052,'#eed7ba');};
  cross(16);cross(115);
  function building(x,z,w,d,h,c,trim,sign){
    const front=z-d/2;
    blocks.push({x,z,w,d});mesh.material=sign==='lab'||sign==='dock'?10:9;mesh.box(x,0,z,w,h,d,c);mesh.material=0; mesh.box(x,h-.4,z,w+.3,.46,d+.3,trim);
    mesh.box(x,h+.06,z,w-.7,.22,d-.7,c);
    // Broad recessed storefront glazing, awning ribs and rooftop mechanical plant.
    mesh.material=11;mesh.box(x,.28,front-.085,w*.8,2.05,.12,'#33505a');mesh.material=0;
    for(let t=-w*.38;t<w*.42;t+=1.4)mesh.box(x+t,.29,front-.17,.07,2.06,.08,trim);
    mesh.box(x+w*.21,h+.25,z,2.1,.92,1.3,'#999997');
    for(let j=0;j<5;j++)mesh.box(x+w*.21-.75+j*.34,h+.43,z-.67,.15,.51,.05,'#576369');
    const floors=Math.max(1,Math.floor(h/3.4)),cols=Math.max(2,Math.floor(w/2.9));
    for(let j=0;j<floors;j++)for(let i=0;i<cols;i++){
      const xx=x-w/2+(i+.5)*w/cols,yy=.9+j*(h-1)/floors;
      mesh.material=11;mesh.box(xx,yy,front-.05,w/cols*.64,Math.min(1.6,h/floors*.46),.12,'#3c5062');mesh.material=0;
      mesh.box(xx,yy-.1,front-.11,w/cols*.74,.12,.24,trim);
      mesh.box(xx-.22,yy,front-.13,.09,1.4,.08,'#eac2a2');}
    mesh.material=11;for(let side of [-1,1])for(let s=2;s<d-1;s+=3.1)for(let j=0;j<floors;j++)
      mesh.box(x+side*(w/2+.03),1+j*(h-1)/floors,front+s,.08,1.4,1.6,'#566575');
    mesh.material=0;
    if(sign){mesh.box(x,h-.9,front-.24,w*.93,1.68,.35,trim);mesh.sign(x,h-.81,front-.43,w*.90,1.48,names[sign]);
      mesh.box(x,2.5,front-.8,w*.94,.22,1.9,trim);}
  }
  building(-14,5,12,10,5.1,'#f1a39b','#ffe3a5','shop');
  // Ocean Drive shopfront: fluted pilasters, rounded marquee and a stepped neon blade.
  mesh.box(-14,2.72,-.55,12.8,.46,2.05,'#eac4a0');
  for(let i=0;i<3;i++){
    mesh.material=6;mesh.box(-14,2.78+i*.13,-1.59,12.55,.042,.055,'#fbbda6');mesh.material=0;
    mesh.box(-8.10+i*.16,1.3,2,.085,4.5-i*.32,.26,'#e5bd9c');
  }
  for(let k=0;k<6;k++){
    mesh.box(-19.2+k*2.04,.2,-.16,.15,2.1,.32,'#e2bb93');
    mesh.box(-19.0+k*2.04,.46,-.19,.7,.055,.06,'#d69f71');
  }
  building(15,11,12,10,8.7,'#8ec3b3','#f3d89d','motel');
  mesh.box(10.25,3.05,7.8,1.02,8.5,1.3,'#ae7566');
  for(const x of [9.84,10.25,10.66]){mesh.material=6;mesh.box(x,4.15,7.10,.075,7.0,.07,'#ffd39d');}mesh.material=0;
  for(const y of [3.5,6.3]){
    mesh.box(15,y,5.49,11.6,.19,1.35,'#d6c0a1');
    mesh.box(15,y+.65,4.86,11.4,.06,.07,'#bec8bd');
    for(let x=9.6;x<20.7;x+=1.15)mesh.box(x,y+.18,4.86,.06,.47,.065,'#a6b0a7');
  }
  building(-16,-10,12,8,7,'#e4bb84','#b6d4be','market');
  building(16,-7,11,8,6,'#d9989e','#eab58e','radio');
  building(25,51,9,14,5.3,'#78bab3','#ffae99','wash');
  building(3,60,12,17,7,'#eeb28e','#f0d69c','market');
  building(-13,73,13,13,9,'#a2c7bc','#ffbc9e','motel');
  building(4,82,10,10,6,'#d897ac','#f8c599');
  building(26,79,9,12,8,'#eab981','#a9cbbf','radio');
  building(-17,120,10,9,5,'#e4a691','#f2cb9c');
  building(14,124,9,9,5,'#a4c5ab','#f4ca99');
  function palm(x,z,h,phase){
    if(nearestRoad(x,z).edge<.65)return;
    const lean=h*.085,leaf=['#415e38','#577643','#486b42','#76864c'];
    const trunk=(level,theta)=>{const t=level/18,r=(.29-.145*t)*(1+.08*Math.cos(level*Math.PI));
      return [x+lean*t*t+r*Math.cos(theta),h*t,z+.12*Math.sin(t*2)+r*Math.sin(theta)];};
    for(let level=0;level<18;level++)for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      mesh.quad([trunk(level,a),trunk(level+1,a),trunk(level+1,b),trunk(level,b)],level%3?'#8a816a':'#726f59');
    }
    for(let k=0;k<14;k++){
      const a=k*2.4+phase,l=h*(.34+.085*Math.sin(k*7.2)),dx=Math.sin(a),dz=Math.cos(a);
      const lift=k%3===0?.64:.36;
      const pt=t=>[x+lean+dx*l*t,h+l*(lift*Math.sin(t*Math.PI)-t*t*.38),z+dz*l*t];
      for(let j=0;j<13;j++){
        const t=j/13,p=pt(t),q=pt((j+1)/13);
        mesh.quad([p,[p[0]+dz*.032,p[1],p[2]-dx*.032],[q[0]+dz*.025,q[1],q[2]-dx*.025],q],'#94894f');
        for(const side of [-1,1]){const width=(.045+.15*Math.sin(Math.PI*(t+.01)))*(1-.25*t)*l*side;
          const end=[p[0]+dz*width+dx*l*.12,p[1]-.07*l-Math.abs(width)*.56,p[2]-dx*width+dz*l*.12];
          mesh.quad([p,[p[0]+dx*l*.066,p[1]+.01,p[2]+dz*l*.066],end,end],leaf[(j+k)%4]);
        }
      }
    }
  }
  [[-8,-7,10],[8,-2,9],[8,21,11],[-9,21,9],[-24,24,10],[-32,34,11],[-44,47,9],[-46,62,12],[-46,78,11],[-39,95,9],[-27,107,10],[23,39,10],[22,68,10],[23,96,9],[-8,112,9],[9,116,9],[-21,139,12],[19,145,13]].forEach(([x,z,h])=>palm(x,z,h,random()*5));
  for(let z=-26;z<145;z+=8){if([14,54,86].includes(z))continue;fixtures.push({kind:'fence',x:-49,z:z+4});}
  mesh.box(0,0,39,.32,3.8,.34,'#5a5264');mesh.sign(0,2.3,38.76,7.4,1.58,names.junction);
  // The larger districts share geometry, collision footprints and navigation markers.
  function tower(x,z,w,d,h,body){
    blocks.push({x,z,w,d});
    const style=Math.abs(Math.round(x+z))%3;
    const glass=['#65929a','#819394','#7795a9'][style],stone=['#e4cbb0','#c9d5c6','#cdb7a5'][style];
    const podium=4.6,shoulder=Math.floor(h*.77/3)*3;
    mesh.material=9;mesh.box(x,0,z,w,podium,d,stone);
    mesh.material=11;mesh.box(x,0.38,z-d*.5-.04,w*.78,3.4,.09,'#536b70');
    for(let i=-2;i<=2;i++){mesh.material=0;mesh.box(x+i*w*.19,0,z-d*.5-.12,.27,podium,.32,stone);}
    mesh.material=5;mesh.box(x,podium,z,w*.94,shoulder-podium,d*.94,glass);
    mesh.box(x,shoulder,z,w*.81,h-shoulder,d*.84,glass);
    mesh.material=0;mesh.box(x,podium-.32,z,w+.22,.32,d+.22,stone);
    for(let y=podium+2.9;y<shoulder;y+=style===0?3.05:6.1){
      mesh.box(x,y,z,w*.96,.17,d*.96,stone);
      if(style===0)mesh.box(x+w*.18,y+.18,z-d*.47,w*.48,.51,.60,'#8caaa9');
    }
    for(let i=-1;i<=1;i+=2){
      mesh.box(x+i*w*.39,podium,z-d*.47,.22,h-podium+.8,.27,stone);
      mesh.material=6;mesh.box(x+i*w*.39,shoulder,z-d*.47-.15,.075,h-shoulder+.8,.06,'#ffcd98');mesh.material=0;
    }
    mesh.box(x,shoulder,z,w*.97,.27,d*.97,stone);
    mesh.box(x,h,z,w*.84,.34,d*.87,stone);
    mesh.material=5;mesh.box(x,h+.34,z,w*.56,2.5+style,d*.53,body);
    mesh.material=6;mesh.box(x,h+2.84+style,z,w*.58,.13,d*.55,['#ffc09d','#88dbcb','#dda3c8'][style]);
    mesh.material=0;if(style===2){mesh.box(x,h+3,z,1.7,3.4,1.7,stone);mesh.box(x,h+6.4,z,.12,3.2,.12,'#a9aeb4');}
  }
  for(const args of [[-30,142,12,12,22,'#d2baad'],[19,162,13,12,34,'#9eb4af'],
    [-15,183,10,12,43,'#adc2bf'],[12,183,14,11,31,'#bdaba6'],[36,185,13,14,21,'#c4c9b9'],
    [-54,170,13,15,30,'#cdaf98'],[-60,192,11,12,25,'#acc2b7'],[-38,243,14,14,36,'#abc3bc'],
    [-29,264,15,12,48,'#c6afb2'],[-12,275,11,15,36,'#9bafb7'],[-1,277,9,10,19,'#c5b29e'],
    [-2,318,11,11,27,'#c9b19f'],[62,294,14,11,40,'#a0b7be'],[84,324,18,12,30,'#c7b6ae']])tower(...args);
  building(-14.3,132,10,12,5.8,'#c8d3bd','#e6a782','lab');
  building(117,214,11,17,7.1,'#aa9381','#efac77','dock');
  building(-67,332,11,10,8.4,'#d8ae99','#f6cb96','hotel');
  // Port cranes, stacked shipping containers, and riveted warehouse doors.
  for(const [x,z] of [[127,207],[135,245],[143,269]]){
    for(const side of [-1,1])mesh.box(x+side*4,0,z,1,17,1.6,'#b86c4c');
    mesh.box(x+2,16.2,z,23,1.1,1.9,'#e6a04f');
    for(let j=0;j<9;j++)mesh.box(x-8+j*2.6,17.3,z,.18,1.3,.2,'#bd8258');
    mesh.box(x+2,18.6,z,22,.27,.38,'#d89c59');mesh.box(x-7,7,z,.08,9,.08,'#53575a');
  }
  for(let i=0;i<30;i++){
    const x=64+(i%5)*7.4,z=260+Math.floor(i/5)*5.6,h=i%4===0?5:2.55;
    blocks.push({x,z,w:6.6,d:3.1});mesh.box(x,0,z,6.6,h,3.1,['#a8533b','#608181','#79838b','#bd8b53'][i%4]);
    for(let j=0;j<9;j++)mesh.box(x-3+j*.72,.1,z-1.58,.10,h-.2,.07,'#726f6b');
  }
  for(const t of targets){
    const color=t===targets[2]?'#ffe375':'#69f4dd';
    for(const side of [-1,1]){
      ground(t.x+side*t.w/2,t.z,.20,t.d,.069,color);
      ground(t.x,t.z+side*t.d/2,t.w,.20,.069,color);
    }
  }
  const screenX=-54,screenZ=364;
  mesh.box(screenX,3.1,screenZ,24,10,.68,'#4e4751');mesh.box(screenX,3.45,screenZ-.40,23.2,9.25,.1,'#262e36');
  for(const dx of [-9,9])mesh.box(screenX+dx,0,screenZ,.65,3.3,.65,'#716b74');
  mesh.sign(screenX,1.45,screenZ-.55,11,1.5,names.cinema);
  const lit=new Gfx.Mesh();lit.material=6;lit.sign(screenX,3.55,screenZ-.52,22.6,9,names.movie);
  for(let z=155;z<357;z+=13)palm(-73,z,8+random()*4,random()*6);
  for(const [x,z] of [[-42,185],[-41,205],[35,140],[55,179],[73,199],[117,234],[115,272],[32,284],[1,301],[-31,320],[-63,346],[-43,346]])palm(x,z,9+random()*2,random()*6);
  // Small street furniture gives the player scale when walking or turning.
  function streetLamp(x,z,side){
    fixtures.push({kind:'lamp',x,z,yaw:side>0?0:Math.PI});
  }
  [[7,8,1],[-8,16,-1],[-20,49,1],[-45,71,-1],[21,57,1],[10,88,-1],[8,111,1]].forEach(v=>streetLamp(...v));
  for(let z of [26,47,69,91,108]){
    const x=-53.7;fixtures.push({kind:'umbrella',x,z});
    ground(x,z,1.4,2.3,-.09,'#ecbb9d');
  }
  ground(-53,56,7,168,-.115,'#e9c594');
  for(const [x,z] of [[-8.5,2],[8.5,14],[-45.5,65],[22.8,84]]){
    mesh.box(x,.48,z,.63,.13,1.9,'#c08b74');mesh.box(x+.28,.69,z,.1,.4,1.9,'#c08b74');
    for(const dz of [-.62,.62])mesh.box(x,.02,z+dz,.36,.46,.12,'#5d5867');
  }
  const trafficCars=['#477e89','#e1bc85','#66778c'].map(col=>makeCoupe(col,names.plate));
  const marker=new Gfx.Mesh();marker.material=6;
  for(let side of [-1,1])marker.quad([[side*1.25,1.16,0],[side*1.25,1.61,0],[0,.71,0],[0,.24,0]],'#9affdc');
  // A strapped transport case on the rear deck makes both handoffs visible.
  const canister=new Gfx.Mesh(),seal=new Gfx.Mesh();
  canister.box(0,.982,0,.83,.23,.39,'#767e73');
  canister.material=3;canister.box(0,1.20,0,.85,.03,.415,'#bac2b6');
  for(const x of [-.27,.27]){canister.material=0;canister.box(x,1.0,0,.063,.24,.43,'#483e36');}
  seal.material=6;seal.box(.04,1.11,-.206,.17,.088,.025,'#8de4ba');
  // At walking distance the shop fronts read as individual businesses.
  function pavement(x,z,w,d){mesh.material=8;ground(x,z,w,d,.016,'#c8b9a7');mesh.material=0;}
  pavement(-10,-2.9,12,4.1);pavement(10.4,3.2,8,5);pavement(-11.4,124.4,8.1,2.7);
  function parasol(x,z){
    fixtures.push({kind:'umbrella',x,z});
    disk(mesh,x,.74,z,.57,.57,'#886854',24);
    for(const sign of [-1,1]){
      const zz=z+sign*.82;
      mesh.box(x,.42,zz,.40,.07,.41,'#795e4b');mesh.box(x,.47,zz+sign*.19,.40,.36,.055,'#99745a');
      for(const xx of [-.15,.15])for(const dz of [-.14,.14])mesh.box(x+xx,0,zz+dz,.033,.43,.033,'#495153');
    }
  }
  parasol(9,1.4);parasol(12.4,2.0);
  function vendor(x,z){
    mesh.box(x,0,z,1.25,1.99,.74,'#a45445');mesh.sign(x,1.60,z-.38,1.12,.30,names.sodas);
    mesh.material=2;mesh.box(x-.14,.42,z-.385,.79,1.06,.04,'#516c68');mesh.material=0;
    for(let row=0;row<3;row++)for(let k=0;k<5;k++)
      mesh.box(x-.45+k*.14,.48+row*.30,z-.414,.095,.17,.04,['#ce9d63','#ac614a','#9ea77b'][(row+k)%3]);
  }
  vendor(-8.9,-.65);vendor(113.8,203.8);
  const filmCounter={x:-9.3,z:123.7};
  mesh.box(filmCounter.x,.05,124.65,2.2,1.0,.74,'#797367');mesh.box(filmCounter.x,1.05,124.65,2.32,.085,.83,'#b79e7f');
  mesh.sign(filmCounter.x,.50,124.262,1.87,.36,names.counter);
  mesh.box(filmCounter.x,1.16,124.88,.72,.31,.34,'#53635c');
  for(const [x,z] of [[-5.4,-5.2],[-5.5,10.5],[5.2,22],[3.1,120],[98,232]]){
    mesh.plane(x,z,.68,1.12,.058,'#5b5b5b');
    for(let j=0;j<8;j++)mesh.plane(x,z-.45+j*.125,.56,.042,.061,'#30383c');
  }
  for(const [x,z] of [[-10.5,-1.85],[10.3,4.3],[-13.2,124.1],[119,228]]){
    mesh.box(x,0,z,.7,.42,.66,'#a78368');
    for(let i=0;i<15;i++){
      const a=i*2.4,l=.26+random()*.22;
      const tip=[x+Math.cos(a)*l,.73+random()*.39,z+Math.sin(a)*l];
      mesh.quad([[x,.35,z],[x+.11*Math.sin(a),.65,z-.11*Math.cos(a)],tip,[x-.09*Math.sin(a),.62,z+.09*Math.cos(a)]],['#556e4c','#75865a','#486455'][i%3]);
    }
  }
  function tube(a,b,radius,color){
    const v=b.map((t,i)=>t-a[i]),len=Math.hypot(...v),dir=v.map(t=>t/len);
    const side=Math.abs(dir[1])>.9?[1,0,0]:[-dir[2]/Math.hypot(dir[0],dir[2]),0,dir[0]/Math.hypot(dir[0],dir[2])];
    const up=[dir[1]*side[2]-dir[2]*side[1],dir[2]*side[0]-dir[0]*side[2],dir[0]*side[1]-dir[1]*side[0]];
    const edge=(p,j)=>p.map((q,i)=>q+radius*(side[i]*Math.cos(j*Math.PI/4)+up[i]*Math.sin(j*Math.PI/4)));
    for(let j=0;j<8;j++)mesh.quad([edge(a,j),edge(b,j),edge(b,j+1),edge(a,j+1)],color);
  }
  // Curved awnings, display windows and service lines give the opening block a human scale.
  for(const [x,z,w,col] of [[-14,-.35,10.2,'#a1654b'],[15,5.45,9.7,'#638b83'],[-14.3,125.72,7.9,'#91866e']]){
    for(let stripe=0;stripe<18;stripe++){
      const x0=x-w/2+w*stripe/18,x1=x0+w/18,c=stripe%2?col:'#ddcbaa';
      for(let j=0;j<5;j++){
        const edge=(xx,k)=>[xx,2.45+.65*Math.cos(k*Math.PI/10),z-.91*Math.sin(k*Math.PI/10)];
        mesh.quad([edge(x0,j),edge(x1,j),edge(x1,j+1),edge(x0,j+1)],c);
      }
      mesh.box((x0+x1)/2,2.32,z-.90,w/18,.13,.045,c);
    }
  }
  const poles=[[-7.8,-16],[-7.8,6],[-7.8,21],[-24,30]];
  for(const [x,z] of poles){
    tube([x,0,z],[x,6.45,z],.105,'#816b55');mesh.box(x,5.96,z,1.44,.13,.15,'#736751');
    for(const d of [-.56,.56])mesh.box(x+d,6.08,z,.12,.22,.12,'#b6b4a0');
  }
  for(let i=1;i<poles.length;i++)for(const off of [-.55,.55]){
    const [ax,az]=poles[i-1],[bx,bz]=poles[i];
    const pt=t=>[ax+(bx-ax)*t+off,6.28-1.35*t*(1-t),az+(bz-az)*t];
    for(let j=0;j<9;j++)tube(pt(j/9),pt((j+1)/9),.012,'#484443');
  }
  Beach.build(mesh,blocks);
  mesh.material=4;ground(45.5,44,2.7,25,.031,'#686669');mesh.material=0;
  for(const z of [32,40,48,56])ground(45.5,z,2.52,.075,.052,'#d0c9b8');
  const pastel=['#94cfbe','#e79c9d','#eed295'],tubeTint=['#70ffd7','#ff80b4','#ffd79c'];
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const frontages=side<0?[41,54,72,90,108,126]:[39,null,null,90,null,130];
    const z=frontages[i];if(z===null)continue;
    const k=(i+(side>0?1:0))%3,x=53+side*15.7,h=5.4+(i%3)*1.25;
    const sign=['solana','casa','coral'][k];
    building(x,z,10.2,11.3,h,pastel[k],'#ebd5ba',sign);
    const face=x-side*5.15;
    // Project the curved entrance canopy towards the pavement; its lip carries two thin light tubes.
    const curve=(a,y,r)=>[face-side*r*Math.sin(a),y,z+2.25*Math.cos(a)];
    for(let j=0;j<18;j++){
      const a=j*Math.PI/18,b=(j+1)*Math.PI/18;
      mesh.material=0;mesh.quad([curve(a,2.68,1.15),curve(b,2.68,1.15),curve(b,3.01,1.15),curve(a,3.01,1.15)],'#e9d2b7');
      mesh.quad([[face,3.01,z],curve(a,3.01,1.15),curve(b,3.01,1.15),[face,3.01,z]],'#d1baab');
      for(const y of [2.72,2.91]){mesh.material=6;mesh.quad([curve(a,y,1.17),curve(b,y,1.17),curve(b,y+.03,1.17),curve(a,y+.03,1.17)],tubeTint[k]);}
    }
    mesh.material=6;const xx=face-side*.12;
    mesh.quad([[xx,3.25,z+side*3.92],[xx,3.25,z-side*3.92],[xx,4.11,z-side*3.92],[xx,4.11,z+side*3.92]],'#ffffff',1,names[sign]);
    for(let level=0;level<3;level++){
      mesh.material=0;mesh.box(face-side*level*.18,h-.9+level*.28,z,.42,.25,11.7-level*.22,'#e5c7ae');
      mesh.material=6;mesh.box(face-side*(.23+level*.18),h-.85+level*.28,z,.055,.085,11.6-level*.22,tubeTint[k]);
    }
    mesh.material=0;mesh.box(face-side*.25,2.5,z+.8,.65,h+.8,1.03,pastel[k]);
    for(const d of [-.32,.32]){mesh.material=6;mesh.box(face-side*.60,2.7,z+.8+d,.06,h+.42,.065,tubeTint[k]);}
    mesh.material=0;
  }
  for(let z=32;z<144;z+=14){palm(44.7,z,8.2+random()*1.7,random()*6);palm(61.4,z+2,9.1+random(),random()*6);}
  for(let z=36;z<142;z+=22)streetLamp(60.5,z,1);
  for(const z of [59,67])for(let x=46.8;x<=59.6;x+=1.22)ground(x,z,.61,2,.057,'#eee0ce');
  const signals=[{x:60.8,z:57.9},{x:45.3,z:68.0},{x:6.6,z:13}];
  for(const [i,v] of signals.entries()){
    const side=i===1?-1:1;mesh.material=0;mesh.box(v.x,0,v.z,.15,5.25,.15,'#605b59');
    mesh.box(v.x-side*1.65,5.14,v.z,3.4,.13,.14,'#7d776c');
    mesh.box(v.x-side*3.2,4.03,v.z,.48,1.13,.34,'#352f35');
  }
  const lenses=['#ff443f','#ffbd48','#54f4a0'].map(c=>{const m=new Gfx.Mesh();m.material=6;
    for(let j=0;j<16;j++){const p=k=>[.145*Math.cos(k*Math.PI/8),.145*Math.sin(k*Math.PI/8),0];m.quad([[0,0,0],p(j),p(j+1),[0,0,0]],c);}
    return m.seal();});
  function signal(t,i){const sec=(t+(i===2?5:0))%15;return sec<8?2:sec<10?1:0;}
  function drawSignals(t){signals.forEach((v,i)=>{const col=signal(t,i),side=i===1?-1:1;
    for(const d of [-.185,.185])Gfx.draw(lenses[col],v.x-side*3.2,4.92-.34*col,v.z+d);});}
  const fleet=['#c3515b','#708780','#29363f'].map((color,id)=>makeCoupe(color,names.plate,id));
  NightBlocks.build(mesh,blocks,ground);
  const world=mesh.seal();Gfx.bakeShadows(world);Gfx.captureStreet(world);
  return {world,fixtures,fleet,filmCounter,floorAt,nearestRoad,signal,drawSignals,lit:lit.seal(),canister:canister.seal(),seal:seal.seal(),trafficCars,marker:marker.seal(),roads,blocks,targets,streets};
})();
