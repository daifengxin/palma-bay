'use strict';
const Climate=(()=>{
  const dayDurationSeconds=48*60;
  let hour=17.65,timer=0,weather=0,rain=0,wet=0;
  const names=['晴','多云','阵雨'],sequence=[0,1,2,1];
  let index=0;
  function tick(dt){
    hour=(hour+dt*24/dayDurationSeconds)%24;timer+=dt;
    if(timer>=49){index=(index+1)%sequence.length;weather=sequence[index];timer=0;}
    const ease=1-Math.exp(-dt*.65);rain+=((weather===2?1:0)-rain)*ease;
    wet+=(rain-wet)*(1-Math.exp(-dt*(rain>wet?.3:.055)));
  }
  function sky(){
    const alt=Math.sin((hour-6)*Math.PI/12);
    return [alt,Math.max(0,1-Math.abs(alt+.01)*3.9),rain,wet];
  }
  function time(){const min=Math.floor(hour*60);return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');}
  return {tick,sky,time,get wet(){return wet;},get cloud(){return weather===1?.74:rain;},get label(){return names[weather];},
    nextTime(){const jumps=[6.4,12.0,18.1,22.0];hour=jumps.find(v=>v>hour+.02)??jumps[0];},
    nextWeather(){weather=(weather+1)%3;index=sequence.indexOf(weather);timer=0;}};
})();
