'use strict';
const Beach=(()=>{
  const shore=z=>-96+2.8*Math.sin(z*.041)+1.4*Math.sin(z*.095);
  function build(m,blocks){
    for(let z=-180;z<500;z+=2){
      m.material=12;
      m.quad([[shore(z),-.06,z],[-49,-.06,z],[-49,-.06,z+2],[shore(z+2),-.06,z+2]],'#e4c899');
    }
    function lathe(x,z,rings,colors,n=32){
      for(let k=1;k<rings.length;k++)for(let j=0;j<n;j++){
        const pt=(i,l)=>[x+rings[l][1]*Math.cos(i*2*Math.PI/n),rings[l][0],z+rings[l][1]*Math.sin(i*2*Math.PI/n)];
        m.quad([pt(j,k-1),pt(j,k),pt(j+1,k),pt(j+1,k-1)],colors[(k-1)%colors.length]);
      }
    }
    m.material=0;
    // Lighthouse and lantern gallery.
    const x=-89,z=113;
    lathe(x,z,[[0,3],[.65,2.8],[4,2.1],[7.1,1.92],[11,1.62],[14,1.4],[14.4,2.1],[14.7,2.1]],['#a9967e','#f2dfc0','#bf5048','#f4e7cd','#b74d43','#e5d6bc','#524c48']);
    lathe(x,z,[[14.7,1.28],[16.4,1.28],[16.5,1.65],[17.7,.12],[18,0]],['#b7d6ce','#584f47','#ad594a','#c09d71']);
    for(let j=0;j<16;j++){let a=j*Math.PI/8;m.box(x+1.96*Math.cos(a),14.65,z+1.96*Math.sin(a),.065,.84,.065,'#5f5652');}
    lathe(x,z,[[15.42,1.98],[15.49,1.98]],['#574d49']);
    blocks.push({x,z,w:4.9,d:4.9});
    // Flags, net, and painted lines of the beach court.
    for(const side of [-1,1]){
      m.plane(-66+4.5*side,57,.09,16,-.034,'#f9f3d8');m.plane(-66,57+8*side,9,.09,-.034,'#fff3d4');
      m.box(-66+4.95*side,-.05,57,.13,2.55,.13,'#dc8968');
      m.box(-66+4.95*side,.24,57,.23,1.62,.23,'#5c9d99');
    }
    for(let i=0;i<=45;i++)m.box(-70.5+i*.20,1.34,57,.017,.90,.018,'#635d59');
    for(let i=0;i<6;i++)m.box(-66,1.34+i*.18,57,9,.019,.02,'#69675c');
    m.box(-66,2.24,57,9.85,.09,.055,'#f7ecce');
    // Lifeguard station on piles with open deck, glazing and corrugated roof.
    for(const dx of [-2.1,2.1])for(const dz of [-1.45,1.45])m.box(-78+dx,0,80+dz,.23,2.32,.23,'#96795e');
    m.box(-78,2.16,80,6.7,.20,4.9,'#b99c77');
    m.box(-78,2.36,80.5,4.6,1.15,2.95,'#df8770');
    m.material=2;m.box(-78,3.51,80.5,4.55,.94,2.9,'#738786');m.material=0;
    for(const dx of [-2.26,-1.15,0,1.15,2.26])m.box(-78+dx,3.5,79.03,.08,1.02,.08,'#ffdfad');
    m.box(-78,4.45,80.35,5.8,.18,4.05,'#d68a73');
    for(let i=0;i<10;i++)m.box(-75.4,2.15-i*.22,78-i*.28,1.15,.13,.31,'#bda88d');
    blocks.push({x:-78,z:80.5,w:4.6,d:2.9});
    // Dinghies and striped lateen sails offshore, visible against the moving water.
    for(const [bx,bz,h,col] of [[-124,38,8,'#db9575'],[-154,97,12,'#debf88'],[-131,164,9,'#b68778']]){
      lathe(bx,bz,[[-.26,.68],[.30,1.48],[.44,1.34]],['#65564e','#e6c498'],18);
      m.box(bx,.22,bz,.08,h,.08,'#9c846e');
      m.quad([[bx,h,bz],[bx,.79,bz],[bx-3.9,.88,bz+.65],[bx-2.7,2.2,bz+.58]],'#eee1be');
      m.quad([[bx+.12,h*.84,bz],[bx+.12,1.12,bz],[bx+2.5,1.18,bz-.53],[bx+1.4,3.1,bz-.35]],col);
    }
    for(let i=0;i<18;i++){const bx=-83+(i%3)*4.7,bz=9+i*7.2;
      if(Math.abs(bz-57)<10||Math.abs(bz-80)<8)continue;
      m.plane(bx,bz,.95,1.85,-.032,i%2?'#a7bec1':'#ce8f78');
      for(const d of [-.71,.71])m.plane(bx,bz+d,.95,.09,-.024,'#eadbc0');
    }
  }
  const ball=new Gfx.Mesh();
  for(let i=0;i<18;i++)for(let j=0;j<10;j++){
    function p(a,b){const u=a*Math.PI/9,v=b*Math.PI/10;return [.19*Math.sin(v)*Math.cos(u),.19*Math.cos(v),.19*Math.sin(v)*Math.sin(u)];}
    ball.quad([p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)],['#f2ddb7','#c77c51','#4a9698'][Math.floor((i+(j>4?2:0))/3)%3]);
  }
  ball.seal();
  return {shore,build,ball};
})();
