'use strict';

// Horizontal velocities and foot anchors live in game world metres. Rig space faces +Z.
class Locomotion {
  static baseFov=2*Math.atan(1/1.55);
  static tau=2*Math.PI;

  constructor(){
    this.feet=[-1,1].map(side=>({side,anchor:new THREE.Vector3(),sole:new THREE.Vector3(),stopFrom:new THREE.Vector3(),yaw:0,contact:false}));
    this.weights={idle:1,walk:0,sprint:0,jump:0};
    this.contacts=[];
    this.ik={target:new THREE.Vector3(),axis:new THREE.Vector3(),pole:new THREE.Vector3(),
      thigh:new THREE.Vector3(),calf:new THREE.Vector3(),rest:new THREE.Vector3(),
      upper:new THREE.Quaternion(),lower:new THREE.Quaternion(),rotation:new THREE.Quaternion(),soleRotation:new THREE.Euler(0,0,0,'YXZ')};
    this.reset();
  }
  reset(){
    this.vx=this.vz=this.currentSpeed=this.bank=this.walkCycle=this.time=0;this.duty=.48;
    this.wasAir=false;this.settling=-1;this.ready=false;this.contacts.length=0;
    Object.assign(this.weights,{idle:1,walk:0,sprint:0,jump:0});
    for(const f of this.feet){f.contact=false;f.hasAnchor=false;}
  }
  // Exact integral of an exponentially damped velocity. 95% of an input step in 150 ms.
  move(p,dt,desiredX,desiredZ,clear){
    const rate=20,decay=Math.exp(-rate*dt),integral=(1-decay)/rate;
    const dx=desiredX*dt+(this.vx-desiredX)*integral,dz=desiredZ*dt+(this.vz-desiredZ)*integral;
    this.vx=desiredX+(this.vx-desiredX)*decay;this.vz=desiredZ+(this.vz-desiredZ)*decay;
    const oldX=p.x,oldZ=p.z;
    if(clear(p.x+dx,p.z))p.x+=dx;else this.vx=0;
    if(clear(p.x,p.z+dz))p.z+=dz;else this.vz=0;
    const mx=p.x-oldX,mz=p.z-oldZ;
    this.currentSpeed=Math.hypot(mx,mz)/dt;
    let yawStep=0;
    if(this.currentSpeed>.035){
      yawStep=turn(p.yaw,Math.atan2(mx,mz))*(-Math.expm1(-13*dt));
      p.yaw+=yawStep;
    }
    const lean=clamp(yawStep/dt*this.currentSpeed*.018,-.20,.20);
    this.bank+=(lean-this.bank)*(-Math.expm1(-11*dt));
    return {oldX,oldZ,dx:mx,dz:mz};
  }
  step(p,dt,travel,swimming){
    const {dx,dz,oldX,oldZ}=travel,speed=this.currentSpeed,air=p.height>.001||p.vertical>0;
    const moving=THREE.MathUtils.smoothstep(speed,.025,.75);
    const running=THREE.MathUtils.smoothstep(speed,2.52,5.45);
    const w=this.weights,blend=-Math.expm1(-17*dt),ground=air?0:1;
    w.walk+=(ground*moving*(1-running)-w.walk)*blend;
    w.sprint+=(ground*moving*running-w.sprint)*blend;
    w.jump+=((air?1:0)-w.jump)*blend;w.idle=1-w.walk-w.sprint-w.jump;
    this.time+=dt;
    const strideFactor=4.15+(2.48-4.15)*running;
    const prev=this.walkCycle;
    this.walkCycle+=speed*dt*strideFactor;
    const phase=this.walkCycle,amplitude=w.walk+w.sprint;
    this.pelvisY=.91-.105*w.walk-.148*w.sprint-.065*w.jump+
      Math.abs(Math.sin(phase))*(.037*w.walk+.083*w.sprint);
    this.sway=.008*w.idle*Math.sin(this.time*.79)+.019*amplitude*Math.cos(phase);
    if(swimming){this.ready=false;this.wasAir=air;return;}
    const duty=this.duty=.48-.226*running,span=Locomotion.tau/strideFactor,lead=span*duty*.5;
    const sn=Math.sin(p.yaw),cs=Math.cos(p.yaw);
    const tx=speed>.02?dx/(speed*dt):sn,tz=speed>.02?dz/(speed*dt):cs;
    if(!this.ready){
      for(const f of this.feet){
        f.sole.set(p.x+cs*f.side*.106,0,p.z-sn*f.side*.106);
        f.sole.y=Town.floorAt(f.sole.x,f.sole.z);f.anchor.copy(f.sole);f.yaw=p.yaw;f.footYaw=p.yaw;f.hasAnchor=false;
      }
      this.ready=true;
    }
    const stopping=speed<.08&&!air;
    if(stopping&&this.settling<0){
      this.settling=0;
      const [left,right]=this.feet;
      const support=left.contact!==right.contact?(left.contact?left:right):(left.sole.y<=right.sole.y?left:right);
      for(const f of this.feet){f.stopFrom.copy(f.sole);f.stopYaw=f.footYaw;f.stopDelay=f===support?.17:0;}
    }
    if(stopping)this.settling+=dt;else this.settling=-1;
    for(const f of this.feet){
      const offset=f.side<0?0:Math.PI,u=((phase+offset)/Locomotion.tau)%1;
      const crossed=Math.floor((prev+offset)/Locomotion.tau)!==Math.floor((phase+offset)/Locomotion.tau);
      const stance=u<duty&&!air,wasPlanted=f.contact;
      const neutralX=p.x+f.side*.106*cs,neutralZ=p.z-f.side*.106*sn;
      if(stopping){
        // Finish the trailing step, then recover the support foot. Each moves on a short lifted arc.
        const t=clamp((this.settling-f.stopDelay)/.17,0,1),smooth=t*t*(3-2*t);
        f.sole.set(THREE.MathUtils.lerp(f.stopFrom.x,neutralX,smooth),0,THREE.MathUtils.lerp(f.stopFrom.z,neutralZ,smooth));
        const length=Math.hypot(f.stopFrom.x-neutralX,f.stopFrom.z-neutralZ);
        const floor=Town.floorAt(f.sole.x,f.sole.z);
        const recovery=f.stopDelay?Math.max(smooth,THREE.MathUtils.smoothstep(this.settling,0,.08)):smooth;
        f.sole.y=THREE.MathUtils.lerp(f.stopFrom.y,floor,recovery)+Math.min(.064,length*.30)*Math.sin(t*Math.PI);
        f.footYaw=f.stopYaw+turn(f.stopYaw,p.yaw)*smooth;
        f.anchor.copy(f.sole);f.yaw=f.footYaw;f.contact=t===1||(t===0&&wasPlanted);f.hasAnchor=false;f.swing=0;f.toePitch=0;continue;
      }
      if(crossed||this.wasAir&&!air&&stance){
        // Interpolate the strike within the physics substep rather than planting at the end of the frame.
        const at=crossed?clamp(1-u*Locomotion.tau/(phase-prev),0,1):1;
        f.anchor.set(oldX+dx*at+f.side*.106*cs+tx*lead,0,oldZ+dz*at-f.side*.106*sn+tz*lead);
        f.anchor.y=Town.floorAt(f.anchor.x,f.anchor.z);f.yaw=p.yaw;f.hasAnchor=true;
        if(!air&&w.sprint>.42){
          this.contacts.push({x:f.anchor.x,y:f.anchor.y,z:f.anchor.z,yaw:f.yaw,side:f.side,time:this.time});
          if(this.contacts.length>8)this.contacts.shift();
        }
      }else if(!f.hasAnchor){f.anchor.copy(f.sole);f.yaw=f.footYaw;f.hasAnchor=true;}
      f.contact=stance;
      if(stance){f.sole.copy(f.anchor);f.footYaw=f.yaw;f.toePitch=0;}
      else{
        const t=clamp((u-duty)/(1-duty),0,1),ease=t*t*(3-2*t);
        const distance=(1-u)*span+lead;
        f.sole.set(THREE.MathUtils.lerp(f.anchor.x,neutralX+tx*distance,ease),0,THREE.MathUtils.lerp(f.anchor.z,neutralZ+tz*distance,ease));
        const lift=Math.sin(Math.PI*t);
        f.toePitch=lift*(.17*w.walk+.52*w.sprint)*Math.sin(Locomotion.tau*t);
        f.sole.y=THREE.MathUtils.lerp(f.anchor.y,Town.floorAt(f.sole.x,f.sole.z),ease)+lift*(1+.24*Math.cos(Math.PI*t))*(.105*w.walk+.34*w.sprint);
        f.footYaw=f.yaw+turn(f.yaw,p.yaw)*ease;
      }
      f.swing=u>duty?Math.sin(Math.PI*(u-duty)/(1-duty)):0;
    }
    this.wasAir=air;
  }
  pose(actor,p,carry,reach){
    const b=actor.nodes,w=this.weights,phase=this.walkCycle,time=this.time;
    const stride=w.walk+w.sprint,breath=Math.sin(time*1.54),sn=Math.sin(p.yaw),cs=Math.cos(p.yaw);
    // Keep both soles reachable at road edges and during sudden changes of heading.
    const rootY=actor.root.position.y;
    let hips=this.pelvisY;
    for(const f of this.feet)if(f.contact){
      const dx=f.sole.x-p.x,dz=f.sole.z-p.z;
      const x=dx*cs-dz*sn-this.sway-f.side*.099,z=dx*sn+dz*cs+.012;
      hips=Math.min(hips,f.sole.y+.105-rootY+Math.sqrt(Math.max(.32,.802**2-x*x-z*z)));
    }
    b.pelvis.position.set(this.sway,hips,-.012);b.pelvis.rotation.set(0,0,0);
    b.chest.scale.set(1+.011*breath*w.idle,1+.004*breath*w.idle,1+.027*breath*w.idle);
    b.chest.rotation.set(.055*w.walk+.305*w.sprint+.13*w.jump-.014*breath*w.idle,
      -.115*Math.cos(phase)*stride,-this.bank-.025*stride*Math.cos(phase));
    b.head.rotation.set(-.12*w.sprint+.009*breath,.035*w.idle*Math.sin(time*.64),this.bank*.35);
    for(const f of this.feet){
      const k=f.side<0?'L':'R',angle=phase+(f.side<0?0:Math.PI)-Math.PI*this.duty;
      const swing=Math.sin(angle),lag=Math.max(0,Math.sin(angle-.8));
      const thigh=swing*(.39*w.walk+.83*w.sprint)+w.jump*(f.side<0?-.85:.22);
      const knee=.045*w.idle+.13*w.walk+.21*w.sprint+lag*(.61*w.walk+1.24*w.sprint)+w.jump*(f.side<0?1.04:.82);
      const foot=-.36*lag*stride-.21*w.jump;
      const hip=b['hip'+k],shin=b['knee'+k],ankle=b['ankle'+k];
      hip.rotation.set(thigh,0,0);shin.rotation.set(knee,0,0);ankle.rotation.set(foot,0,0);
      b['shoulder'+k].rotation.set((-swing*(.42*w.walk+.96*w.sprint)-.30*w.jump)*(1-carry)-.34*carry-.92*reach+.021*breath*w.idle,0,f.side*(.055+.045*w.sprint));
      b['elbow'+k].rotation.set(-.16-.24*w.walk-.98*w.sprint-.53*w.jump-.72*carry-.12*swing*stride,0,0);
      b['wrist'+k].rotation.set(.11+.06*Math.sin(time*1.25+f.side)*w.idle+.08*swing*stride,.045*f.side,.045*f.side);
      const dx=f.sole.x-p.x,dz=f.sole.z-p.z;
      const target=this.ik.target.set(dx*cs-dz*sn-this.sway-hip.position.x,
        f.sole.y+.105-rootY-hips,dx*sn+dz*cs+.012);
      // FK supplies the swinging arcs; stance has full two-bone IK and a world-fixed shoe orientation.
      const pin=(1-w.jump)*(1-(f.contact||this.settling>=0?0:.32*(f.swing||0)**2));
      this.solveLeg(hip,shin,ankle,target,turn(p.yaw,f.footYaw),f.toePitch||0,pin);
    }
  }
  solveLeg(hip,knee,ankle,target,yaw,toePitch,pin){
    const upper=knee.position,lower=ankle.position,l1=upper.length(),l2=lower.length(),ik=this.ik;
    const length=clamp(target.length(),.09,l1+l2-.003),axis=ik.axis.copy(target).normalize();
    const along=(length*length+l1*l1-l2*l2)/(2*length);
    const pole=ik.pole.set(0,0,1).addScaledVector(axis,-axis.z).normalize();
    const thigh=ik.thigh.copy(axis).multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const calf=ik.calf.copy(axis).multiplyScalar(length).sub(thigh);
    const q1=ik.upper.setFromUnitVectors(ik.rest.copy(upper).normalize(),thigh.normalize());
    const q2=ik.lower.setFromUnitVectors(ik.rest.copy(lower).normalize(),calf.normalize());
    hip.quaternion.slerp(q1,pin);
    knee.quaternion.slerp(q1.invert().multiply(q2),pin);
    ik.rotation.setFromEuler(ik.soleRotation.set(toePitch,yaw,0,'YXZ'));
    ankle.quaternion.slerp(q2.invert().multiply(ik.rotation),pin);
  }
}
