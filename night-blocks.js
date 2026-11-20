'use strict';
const NightBlocks=(()=>{
  // An entrance is the origin. Positive local Z points into the building.
  const locations=[
    ['sunmart','日落店',47,16,-1,'#ff819a'],['seamart','海堤店',-45,87,1,'#81f2d7'],
    ['dockmart','港区店',87,211,1,'#ffb86d'],['northmart','北湾店',-42,306,1,'#b5a2ff'],
    ['workshop','地下黑市车库',88,123,1,'#88f5df']
  ].map(([id,name,x,z,dir,tint],i)=>({id,name:i===4?name:'24h 便利店 · '+name,x,z,dir,tint,garage:i===4,index:i}));
  const shops=locations.slice(0,-1),garage=locations.at(-1);
  const sign=Gfx.label('24 / SEVEN','#183733','#ffefa1'),service=Gfx.label('UNDERGROUND','#212333','#83ffdd');
  const fresh=Gfx.label('PALMA   •   MARKET','#1b5348','#ffefc5');
  const chilled=Gfx.label('ICE COLD','#325a67','#cff9eb'),coffee=Gfx.label('CAFÉ   24','#734f41','#ffdaa0');
  const till=Gfx.label('CHECKOUT   /   CAJA','#314a43','#ffdc9f');
  const world=(v,x,z)=>({x:v.x+v.dir*x,z:v.z+v.dir*z});
  const local=(v,p)=>({x:(p.x-v.x)*v.dir,z:(p.z-v.z)*v.dir});
  const stamp=(m,x,y,z,w,h,uv,dir)=>m.quad([[x-dir*w/2,y,z],[x+dir*w/2,y,z],[x+dir*w/2,y+h,z],[x-dir*w/2,y+h,z]],'#ffffff',1,uv);
  function build(m,blocks,ground){
    for(const v of locations){
      const p=(x,z)=>world(v,x,z);
      const box=(x,y,z,w,h,d,col,kind=0,solid=false)=>{
        const at=p(x,z);m.material=kind||17;m.box(at.x,y,at.z,w,h,d,col);
        if(solid)blocks.push({...at,w,d});
      };
      const plaque=(z,y,w,h,uv)=>{m.material=6;const at=p(0,z);stamp(m,at.x,y,at.z,w,h,uv,v.dir);};
      const deck=p(0,3.4);m.material=0;ground(deck.x,deck.z,10,12,.016,'#c6bda6');
      if(v.garage){
        box(-4.3,0,3,.55,3.55,8.4,'#424852',9,true);box(4.3,0,3,.55,3.55,8.4,'#424852',9,true);
        box(0,3.4,3.3,9.2,.35,8.7,'#404354');box(0,0,7.2,8.5,3.5,.35,'#252b37',0,true);
        for(const side of [-1,1])box(side*3.85,.25,3,.11,.12,8,'#83ffe3',6);
        box(0,3.35,-1,9,.5,.19,'#202535');plaque(-1.12,3.41,7.6,.40,service);
      }else{
        for(const side of [-1,1]){
          box(side*4.5,0,4,.20,3.55,8.4,'#ccbaa5',9,true);
          box(side*2.93,0,0,3.16,.91,.19,'#395950',0,true);
          box(side*2.93,.91,0,3.16,1.35,.09,'#55837c',11);
          box(side*1.39,.88,0,.10,1.7,.19,'#dce1cb');
          box(side*3.80,.03,4.5,.90,.18,4.1,'#4c565b',0,true);
          box(side*4.22,.17,4.5,.09,1.68,4.1,'#6a817a');
          for(let row=0;row<3;row++){
            box(side*3.81,.26+row*.48,4.5,1.03,.07,4.3,'#e1dbbf');
            for(let j=0;j<12;j++)box(side*3.60,.33+row*.48,2.6+j*.34,.30,.23+(j%3)*.04,.23,['#df8668','#d8c677','#6daca9','#bd869b'][(row+j+v.index)%4]);
          }
        }
        box(0,0,8.15,9.14,3.58,.22,'#88a398',0,true);
        box(0,3.58,4,9.5,.23,8.9,'#b4b1a1');
        // Visible ceiling underside and warm practical strip lights.
        const pt=(x,y,z)=>{const a=p(x,z);return [a.x,y,a.z];};m.material=0;m.quad([pt(-4.4,3.57,0),pt(4.4,3.57,0),pt(4.4,3.57,8),pt(-4.4,3.57,8)],'#ddd9bd');
        for(const x of [-2.3,2.3])box(x,3.44,4,.18,.10,6.6,'#fffaca',6);
        box(0,2.44,-.07,9.5,1.05,.35,'#1c514a');plaque(-.255,2.54,6.25,.77,sign);
        box(0,3.49,-.23,9.65,.095,.15,v.tint,6);box(0,2.42,-.23,9.65,.07,.15,v.tint,6);
        box(0,.02,5.6,4.0,.95,.79,'#375a50',0,true);box(0,.98,5.6,4.16,.1,.93,'#e1d2af');
        box(.74,1.08,5.65,.56,.14,.40,'#333c41');box(.74,1.22,5.73,.47,.30,.1,'#576367');
        box(.74,1.25,5.665,.38,.19,.025,'#99e6c8',6);
        const poster=p(0,7.99);m.material=17;stamp(m,poster.x,2.69,poster.z,5.6,.62,fresh,v.dir);
        const colors=['#d67d53','#e5b54d','#5eaaa0','#dd8d9f','#97ac6d'];
        for(const side of [-1,1]){
          const cx=side*2.8;
          box(cx,.04,7.54,2.45,2.24,.80,'#324b50');
          box(cx,.29,7.10,2.21,1.68,.08,'#708483');
          for(let row=0;row<3;row++){
            box(cx,.33+row*.52,7.04,2.25,.055,.32,'#c8cfc1');
            for(let j=0;j<8;j++){const xx=cx+(j-3.5)*.255,h=.21+.035*(j%3),yy=.39+row*.52;
              box(xx,yy,7.03,.155,h,.18,colors[(j+row+v.index)%5]);
              box(xx,yy+h,7.03,.083,.06,.092,'#ddd8af');box(xx,yy+.085,6.93,.145,.056,.017,'#f6dfba');}
          }
          for(const dx of [-1.17,0,1.17])box(cx+dx,.19,6.89,.052,1.85,.073,'#c7cbbb');
          const at=p(cx,7.09);m.material=17;stamp(m,at.x,2.03,at.z,2.29,.27,side<0?chilled:coffee,v.dir);
        }
        const fascia=p(0,5.185);m.material=17;stamp(m,fascia.x,.50,fascia.z,2.22,.28,till,v.dir);
        for(const y of [.21,.28])box(0,y,5.192,3.89,.026,.022,'#edc485');
        m.material=18;const f=p(0,4);m.plane(f.x,f.z,8.8,8.0,.021,'#cfccc1');
        box(-1.15,2.38,7.87,.38,.31,.22,'#702e3c');
      }
    }m.material=0;
  }
  const mesh=(fn)=>{const m=new Gfx.Mesh();fn(m);return m.seal();};
  const glow=mesh(m=>{m.material=6;m.box(0,0,0,.38,.31,.23,'#ff344a');});
  const circle=mesh(m=>{m.material=6;for(let i=0;i<60;i++){const at=(r,j)=>[r*Math.cos(j*Math.PI/30),.046,r*Math.sin(j*Math.PI/30)];m.quad([at(2.73,i),at(2.85,i),at(2.85,i+1),at(2.73,i+1)],i%5?'#86ffdf':'#d6ffbc');}});
  const bag=mesh(m=>{m.material=17;for(let j=0;j<16;j++)for(let i=0;i<10;i++){
    const pt=(a,b)=>[.32*Math.sin(b*Math.PI/10)*Math.cos(a*Math.PI/8),.16-.16*Math.cos(b*Math.PI/10),.17*Math.sin(b*Math.PI/10)*Math.sin(a*Math.PI/8)];
    m.quad([pt(j,i),pt(j+1,i),pt(j+1,i+1),pt(j,i+1)],j%8===0?'#c38d53':'#526056');}m.box(0,.32,0,.20,.036,.04,'#37453b');});
  const weapons=[0,1,2].map(id=>mesh(m=>{
    const length=[.21,.36,.43][id],width=[.055,.083,.105][id];
    m.box(0,0,0,width,.068,length,id===2?'#677969':'#43505b');
    m.box(0,-.071,-length*.28,.041,.09,.055,'#3d4144');
    m.material=6;m.box(0,.055,.02,width*1.04,.008,length*.63,['#97ffe2','#ffd091','#ffa1c0'][id]);
  }));
  const spark=mesh(m=>{m.material=6;m.box(0,0,0,.07,.07,.09,'#ffde78');});
  const drone=mesh(m=>{m.box(0,0,0,.55,.24,.48,'#35424b');for(const s of [-1,1]){
    m.box(s*.42,.09,0,.65,.07,.08,'#a3ada8');m.material=6;m.box(s*.65,.15,0,.29,.04,.29,s<0?'#ff5268':'#6abfff');m.material=0;}});
  const bunker=mesh(m=>{
    m.material=18;m.plane(0,0,22,29,-.09,'#546263');
    for(const s of [-1,1]){m.box(s*9.5,0,0,.7,5,25,'#485153');m.box(0,0,s*12,19,5,.55,'#38494c');
      for(let j=-9;j<=9;j+=3){m.box(s*9.08,.2,j,.27,4.5,.40,'#728481');m.material=6;m.box(s*8.9,2.4,j,.12,.14,2.4,'#8cffe0');m.material=17;}
      m.box(s*1.7,0,0,.22,.12,6,'#bd9d62');}
    m.material=6;stamp(m,0,2,-11.69,8,.93,service,-1);m.material=0;
    m.material=17;
    m.quad([[-10,4.75,-12],[10,4.75,-12],[10,4.75,12],[-10,4.75,12]],'#536667');
    for(const s of [-1,1]){
      m.box(s*6,.05,-7.9,2.4,.93,.85,'#a65847');
      for(let k=0;k<5;k++)m.box(s*6,.17+.14*k,-7.44,2.15,.05,.04,'#e3ba81');
      for(let k=0;k<4;k++){m.box(s*7.1,.03,-5.8+k*2.5,.37,4.44,.45,'#738889');}
      m.material=6;m.box(s*3.5,4.54,0,.18,.09,14,'#c9fff0');m.material=17;
    }
    m.box(0,0,-11.53,6.3,3.1,.13,'#586669');
    for(let j=0;j<13;j++)m.box(0,.12+j*.23,-11.43,6.32,.035,.025,'#83928c');
    m.material=6;stamp(m,0,3.27,-11.50,4.7,.42,service,-1);
  });
  return {locations,shops,garage,world,local,build,glow,circle,bag,drone,bunker,weapons,spark};
})();
