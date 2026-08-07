(function(){
  var DESIGN_W=1920,DESIGN_H=1080;
  var MODE='both';          // 'both' (fit ancho/alto) o 'height' (solo alto)
  var BOOST=1.00, MAX_SCALE=1.25;

  function setScale(){
    var w=window.innerWidth, h=window.innerHeight, s;
    if(MODE==='height'){
      s=h/DESIGN_H;
    }else{
      s=Math.min(w/DESIGN_W,h/DESIGN_H);
    }
    s=Math.min(s*BOOST,MAX_SCALE);
    document.documentElement.style.setProperty('--scale',s);
  }
  window.addEventListener('resize',setScale,{passive:true});
  setScale();
})();
