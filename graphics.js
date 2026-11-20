'use strict';
const Gfx = (() => {
  const gl = document.querySelector('#scene').getContext('webgl',{antialias:true,alpha:false});
  if (!gl) { document.querySelector('#error').hidden=false; throw Error('WebGL unavailable'); }
  const cityTextures=[];
  function withCharacterContext(render){
    render(gl);
    // Three owns its binding cache. Restore the city's persistent samplers and raster state explicitly.
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.colorMask(true,true,true,true);
    cityTextures.forEach((tex,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);});
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.activeTexture(gl.TEXTURE0);gl.useProgram(meshProgram);
  }
  function shader(kind,source) {
    const s=gl.createShader(kind); gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs,fs) {
    const p=gl.createProgram(); gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));
    gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    return p;
  }
  const atmosphere=`
    float hash(vec2 p){p=fract(p*vec2(.1031,.11369));p+=dot(p,p.yx+19.19);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    uniform vec4 climate;
    uniform vec3 sun;
    uniform float overcast;
    float daylight(){return smoothstep(-.23,.26,climate.x);}
    vec3 haze(){return mix(vec3(.065,.073,.135),mix(vec3(.72,.83,.86),vec3(.99,.49,.45),climate.y),daylight());}
    vec3 horizon(vec3 ray){
      float h=max(ray.y,0.);float glow=max(dot(ray,sun),0.);
      vec3 high=mix(vec3(.040,.073,.15),mix(vec3(.22,.47,.72),vec3(.45,.25,.55),climate.y),daylight());
      vec3 sky=mix(haze(),high,smoothstep(.0,.59,h));
      sky+=vec3(.50,.18,.075)*pow(glow,12.)*climate.y;
      sky=mix(sky,vec3(dot(sky,vec3(.3,.55,.15)))*vec3(.88,.99,1.12),overcast*.58);
      return sky;
    }`;
  // Orthographic sun atlas covers the playable peninsula in one static pass.
  const sunProjection=`
    vec3 shadowCoord(vec3 p){
      vec3 q=p-vec3(35.,10.,172.);
      return vec3(dot(q,vec3(.849,0.,.529))/410.+.5,
        dot(q,vec3(.239,.892,-.384))/330.+.5,
        .5-dot(q,vec3(-.472,.452,.756))/600.);
    }`;
  const meshProgram=program(`
    attribute vec3 pos,col,norm;attribute vec2 uv;attribute float material;
    varying vec3 tone,world,N,local;varying vec2 tex;varying float depth,mat;
    uniform vec3 eye,origin;uniform vec2 facing,tilt,rotation,pitchRotation;uniform float aspect,lens,bank;
    vec3 rotate(vec3 p){return vec3(rotation.y*p.x+rotation.x*p.z,p.y,-rotation.x*p.x+rotation.y*p.z);}
    void main(){
      vec3 p=pos,n=norm;
      p.yz=mat2(pitchRotation.y,pitchRotation.x,-pitchRotation.x,pitchRotation.y)*p.yz;
      n.yz=mat2(pitchRotation.y,pitchRotation.x,-pitchRotation.x,pitchRotation.y)*n.yz;
      mat2 lean=mat2(cos(bank),sin(bank),-sin(bank),cos(bank));p.xy=lean*p.xy;n.xy=lean*n.xy;
      world=rotate(p)+origin;N=rotate(n);mat=material;local=pos;
      vec3 d=world-eye;float side=dot(d.xz,vec2(facing.y,-facing.x)),along=dot(d.xz,facing);
      float z=along*tilt.y-d.y*tilt.x,up=d.y*tilt.y+along*tilt.x;
      gl_Position=vec4(side*lens/aspect,up*lens,z*1.00064-.55,z);
      tone=col;tex=uv;depth=z;
    }`,`precision highp float;varying vec3 tone,world,N,local;varying vec2 tex;varying float depth,mat;
      uniform vec3 paintColor;uniform vec3 eye;uniform sampler2D ink,shadowAtlas,streetEnv,roadPhoto,brickPhoto;uniform vec2 photoReady;uniform float useEnv,seaTime;
      vec3 panorama(vec3 r,vec3 fallback){
        if(useEnv<.5)return fallback;
        float face,s,dist=max(abs(r.x),abs(r.z));
        if(abs(r.z)>abs(r.x)){face=r.z>0.?0.:2.;s=r.z>0.?r.x:-r.x;}
        else{face=r.x>0.?1.:3.;s=r.x>0.?-r.z:r.z;}
        vec2 tile=clamp(vec2(s,r.y)/max(dist,.01)*.5+.5,.002,.998);
        vec3 capture=texture2D(streetEnv,vec2((face+tile.x)/4.,tile.y)).rgb;
        return mix(capture,fallback,smoothstep(.75,1.05,abs(r.y)/max(.01,dist)));
      }`+atmosphere+sunProjection+`
      void main(){
        if(mat>15.5&&mat<16.5){
          float r=length(local.xz/vec2(1.38,2.72));
          gl_FragColor=vec4(.075,.065,.082,.53*(1.-smoothstep(.49,1.,r)));return;
        }
        vec3 V=normalize(eye-world),n=normalize(N);if(dot(n,V)<0.)n=-n;
        vec3 r=reflect(-V,n);float light=max(dot(n,sun),0.);
        vec3 base=tone*texture2D(ink,tex).rgb;
        if(mat>.5&&mat<1.5&&paintColor.x>0.)base=paintColor*(.65+.50*max(tone.r,max(tone.g,tone.b)));
        vec3 c=base*(vec3(.58,.64,.74)+vec3(.56,.41,.27)*light);
        if(mat>.5&&mat<3.5){
          float city= .07+.19*hash(vec2(floor(atan(r.z,r.x)*20.),.5));
          vec3 env=mix(vec3(.075,.125,.16),horizon(r),smoothstep(city-.045,city+.02,r.y));
          env=panorama(r,env);float fres=pow(1.-max(dot(n,V),0.),3.);
          if(mat<1.5)c=mix(c,env,.15+.57*fres)+vec3(.32,.2,.09)*pow(max(dot(r,sun),0.),38.);
          else if(mat<2.5)c=mix(c*.42,env,.67+.30*fres);
          else c=mix(base*.38,env,.76)+.14;
        }else if(mat>3.5&&mat<4.5){
          vec3 aggregate=texture2D(roadPhoto,world.xz*.25).rgb;
          c*=mix(vec3(1.),aggregate*1.9,photoReady.x);
          float grain=noise(world.xz*37.)*.7+noise(world.xz*4.)*.3;
          c*=.83+.26*grain;float wet=smoothstep(.53,.76,noise(world.xz*vec2(.21,.09)));
          c+=wet*(.045+.19*pow(max(dot(r,sun),0.),5.))*vec3(1.,.74,.52);
        }else if(mat>4.5&&mat<5.5&&abs(n.y)<.5){
          vec2 w=vec2(abs(n.x)>.5?world.z:world.x,world.y)/vec2(2.75,3.05);
          vec2 f=fract(w);float window=step(.10,f.x)*step(f.x,.91)*step(.15,f.y)*step(f.y,.88);
          vec3 glass=mix(vec3(.15,.27,.32),horizon(r)*.77,clamp(.30+r.y,0.,.9));
          if(hash(floor(w))>.83)glass=mix(glass,vec3(.96,.71,.43),.66);
          c=mix(c,glass*(.82+.20*noise(floor(w))),window);
        }else if(mat>5.5&&mat<6.5)c=base*(1.06+.12*base);
        else if(mat>6.5&&mat<7.5){
          float shore=-96.+2.8*sin(world.z*.041)+1.4*sin(world.z*.095);
          float offshore=max(0.,shore-world.x);
          float ripple=noise(world.xz*vec2(.54,1.7)+vec2(-seaTime*.65,seaTime*.12));
          float wave=sin(offshore*2.6+seaTime*2.1+ripple*2.8);
          vec3 water=mix(vec3(.22,.65,.61),vec3(.06,.31,.38),smoothstep(0.,24.,offshore));
          c=mix(water,horizon(r),.17+.18*ripple)+vec3(.85,.56,.31)*smoothstep(.72,.94,ripple)*pow(max(dot(r,sun),0.),4.);
          c=mix(c,vec3(.91,.91,.77),smoothstep(.52,.98,wave)*(1.-smoothstep(0.,4.3,offshore))*.85);
        }else if(mat>11.5&&mat<12.5){
          float shore=-96.+2.8*sin(world.z*.041)+1.4*sin(world.z*.095);
          float dry=smoothstep(0.,7.,world.x-shore);
          float ridges=sin(world.x*5.2+sin(world.z*.7)*1.8+noise(world.xz*.43)*4.);
          c*=mix(vec3(.66,.71,.71),vec3(1.05,1.02,.98),dry)*(.90+.075*noise(world.xz*18.)+.045*ridges+.07*noise(world.xz*.28));
        }
        if(mat>10.5&&mat<11.5){
          float horiz=abs(n.x)>.5?world.z:world.x;
          float view=abs(n.x)>.5?V.z:V.x;
          vec2 u=vec2(horiz+.45*view,world.y)/vec2(1.45,1.85);
          float pane=hash(vec2(floor(horiz/2.8),floor(world.y/3.)));
          vec3 room=mix(vec3(.12,.145,.16),vec3(.50,.35,.24),pane);
          float blind=smoothstep(.68,.81,fract(u.y*12.))*step(.37,fract(u.y));
          room=mix(room,vec3(.53,.45,.38),.5*blind);
          float shelf=step(.86,fract(u.y*3.));room*=1.-.38*shelf;
          vec2 display=fract(u*vec2(8.,3.));
          room+=vec3(.19,.125,.06)*step(.17,display.x)*step(display.x,.81)*step(.55,display.y)*step(display.y,.86);
          c=mix(room,panorama(r,horizon(r)),.19+.40*pow(1.-max(dot(n,V),0.),2.));
        }else if(mat>7.5&&mat<8.5){
          vec2 uv=world.xz/vec2(1.6,1.22);uv.x+=.5*mod(floor(uv.y),2.);
          vec2 f=min(fract(uv),1.-fract(uv));float seam=smoothstep(.003,.024,min(f.x,f.y));
          c*=mix(.58,1.,seam)*(.83+.17*hash(floor(uv))+.09*noise(world.xz*27.));
        }else if(mat>8.5&&mat<9.5){
          vec2 u=vec2(abs(n.x)>.5?world.z:world.x,world.y);
          c*=(.94+.07*noise(u*21.))*(.88+.15*noise(u*vec2(1.8,.24)));
          c*=.72+.28*smoothstep(.08,.85,world.y);
        }else if(mat>9.5&&mat<10.5){
          vec2 u=vec2(abs(n.x)>.5?world.z:world.x,world.y);
          vec2 grid=u/vec2(.43,.145);grid.x+=mod(floor(grid.y),2.)*.5;
          vec2 edge=min(fract(grid),1.-fract(grid));
          vec3 mortar=mix(c*.66,c*(.76+.30*hash(floor(grid))+.12*noise(u*44.)),smoothstep(.018,.085,min(edge.x,edge.y)));
          c=mix(mortar,c*texture2D(brickPhoto,u*vec2(.66,-.66)).rgb*1.69,photoReady.y);
        }
        vec3 q=shadowCoord(world);float shade=0.;
        if((mat<5.5||mat>7.5) && all(greaterThan(q.xy,vec2(0.))) && all(lessThan(q.xy,vec2(1.)))){
          for(int i=0;i<4;i++){vec2 offset=vec2(float(i-2*(i/2)),float(i/2))-.5;
            vec2 packedDepth=texture2D(shadowAtlas,q.xy+offset/2048.).rg;
            shade+=.25*step(dot(packedDepth,vec2(1.,1./255.))+.0012,q.z);}
        }
        c*=mix(vec3(1.),vec3(.67,.70,.77),shade);
        float night=1.-daylight();
        float lit=step(5.5,mat)*(1.-step(6.5,mat));
        c*=mix(vec3(1.),vec3(.25,.30,.45),night*(1.-lit));
        c+=lit*base*night*.66;
        if(mat>16.5){
          float ceilingLight=.69+.25*max(0.,dot(n,normalize(vec3(.31,.84,-.42))));
          c=base*ceilingLight*(.94+.05*noise(world.xz*4.));
          if(mat>17.5){vec2 edge=abs(fract(world.xz*.86)-.5);c*=1.-.22*smoothstep(.477,.498,max(edge.x,edge.y));}
        }
        if(mat>4.5&&mat<5.5&&abs(n.y)<.5){
          vec2 w=vec2(abs(n.x)>.5?world.z:world.x,world.y)/vec2(2.75,3.05);
          vec2 f=fract(w);float pane=step(.14,f.x)*step(f.x,.87)*step(.19,f.y)*step(f.y,.83);
          c+=vec3(.81,.55,.31)*night*step(.63,hash(floor(w)))*pane;
        }
        if(mat>3.5&&mat<4.5){
          float streetX=(world.z>22.&&world.z<150.&&world.x>32.)?world.x-53.:world.x;
          float pool=exp(-abs(abs(streetX)-5.8)*.45)*exp(-abs(mod(world.z+5.,18.)-9.)*.19);
          c+=vec3(.48,.31,.17)*pool*night;
          float wet=climate.w*(.35+.65*noise(world.xz*.86));
          vec3 env=panorama(r,horizon(r))*mix(vec3(1.),vec3(.35,.30,.52),night);
          float streak=pow(max(0.,1.-abs(sin(world.z*.42+noise(world.xz*2.)*.40))),4.);
          env+=night*streak*mix(vec3(.94,.25,.54),vec3(.18,.87,.77),smoothstep(-1.,1.,streetX))*exp(-abs(abs(streetX)-4.8)*.32);
          c=mix(c*.98,env,wet*(.23+.63*pow(1.-max(0.,dot(n,V)),2.)));
        }
        gl_FragColor=vec4(mix(c,haze(),smoothstep(78.,490.,depth)*(.72+.20*climate.z)),1.);
      }`);
  const skyProgram=program(`attribute vec2 vertex;varying vec2 screen;void main(){screen=vertex;gl_Position=vec4(vertex,0,1);}`,
    `precision highp float;varying vec2 screen;uniform vec2 facing,tilt;uniform float aspect,lens;`+atmosphere+`
    void main(){float up=screen.y/lens,fwd=tilt.y+up*tilt.x;
      vec3 ray=normalize(vec3(facing.x*fwd+facing.y*screen.x*aspect/lens,up*tilt.y-tilt.x,facing.y*fwd-facing.x*screen.x*aspect/lens));
      vec3 sky=horizon(ray);vec2 p=ray.xz/(max(.0,ray.y)+.19);
      float cloud=noise(p*2.3)*.55+noise(p*5.7)*.29+noise(p*13.8)*.16;
      vec3 clouds=mix(vec3(.05,.069,.11),mix(vec3(.52,.58,.67),vec3(.92,.78,.81),cloud),daylight());
      sky=mix(sky,clouds,smoothstep(.53-overcast*.22,.76-overcast*.12,cloud)*.76*smoothstep(.0,.08,ray.y));
      sky+=vec3(.48,.54,.61)*step(.994,hash(floor(ray.xz/(.25+max(ray.y,0.))*450.)))*smoothstep(.02,.24,ray.y)*pow(1.-daylight(),4.)*(1.-overcast);
      float dist=length(ray-sun);sky+=vec3(.40,.22,.07)*exp(-20.*dist);
      sky=mix(sky,vec3(1.,.89,.65),(1.-smoothstep(.028,.031,dist))*smoothstep(-.01,.06,sun.y)*(1.-overcast*.9));gl_FragColor=vec4(sky,1.);}`);
  const loc=(p,n)=>gl.getUniformLocation(p,n);
  const uniforms=Object.fromEntries(['eye','origin','facing','tilt','rotation','aspect','pitchRotation','lens','useEnv','seaTime','sun','climate','overcast','bank','paintColor'].map(n=>[n,loc(meshProgram,n)]));
  const skyU=Object.fromEntries(['facing','tilt','aspect','lens','sun','climate','overcast'].map(n=>[n,loc(skyProgram,n)]));
  function buffer(a){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);return b;}
  const skyBuffer=buffer([-1,-1,3,-1,-1,3]);
  const atlas=document.createElement('canvas'); atlas.width=1024;atlas.height=2048;
  const ctx=atlas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,atlas.width,atlas.height);
  const white=[.99,.99];let signIndex=0;
  function label(word,bg,fg){
    const i=signIndex++,x=(i%2)*512,y=Math.floor(i/2)*96;
    ctx.fillStyle=bg;ctx.fillRect(x,y,512,96);ctx.fillStyle=fg;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 58px Helvetica, sans-serif';
    ctx.fillText(word,x+256,y+50,480);
    return [[(x+2)/1024,(y+94)/2048],[(x+510)/1024,(y+94)/2048],[(x+510)/1024,(y+2)/2048],[(x+2)/1024,(y+2)/2048]];
  }
  function uploadAtlas(){const tex=gl.createTexture();cityTextures[0]=tex;gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
  function bakeShadows(world){
    const sh=program(`attribute vec3 pos; `+sunProjection+`
      void main(){vec3 p=shadowCoord(pos);gl_Position=vec4(p*2.-1.,1.);}`,
      `precision highp float;void main(){float d=gl_FragCoord.z;gl_FragColor=vec4(floor(d*255.)/255.,fract(d*255.),0.,1.);}`);
    const size=2048,fb=gl.createFramebuffer(),depth=gl.createRenderbuffer(),tex=gl.createTexture();
    cityTextures[1]=tex;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);gl.viewport(0,0,size,size);
    gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(sh);
    const a=gl.getAttribLocation(sh,'pos');gl.bindBuffer(gl.ARRAY_BUFFER,world.buffer);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,48,0);
    gl.drawArrays(gl.TRIANGLES,0,world.count);gl.disableVertexAttribArray(a);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.deleteFramebuffer(fb);gl.deleteRenderbuffer(depth);gl.deleteProgram(sh);gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(meshProgram);gl.uniform1i(loc(meshProgram,'shadowAtlas'),1);
  }
  const colors=new Map();
  function rgb(hex){if(!colors.has(hex)){const n=parseInt(hex.slice(1),16);colors.set(hex,[(n>>16)/255,(n>>8&255)/255,(n&255)/255]);}return colors.get(hex);}
  class Mesh {
    constructor(){this.vertices=[];this.material=0;}
    quad(points,color,light=1,uv=null,normals=null){
      const c=rgb(color),[a,b,d]=points;
      const u=b.map((v,i)=>v-a[i]),v=d.map((t,i)=>t-a[i]);
      const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const len=Math.hypot(...cross)||1,normal=cross.map(q=>q/len);
      for(const j of [0,1,2,0,2,3])this.vertices.push(...points[j],c[0]*light,c[1]*light,c[2]*light,...(uv?uv[j]:white),...(normals?normals[j]:normal),this.material);
    }
    box(x,y,z,w,h,d,color){const l=x-w/2,r=x+w/2,b=y,t=y+h,n=z-d/2,f=z+d/2;
      this.quad([[l,b,n],[r,b,n],[r,t,n],[l,t,n]],color,.92);
      this.quad([[r,b,f],[l,b,f],[l,t,f],[r,t,f]],color,.72);
      this.quad([[l,b,f],[l,b,n],[l,t,n],[l,t,f]],color,.98);
      this.quad([[r,b,n],[r,b,f],[r,t,f],[r,t,n]],color,.76);
      this.quad([[l,t,n],[r,t,n],[r,t,f],[l,t,f]],color);}
    plane(x,z,w,d,y,color){this.quad([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);}
    strip(a,b,width,y,color){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),u=dz/len*width/2,v=-dx/len*width/2;
      this.quad([[a[0]-u,y,a[1]-v],[a[0]+u,y,a[1]+v],[b[0]+u,y,b[1]+v],[b[0]-u,y,b[1]-v]],color);}
    sign(x,y,z,w,h,uv){this.quad([[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z]],'#ffffff',1,uv);}
    seal(){this.count=this.vertices.length/12;this.buffer=buffer(this.vertices);this.vertices=null;return this;}
  }
  const attribs=['pos','col','uv','norm','material'].map(n=>gl.getAttribLocation(meshProgram,n)),skyAttr=gl.getAttribLocation(skyProgram,'vertex');
  function begin(eye,yaw,pitch,face=-1,indoors=false,lens=1.55){const c=gl.canvas,dpr=Math.min(devicePixelRatio,1.6),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
    if(face<0){if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);}else gl.viewport(face*256,0,256,256);
    gl.disable(gl.DEPTH_TEST);gl.useProgram(skyProgram);gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);
    gl.enableVertexAttribArray(skyAttr);gl.vertexAttribPointer(skyAttr,2,gl.FLOAT,false,0,0);
    for(const [p,u] of [[skyProgram,skyU],[meshProgram,uniforms]]){
      gl.useProgram(p);const sky=indoors?[.66,0,0,0]:Climate.sky();
      const sy=Math.min(.96,Math.max(-.48,sky[0])),horiz=Math.sqrt(1-sy*sy);
      gl.uniform3f(u.sun,-.53*horiz,sy,.848*horiz);gl.uniform4fv(u.climate,sky);gl.uniform1f(u.overcast,Climate.cloud);
      gl.uniform2f(u.facing,Math.sin(yaw),Math.cos(yaw));gl.uniform2f(u.tilt,Math.sin(pitch),Math.cos(pitch));gl.uniform1f(u.aspect,face<0?w/h:1);gl.uniform1f(u.lens,face<0?lens:1);
      if(p===skyProgram){gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(skyAttr);}
    }
    gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform3fv(uniforms.eye,eye);gl.uniform1f(uniforms.seaTime,performance.now()*.001);
  }
  function draw(mesh,x=0,y=0,z=0,angle=0,roll=0,bank=0){gl.uniform1f(uniforms.bank,bank);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    attribs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,[3,3,2,3,1][i],gl.FLOAT,false,48,[0,12,24,32,44][i]);});
    gl.uniform2f(uniforms.pitchRotation,Math.sin(roll),Math.cos(roll));gl.uniform3f(uniforms.origin,x,y,z);gl.uniform2f(uniforms.rotation,Math.sin(angle),Math.cos(angle));gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    attribs.forEach(a=>gl.disableVertexAttribArray(a));}
  function contact(mesh,x,z,yaw){
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    draw(mesh,x,0,z,yaw);gl.depthMask(true);gl.disable(gl.BLEND);
  }
  function captureStreet(world){
    const f=gl.createFramebuffer(),tex=gl.createTexture(),depth=gl.createRenderbuffer();
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,256,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,1024,256);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    gl.bindTexture(gl.TEXTURE_2D,null);
    for(let face=0;face<4;face++){begin([3,1.1,14],face*Math.PI/2,0,face);draw(world);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(f);gl.deleteRenderbuffer(depth);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc(meshProgram,'streetEnv'),2);cityTextures[2]=tex;
    gl.uniform1f(uniforms.useEnv,1);gl.activeTexture(gl.TEXTURE0);
  }
  // Filter the completed framebuffer, including traffic lights and vehicles.
  const post=program(`attribute vec2 vertex;varying vec2 uv;void main(){uv=vertex*.5+.5;gl_Position=vec4(vertex,0,1);}`,
    `precision highp float;varying vec2 uv;uniform sampler2D sceneColor;uniform vec2 pixel;uniform float night,rain,clock;
    float hash(vec2 v){return fract(sin(dot(v,vec2(27.1,49.7)))*43758.5);}
    vec3 bright(vec2 q){vec3 c=texture2D(sceneColor,q).rgb;return c*smoothstep(.52,.88,max(max(c.r,c.g),c.b));}
    void main(){
      vec3 c=texture2D(sceneColor,uv).rgb;
      if(night>.01){vec3 bloom=vec3(0.);for(int i=0;i<8;i++){
        float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*pixel;
        bloom+=bright(uv+3.*o)*.082+bright(uv+8.*o)*.042;
      }c+=bloom*.53*night;}
      if(rain>.015){
        vec2 v=vec2(uv.x*174.+uv.y*21.,uv.y*13.+clock*9.);
        float h=hash(floor(v));float drop=step(.78,h)*(1.-smoothstep(.025,.15,abs(fract(v.x)-.5)))*(1.-smoothstep(.05,.43,abs(fract(v.y)-.5)));
        c=mix(c,vec3(.77,.86,.91),drop*rain*.38);
      }gl_FragColor=vec4(c,1.);
    }`);
  const postU=Object.fromEntries(['sceneColor','pixel','night','rain','clock'].map(n=>[n,loc(post,n)]));
  const postAttr=gl.getAttribLocation(post,'vertex'),frameTexture=gl.createTexture();let frameW=0,frameH=0;
  function finishFrame(){
    const climate=Climate.sky(),night=1-Math.max(0,Math.min(1,(climate[0]+.23)/.49));
    if(night<.01&&climate[2]<.015)return;
    const w=gl.canvas.width,h=gl.canvas.height;
    gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,frameTexture);
    if(w!==frameW||h!==frameH){frameW=w;frameH=h;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,w,h,0,gl.RGB,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h);
    gl.disable(gl.DEPTH_TEST);gl.useProgram(post);gl.uniform1i(postU.sceneColor,5);gl.uniform2f(postU.pixel,1/w,1/h);
    gl.uniform1f(postU.night,night);gl.uniform1f(postU.rain,climate[2]);gl.uniform1f(postU.clock,performance.now()*.001);
    gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(postAttr);gl.vertexAttribPointer(postAttr,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(postAttr);gl.activeTexture(gl.TEXTURE0);gl.useProgram(meshProgram);
  }
  const photos=[['roadPhoto','asphalt_04'],['brickPhoto','brown_brick_02']];
  const ready=[0,0];
  gl.useProgram(meshProgram);
  for(const [i,[sampler,name]] of photos.entries()){
    const unit=3+i,texture=gl.createTexture();cityTextures[unit]=texture;
    function bind(){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);}
    bind();
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.uniform1i(loc(meshProgram,sampler),unit);
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{
      bind();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
      gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.activeTexture(gl.TEXTURE0);ready[i]=1;gl.useProgram(meshProgram);gl.uniform2fv(loc(meshProgram,'photoReady'),ready);
    };
    img.src=window.surfaceImages?.[name]||'textures/'+name+'_diff_1k.jpg';
  }
  gl.activeTexture(gl.TEXTURE0);
  return {paint:color=>gl.uniform3fv(uniforms.paintColor,color||[0,0,0]),withCharacterContext,contact,finishFrame,Mesh,label,uploadAtlas,bakeShadows,captureStreet,begin,draw};
})();
