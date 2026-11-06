/* Aplicación del estudiante */
const App = $('#app');
const esAct = p => p.tipo !== 'diapositiva' && p.tipo !== 'documento';
/* Sin ventanas emergentes: la app nunca abre pop-ups ni pestañas nuevas por sí sola */
window.open = () => null;
let instalarEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalarEvt = e; const b = $('#instalar'); if (b) b.style.display = ''; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
const S = { previa: false, cfg: null, perfil: null, sesiones: [], progreso: null, ses: null, idx: 0, hb: null, poll: null, enPart: false, bloqueado: false, ritmoDoc: false, pasoDoc: 0 };
const params = new URLSearchParams(location.search);
const sesionQR = params.get('s');

function banner() { return S.previa ? `<div class="previa"><span>👁 Vista previa del docente: lo que ves es lo que ven los estudiantes. No se guarda nada.</span><span class="sp"></span><button class="btn sm navy" onclick="window.close();location.href='docente.html'">Cerrar</button></div>` : ''; }
function hero(titulo, sub, extra = '', big = false) {
  return `${banner()}<div class="hero"><div class="stars"></div><div class="in"><div class="hero-top"><img class="logo ${big ? 'big' : ''}" src="img/insignia.png" alt="Insignia Colegio Marina de Chile"><div class="brand">Colegio Marina de Chile<small>${esc(S.cfg?.asignatura || 'Economía y Sociedad')} · ${esc(S.cfg?.nombre_unidad || 'Unidad 4')}</small></div></div><h1>${titulo}</h1><p>${sub}</p>${extra}</div></div>`;
}
function cargando(t = 'Cargando…') { App.innerHTML = `<div class="c" style="padding:90px 20px"><img src="img/insignia.png" class="logo-load" alt=""><p class="mut">${t}</p></div>`; }

async function iniciar() {
  try { S.cfg = await API.call('config'); } catch (e) { App.innerHTML = `<div class="wrap"><div class="card err" style="margin-top:40px">${esc(e.message)}</div></div>`; return; }
  document.title = `${S.cfg.asignatura} · ${S.cfg.nombre_unidad}`;
  const tp = params.get('previa');
  if (tp) { S.previa = true; API.token = tp; S.perfil = { rut: 'PREVIA', nombre: 'Vista previa', curso: 'Docente' }; return inicio(); }
  const t = store.get('tok'), p = store.get('perfil');
  if (t && p) { API.token = t; S.perfil = JSON.parse(p); return inicio(); }
  vistaAuth();
}

/* ---------- Inscripción / ingreso ---------- */
function vistaAuth() {
  App.innerHTML = `${hero('¡Bienvenido/a!', 'Participa en clases de Economía desde tu celular.', '', true)}
  <div class="wrap pull"><div class="card">
    <form id="f" autocomplete="off">
      <label for="rut">Ingresa con tu RUT</label><input id="rut" inputmode="text" placeholder="12.345.678-9" required autofocus>
      <div class="hint">Tu docente te inscribió en la asignatura. Si tu RUT no aparece, avísale.</div>
      <div id="msg"></div>
      <button class="btn block" style="margin-top:16px" id="go">Entrar</button>
    </form></div></div>`;
  const rut = $('#rut'); rut.oninput = () => { rut.value = formatRut(rut.value); };
  $('#f').onsubmit = async ev => {
    ev.preventDefault(); const m = $('#msg'); m.innerHTML = '';
    if (!rutValido(rut.value)) { m.innerHTML = '<div class="err">El RUT no es válido. Revisa el dígito verificador.</div>'; return; }
    const b = $('#go'); b.disabled = true; b.textContent = 'Un momento…';
    try {
      const d = await API.call('ingresar', { rut: rut.value });
      API.token = d.token; S.perfil = d.perfil; store.set('tok', d.token); store.set('perfil', JSON.stringify(d.perfil)); inicio();
    } catch (e) { m.innerHTML = `<div class="err">${esc(e.message)}</div>`; b.disabled = false; b.textContent = 'Entrar'; }
  };
}
function cerrarSesion() { detenerPart(); store.del('tok'); store.del('perfil'); API.token = null; vistaAuth(); }
function manejar(e) { if (e.code === 'SESION_EXPIRADA') { toast('Tu sesión expiró. Ingresa nuevamente.'); cerrarSesion(); return true; } return false; }

/* ---------- Inicio ---------- */
async function inicio() {
  cargando('Cargando tu unidad…');
  try { const d = await API.call('misSesiones'); S.sesiones = d.sesiones; S.progreso = d.progreso; } catch (e) { if (!manejar(e)) App.innerHTML = `<div class="wrap"><div class="err">${esc(e.message)}</div></div>`; return; }
  const p = S.progreso;
  const ring = `<div class="row" style="margin-top:18px;gap:16px"><div class="ring" style="--p:${p.pct_avance}"><b>${p.pct_avance}%</b></div><div class="sp"><div style="font:600 1rem Poppins">Tu progreso en la unidad</div><div class="small" style="opacity:.85">${p.completadas} de ${p.total} sesiones completadas</div></div></div>
  <div class="stats"><div><b>${p.pct_logro}%</b>Logro</div><div><b>${p.nota === null ? '—' : String(p.nota).replace('.', ',')}</b>Nota ref.</div><div><b style="font-size:.95rem;padding-top:3px">${esc(p.nivel)}</b>Nivel</div></div>`;
  App.innerHTML = `${hero('Hola, ' + esc(S.perfil.nombre.split(' ')[0]) + ' 👋', esc(S.perfil.curso) + ' · <span class="alias">👤 ' + esc(S.perfil.nombre || '—') + '</span>', ring)}
  <div class="wrap pull">
    <div class="card instalar noprint" id="instalar" style="display:none"><img src="img/icon-192.png" alt=""><div class="sp"><b>Instala «Clases de Economía»</b><div class="small mut">Tendrás el ícono en tu pantalla y se abrirá a pantalla completa.</div></div><button class="btn sm gold" id="ins">Instalar</button></div>
    <div class="card instalar noprint" id="iosins" style="display:none"><img src="img/icon-192.png" alt=""><div class="sp small"><b>Para instalar en iPhone:</b> toca <b>Compartir</b> ⬆️ y luego <b>«Agregar a pantalla de inicio»</b>.</div></div>
    <div class="row noprint" style="margin-bottom:10px;justify-content:flex-end"><button class="btn sm ghost" id="inf">📄 Mi informe</button>${S.previa ? '' : '<button class="btn sm ghost" id="out">Salir</button>'}</div>
    <h2 style="margin-top:6px">Sesiones</h2>
    ${S.sesiones.length ? S.sesiones.map(tarjetaSesion).join('') : '<div class="card c mut">Aún no hay sesiones publicadas.</div>'}
  </div>`;
  $$('.ses').forEach(b => b.onclick = () => verSesion(b.dataset.id));
  if ($('#out')) $('#out').onclick = cerrarSesion;
  const standalone = matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!standalone && !S.previa) {
    if (instalarEvt) $('#instalar').style.display = '';
    else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) $('#iosins').style.display = '';
    $('#ins').onclick = async () => { if (instalarEvt) { instalarEvt.prompt(); await instalarEvt.userChoice; instalarEvt = null; $('#instalar').style.display = 'none'; } };
  }
  $('#inf').onclick = async ev => { ev.target.disabled = true; try { const d = await API.call('miInforme'); descargarBase64(d.nombre, d.base64); } catch (e) { toast(e.message, 4500); } ev.target.disabled = false; };
  if (sesionQR && S.sesiones.some(s => s.id === sesionQR)) { const q = sesionQR; history.replaceState(null, '', location.pathname); verSesion(q); }
}
function chipEstado(e, vivo) { if (vivo) return '<span class="chip bad">🔴 En vivo</span>'; return { abierta: '<span class="chip ok">Abierta</span>', cerrada: '<span class="chip bad">Plazo cerrado</span>', proximamente: '<span class="chip warn">Próximamente</span>' }[e] || ''; }
function tarjetaSesion(s) {
  return `<button class="card ses ${s.estado} row" data-id="${esc(s.id)}" style="gap:14px"><div class="n">${s.numero}</div><div class="sp"><div class="row" style="gap:8px"><b>${esc(s.titulo)}</b></div>
  <div class="small mut">${s.estado === 'abierta' ? 'Cierra: ' + fmtFecha(s.cierre) : s.estado === 'cerrada' ? 'Cerró: ' + fmtFecha(s.cierre) : 'Abre: ' + fmtFecha(s.apertura)}</div>
  <div class="bar" style="margin:8px 0 4px"><i style="width:${s.actividades ? Math.round(s.respondidas / s.actividades * 100) : 0}%"></i></div>
  <div class="small mut">${s.respondidas}/${s.actividades} actividades${s.pendientes ? ' · ' + s.pendientes + ' en revisión' : ''}${s.nota !== null ? ' · Nota ' + String(s.nota).replace('.', ',') : ''}</div></div>${chipEstado(s.estado, s.enVivo)}</button>`;
}

/* ---------- Sesión: material + participar ---------- */
async function verSesion(id) {
  cargando('Abriendo la sesión…');
  try { S.ses = await API.call('sesion', { sesion: id }); } catch (e) { if (!manejar(e)) { toast(e.message); inicio(); } return; }
  pintarSesion('part');
}
function pintarSesion(tab) {
  const s = S.ses; const r = s.respuestas || {}; const acts = s.pasos.filter(esAct);
  const hechas = acts.filter(p => r[p.id]).length;
  let cuerpo = '';
  if (tab === 'mat') {
    cuerpo = s.material.length ? s.material.map(m => {
      const ab = urlAbrir(m);
      return `<div class="card"><div class="row"><span style="font-size:1.4rem">${m.tipo === 'video' ? '🎬' : m.tipo === 'enlace' ? '🔗' : '📄'}</span><b>${esc(m.titulo)}</b></div>
      ${m.descripcion ? `<p class="small mut">${esc(m.descripcion)}</p>` : ''}
      ${bloqueEmbed(m)}
      ${ab ? `<a class="btn sm ghost" style="margin-top:10px" href="${esc(ab)}" target="_blank" rel="noopener">Abrir en pantalla aparte</a>` : '<div class="small mut">El docente aún no publica este enlace.</div>'}</div>`;
    }).join('') : '<div class="card c mut">No hay material para esta sesión.</div>';
  } else if (tab === 'res') {
    cuerpo = acts.map(p => {
      const x = r[p.id]; const nota = x ? (x.puntaje === null ? '<span class="chip warn">En revisión</span>' : `<span class="chip ${x.puntaje >= p.puntos * .6 ? 'ok' : 'bad'}">${x.puntaje}/${p.puntos}</span>`) : '<span class="chip">Sin responder</span>';
      return `<div class="card"><div class="row"><b class="sp">${esc(p.titulo || p.pregunta)}</b>${nota}</div>${x && x.comentario ? `<div class="fb neu small">💬 ${esc(x.comentario)}</div>` : ''}</div>`;
    }).join('') || '<div class="card c mut">Sin actividades.</div>';
    if (hechas) cuerpo += '<button class="btn block ghost" id="mail">📧 Enviar copia formal a mi correo</button>';
  } else {
    const ab = s.estado === 'abierta';
    cuerpo = `<div class="card"><h3>${esc(s.titulo)}</h3><p class="mut">${esc(s.descripcion || '')}</p>
      <div class="row small"><span>📅 ${s.estado === 'abierta' ? 'Cierra ' + fmtFecha(s.cierre) : s.estado === 'cerrada' ? 'Cerró ' + fmtFecha(s.cierre) : 'Abre ' + fmtFecha(s.apertura)}</span>${chipEstado(s.estado)}</div>
      <div class="bar" style="margin:12px 0 4px"><i style="width:${acts.length ? hechas / acts.length * 100 : 0}%"></i></div><div class="small mut">${hechas} de ${acts.length} actividades respondidas</div></div>
      ${ab ? `${s.bloqueo === 'SI' ? `<div class="info">🔒 <b>Modo concentración:</b> mientras participas no puedes abrir otra app ni otra página. Si sales, tu participación se detiene y solo el docente puede autorizarte a volver.</div>` : ''}
        ${s.miEstado === 'bloqueado' ? '<div class="info">Tu participación fue suspendida. Entra y espera la autorización del docente.</div>' : ''}
        ${s.ritmo === 'docente' ? '<div class="info" style="background:var(--badbg);color:var(--bad)">🔴 <b>Clase en vivo:</b> tu docente guía la presentación y las actividades. Entra y sigue su ritmo.</div>' : ''}
        <button class="btn block" id="ent">${s.ritmo === 'docente' ? '🔴 Entrar a la clase en vivo' : hechas ? 'Continuar participando' : 'Entrar a participar'} →</button>`
        : `<div class="info">${s.estado === 'cerrada' ? 'El plazo terminó: ya no puedes responder actividades, pero puedes revisar el material y tus resultados.' : 'Esta sesión aún no se abre.'}</div>`}`;
  }
  App.innerHTML = `${banner()}<div class="hero"><div class="stars"></div><div class="in"><div class="hero-top"><img class="logo" src="img/insignia.png" alt=""><div class="sp"><div class="brand">Colegio Marina de Chile<small>Clases de Economía</small></div></div><button class="btn sm ghost" id="back" style="color:#fff;border-color:rgba(255,255,255,.4)">← Volver</button></div><h1>Sesión ${s.numero}</h1><p>${esc(s.titulo)}</p></div></div>
  <div class="wrap pull"><div class="tabs"><button class="tab ${tab === 'part' ? 'on' : ''}" data-t="part">Participar</button><button class="tab ${tab === 'mat' ? 'on' : ''}" data-t="mat">Material y videos</button><button class="tab ${tab === 'res' ? 'on' : ''}" data-t="res">Mis resultados</button></div>${cuerpo}</div>`;
  $('#back').onclick = inicio; $$('.tab').forEach(b => b.onclick = () => pintarSesion(b.dataset.t));
  if ($('#ent')) $('#ent').onclick = () => entrarPart();
  if ($('#mail')) $('#mail').onclick = async ev => { ev.target.disabled = true; try { const d = await API.call('enviarCopia', { sesion: s.id }); toast(d.estado === 'enviado' ? '📧 Copia enviada a tu correo institucional.' : 'Ya te enviamos una copia hace unos minutos.', 4500); } catch (e) { toast(e.message, 5000); } ev.target.disabled = false; };
}

/* ---------- Modo participación ---------- */
function setVivo(d) { S.vivo = { paso: d.paso ?? d.paso_actual ?? 0, fase: d.fase || 'diapositiva', t: d.t || 0, dur: d.dur || 20, retro: d.retro || '', off: (d.ahora || Date.now()) - Date.now() }; }
const claveVivo = v => v.paso + '|' + v.fase + '|' + v.retro;
async function entrarPart() {
  const s = S.ses; const b = $('#ent'); b.disabled = true;
  try {
    const d = await API.call('entrar', { sesion: s.id });
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) { }
    S.enPart = true; S.bloqueado = d.estado === 'bloqueado'; S.ritmoDoc = d.ritmo === 'docente'; setVivo(d);
    const primero = s.pasos.findIndex(p => esAct(p) && !s.respuestas[p.id]);
    S.idx = Math.max(0, Math.min(S.idx, s.pasos.length - 1));
    if (!S.ritmoDoc && S.idx === 0 && primero > 0 && Object.keys(s.respuestas).length) S.idx = primero;
    document.addEventListener('visibilitychange', alVisibilidad); window.addEventListener('pagehide', alSalirPagina); window.addEventListener('beforeunload', antesDeCerrar);
    document.addEventListener('fullscreenchange', alPantalla); document.addEventListener('click', bloquearEnlaces, true); document.addEventListener('contextmenu', bloquearMenu);
    programarLatido();
    if (S.bloqueado) return pintarBloqueo(); pintarPaso();
  } catch (e) { if (!manejar(e)) { toast(e.message, 4500); b.disabled = false; } }
}
function programarLatido() { clearTimeout(S.hb); S.hb = setTimeout(async () => { await latir(); if (S.enPart) programarLatido(); }, S.ritmoDoc ? 2500 : 4000); }
function detenerPart() {
  S.enPart = false; clearTimeout(S.hb); clearInterval(S.poll); clearInterval(S.tick);
  document.removeEventListener('visibilitychange', alVisibilidad); window.removeEventListener('pagehide', alSalirPagina); window.removeEventListener('beforeunload', antesDeCerrar);
  document.removeEventListener('fullscreenchange', alPantalla); document.removeEventListener('click', bloquearEnlaces, true); document.removeEventListener('contextmenu', bloquearMenu);
  const f = $('.lock.fsw'); if (f) f.remove(); const pt = $('.part'); if (pt) pt.remove();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }   // al terminar, vuelve a la pantalla normal
}
/* Durante la participación: sin pestañas nuevas, sin menú contextual y con pantalla completa */
function bloquearEnlaces(e) { const a = e.target.closest && e.target.closest('a[target="_blank"]'); if (a && S.enPart && !S.bloqueado) { e.preventDefault(); e.stopPropagation(); toast('Durante la actividad no puedes abrir otras ventanas.'); } }
function bloquearMenu(e) { if (S.enPart) e.preventDefault(); }
function alPantalla() {
  if (!S.enPart || S.bloqueado || document.fullscreenElement || !document.documentElement.requestFullscreen || S.previa) return;
  if ($('.lock.fsw')) return;
  const o = document.createElement('div'); o.className = 'lock fsw';
  o.innerHTML = '<div class="box"><img src="img/insignia.png" width="84" alt=""><h2 style="margin-top:12px">Pantalla completa</h2><p>Para seguir participando, vuelve a pantalla completa.</p><button class="btn gold block" id="fsb">Volver a pantalla completa</button></div>';
  document.body.appendChild(o);
  $('#fsb').onclick = async () => { try { await document.documentElement.requestFullscreen(); } catch (e) { } o.remove(); };
}
function antesDeCerrar(e) { if (S.enPart && !S.bloqueado && S.ses.bloqueo === 'SI') { e.preventDefault(); e.returnValue = ''; } }
function marcarSalida(motivo) {
  if (!S.enPart || S.bloqueado || S.ses.bloqueo !== 'SI') return;
  S.bloqueado = true; API.call('salir', { sesion: S.ses.id, motivo }, { keepalive: true }).catch(() => { });
}
function alVisibilidad() {
  if (document.hidden) marcarSalida('cambió de app o pestaña');
  else if (S.enPart) { pintarBloqueo(); }
}
function alSalirPagina() { marcarSalida('cerró o recargó la página'); }
async function latir() {
  if (!S.enPart || S.bloqueado || document.hidden) return;
  try {
    const d = await API.call('latido', { sesion: S.ses.id, vista: S.ritmoDoc && S.vivo ? S.vivo.paso : S.idx });
    if (d.estado === 'bloqueado') { S.bloqueado = true; return pintarBloqueo(); }
    if (d.cerrada) { toast('El plazo de la sesión terminó.'); return finalizarPart(); }
    const antes = S.vivo ? claveVivo(S.vivo) : ''; const era = S.ritmoDoc; S.ritmoDoc = d.ritmo === 'docente'; setVivo(d);
    if (S.ritmoDoc && (claveVivo(S.vivo) !== antes || !era)) pintarPaso();
    else if (!S.ritmoDoc && era) pintarPaso();
  } catch (e) { if (e.code === 'SESION_EXPIRADA') manejar(e); }
}
function pintarBloqueo() {
  if (!S.bloqueado) return;
  let ov = $('.lock'); if (!ov) { ov = document.createElement('div'); ov.className = 'lock'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="box"><div class="ic">🔒</div><h1>Participación suspendida</h1><p>Saliste de la aplicación mientras participabas. Tu participación se detuvo.</p><p><b>Espera a que tu docente te autorice para volver.</b></p><p class="small" style="opacity:.8"><span class="spin" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></span> Verificando autorización…</p><button class="btn ghost" id="cl" style="color:#fff;border-color:rgba(255,255,255,.5)">Cerrar y volver al inicio</button></div>`;
  $('#cl').onclick = () => { ov.remove(); detenerPart(); S.bloqueado = false; inicio(); };
  clearInterval(S.poll);
  S.poll = setInterval(async () => {
    if (document.hidden) return;
    try {
      const d = await API.call('latido', { sesion: S.ses.id });
      if (d.cerrada) { ov.remove(); clearInterval(S.poll); toast('El plazo terminó.'); return finalizarPart(); }
      if (d.estado === 'activo') { clearInterval(S.poll); S.bloqueado = false; ov.remove(); setVivo(d); S.ritmoDoc = d.ritmo === 'docente'; toast('✅ El docente te autorizó. ¡Sigue participando!'); try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } pintarPaso(); }
    } catch (e) { manejar(e); }
  }, 4000);
}
async function finalizarPart() { detenerPart(); const o = $('.lock'); if (o) o.remove(); await verSesion(S.ses.id); }
async function terminarPart() {
  if (!confirm('¿Terminar tu participación en esta sesión? Podrás volver mientras el plazo esté abierto.')) return;
  const s = S.ses;
  await API.call('salir', { sesion: s.id, motivo: 'terminó voluntariamente' }).catch(() => { }); S.bloqueado = false;
  API.call('enviarCopia', { sesion: s.id, auto: true }).then(d => { if (d.estado === 'enviado') toast('📧 Te enviamos una copia de tus actividades a tu correo institucional.', 5000); }).catch(() => { });
  detenerPart(); const l = $('.lock'); if (l) l.remove(); verSesion(s.id);
}

/* ---------- Pasos ---------- */
function slideHtml(p) {
  if (p.tipo === 'documento') return `<div class="card slide"><h2>${esc(p.titulo || 'Material')}</h2>${p.texto ? md(p.texto) : ''}${bloqueEmbed(p) || `<a class="btn" href="${esc(urlAbrir(p))}" target="_blank" rel="noopener">Abrir material</a>`}</div>`;
  return slideStage(p, false);
}
function montarPart(top, body, foot) {
  const prev = document.querySelector('.part'); if (prev) prev.remove();
  const w = document.createElement('div'); w.className = 'part';
  w.innerHTML = `<div class="top">${top}</div><div class="body">${body}</div>${foot || ''}`; document.body.appendChild(w); return w;
}
function pintarPaso() {
  if (S.ritmoDoc) return pintarVivo();
  const s = S.ses; const p = s.pasos[S.idx]; const n = s.pasos.length;
  const html = esAct(p) ? `<div class="card">${cuerpoActividad(p)}</div>` : slideHtml(p);
  montarPart(`<div class="row"><img src="img/insignia.png" alt=""><span class="live"></span><b class="sp small">Sesión ${s.numero} · ${S.idx + 1}/${n}</b><button class="btn sm ghost" id="sal" style="color:#fff;border-color:rgba(255,255,255,.4)">Terminar</button></div><div class="bar" style="margin-top:8px;background:rgba(255,255,255,.2)"><i style="width:${(S.idx + 1) / n * 100}%"></i></div>`, html,
    `<div class="foot"><button class="btn ghost" id="ant" ${S.idx === 0 ? 'disabled' : ''}>← Anterior</button><span class="sp"></span><button class="btn" id="sig" ${S.idx >= n - 1 ? 'disabled' : ''}>Siguiente →</button></div>`);
  $('#ant').onclick = () => { S.idx--; pintarPaso(); }; $('#sig').onclick = () => { S.idx++; pintarPaso(); }; $('#sal').onclick = terminarPart;
  if (esAct(p)) enlazarActividad(p);
}

/* ---------- Modo en vivo (el docente guía: estilo Kahoot / Mentimeter) ---------- */
function pintarVivo() {
  const s = S.ses, v = S.vivo, p = s.pasos[v.paso]; if (!p) return;
  clearInterval(S.tick);
  const acts = s.pasos.filter(esAct); const act = esAct(p); const nAct = acts.indexOf(p) + 1; const r = s.respuestas[p.id];
  let body = '', timer = '';
  if (!act) body = slideHtml(p) + '<p class="c mut small" style="margin-top:12px">📺 Sigue la clase: tu docente avanzará.</p>';
  else if (v.fase === 'espera') body = `<div class="card c big-msg"><div class="emoji">🎯</div><h2>Pregunta ${nAct} de ${acts.length}</h2><p class="mut">¡Prepárate! Tu docente la lanzará en un momento…</p></div>`;
  else if (v.fase === 'pregunta') {
    timer = '<div class="timer"><i id="tbar"></i><b id="tnum"></b></div>';
    body = r ? '<div class="card c big-msg"><div class="emoji">✅</div><h2>¡Respuesta enviada!</h2><p class="mut">Espera los resultados…</p></div>' : `<div class="card">${cuerpoActividad(p)}</div>`;
  } else body = '<div id="vres"><div class="c"><span class="spin"></span></div></div>';
  montarPart(`<div class="row"><img src="img/insignia.png" alt=""><span class="live"></span><span class="alias sp">${esc(S.perfil.nombre || 'Participante')}</span><span class="chip navy">En vivo</span><button class="btn sm ghost" id="sal" style="color:#fff;border-color:rgba(255,255,255,.4)">Terminar</button></div>${timer}`, body);
  $('#sal').onclick = terminarPart;
  if (act && v.fase === 'pregunta') {
    const tic = () => {
      const left = v.t + v.dur * 1000 - (Date.now() + v.off); const f = Math.max(0, left / (v.dur * 1000));
      const b = $('#tbar'), n = $('#tnum'); if (b) b.style.width = f * 100 + '%'; if (n) n.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) { clearInterval(S.tick); if (S.vivo === v && S.enPart) { v.fase = 'cerrada'; pintarVivo(); } }
    };
    tic(); S.tick = setInterval(tic, 250);
    if (!r) enlazarActividad(p);
  }
  if (act && ['cerrada', 'resultados', 'ranking'].includes(v.fase)) cargarResultados(p, claveVivo(v));
}
async function cargarResultados(p, clave, intento = 0) {
  let d; try { d = await API.call('vivoResultados', { sesion: S.ses.id }); } catch (e) { return; }
  if (!S.vivo || claveVivo(S.vivo) !== clave) return; const box = $('#vres'); if (!box) return;
  const v = S.vivo; let h = '';
  if (v.fase === 'ranking') {
    h = `<div class="card"><h2 class="c">🏆 Ranking</h2>${podioHtml(d.top, S.perfil.alias)}<p class="c" style="margin-top:12px">${d.miPos ? `Tu puesto: <b>#${d.miPos}</b> de ${d.total} · <b>${d.miPts}</b> puntos` : 'Aún no tienes puntos en esta sesión.'}</p></div>`;
  } else {
    h = miResultadoHtml(p, d) + (v.fase === 'resultados' ? `<div class="card">${aggHtml(p, d.agregado, d.correcta)}</div>` : '');
  }
  if (d.retro) h += `<div class="card retro"><b>🧑‍🏫 Retroalimentación para el curso</b><p>${md(d.retro)}</p></div>`;
  box.innerHTML = h;
  if (p.tipo === 'abierta' && d.mi && d.mi.puntaje === null && intento < 30) setTimeout(() => cargarResultados(p, clave, intento + 1), 4000);
}
function miResultadoHtml(p, d) {
  const m = d.mi;
  if (!m) return '<div class="card c big-msg"><div class="emoji">⏱</div><h2>No alcanzaste a responder</h2><p class="mut">¡La próxima vas con todo!</p></div>';
  if (['opcion', 'vf', 'numerica'].includes(p.tipo)) {
    const ok = m.puntaje > 0; const corr = p.tipo === 'opcion' ? 'ABCDEFGH'[d.correcta] + '. ' + (p.opciones || [])[d.correcta] : p.tipo === 'vf' ? (d.correcta === 'V' ? 'Verdadero' : 'Falso') : d.correcta;
    return `<div class="card c big-msg ${ok ? 'okc' : 'badc'}"><div class="emoji">${ok ? '🎉' : '😅'}</div><h2>${ok ? '¡Correcto!' : 'Incorrecto'}</h2>${ok ? `<p class="pts">+${m.juego || 0} puntos</p>` : `<p>La respuesta correcta era: <b>${esc(corr)}</b></p>`}${d.explicacion ? `<p class="small">${esc(d.explicacion)}</p>` : ''}</div>`;
  }
  if (p.tipo === 'abierta') return m.puntaje === null ? '<div class="card c big-msg"><div class="emoji">📝</div><h2>Respuesta enviada</h2><p class="mut">Tu retroalimentación individual aparecerá aquí.</p></div>' : `<div class="card okc"><h3>Tu retroalimentación</h3><p>Puntaje: <b>${m.puntaje}/${p.puntos}</b></p>${m.comentario ? `<p>💬 ${esc(m.comentario)}</p>` : ''}</div>`;
  return '<div class="card c big-msg"><div class="emoji">🙌</div><h2>¡Gracias por participar!</h2></div>';
}

/* ---------- Actividades ---------- */
function tilesHtml(items, p, r, hecho, corr, attr) {
  return '<div class="tiles">' + items.map((o, i) => {
    let c = `tile t${p.tipo === 'vf' ? (i === 0 ? 1 : 0) : i % 4}`;
    const val = attr === 'v' ? (i === 0 ? 'V' : 'F') : String(i);
    if (hecho && corr !== undefined) { if (val === String(corr)) c += ' good'; else c += ' dim'; if (r && val === String(r.respuesta)) c += ' mine'; }
    else if (hecho) { if (r && val === String(r.respuesta)) c += ' mine'; else c += ' dim'; }
    return `<button class="${c}" data-${attr}="${val}" ${hecho ? 'disabled' : ''}><span class="sh">${p.tipo === 'vf' ? (i === 0 ? '✔' : '✖') : FORMAS[i % 4]}</span><span>${esc(o)}</span></button>`;
  }).join('') + '</div>';
}
function cuerpoActividad(p) {
  const r = S.ses.respuestas[p.id]; const hecho = !!r;
  const tag = { encuesta: 'Encuesta', nube: 'Nube de palabras', escala: 'Escala' }[p.tipo] || 'Actividad';
  let h = `<div class="row"><span class="chip navy">${tag}</span><span class="chip">${p.puntos} pt${p.puntos > 1 ? 's' : ''}</span></div><h3 style="margin-top:10px">${esc(p.pregunta)}</h3>`;
  const corr = p.correcta;
  if (p.tipo === 'opcion') h += tilesHtml(p.opciones, p, r, hecho, corr, 'i');
  else if (p.tipo === 'vf') h += tilesHtml(['Verdadero', 'Falso'], p, r, hecho, corr, 'v');
  else if (p.tipo === 'encuesta') h += hecho ? '<div id="res"><div class="fb ok">✅ Respuesta registrada. ¡Gracias por participar!</div></div>' : tilesHtml(p.opciones, p, r, false, undefined, 'i');
  else if (p.tipo === 'numerica') h += `<input id="num" inputmode="decimal" placeholder="Escribe un número" value="${hecho ? esc(r.respuesta) : ''}" ${hecho ? 'disabled' : ''}>${hecho ? '' : '<button class="btn block" id="env" style="margin-top:12px">Responder</button>'}`;
  else if (p.tipo === 'nube') h += hecho ? `<div class="fb ok">✅ Enviaste: «${esc(r.respuesta)}»</div>` : '<input id="nb" maxlength="30" placeholder="Una palabra o frase corta" autocomplete="off"><button class="btn block" id="env" style="margin-top:12px">Enviar</button>';
  else if (p.tipo === 'escala') h += `<div class="escala">${[1, 2, 3, 4, 5].map(n => `<button class="esc ${hecho && String(n) === String(r.respuesta) ? 'sel' : ''}" data-e="${n}" ${hecho ? 'disabled' : ''}>${n}</button>`).join('')}</div><div class="row small mut"><span>Muy en desacuerdo</span><span class="sp"></span><span>Muy de acuerdo</span></div>`;
  else {
    let vals = []; if (hecho) { try { vals = JSON.parse(r.respuesta); } catch (e) { vals = [r.respuesta]; } }
    h += (p.campos?.length ? p.campos : ['Tu respuesta']).map((c, i) => `<label for="c${i}">${esc(c)}</label><textarea id="c${i}" maxlength="1500">${esc(vals[i] || '')}</textarea>`).join('') + `<button class="btn block" id="env" style="margin-top:12px">${hecho ? 'Actualizar respuesta' : 'Enviar respuesta'}</button>`;
  }
  if (hecho && !S.ritmoDoc) h += feedback(p, r);
  return h + '<div id="fb"></div>';
}
function feedback(p, r) {
  if (['encuesta', 'nube', 'escala'].includes(p.tipo)) return '';
  if (p.tipo === 'abierta') return r.puntaje === null ? '<div class="fb neu">✅ Respuesta enviada. Tu docente la está revisando.</div>' : `<div class="fb ok">Puntaje: <b>${r.puntaje}/${p.puntos}</b>${r.comentario ? '<br>💬 ' + esc(r.comentario) : ''}</div>`;
  const ok = r.puntaje > 0; return `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? '🎉 ¡Correcto!' : '❌ Incorrecto.'} ${p.explicacion ? esc(p.explicacion) : ''}</div>`;
}
function enlazarActividad(p) {
  const enviar = async valor => {
    const fb = $('#fb'); fb.innerHTML = '<span class="spin"></span>';
    try {
      const d = await API.call('responder', { sesion: S.ses.id, paso: p.id, respuesta: valor });
      S.ses.respuestas[p.id] = { respuesta: Array.isArray(valor) ? JSON.stringify(valor) : String(valor), puntaje: d.puntaje, comentario: '', estado: d.estado };
      if (d.correcta !== undefined) { p.correcta = d.correcta; p.explicacion = d.explicacion; }
      pintarPaso();
      if (d.resultados && $('#res')) { const t = d.resultados.reduce((a, b) => a + b, 0) || 1; $('#res').innerHTML = p.opciones.map((o, i) => `<div style="margin:10px 0"><div class="row small"><span class="sp">${esc(o)}</span><b>${Math.round(d.resultados[i] / t * 100)}%</b></div><div class="bar"><i style="width:${d.resultados[i] / t * 100}%"></i></div></div>`).join(''); }
    } catch (e) {
      if (e.message === 'BLOQUEADO') { S.bloqueado = true; return pintarBloqueo(); }
      if (!manejar(e)) fb.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  };
  if (p.tipo === 'opcion' || p.tipo === 'encuesta') $$('.tile:not([disabled])').forEach(b => b.onclick = () => enviar(b.dataset.i));
  else if (p.tipo === 'vf') $$('.tile:not([disabled])').forEach(b => b.onclick = () => enviar(b.dataset.v));
  else if (p.tipo === 'escala') $$('.esc:not([disabled])').forEach(b => b.onclick = () => enviar(b.dataset.e));
  else if (p.tipo === 'numerica') { if ($('#env')) $('#env').onclick = () => enviar($('#num').value); }
  else if (p.tipo === 'nube') { if ($('#env')) { $('#env').onclick = () => enviar($('#nb').value); $('#nb').onkeydown = e => { if (e.key === 'Enter') enviar($('#nb').value); }; } }
  else $('#env').onclick = () => enviar((p.campos?.length ? p.campos : ['x']).map((_, i) => $('#c' + i).value));
}

iniciar();
