(function(){
  'use strict';

  var SIZE = 96;
  var FPS = 8;
  var FRAME_MS = 1000 / FPS;
  var PALETTES = [
    ['#050713', '#0b2767', '#22d3ee', '#f8c7ff', '#fff7d6'],
    ['#080512', '#371269', '#a855f7', '#fb7185', '#fde68a'],
    ['#030712', '#064e3b', '#34d399', '#a7f3d0', '#ffffff'],
    ['#09090b', '#7f1d1d', '#fb923c', '#fde047', '#fff7ed'],
    ['#020617', '#164e63', '#38bdf8', '#a78bfa', '#fdf2f8'],
    ['#08040f', '#581c87', '#2563eb', '#2dd4bf', '#fef3c7']
  ];

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  var ctx = cv.getContext('2d');
  var raf = 0;
  var last = 0;
  var pal = PALETTES[Math.floor(Math.random() * PALETTES.length)].map(hexToRgb);
  var seed = Math.random() * 1000;
  var spin = Math.random() * Math.PI * 2;
  var dir = Math.random() < 0.5 ? -1 : 1;
  var twist = 7.4 + Math.random() * 2.3;

  function hexToRgb(h){
    h = h.replace('#', '');
    return [parseInt(h.substr(0,2), 16), parseInt(h.substr(2,2), 16), parseInt(h.substr(4,2), 16)];
  }
  function clamp(v){ return Math.max(0, Math.min(1, v)); }
  function mix(a, b, t){ return a + (b - a) * t; }
  function smooth(a, b, x){
    x = clamp((x - a) / (b - a));
    return x * x * (3 - 2 * x);
  }
  function sampleRamp(cols, t){
    t = clamp(t);
    var p = t * (cols.length - 1);
    var i = Math.min(cols.length - 2, Math.floor(p));
    var f = p - i;
    return [
      mix(cols[i][0], cols[i + 1][0], f),
      mix(cols[i][1], cols[i + 1][1], f),
      mix(cols[i][2], cols[i + 1][2], f)
    ];
  }
  function setFavicons(url){
    var links = document.querySelectorAll('link[rel~="icon"]');
    for (var i = 0; i < links.length; i++){
      links[i].setAttribute('href', url);
      links[i].setAttribute('type', 'image/png');
      links[i].setAttribute('sizes', '96x96');
    }
    if (!links.length){
      var l = document.createElement('link');
      l.rel = 'icon';
      l.type = 'image/png';
      l.sizes = '96x96';
      l.href = url;
      document.head.appendChild(l);
    }
  }
  function draw(t){
    if (!ctx){ return; }
    var time = t * 0.001;
    var img = ctx.createImageData(SIZE, SIZE);
    var d = img.data;
    for (var y = 0; y < SIZE; y++){
      for (var x = 0; x < SIZE; x++){
        var px = (x + 0.5) / SIZE;
        var py = (y + 0.5) / SIZE;
        var nx = (px - 0.5) * 2.0;
        var ny = (py - 0.5) * 2.0;
        var r = Math.sqrt(nx * nx + ny * ny);
        var a = Math.atan2(ny, nx);
        var pull = Math.pow(Math.max(0.02, r), 0.68);
        var wobble = Math.sin(nx * 5.5 + seed + time * 0.55) * 0.22 +
          Math.cos(ny * 6.2 - seed * 0.7 - time * 0.45) * 0.18;
        var vortex = a * 2.25 * dir + pull * twist - time * 1.35 + spin + wobble;
        var ribbon = 0.5 + 0.5 * Math.sin(vortex);
        var vein = 1.0 - Math.abs(Math.sin(vortex * 1.02 + r * 3.1));
        var core = smooth(0.58, 0.03, r);
        var edge = 1.0 - smooth(0.82, 1.12, r);
        var value = clamp(0.20 + ribbon * 0.72 + vein * 0.20 + core * 0.16 - r * 0.13);
        var c = sampleRamp(pal, value);

        var shine = smooth(0.64, 1.0, vein) * edge;
        var glint = smooth(0.20, 0.0, Math.sqrt(Math.pow(nx + 0.26, 2) + Math.pow(ny + 0.31, 2)));
        var shade = 0.50 + edge * 0.55;
        var grain = (((x * 13 + y * 19 + Math.floor(seed)) % 7) - 3) * 1.25;
        var disk = 1.0 - smooth(0.74, 1.0, r);
        var band = smooth(0.18, 0.94, ribbon) * 0.76 + smooth(0.66, 1.0, vein) * 0.34 + core * 0.18;
        var alpha = Math.max(0, Math.min(1, disk * band));

        var idx = (y * SIZE + x) * 4;
        d[idx] = Math.max(0, Math.min(255, c[0] * shade + shine * 48 + glint * 38 + grain));
        d[idx + 1] = Math.max(0, Math.min(255, c[1] * shade + shine * 48 + glint * 38 + grain));
        d[idx + 2] = Math.max(0, Math.min(255, c[2] * shade + shine * 54 + glint * 44 + grain));
        d[idx + 3] = Math.round(255 * alpha);
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    var vignette = ctx.createRadialGradient(48, 44, 6, 48, 48, 61);
    vignette.addColorStop(0, 'rgba(255,255,255,.08)');
    vignette.addColorStop(0.55, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(48, 48, 43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    setFavicons(cv.toDataURL('image/png'));
  }
  function tick(now){
    if (document.hidden || prefersReduced){ return; }
    if (now - last >= FRAME_MS){
      last = now;
      draw(now);
    }
    raf = requestAnimationFrame(tick);
  }
  function start(){
    if (!ctx){ return; }
    if (raf){ cancelAnimationFrame(raf); raf = 0; }
    draw(0);
    if (!prefersReduced && !document.hidden){ raf = requestAnimationFrame(tick); }
  }
  document.addEventListener('visibilitychange', start);
  try { start(); } catch(e){}
})();
