// Reproductor compartido: une el color (mitad de arriba del video) con la
// transparencia (mitad de abajo) y lo dibuja en un canvas transparente.

const OVERLAYS = [
  { id: "jaguar",        nombre: "JAGUAR",   desc: "Choque de guantes y rugido", plan: "Élite" },
  { id: "x2_dorado",     nombre: "X2 ORO",   desc: "Oro fundido 3D, 60 fps",     plan: "Pro" },
  { id: "guante_dorado", nombre: "¡GUANTE!", desc: "Combo de 3 golpes",          plan: "Pro" },
  { id: "guante_morado", nombre: "GUANTE",   desc: "Versión morada",             plan: "Pro" },
  { id: "x2_morado",     nombre: "X2",       desc: "Sencillo, sin sonido",       plan: "Pro" }
];
OVERLAYS.forEach(o => { o.video = "overlays/" + o.id + ".mp4"; o.miniatura = "miniaturas/" + o.id + ".jpg"; });

function crearReproductor(canvas, onEstado) {
  const estado = (t) => { if (onEstado) onEstado(t); };
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
  const videos = {};
  let actual = null;

  if (!gl) estado("ERROR: este navegador no tiene WebGL; no se puede dibujar la transparencia.");
  else {
    const vs = "attribute vec2 p; varying vec2 uv; void main(){ uv = vec2((p.x+1.0)*0.5, (1.0-p.y)*0.5); gl_Position = vec4(p,0.0,1.0); }";
    const fs = "precision mediump float; varying vec2 uv; uniform sampler2D t; void main(){ vec3 c = texture2D(t, vec2(uv.x, uv.y*0.5)).rgb; float a = texture2D(t, vec2(uv.x, 0.5 + uv.y*0.5)).r; gl_FragColor = vec4(a > 0.004 ? c : vec3(0.0), a > 0.004 ? a : 0.0); }";
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.clearColor(0, 0, 0, 0);
  }

  function limpiar() { if (gl) gl.clear(gl.COLOR_BUFFER_BIT); }
  function dibujar() {
    const v = actual && videos[actual];
    if (gl && v && !v.paused && !v.ended && v.readyState >= 2) {
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } catch (e) { estado("ERROR al dibujar: " + e.message); }
    }
    requestAnimationFrame(dibujar);
  }
  requestAnimationFrame(dibujar);

  function cargar(o) {
    if (videos[o.id]) return videos[o.id];
    const v = document.createElement("video");
    v.src = o.video; v.preload = "auto"; v.playsInline = true;
    v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    // Casi invisible, pero en el documento: algunos navegadores no decodifican videos ocultos.
    v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none";
    document.body.appendChild(v);
    v.addEventListener("ended", () => { if (actual === o.id) { actual = null; limpiar(); estado("Terminó: " + o.nombre); } });
    v.addEventListener("error", () => estado("ERROR: no se pudo cargar " + o.video));
    videos[o.id] = v;
    return v;
  }

  function reproducir(id, volumen) {
    const o = OVERLAYS.find(x => x.id === id);
    if (!o) { estado("ERROR: no existe el overlay '" + id + "'"); return; }
    Object.entries(videos).forEach(([k, v]) => { if (k !== id) v.pause(); });
    const v = cargar(o);
    actual = id;
    v.volume = volumen == null ? 1 : volumen;
    v.muted = false;
    try { v.currentTime = 0; } catch (e) {}
    const p = v.play();
    if (p && p.then) {
      p.then(() => estado("Reproduciendo con sonido: " + o.nombre))
       .catch(() => {
         v.muted = true;
         v.play().then(() => estado("Reproduciendo SIN sonido (el programa bloqueó el audio): " + o.nombre))
                 .catch(err => estado("ERROR: no se pudo reproducir (" + err.name + ")"));
       });
    }
  }

  function detener() { Object.values(videos).forEach(v => v.pause()); actual = null; limpiar(); }

  return { cargar, reproducir, detener, tieneWebGL: !!gl };
}

// Canal de mensajes del enlace general (prueba): ntfy.sh, un servicio público y gratuito.
// Solo para esta prueba: en la plataforma real esto lo haría tu propio servidor.
const NTFY = "https://ntfy.sh/";
