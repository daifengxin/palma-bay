'use strict';

// Recycle transparent quads; a landing event is consumed once even with multiple render passes.
class Footfalls {
  constructor(scene){
    this.scene=scene;this.clouds=[];this.prints=[];this.cloudCursor=0;this.printCursor=0;
    this.quad=new THREE.PlaneGeometry(1,1);
    this.dust=this.texture(false);this.tread=this.texture(true);
  }
  texture(foot){
    const c=document.createElement('canvas');c.width=64;c.height=96;
    const g=c.getContext('2d');
    if(foot){
      for(const [x,y,rx,ry,angle] of [[29,31,18,26,-.12],[36,58,10,13,.21],[34,76,13,13,.03]]){
        g.fillStyle='#d8c7ad';g.beginPath();g.ellipse(x,y,rx,ry,angle,0,Math.PI*2);g.fill();
      }
      g.globalCompositeOperation='destination-out';g.lineWidth=2.2;g.strokeStyle='#000a';
      for(let y=12;y<90;y+=8){g.beginPath();g.moveTo(8,y);g.lineTo(32,y+4);g.lineTo(52,y-2);g.stroke();}
    }else{
      const glow=g.createRadialGradient(32,48,0,32,48,32);
      glow.addColorStop(0,'rgba(255,255,255,.85)');glow.addColorStop(.45,'rgba(255,255,255,.48)');glow.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=glow;g.fillRect(0,0,64,96);
    }
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map;
  }
  acquire(foot){
    const pool=foot?this.prints:this.clouds,index=foot?this.printCursor++%40:this.cloudCursor++%40;
    if(!pool[index]){
      const m=new THREE.Mesh(this.quad,new THREE.MeshBasicMaterial({map:foot?this.tread:this.dust,transparent:true,depthWrite:false,
        polygonOffset:foot,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide}));
      m.renderOrder=foot?3:4;this.scene.add(m);pool[index]={mesh:m};
    }
    pool[index].mesh.visible=true;return pool[index];
  }
  emit(e,now){
    const sand=e.x>=Beach.shore(e.z)&&e.x<=-49&&Math.abs(e.y+.06)<.008;
    if(sand){
      const mark=this.acquire(true),m=mark.mesh;mark.start=now;mark.life=2.4;
      m.position.set(e.x+.026*Math.sin(e.yaw),e.y+.006,-e.z-.026*Math.cos(e.yaw));
      m.rotation.set(-Math.PI/2,0,-e.yaw);m.scale.set(e.side*.124,.272,1);m.material.color.set('#715942');
    }
    for(let i=0;i<3;i++){
      const puff=this.acquire(false),lateral=(i-1)*.18,back=.21+i*.11;
      Object.assign(puff,{start:now,life:.26+i*.075,x:e.x,y:e.y+.035,z:e.z,
        vx:lateral*Math.cos(e.yaw)-back*Math.sin(e.yaw),vz:-lateral*Math.sin(e.yaw)-back*Math.cos(e.yaw)});
      puff.mesh.material.color.set(sand?'#d9bd8b':'#a9957d');
    }
  }
  update(events,now,simulationTime,camera){
    for(const e of events)this.emit(e,now-(simulationTime-e.time));events.length=0;
    let visible=false;
    for(const pool of [this.prints,this.clouds])for(const p of pool){
      const m=p.mesh;if(!m.visible)continue;
      const age=now-p.start,t=age/p.life;
      if(t<0||t>=1){m.visible=false;continue;}
      visible=true;
      if(pool===this.prints)m.material.opacity=.30*(1-t*t);
      else{
        m.position.set(p.x+p.vx*age,p.y+age*.28,-p.z-p.vz*age);
        m.scale.setScalar(.062+t*.22);m.quaternion.copy(camera.quaternion);m.material.opacity=.26*(1-t)**2;
      }
    }
    return visible;
  }
  clear(){for(const pool of [this.prints,this.clouds])for(const p of pool)p.mesh.visible=false;}
}
