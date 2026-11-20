'use strict';
const HeroCar=(()=>{
  // Car Concept surface IDs in the source glTF; paint, glazing and lamps use the town lighting.
  const surfaces=[
    ['#42464a',0],['#364955',2],['#292b2d',0],['#3c3738',0],['#29282a',0],['#889497',3],
    ['#a0694d',0],['#3e3f40',0],['#252b31',0],['#d6ccae',0],['#a13b32',1],['#ce4d35',1],
    ['#ffb060',6],['#ff4339',6],['#fff3da',6],['#ece6dd',3],['#ad5637',1],['#98968e',3],
    ['#2a2b2d',0],['#28292a',0],['#545759',3],['#babcb6',3]
  ];
  const parts=new Map();
  for(const data of conceptGeometry){
    if(!parts.has(data.part))parts.set(data.part,{mesh:new Gfx.Mesh(),pivot:data.pivot});
    const mesh=parts.get(data.part).mesh,[hex,kind]=surfaces[data.material]||surfaces[0];
    const col=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    for(const index of data.indices){
      const a=data.vertices,i=index*6;
      mesh.vertices.push(a[i]/1000,a[i+1]/1000,a[i+2]/1000,...col,.99,.99,a[i+3]/100,a[i+4]/100,a[i+5]/100,kind);
    }
  }
  for(const part of parts.values())part.mesh.seal();
  conceptGeometry.length=0;
  const shadow=new Gfx.Mesh();
  for(let j=0;j<32;j++){
    const edge=t=>[1.10*Math.cos(t),.055,2.32*Math.sin(t)],center=[0,.055,0];
    shadow.quad([center,edge(j*Math.PI/16),edge((j+1)*Math.PI/16),center],'#353438');
  }
  shadow.seal();
  function draw(car,opening){
    const {x,z,yaw}=car,cs=Math.cos(yaw),sn=Math.sin(yaw);
    Gfx.draw(shadow,x,0,z,yaw);
    for(const [name,{mesh,pivot:[dx,dy,dz]}] of parts){
      const wheel=name.startsWith('front')||name.startsWith('rear');
      const twist=name==='door'?opening*1.05:name.startsWith('front')?(car.steering||0)*.38:0;
      const corner=(dz>0?0:2)+(dx>0?1:0);
      const ride=wheel&&!car.crash?(car.springs?.[corner]?.road||0):(car.lift||0);
      Gfx.draw(mesh,x+dx*cs+dz*sn,dy+ride,z-dx*sn+dz*cs,yaw+twist,wheel?(car.roll||0):(car.pitch||0),wheel?0:(car.bank||0));
    }
  }
  return {draw};
})();
