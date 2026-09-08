(function(){
  function fallback(text){ try{ var t=document.createElement('textarea'); t.value=text; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }catch(e){} }
  document.querySelectorAll('.cs-copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      var copied = btn.getAttribute('data-copied') || 'Copied ✓';
      var orig = btn.innerHTML;
      var show = function(){ btn.innerHTML = copied; clearTimeout(btn._t); btn._t = setTimeout(function(){ btn.innerHTML = orig; }, 1700); };
      if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(show, function(){ fallback(text); show(); }); }
      else { fallback(text); show(); }
    });
  });
  try {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:0.10, rootMargin:'0px 0px -6% 0px' });
    requestAnimationFrame(function(){ document.querySelectorAll('[data-reveal]').forEach(function(el){ io.observe(el); }); });
  } catch(e){ document.querySelectorAll('[data-reveal]').forEach(function(el){ el.classList.add('in'); }); }

  // ---- three.js glass background (graceful fallback to CSS blobs) ----
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var host = document.getElementById('fx');
  if (host && !reduce){
    var tries = 0;
    (function wait(){
      if (!window.THREE){ if (tries++ < 90) setTimeout(wait, 80); return; }
      try { buildScene(window.THREE, host); } catch(e){}
    })();
  }
  function buildScene(THREE, host){
    var w = function(){ return host.clientWidth || window.innerWidth; };
    var h = function(){ return host.clientHeight || window.innerHeight; };
    var renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w(), h());
    Object.assign(renderer.domElement.style, { position:'absolute', inset:'0', width:'100%', height:'100%' });
    host.appendChild(renderer.domElement);
    host.classList.add('on');

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, w()/h(), 0.1, 100);
    camera.position.set(0, 0, 9);

    var c = document.createElement('canvas'); c.width=128; c.height=256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0,0,0,256);
    grad.addColorStop(0,'#3b1d6e'); grad.addColorStop(0.45,'#0a0a16'); grad.addColorStop(0.55,'#0a0a16'); grad.addColorStop(1,'#0b3b52');
    g.fillStyle=grad; g.fillRect(0,0,128,256);
    g.fillStyle='rgba(232,121,249,0.55)'; g.beginPath(); g.arc(38,58,28,0,7); g.fill();
    g.fillStyle='rgba(34,211,238,0.5)'; g.beginPath(); g.arc(96,184,30,0,7); g.fill();
    g.fillStyle='rgba(190,242,100,0.35)'; g.beginPath(); g.arc(64,128,18,0,7); g.fill();
    var tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping;
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    var l1 = new THREE.PointLight(0xa78bfa, 45, 50); l1.position.set(-6,5,6); scene.add(l1);
    var l2 = new THREE.PointLight(0x22d3ee, 45, 50); l2.position.set(6,-4,6); scene.add(l2);
    var l3 = new THREE.PointLight(0xe879f9, 32, 50); l3.position.set(0,6,-4); scene.add(l3);

    var mat = function(color){ return new THREE.MeshPhysicalMaterial({
      color:color, metalness:0, roughness:0.06, transmission:1, thickness:1.6, ior:1.35,
      clearcoat:1, clearcoatRoughness:0.1, iridescence:1, iridescenceIOR:1.3,
      transparent:true, envMapIntensity:1.5, attenuationDistance:4, attenuationColor:new THREE.Color(color)
    }); };

    var group = new THREE.Group(); scene.add(group);
    var defs = [
      { geo:new THREE.IcosahedronGeometry(1.25,0), pos:[-4.3,2.2,-1], col:0xc4b5fd },
      { geo:new THREE.OctahedronGeometry(0.85,0), pos:[4.6,-2.0,-1.5], col:0x67e8f9 },
      { geo:new THREE.TorusGeometry(0.66,0.26,32,90), pos:[4.4,2.4,-2], col:0xf0abfc },
      { geo:new THREE.DodecahedronGeometry(0.7,0), pos:[-4.6,-2.2,-2], col:0xbef264 }
    ];
    var meshes = defs.map(function(d){ var m=new THREE.Mesh(d.geo, mat(d.col)); m.position.set(d.pos[0],d.pos[1],d.pos[2]); m.userData.sp=Math.random()*6; group.add(m); return m; });
    if (w() < 760) group.scale.setScalar(0.7);

    var mx=0,my=0,tx=0,ty=0;
    window.addEventListener('pointermove', function(e){ tx=(e.clientX/window.innerWidth)*2-1; ty=(e.clientY/window.innerHeight)*2-1; }, { passive:true });
    window.addEventListener('resize', function(){ camera.aspect=w()/h(); camera.updateProjectionMatrix(); renderer.setSize(w(),h()); });

    var clock = new THREE.Clock();
    var running = !document.hidden;
    var loop = function(){
      if (!running) return;
      requestAnimationFrame(loop);
      var t = clock.getElapsedTime();
      mx += (tx-mx)*0.04; my += (ty-my)*0.04;
      group.rotation.y = mx*0.25; group.rotation.x = my*0.16;
      group.position.x = mx*0.4; group.position.y = -my*0.3;
      meshes.forEach(function(m,i){ m.rotation.x=t*0.13+i; m.rotation.y=t*0.1+i; m.position.y += Math.sin(t*0.6+m.userData.sp)*0.0016; });
      renderer.render(scene, camera);
    };
    document.addEventListener('visibilitychange', function(){ running = !document.hidden; if (running) loop(); });
    loop();
  }
})();
