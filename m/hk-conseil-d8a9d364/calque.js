/* Trait de plan qui suit la souris, façon ligne de cote de dessin d'architecte :
   fines lignes vertes (couleurs du site), uniquement horizontales et verticales, qui dépassent un peu à chaque angle
   avec une petite croix au sommet. Le trait finit sur la pointe du curseur, reste court et s'efface vite.
   Désactivé au tactile et si l'utilisateur réduit les animations. */
(function(){
  'use strict';
  if(matchMedia('(hover:none)').matches||matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var LIFE=260;    // durée avant effacement complet, en ms
  var MAXLEN=110;  // longueur maximale du trait visible, en px (le plus ancien est raccourci)
  var STEP=22;     // écart perpendiculaire (px) à partir duquel le trait tourne à angle droit
  var OVER=7;      // dépassement des lignes au-delà d'un angle, en px
  var CROSS=3;     // demi-taille de la croix posée sur chaque angle, en px
  var JUMP=160;    // saut de souris (px) entre deux événements : on repart d'un nouveau tracé
  var canvas=document.createElement('canvas');
  canvas.className='calque-trait';
  canvas.setAttribute('aria-hidden','true');
  document.body.appendChild(canvas);
  var ctx=canvas.getContext('2d');
  var dpr=1,w=0,h=0,raf=0,dark=false,custom=false;
  var verts=[];    // sommets du tracé : {x,y,t}
  var head=null;   // position actuelle de la pointe
  var axis=null;   // 'h' ou 'v' : axe du segment en cours
  var lastMove=0;

  function size(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    w=innerWidth; h=innerHeight;
    canvas.width=w*dpr; canvas.height=h*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  size();
  addEventListener('resize',size);
  document.documentElement.classList.add('calque-cursor');   // masque le curseur du navigateur (voir calque.css)

  function reset(){
    if(raf){cancelAnimationFrame(raf);raf=0;}
    verts=[]; head=null; axis=null; custom=false;
    ctx.clearRect(0,0,w,h);
  }

  // croix de logiciel de dessin : longues branches fines qui se croisent, avec un petit carré de sélection au centre
  function crosshair(){
    if(!custom||!head) return;
    var x=Math.round(head.x)+.5,y=Math.round(head.y)+.5,arm=29,box=3;
    var rgb=dark||'63,107,63';
    ctx.lineWidth=1; ctx.lineCap='butt';
    ctx.strokeStyle='rgba('+rgb+',.85)';
    ctx.beginPath();
    ctx.moveTo(x-arm,y); ctx.lineTo(x+arm,y);
    ctx.moveTo(x,y-arm); ctx.lineTo(x,y+arm);
    ctx.stroke();
    ctx.strokeStyle='rgba('+rgb+',1)';
    ctx.strokeRect(x-box,y-box,box*2,box*2);
  }

  addEventListener('pointermove',function(e){
    if(e.pointerType&&e.pointerType!=='mouse') return;
    var now=performance.now(),t=e.target;
    // vert profond du site sur fond clair, vert sauge sur la section sombre, blanc sur le vert sauge
    dark=t&&t.closest?(t.closest('.works')?'136,172,136':t.closest('.quote,.lb')?'255,255,255':''):'';
    var p={x:e.clientX,y:e.clientY};
    if(!head||now-lastMove>LIFE||Math.hypot(p.x-head.x,p.y-head.y)>JUMP){
      verts=[{x:p.x,y:p.y,t:now}]; axis=null;     // nouveau tracé
    }
    var a=verts[verts.length-1];
    var dx=p.x-a.x,dy=p.y-a.y;
    if(!axis){
      if(Math.max(Math.abs(dx),Math.abs(dy))>=STEP) axis=Math.abs(dx)>=Math.abs(dy)?'h':'v';
    }else{
      var perp=axis==='h'?Math.abs(dy):Math.abs(dx);
      if(perp>=STEP){
        // la souris change d'axe : le coin du tracé est l'angle droit
        verts.push(axis==='h'?{x:p.x,y:a.y,t:now}:{x:a.x,y:p.y,t:now});
        if(verts.length>40) verts.shift();
        axis=axis==='h'?'v':'h';
      }
    }
    head=p; lastMove=now;
    // la croix remplace le curseur partout où celui-ci est masqué (« none », hérité de <html>) ;
    // sur les liens, boutons, champs et curseurs spéciaux, le curseur du navigateur reste visible et la croix s'efface
    custom=!!(t&&t.nodeType===1&&getComputedStyle(t).cursor==='none');
    draw(now);
  },{passive:true});

  // la souris sort de la fenêtre ou la fenêtre perd le focus : on efface le tracé
  document.documentElement.addEventListener('mouseleave',reset);
  document.addEventListener('mouseout',function(e){if(!e.relatedTarget) reset();});
  addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);

  function len(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}   // segments horizontaux ou verticaux

  function draw(now){
    if(raf){cancelAnimationFrame(raf);raf=0;}
    ctx.clearRect(0,0,w,h);
    while(verts.length>1&&now-verts[1].t>LIFE) verts.shift();
    if(!head) return;
    if(!verts.length||now-lastMove>LIFE){ crosshair(); return; }

    // points du tracé : sommets validés, puis le coude et la pointe
    var a=verts[verts.length-1];
    var ax=axis||(Math.abs(head.x-a.x)>=Math.abs(head.y-a.y)?'h':'v');
    var pts=verts.map(function(v,i){return {x:v.x,y:v.y,t:v.t,corner:i>0};});
    pts.push(ax==='h'?{x:head.x,y:a.y,t:lastMove}:{x:a.x,y:head.y,t:lastMove});
    pts.push({x:head.x,y:head.y,t:lastMove});

    // longueur maximale : on raccourcit le début du tracé
    var total=0,i;
    for(i=1;i<pts.length;i++) total+=len(pts[i-1],pts[i]);
    while(total>MAXLEN&&pts.length>2){
      var L=len(pts[0],pts[1]),ex=total-MAXLEN;
      if(ex>=L){pts.shift(); total-=L; if(verts.length>1) verts.shift();}
      else{
        var f=ex/L; pts[0]={x:pts[0].x+(pts[1].x-pts[0].x)*f,y:pts[0].y+(pts[1].y-pts[0].y)*f,t:pts[0].t,corner:false};
        total=MAXLEN;
      }
    }

    var rgb=dark||'63,107,63';   // --sage-deep du site par défaut
    ctx.lineCap='butt'; ctx.lineWidth=1;
    for(i=1;i<pts.length;i++){
      var p0=pts[i-1],p1=pts[i];
      var k=1-(now-p1.t)/LIFE;
      if(k<=0) continue;
      ctx.strokeStyle='rgba('+rgb+','+(.1+k*.5).toFixed(3)+')';
      var dx=Math.sign(p1.x-p0.x),dy=Math.sign(p1.y-p0.y);
      // la ligne dépasse de OVER px au-delà de chaque angle
      var x0=p0.x-(p0.corner?dx*OVER:0),y0=p0.y-(p0.corner?dy*OVER:0);
      var x1=p1.x+(p1.corner?dx*OVER:0),y1=p1.y+(p1.corner?dy*OVER:0);
      ctx.beginPath(); ctx.moveTo(x0+.5,y0+.5); ctx.lineTo(x1+.5,y1+.5); ctx.stroke();
    }
    // petite croix sur chaque angle, et sur la pointe
    ctx.strokeStyle='rgba('+rgb+',.6)';
    for(i=0;i<pts.length;i++){
      var c=pts[i];
      if(!c.corner&&(i!==pts.length-1||custom)) continue;   // la croix du curseur remplace celle de la pointe
      if(i!==pts.length-1&&now-c.t>LIFE) continue;
      ctx.beginPath();
      ctx.moveTo(c.x-CROSS+.5,c.y+.5); ctx.lineTo(c.x+CROSS+.5,c.y+.5);
      ctx.moveTo(c.x+.5,c.y-CROSS+.5); ctx.lineTo(c.x+.5,c.y+CROSS+.5);
      ctx.stroke();
    }
    crosshair();
    raf=requestAnimationFrame(draw);
  }
})();
