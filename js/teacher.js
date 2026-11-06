/* Panel docente */
const App = $('#app');
const T = { tab: 'ctrl', sesiones: [], sel: null, timer: null, cfg: null, dash: null, resp: null, edit: null, resultados: null };
const NOMBRE_DOC = 'Leandro Bascuñán';

function shell(contenido) {
  const tabs = [['ctrl', '🎮 Control'], ['vivo', '📡 En vivo'],['corr', '✍️ Corrección'], ['res', '📊 Resultados'], ['est', '👥 Estudiantes'], ['ses', '🗂️ Sesiones'], ['inf', '📄 Informes'], ['cfg', '⚙️ Ajustes']];
  App.innerHTML = `<div class="hero wide"><div class="stars"></div><div class="in"><div class="hero-top"><img class="logo" src="img/insignia.png" alt=""><div class="brand sp">Colegio Marina de Chile<small>Panel docente · ${esc((T.cfg && T.cfg.asignatura) || 'Economía y Sociedad')} · ${esc((T.cfg && T.cfg.nombre_unidad) || 'Unidad 4')}</small></div><button class="btn sm gold" id="vp">👁 Ver como estudiante</button><button class="btn sm ghost" id="et" title="Cambiar el nombre de la asignatura y de la unidad" style="color:#fff;border-color:rgba(255,255,255,.4)">✏️ Título</button><button class="btn sm ghost" id="out" style="color:#fff;border-color:rgba(255,255,255,.4)">Salir</button></div><h1>Hola, ${NOMBRE_DOC}</h1><p>Participación, resultados, corrección con IA e informes.</p></div></div>
  <div class="wrap wide pull"><div class="tabs">${tabs.map(t => `<button class="tab ${T.tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div id="main">${contenido || ''}</div></div>`;
  $('#out').onclick = salir; $('#et').onclick = editarTitulo; $('#vp').onclick = () => verComoEstudiante(T.tab === 'vivo' || T.tab === 'corr' ? T.sel : '');
  $$('.tab').forEach(b => b.onclick = () => ir(b.dataset.t));
}
/** Cambia el nombre de la asignatura y de la unidad (aparece en el panel, en las pantallas de los estudiantes, informes y correos). */
function editarTitulo() {
  const c = T.cfg || {}; const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><div class="row"><h3 class="sp" style="margin:0">✏️ Título de la asignatura y la unidad</h3><button type="button" class="btn sm ghost" id="tx" aria-label="Cerrar">✕</button></div>
  <label>Asignatura</label><input id="t_asig" value="${esc(c.asignatura || '')}" placeholder="Economía y Sociedad">
  <label>Unidad</label><input id="t_uni" value="${esc(c.nombre_unidad || '')}" placeholder="Unidad 4 · Comercio internacional">
  <label>Establecimiento</label><input id="t_col" value="${esc(c.colegio || '')}" placeholder="Colegio Marina de Chile · Concepción">
  <div class="hint">Se muestra en el panel, en las pantallas de los estudiantes, en los informes PDF y en los correos.</div><div id="tmsg"></div>
  <div class="row" style="margin-top:14px"><button type="button" class="btn gold" id="t_ok">Guardar</button><button type="button" class="btn ghost" id="t_no">Cancelar</button></div></div>`;
  document.body.appendChild(m);
  const cerrar = () => { m.remove(); document.removeEventListener('keydown', escT); }; const escT = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', escT);
  $('#tx', m).onclick = cerrar; $('#t_no', m).onclick = cerrar; m.onclick = e => { if (e.target === m) cerrar(); };
  $('#t_ok', m).onclick = async () => {
    const cfgN = { asignatura: $('#t_asig', m).value.trim(), nombre_unidad: $('#t_uni', m).value.trim(), colegio: $('#t_col', m).value.trim() };
    if (!cfgN.asignatura || !cfgN.nombre_unidad) return $('#tmsg', m).innerHTML = '<div class="err">Escribe la asignatura y la unidad.</div>';
    try { await API.call('docGuardarConfig', { config: cfgN }); T.cfg = { ...T.cfg, ...cfgN }; cerrar(); toast('Título actualizado ✅'); ir(T.tab); } catch (e) { $('#tmsg', m).innerHTML = `<div class="err">${esc(e.message)}</div>`; if (e.code === 'SESION_EXPIRADA') { cerrar(); manejar(e); } }
  };
}/** Abre la app de estudiantes en una ventana con formato de celular, en modo vista previa (no guarda datos). */
function verComoEstudiante(sid) {
  const w = window.open('about:blank', 'vistaprevia', 'width=410,height=860');
  API.call('docVistaPrevia').then(d => {
    const base = location.href.replace(/docente\.html.*$/, '');
    const u = base + 'index.html?previa=' + encodeURIComponent(d.token) + (sid ? '&s=' + encodeURIComponent(sid) : '');
    if (w) w.location.href = u; else location.href = u;
  }).catch(e => { if (w) w.close(); manejar(e); });
}
async function subirArchivo(file, onProg) {
  const mime = file.type || 'application/octet-stream';
  const ini = await API.call('docSubidaIniciar', { nombre: file.name, mime, tamano: file.size });
  const CH = 3 * 1024 * 1024; let pos = 0, res = null;   // 3 MB = múltiplo de 256 KB
  while (pos < file.size) {
    const fin = Math.min(pos + CH, file.size); const u = new Uint8Array(await file.slice(pos, fin).arrayBuffer()); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    res = await API.call('docSubidaParte', { url: ini.sesion, data: btoa(s), inicio: pos, total: file.size, mime });
    pos = fin; onProg(pos / file.size);
  }
  if (!res || !res.listo) throw new Error('La subida no se completó. Inténtalo de nuevo.');
  return res;
}
function salir() { clearInterval(T.timer); store.del('dtok'); API.token = null; login(); }
function manejar(e) { if (e.code === 'SESION_EXPIRADA') { toast('Sesión expirada. Ingresa de nuevo.'); salir(); return true; } toast(e.message, 5000); return false; }

/* ---------- Login (solo clave) ---------- */
function login() {
  App.innerHTML = `<div class="hero"><div class="stars"></div><div class="in"><div class="hero-top"><img class="logo big" src="img/insignia.png" alt=""><div class="brand">Colegio Marina de Chile<small>Panel docente</small></div></div><h1>${NOMBRE_DOC}</h1><p>Administrador</p></div></div>
  <div class="wrap pull"><form class="card" id="f"><label for="k">Clave</label><input id="k" type="password" autocomplete="current-password" required autofocus><div id="m"></div><button class="btn block" style="margin-top:14px">Ingresar</button></form></div>`;
  $('#f').onsubmit = async ev => {
    ev.preventDefault(); const b = $('#f button'); b.disabled = true;
    try { const d = await API.call('docLogin', { clave: $('#k').value }); API.token = d.token; store.set('dtok', d.token); T.planilla = d.planilla; await arrancar(); }
    catch (e) { $('#m').innerHTML = `<div class="err">${esc(e.message)}</div>`; b.disabled = false; }
  };
}
async function arrancar() {
  shell('<div class="c"><span class="spin"></span></div>');
  try { T.sesiones = (await API.call('docSesiones')).sesiones; T.cfg = await API.call('docConfig'); } catch (e) { return manejar(e); }
  if (!T.sel && T.sesiones.length) T.sel = T.sesiones[0].id;
  ir(T.tab);
}
function ir(t) {
  clearInterval(T.timer); T.tab = t; shell('');
  clearInterval(T.tick); if (T.keyH) { document.removeEventListener('keydown', T.keyH); T.keyH = null; }
  ({ ctrl: vCtrl, vivo: vVivo, corr: vCorr, res: vRes, est: vEst, ses: vSes, inf: vInf, cfg: vCfg })[t]();
}
function selSesion(id = 'sel') {
  return `<select id="${id}" style="max-width:380px">${T.sesiones.map(s => `<option value="${esc(s.id)}" ${s.id === T.sel ? 'selected' : ''}>Sesión ${s.numero} · ${esc(s.titulo)}</option>`).join('')}</select>`;
}

/* ---------- EN VIVO ---------- */
function vVivo() {
  if (!T.sel) { $('#main').innerHTML = '<div class="card c mut">Crea una sesión en la pestaña «Sesiones».</div>'; return; }
  const url = location.href.replace(/docente\.html.*$/, '') + 'index.html?s=' + encodeURIComponent(T.sel);
  $('#main').innerHTML = `<div class="sidebyside"><div><div class="card"><label>Sesión</label>${selSesion()}<div class="qrbox"><div class="qr" style="margin-top:12px"><div id="qr"></div></div><div class="small mut c" style="margin-top:8px;word-break:break-all">${esc(url)}</div><button class="btn sm ghost block" id="fs" style="margin-top:8px">🖥️ QR a pantalla completa</button></div></div>
  <div class="card"><h3>Control de la clase</h3><p class="small mut">Para guiar la presentación (avanzar, retroceder, lanzar preguntas) usa la pestaña <b>🎮 Control</b>.</p><button class="btn sm block" id="irc">🎮 Ir al control</button><button class="btn sm gold block" id="vps" style="margin-top:8px">👁 Ver esta sesión como estudiante</button><button class="btn sm ghost block" id="enl" style="margin-top:8px">✉ Enviar enlace por correo</button></div></div>
  <div id="live"><div class="c"><span class="spin"></span></div></div></div>`;
  new QRCode($('#qr'), { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  $('#sel').onchange = e => { T.sel = e.target.value; vVivo(); };
  $('#fs').onclick = () => { const w = document.createElement('div'); w.className = 'lock'; w.style.background = '#fff'; w.innerHTML = `<div class="c" style="color:#0b2545"><h1 style="font-size:2.2rem">Escanea para participar</h1><div id="qq" style="display:inline-block;padding:16px;background:#fff"></div><p style="font-size:1.1rem">Sesión ${T.sesiones.find(s => s.id === T.sel).numero}</p></div>`; w.onclick = () => w.remove(); document.body.appendChild(w); const sz = Math.min(innerWidth, innerHeight) * .6; new QRCode($('#qq'), { text: url, width: sz, height: sz }); };
  $('#vps').onclick = () => verComoEstudiante(T.sel); $('#irc').onclick = () => ir('ctrl'); $('#enl').onclick = () => enviarEnlaceUI();
  refrescarVivo(); T.timer = setInterval(refrescarVivo, 8000);
}
async function refrescarVivo() {
  if (T.tab !== 'vivo' || document.hidden || !$('#live')) return;
  try { T.dash = await API.call('docDashboard', { sesion: T.sel }); } catch (e) { return manejar(e); }
  const d = T.dash, s = d.sesion, A = d.alumnos;
  const est = a => a.estado === 'activo' ? (d.ahora - a.ultima > 30000 ? 'sin_senal' : 'activo') : a.estado;
  const n = k => A.filter(a => est(a) === k).length;
  const chip = a => { const e = est(a); return { activo: '<span class="chip ok"><span class="live"></span> Participando</span>', sin_senal: '<span class="chip warn">Sin señal</span>', bloqueado: '<span class="chip bad">Salió · suspendido</span>', autorizado: '<span class="chip navy">Autorizado, esperando</span>', ausente: '<span class="chip">No ha entrado</span>' }[e]; };
  const orden = { bloqueado: 0, sin_senal: 1, autorizado: 2, activo: 3, ausente: 4 };
  $('#live').innerHTML = `<div class="kpis"><div class="kpi"><b>${n('activo')}</b><span>Participando</span></div><div class="kpi"><b style="color:var(--bad)">${n('bloqueado')}</b><span>Suspendidos</span></div><div class="kpi"><b>${A.filter(a => a.estado !== 'ausente').length}</b><span>Han ingresado</span></div><div class="kpi"><b>${A.reduce((x, a) => x + a.respuestas, 0)}</b><span>Respuestas</span></div></div>
  <div class="row" style="margin-bottom:8px"><b class="sp">${esc(s.titulo)} · ${chipSes(s.estado)}</b><button class="btn sm gold" id="auto" ${n('bloqueado') ? '' : 'disabled'}>🔓 Autorizar a todos los suspendidos</button></div>
  <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>Curso</th><th>Estado</th><th>Entrada</th><th>Salida / últ. señal</th><th>Salidas</th><th>Resp.</th><th>Pts</th><th></th></tr>
  ${A.sort((a, b) => orden[est(a)] - orden[est(b)] || a.nombre.localeCompare(b.nombre)).map(a => `<tr><td><b>${esc(a.nombre)}</b><div class="small mut">${esc(a.rut)}</div></td><td>${esc(a.curso)}</td><td>${chip(a)}</td><td>${fmtHora(a.entrada)}</td><td>${est(a) === 'activo' ? fmtHora(a.ultima) : fmtHora(a.salida || a.ultima)}</td><td>${a.salidas}</td><td>${a.respuestas}/${s.actividades}</td><td>${a.puntaje}/${s.max}</td><td>${a.estado === 'bloqueado' ? `<button class="btn sm gold" data-rut="${esc(a.rut)}">Autorizar</button>` : ''}</td></tr>`).join('')}</table></div>`;
  $$('[data-rut]').forEach(b => b.onclick = () => autorizar([b.dataset.rut]));
  $('#auto').onclick = () => autorizar('todos');
}
function chipSes(e) { return { abierta: '<span class="chip ok">abierta</span>', cerrada: '<span class="chip bad">cerrada</span>', proximamente: '<span class="chip warn">próximamente</span>', borrador: '<span class="chip">borrador</span>' }[e]; }
async function autorizar(ruts) { try { const d = await API.call('docAutorizar', { sesion: T.sel, ruts }); toast(`Autorizados: ${d.autorizados}`); refrescarVivo(); } catch (e) { manejar(e); } }


/* ---------- Envío de correos con PRUEBA ---------- */
function modalEnvio({ titulo, cuerpo, onSend }) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><div class="row"><h3 class="sp" style="margin:0">${titulo}</h3><button type="button" class="btn sm ghost" id="mx" aria-label="Cerrar">✕</button></div>${cuerpo}<div id="mres"></div><div class="row" style="margin-top:14px"><button class="btn gold" id="mp">🧪 Enviar prueba a mi correo</button><button class="btn" id="mt">Enviar a todos</button><button class="btn ghost" id="mc">Cerrar</button></div><div class="hint">La prueba te llega solo a ti, con los datos de un estudiante real como ejemplo, para que veas cómo lo recibe. Recomendado antes de enviar a todos.</div></div>`;
  document.body.appendChild(m);
  const run = async prueba => {
    if (!prueba && !confirm('¿Enviar a todos los estudiantes?')) return;
    $$('#mp, #mt', m).forEach(b => b.disabled = true); $('#mres', m).innerHTML = '<p><span class="spin"></span> Enviando…</p>';
    try { $('#mres', m).innerHTML = `<div class="fb ok" style="margin-top:12px">${await onSend(prueba, m)}</div>`; }
    catch (e) { $('#mres', m).innerHTML = `<div class="err">${esc(e.message)}</div>`; if (e.code === 'SESION_EXPIRADA') { cerrarM(); manejar(e); return; } }
    $$('#mp, #mt', m).forEach(b => b.disabled = false);
  };
  $('#mp', m).onclick = () => run(true); $('#mt', m).onclick = () => run(false); const cerrarM = () => { m.remove(); document.removeEventListener('keydown', escM); }; const escM = e => { if (e.key === 'Escape') cerrarM(); }; document.addEventListener('keydown', escM);
  $('#mc', m).onclick = cerrarM; $('#mx', m).onclick = cerrarM; m.onclick = e => { if (e.target === m) cerrarM(); };
}
async function lotes(accion, datos, tope = 30) {
  let desde = 0, ok = 0, fallos = 0, ult = null;
  for (let i = 0; i < tope; i++) { const d = await API.call(accion, { ...datos, desde }); ok += d.enviados; fallos += d.fallos; ult = d; desde = d.siguiente; if (!d.restantes) break; }
  return { ok, fallos, ult };
}
function enviarEnlaceUI() {
  const cur = String((T.cfg && T.cfg.cursos) || '').split(',').map(x => x.trim()).filter(Boolean);
  modalEnvio({
    titulo: '✉ Enviar enlace de acceso por correo',
    cuerpo: `<p class="small mut">Los estudiantes reciben un correo con un botón para entrar a la plataforma (o directo a una sesión) y su RUT para ingresar. No necesitan el QR.</p><label>Curso</label><select id="mcur"><option value="">Todos los cursos</option>${cur.map(c => `<option>${esc(c)}</option>`).join('')}</select><label>Sesión</label><select id="mses"><option value="">Solo la plataforma</option>${T.sesiones.map(s => `<option value="${esc(s.id)}" ${s.id === T.sel ? 'selected' : ''}>Sesión ${s.numero} · ${esc(s.titulo)}</option>`).join('')}</select><label>Mensaje adicional (opcional)</label><textarea id="mmsg" style="min-height:70px" placeholder="Ej: Hoy trabajaremos en vivo, ten tu celular cargado."></textarea>`,
    onSend: async (prueba, m) => { const r = await lotes('docEnviarEnlace', { curso: $('#mcur', m).value, sesion: $('#mses', m).value, mensaje: $('#mmsg', m).value, prueba }); return prueba ? `🧪 Prueba enviada a <b>${esc(r.ult.para)}</b> (ejemplo con los datos de «${esc(r.ult.ejemplo)}»). Revisa tu bandeja y spam.` : `✅ Enlaces enviados: ${r.ok}${r.fallos ? ` · fallos: ${r.fallos}` : ''}`; }
  });
}
/* ---------- CONTROL REMOTO (pensado para el celular) ---------- */
const ESACT = p => p && !['diapositiva', 'documento'].includes(p.tipo);
const FASES = { diapositiva: 'Diapositiva', espera: 'Preparada', pregunta: 'Pregunta abierta', cerrada: 'Cerrada', resultados: 'Resultados', ranking: 'Ranking' };
function accionPrincipal(c) {
  const v = c.v, p = c.paso; if (!ESACT(p)) return { t: 'Siguiente ▶', a: 'siguiente' };
  const punt = ['opcion', 'vf', 'numerica'].includes(p.tipo);
  return ({ espera: { t: `▶ Lanzar pregunta (${v.dur}s)`, a: 'abrir' }, pregunta: { t: '⏹ Cerrar ahora', a: 'cerrar' }, cerrada: { t: '📊 Mostrar resultados', a: 'resultados' }, resultados: punt ? { t: '🏆 Mostrar ranking', a: 'ranking' } : { t: 'Siguiente ▶', a: 'siguiente' } })[v.fase] || { t: 'Siguiente ▶', a: 'siguiente' };
}
function tilesDocente(p) {
  if (!p) return '';
  if (p.tipo === 'opcion' || p.tipo === 'encuesta') return '<div class="tiles">' + (p.opciones || []).map((o, i) => `<div class="tile t${i % 4}" style="min-height:56px;cursor:default"><span class="sh">${FORMAS[i % 4]}</span><span>${esc(o)} ${p.tipo === 'opcion' && p.correcta === i ? '✅' : ''}</span></div>`).join('') + '</div>';
  if (p.tipo === 'vf') return `<div class="tiles"><div class="tile t1" style="min-height:56px;cursor:default">✔ Verdadero ${p.correcta === 'V' ? '✅' : ''}</div><div class="tile t0" style="min-height:56px;cursor:default">✖ Falso ${p.correcta === 'F' ? '✅' : ''}</div></div>`;
  if (p.tipo === 'numerica') return `<p class="mut">Respuesta correcta: <b>${esc(p.correcta)}</b></p>`;
  return '';
}
T.auto = (() => { try { return { lanzar: true, cerrar: true, ...JSON.parse(localStorage.getItem('auto') || '{}') }; } catch (e) { return { lanzar: true, cerrar: true }; } })();
const guardarAuto = () => { try { localStorage.setItem('auto', JSON.stringify(T.auto)); } catch (e) { } };
function etiquetaAvanzar(c) {
  const v = c.v, p = c.paso, ult = c.paso && c.paso.idx >= c.n - 1;
  if (v.ritmo !== 'docente') return c.retomar && c.retomar.disponible ? '▶ Retomar (paso ' + (c.retomar.paso + 1) + ')' : '▶ Iniciar clase en vivo';
  if (!ESACT(p)) return ult ? '🏁 Fin de la clase' : 'Siguiente ▶';
  if (v.fase === 'espera') return '▶ Lanzar pregunta';
  if (v.fase === 'pregunta') return c.todos ? '📊 Ver resultados' : '⏹ Cerrar y ver resultados';
  if (v.fase === 'cerrada') return '📊 Ver resultados';
  return ult ? '🏁 Fin de la clase' : 'Siguiente ▶';
}
async function vCtrl() {
  if (!T.sel) { $('#main').innerHTML = '<div class="card c mut">Crea una sesión primero.</div>'; return; }
  const cur = String((T.cfg && T.cfg.cursos) || '').split(',').map(x => x.trim()).filter(Boolean);
  $('#main').innerHTML = `<div class="card"><div class="row"><div style="flex:1;min-width:150px">${selSesion()}</div>${cur.length > 1 ? `<select id="ccur" style="max-width:150px"><option value="">Todos los cursos</option>${cur.map(c => `<option ${c === T.cursoCtrl ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}</div>
  <div class="row" style="margin-top:8px"><button class="btn sm ghost" id="enl2">✉ Enlace</button><button class="btn sm ghost" id="vps2">👁 Ver como estudiante</button><button class="btn sm gold" id="prj">🖥 Proyectar</button></div>
  <label class="row" style="margin:10px 0 0;font-weight:500;font-size:.88rem"><input type="checkbox" id="au1" ${T.auto.lanzar ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Lanzar cada pregunta al llegar a ella</label>
  <label class="row" style="margin:6px 0 0;font-weight:500;font-size:.88rem"><input type="checkbox" id="au2" ${T.auto.cerrar ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Cerrar cuando todos hayan respondido</label></div>
  <div id="cv"><div class="c"><span class="spin"></span></div></div><div id="rbar"></div><div id="aipanel"><div id="aires"></div></div>`;
  $('#sel').onchange = e => { T.sel = e.target.value; T.ckey = ''; T.sig = ''; vCtrl(); };
  if ($('#ccur')) $('#ccur').onchange = e => { T.cursoCtrl = e.target.value; T.sig = ''; refrescarCtrl(true); };
  $('#au1').onchange = e => { T.auto.lanzar = e.target.checked; guardarAuto(); }; $('#au2').onchange = e => { T.auto.cerrar = e.target.checked; guardarAuto(); };
  $('#prj').onclick = proyectar; $('#enl2').onclick = () => enviarEnlaceUI(); $('#vps2').onclick = () => verComoEstudiante(T.sel);
  T.ckey = ''; T.sig = '';
  // gestos: deslizar a la izquierda = avanzar, a la derecha = retroceder
  let x0 = null, y0 = 0; const cv = $('#cv');
  cv.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  cv.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) accionVivo({ op: dx < 0 ? 'avanzar' : 'anterior' }); });
  // teclado / control remoto de presentaciones: → ← PgDn PgUp espacio
  if (T.keyH) document.removeEventListener('keydown', T.keyH);
  T.keyH = ev => { if (/INPUT|TEXTAREA|SELECT/.test((ev.target.tagName || '')) || ev.target.isContentEditable) return; if (['ArrowRight', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); accionVivo({ op: 'avanzar' }); } else if (['ArrowLeft', 'PageUp'].includes(ev.key)) { ev.preventDefault(); accionVivo({ op: 'anterior' }); } };
  document.addEventListener('keydown', T.keyH);
  refrescarCtrl(true); T.timer = setInterval(refrescarCtrl, 2000);
  clearInterval(T.tick);
  T.tick = setInterval(() => {
    const c = T.cv; if (!c) return; const v = c.v; const n = $('#ctm'), b = $('#ctb'); if (!n) return;
    if (v.fase === 'pregunta') { const left = v.t + v.dur * 1000 - (Date.now() + c.off); n.textContent = Math.max(0, Math.ceil(left / 1000)) + ' s'; n.classList.toggle('urg', left < 5000); if (b) b.style.width = Math.max(0, left / (v.dur * 1000)) * 100 + '%'; }
    else { n.textContent = v.dur + ' s'; n.classList.remove('urg'); if (b) b.style.width = '100%'; }
  }, 250);
}
async function autorizarCtrl(ruts) {
  ruts.forEach(r => { const b = $(`[data-au="${r}"]`); const fila = b && b.closest('.row'); if (fila) fila.remove(); });   // desaparece al instante, sin esperar al servidor
  toast('✅ Autorizando…', 1400);
  try { await API.call('docAutorizar', { sesion: T.sel, ruts }); T.sig = ''; await refrescarCtrl(true); } catch (e) { manejar(e); T.sig = ''; refrescarCtrl(true); }
}
/** Aviso solo en el Control del docente (nunca mientras se proyecta en este equipo). */
function avisarSalidas(c) {
  const ahora = new Set((c.suspendidos || []).map(x => x.rut)); const pidieron = new Set((c.suspendidos || []).filter(x => x.pidio).map(x => x.rut));
  if (T.suspPrev && !document.querySelector('.proj')) {
    (c.suspendidos || []).forEach(x => { if (!T.suspPrev.has(x.rut)) { toast(`⚠️ ${x.nombre} salió de la aplicación`, 5000); try { navigator.vibrate && navigator.vibrate(160); } catch (e) { } } else if (x.pidio && !T.pidPrev.has(x.rut)) { toast(`🙋 ${x.nombre} pide autorización`, 6000); try { navigator.vibrate && navigator.vibrate([160, 80, 160]); } catch (e) { } } });
  }
  T.suspPrev = ahora; T.pidPrev = pidieron;
}async function accionVivo(d) {
  if (T.busy) return; T.busy = true; $$('.remote .btn').forEach(b => b.disabled = true);
  const q = { ...d }; if (['avanzar', 'anterior', 'siguiente', 'ir'].includes(q.op)) q.auto = T.auto.lanzar;
  if (!q.ritmo && T.cv && T.cv.v.ritmo !== 'docente' && q.op !== 'tiempo') q.ritmo = 'docente';   // al mover, se activa el modo en vivo solo
  try { const est = await API.call('docVivoAccion', { sesion: T.sel, curso: T.cursoCtrl || '', ...q }); T.busy = false; await refrescarCtrl(true, est && est.v ? est : undefined); }
  catch (e) { T.busy = false; $$('.remote .btn').forEach(b => b.disabled = false); manejar(e); }
}
async function refrescarCtrl(forzar, datos) {
  if (!$('#cv') || (document.hidden && !forzar) || (T.busy && !forzar)) return;
  let c = datos; if (!c) { try { c = await API.call('docVivo', { sesion: T.sel, curso: T.cursoCtrl || '' }); } catch (e) { return manejar(e); } }
  c.off = c.v.ahora - Date.now(); T.cv = c; const v = c.v, p = c.paso;
  const act = ESACT(p); const enVivo = v.ritmo === 'docente';
  const kAuto = v.paso + '|' + v.t;
  if (T.auto.cerrar && enVivo && act && v.fase === 'pregunta' && c.todos && T.autoKey !== kAuto) { T.autoKey = kAuto; return accionVivo({ op: 'cerrar' }); }
  const sig = JSON.stringify({ ...c, off: 0, v: { ...c.v, ahora: 0 } });
  const key = [v.paso, v.fase, c.todos, enVivo].join('|');
  if (sig === T.sig && key === T.ckey && !forzar) return;
  T.sig = sig;
  const chips = arr => arr.map(n => `<span class="chip">${esc(n)}</span>`).join('');
  avisarSalidas(c);
  const susp = c.suspendidos || []; const hace = x => { const m = Math.max(0, Math.round((Date.now() + c.off - x.desde) / 60000)); return m < 1 ? 'hace un momento' : 'hace ' + m + ' min'; };
  let h = susp.length ? `<div class="card" style="border:2px solid var(--bad)"><div class="row"><b class="sp" style="color:var(--bad)">🔒 Salieron de la aplicación (${susp.length})</b>${susp.length > 1 ? '<button class="btn sm gold" id="au-all">Autorizar a todos</button>' : ''}</div>${susp.map(x => `<div class="row" style="margin-top:8px;gap:8px"><div class="sp"><b>${esc(x.nombre)}</b><div class="small mut">Salió ${hace(x)}</div></div>${x.pidio ? '<span class="chip warn">🙋 Pide autorización</span>' : ''}<button class="btn sm gold" data-au="${esc(x.rut)}">Autorizar</button></div>`).join('')}</div>` : '';
  const rt = c.retomar; const haceMs = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' día(s)'; };
  if (rt && rt.disponible) h += `<div class="card" style="border:2px solid var(--gold)"><b>↩ Clase pausada</b><div class="small mut" style="margin:4px 0 10px">Quedaron en el paso <b>${rt.paso + 1} de ${rt.n}</b>${rt.titulo ? ': «' + esc(String(rt.titulo).slice(0, 60)) + '»' : ''}${rt.ult ? ' · ' + haceMs(Date.now() + c.off - rt.ult) : ''}.</div><div class="row" style="gap:8px"><button class="btn gold" id="ret">▶ Retomar donde quedamos</button><button class="btn sm ghost" id="ini0">Empezar desde el principio</button></div></div>`;
  h += `<div class="card"><div class="row"><span class="chip navy">${p ? p.idx + 1 : 0} / ${c.n}</span><span class="chip ${enVivo ? 'ok' : ''}">${enVivo ? '🔴 En vivo' : 'Ritmo libre'}</span><span class="chip">${FASES[v.fase] || v.fase}</span><span class="sp"></span><span class="chip">👥 ${c.presentes}</span>${enVivo ? `<span class="chip ${c.viendo >= c.presentes && c.presentes ? 'ok' : 'warn'}" title="Estudiantes que ya ven este mismo paso">👁 ${c.viendo}/${c.presentes}</span>` : ''}</div>`;
  if (p) {
    if (!act && p.tipo === 'diapositiva') h += `<div style="margin:12px auto 0;max-width:520px" class="mini">${slideStage(p, false)}</div>`;
    else if (!act) h += `<h3 style="margin-top:12px">${esc(p.titulo || 'Archivo o enlace')}</h3><p class="mut small">Archivo o enlace incrustado.</p>`;
    else h += `<h3 style="margin-top:12px">${esc(p.pregunta)}</h3>${tilesDocente(p)}`;
  }
  h += '</div>';
  if (act && enVivo && ['espera', 'pregunta'].includes(v.fase)) h += `<div class="card"><div class="small mut c">${v.fase === 'espera' ? 'Tiempo para responder' : 'Tiempo restante'}</div><div class="tb-num" id="ctm">${v.dur} s</div><div class="tb-bar"><i id="ctb" style="width:100%"></i></div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm ghost" data-dt="-5">−5 s</button><button class="btn sm ghost" data-dt="10">+10 s</button></div></div>`;
  if (act && enVivo && v.fase !== 'espera') {
    const pc = c.presentes ? Math.round(c.respondieron / c.presentes * 100) : 0;
    h += `<div class="card"><div class="row"><b class="sp">✍️ ${c.respondieron} de ${c.presentes} respondieron</b><b>${pc}%</b></div><div class="bar" style="margin-top:8px"><i style="width:${pc}%"></i></div>`;
    if (c.todos && ['pregunta', 'cerrada'].includes(v.fase)) h += `<div class="fb ok"><b>✅ ¡Todos respondieron!</b><div class="row" style="margin-top:8px"><button class="btn sm" id="bres">📊 Ver resultados a la clase</button><button class="btn sm gold" id="bana">🤖 Analizar ahora</button></div></div>`;
    else if (c.faltan.length) h += `<div style="margin-top:12px"><b class="small">⏳ Faltan por responder (${c.faltan.length}):</b><div class="row" style="gap:6px;margin-top:6px">${chips(c.faltan)}</div></div>`;
    if (c.ausentes.length) h += `<details style="margin-top:10px"><summary class="small mut">Sin conectar (${c.ausentes.length})</summary><div class="row" style="gap:6px;margin-top:6px">${chips(c.ausentes)}</div></details>`;
    h += '</div>';
  }
  if (act && c.agregado && enVivo && !['espera'].includes(v.fase)) h += `<div class="card"><h3>Resultados en vivo</h3>${p.tipo === 'abierta' ? `<p class="small mut">${c.agregado.n} respuestas abiertas</p>${(c.agregado.textos || []).slice(-6).map(t => `<div class="fb neu small" style="margin:6px 0">${esc(t)}</div>`).join('')}` : aggHtml(p, c.agregado, p.correcta)}</div>`;
  if (c.ranking.length && ['resultados', 'ranking'].includes(v.fase)) h += `<div class="card"><h3>🏆 Ranking</h3>${podioHtml(c.ranking, '')}</div>`;
  h += `<div class="card"><div class="row" style="gap:8px">${act && v.fase === 'pregunta' ? '<button class="btn sm" id="bcer">⏹ Cerrar ahora</button>' : ''}${act ? '<button class="btn sm ghost" id="bana2">🤖 Analizar esta pregunta</button><button class="btn sm ghost" id="brk">🏆 Ranking</button>' : ''}${p && p.tipo === 'abierta' ? '<button class="btn sm gold" id="bcor">⚡ Corregir y devolver feedback</button>' : ''}<button class="btn sm ghost" id="bana3">🤖 Analizar toda la sesión</button></div>
  <div class="row" style="margin-top:10px"><select id="rj" style="flex:1">${c.pasos.map(q => `<option value="${q.i}" ${q.i === v.paso ? 'selected' : ''}>${q.i + 1}. ${esc((q.titulo || '').slice(0, 40))} · ${q.tipo}</option>`).join('')}</select><button class="btn sm ghost" id="rt">Ir</button></div>
  ${enVivo ? '<button class="btn sm ghost block" id="bfin" style="margin-top:10px">Terminar modo en vivo (ritmo libre)</button>' : '<div class="info">Ritmo libre: los estudiantes avanzan solos. Con la flecha ▶ inicias la clase en vivo.</div>'}</div><div class="remote-pad"></div>`;
  $('#cv').innerHTML = h;
  $$('[data-au]').forEach(b => b.onclick = () => autorizarCtrl([b.dataset.au])); if ($('#au-all')) $('#au-all').onclick = () => autorizarCtrl(susp.map(x => x.rut)); if ($('#ret')) $('#ret').onclick = () => accionVivo({ op: 'retomar' }); if ($('#ini0')) $('#ini0').onclick = () => { if (confirm('¿Empezar la clase desde el principio? Se pierde el punto donde quedaron.')) accionVivo({ op: 'reiniciar' }); };
  const ev = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  $$('[data-dt]').forEach(b => b.onclick = () => accionVivo({ op: 'tiempo', delta: +b.dataset.dt }));
  ev('#bres', () => accionVivo({ op: 'resultados' })); ev('#bana', () => { analizar('paso'); });
  ev('#bcer', () => accionVivo({ op: 'cerrar' })); ev('#bana2', () => { analizar('paso'); }); ev('#bana3', () => { analizar('sesion'); });
  ev('#brk', () => accionVivo({ op: 'ranking' })); ev('#bcor', corregirAhora); ev('#rt', () => accionVivo({ op: 'ir', paso: +$('#rj').value })); ev('#bfin', () => { accionVivo({ ritmo: 'libre' }); toast('Clase pausada: se libera a los estudiantes. Puedes retomarla en este mismo punto cuando quieras.', 6000); });
  if (key !== T.ckey || forzar) {
    T.ckey = key; if ($('#aires')) $('#aires').innerHTML = '';
    $('#rbar').innerHTML = `<div class="remote"><button class="btn ghost" id="rp" aria-label="Paso anterior">◀<small>Atrás</small></button><button class="btn ${v.fase === 'pregunta' && enVivo ? 'red' : 'gold'}" id="rm">${etiquetaAvanzar(c)}</button></div>`;
    $('#rp').onclick = () => accionVivo({ op: 'anterior' });
    $('#rm').onclick = () => accionVivo(enVivo ? { op: 'avanzar' } : (c.retomar && c.retomar.disponible ? { op: 'retomar' } : { ritmo: 'docente', op: 'ir', paso: v.paso }));
  }
}
/** Hoja inferior fija (misma pantalla, con desplazamiento propio): ya no hay que bajar a buscar el resultado. */
function hojaIA(titulo, html) {
  let s = $('#iasheet'); if (!s) { s = document.createElement('div'); s.id = 'iasheet'; s.className = 'ia-sheet'; document.body.appendChild(s); }
  s.innerHTML = `<div class="ia-h"><b class="sp">${titulo}</b><button type="button" class="btn sm ghost" id="iax" aria-label="Cerrar">✕</button></div><div class="ia-b">${html}</div>`;
  $('#iax').onclick = () => s.remove(); return $('.ia-b', s);
}
async function analizar(alcance) {
  hojaIA('🤖 Análisis de los resultados', '<p><span class="spin"></span> Analizando los resultados…</p>');
  try {
    const a = await API.call('docAnalisisIA', { sesion: T.sel, alcance, paso: T.cv?.v.paso });
    const li = arr => arr.length ? '<ul>' + arr.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="mut small">—</p>';
    hojaIA('🤖 Análisis de los resultados', `<label style="margin-top:0">Retroalimentación de contenido para el curso (puedes editarla)</label><textarea id="rmsg" style="min-height:140px">${esc(a.mensaje_clase)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn gold" id="rshare">📣 Mostrar a los estudiantes</button><span class="hint">Aparece fija en sus pantallas, sin nombres.</span></div>
    <div class="fb neu" style="margin-top:14px"><b>Qué muestran los resultados:</b> ${esc(a.resumen)}</div>
    <div class="grid2"><div><b>✅ Lo que dominan</b>${li(a.logros)}</div><div><b>⚠️ Errores detectados</b>${li(a.dificultades)}</div></div><b>💡 Qué re-explicar</b>${li(a.recomendaciones)}`);
    $('#rshare').onclick = async () => { try { await API.call('docCompartirRetro', { sesion: T.sel, texto: $('#rmsg').value }); toast('Retroalimentación enviada a la clase ✅'); $('#iasheet').remove(); } catch (e) { manejar(e); } };
  } catch (e) { hojaIA('🤖 Análisis de los resultados', `<div class="err">${esc(e.message)}</div>`); if (e.code === 'SESION_EXPIRADA') manejar(e); }
}
async function corregirAhora() {
  const p = T.cv?.paso; if (!p || p.tipo !== 'abierta') return toast('Ubícate en una pregunta abierta para corregirla.');
  hojaIA('⚡ Corrección con IA', '<p><span class="spin"></span> Corrigiendo con IA…</p>'); let tot = 0;
  try {
    for (let i = 0; i < 40; i++) { const d = await API.call('docCorregirIA', { sesion: T.sel, paso: p.id }); tot += d.corregidas; if (!d.pendientes || (!d.corregidas && d.fallos)) break; }
    const ap = await API.call('docAprobarIA', { sesion: T.sel, paso: p.id });
    hojaIA('⚡ Corrección con IA', `<div class="fb ok">✅ Corregidas: ${tot} · Devueltas a los estudiantes: ${ap.aprobadas}. Cada estudiante ve su retroalimentación individual de contenido en su pantalla.</div>`);
  } catch (e) { hojaIA('⚡ Corrección con IA', `<div class="err">${esc(e.message)}</div>`); }
}
/** Pantalla de proyección para el proyector / pizarra digital */
function proyectar() {
  const base = location.href.replace(/docente\.html.*$/, '') + 'index.html?s=' + encodeURIComponent(T.sel);
  const w = document.createElement('div'); w.className = 'proj'; document.body.appendChild(w);
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'proj-x'; x.textContent = '✕ Cerrar'; document.body.appendChild(x);   // botón fijo: siempre se puede cerrar
  const cerrar = () => { clearInterval(w._t); clearInterval(w._k); w.remove(); x.remove(); document.removeEventListener('keydown', esc_); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { } };
  x.onclick = cerrar;
  const esc_ = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', esc_);
  const pintar = async () => {
    let c; try { c = await API.call('docVivo', { sesion: T.sel, proy: true }); } catch (e) { return; }
    c.off = c.v.ahora - Date.now(); w._c = c; const v = c.v, p = c.paso; let cuerpo = '';
    const pc = $('#pcnt'); if (pc) pc.textContent = '👥 ' + c.presentes;   // el contador se actualiza aparte, sin redibujar (así el video no se reinicia)
    const esDiap = !ESACT(p); const sig = esDiap ? JSON.stringify({ paso: v.paso, p }) : JSON.stringify({ ...c, off: 0, v: { ...c.v, ahora: 0 } }); if (sig === w._sig) return; w._sig = sig;   // sin parpadeo si nada cambió
    if (!p) cuerpo = '<h1>Sin contenido</h1>';
    else if (p.tipo === 'diapositiva') cuerpo = `<div style="width:min(calc(100vw - 56px), calc((100vh - 140px) * 1.7778));margin:0 auto">${slideStage(p, false, { live: true, proj: true })}</div>${ytId(p.video) ? `<div class="small" style="text-align:center;margin-top:8px"><a href="https://www.youtube.com/watch?v=${ytId(p.video)}" target="_blank" rel="noopener" style="color:#cfe0ff">¿No se reproduce? Abrir el video en YouTube</a></div>` : ''}`;
    else if (!ESACT(p)) cuerpo = `<h1>${esc(p.titulo || '')}</h1>${bloqueEmbed(p)}`;
    else if (v.fase === 'ranking') cuerpo = `<h1>🏆 Ranking</h1><div style="max-width:700px">${podioHtml(c.ranking, '')}</div>`;
    else if (v.fase === 'espera') cuerpo = `<h1>${esc(p.pregunta)}</h1>${tilesDocente({ ...p, correcta: -1 })}<p class="mut">Prepárate…</p>`;
    else if (v.fase === 'pregunta') cuerpo = `<div class="row"><h1 class="sp">${esc(p.pregunta)}</h1><b id="ptm" style="font:800 4rem Poppins;color:#ffd23f"></b></div>${tilesDocente({ ...p, correcta: -1 })}<p style="font-size:1.4rem">✍️ ${c.agregado ? c.agregado.n : 0} / ${c.presentes} respondieron</p>`;
    else cuerpo = `<h1>${esc(p.pregunta)}</h1><div class="proj-grid ${v.retro ? 'dos' : ''}"><div class="proj-card">${p.tipo === 'abierta' ? `<p>${c.agregado.n} respuestas</p>` : aggHtml(p, c.agregado, p.correcta)}</div>${v.retro ? `<div class="proj-card retro"><b>🧑‍🏫 Retroalimentación</b><div class="rp">${textoRico(v.retro)}</div></div>` : ''}</div>`;
    w.innerHTML = `<div class="in"><div class="row" style="margin-bottom:14px"><img src="img/insignia.png" width="56" alt=""><b class="sp" style="font:700 1rem Poppins">Colegio Marina de Chile · Sesión ${c.numero}: ${esc(c.titulo)}</b><span class="chip" id="pcnt">👥 ${c.presentes}</span></div>${cuerpo}${v.paso === 0 && v.fase !== 'pregunta' ? '<div class="row qrbox" style="margin-top:20px"><div class="qr" style="padding:6px"><div id="pqr"></div></div><span class="mut">Escanea para unirte · Ingresa con tu RUT</span></div>' : ''}</div>`;
    if ($('#pqr')) new QRCode($('#pqr'), { text: base, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
  };
  w._k = setInterval(() => { const c = w._c; if (!c || c.v.fase !== 'pregunta') return; const n = $('#ptm'); if (n) n.textContent = Math.max(0, Math.ceil((c.v.t + c.v.dur * 1000 - (Date.now() + c.off)) / 1000)); }, 250);
  pintar(); w._t = setInterval(pintar, 2000);
}

/* ---------- CORRECCIÓN ---------- */
async function vCorr(paso) {
  if (!T.sel) { $('#main').innerHTML = '<div class="card mut c">Sin sesiones.</div>'; return; }
  $('#main').innerHTML = '<div class="c"><span class="spin"></span></div>';
  try { T.resp = await API.call('docRespuestas', { sesion: T.sel }); } catch (e) { return manejar(e); }
  const P = T.resp.pasos; if (!P.length) { $('#main').innerHTML = `<div class="card">${selSesion()}<p class="mut">Esta sesión no tiene actividades.</p></div>`; $('#sel').onchange = e => { T.sel = e.target.value; vCorr(); }; return; }
  paso = paso || T.pasoCorr || P[0].id; if (!P.find(p => p.id === paso)) paso = P[0].id; T.pasoCorr = paso;
  const p = P.find(x => x.id === paso); const R = T.resp.respuestas.filter(r => r.paso === paso);
  const pend = R.filter(r => r.estado === 'pendiente').length, ia = R.filter(r => r.estado === 'ia').length;
  const L = 'ABCDEFGH';
  let detalle = '';
  if (p.tipo === 'abierta') {
    detalle = R.map(r => { let v = []; try { v = JSON.parse(r.respuesta); } catch (e) { v = [r.respuesta]; }
      return `<div class="card" data-rut="${esc(r.rut)}"><div class="row"><b class="sp">${esc(r.nombre)} <span class="mut small">${esc(r.curso)}</span></b><span class="chip ${r.estado === 'revisada' ? 'ok' : r.estado === 'ia' ? 'navy' : 'warn'}">${{ revisada: 'Revisada', ia: 'Sugerida por IA', pendiente: 'Pendiente' }[r.estado]}</span></div>
      ${(p.campos?.length ? p.campos : ['Respuesta']).map((c, i) => `<div class="small mut" style="margin-top:8px">${esc(c)}</div><div>${esc(v[i] || '—')}</div>`).join('')}
      ${r.ia !== null ? `<div class="fb neu small" style="margin-top:10px">🤖 IA sugiere <b>${r.ia}/${p.puntos}</b>: ${esc(r.ia_comentario)}</div>` : ''}
      <div class="row" style="margin-top:10px"><input class="pt" type="number" step="0.5" min="0" max="${p.puntos}" style="width:90px" value="${r.final ?? r.ia ?? ''}" placeholder="pts"><input class="co" style="flex:1;min-width:160px" value="${esc(r.comentario || (r.estado === 'ia' ? r.ia_comentario : ''))}" placeholder="Comentario para el estudiante"><button class="btn sm gv">Guardar</button></div></div>`; }).join('') || '<div class="card mut c">Aún no hay respuestas.</div>';
  } else {
    const cnt = (p.opciones || ['Verdadero', 'Falso']).map(() => 0); R.forEach(r => { const i = p.tipo === 'vf' ? (r.respuesta === 'V' ? 0 : 1) : +r.respuesta; if (cnt[i] !== undefined) cnt[i]++; });
    const ac = R.filter(r => r.final > 0).length;
    detalle = `<div class="card"><p><b>${R.length}</b> respuestas · <b>${ac}</b> correctas (${R.length ? Math.round(ac / R.length * 100) : 0}%)</p>${p.tipo === 'opcion' || p.tipo === 'vf' || p.tipo === 'encuesta' ? (p.opciones || ['Verdadero', 'Falso']).map((o, i) => `<div style="margin:8px 0"><div class="row small"><span class="sp">${p.tipo !== 'vf' ? L[i] + '. ' : ''}${esc(o)} ${(p.tipo === 'opcion' && i === p.correcta) || (p.tipo === 'vf' && (i === 0) === (p.correcta === 'V')) ? '✅' : ''}</span><b>${cnt[i]}</b></div><div class="bar"><i style="width:${R.length ? cnt[i] / R.length * 100 : 0}%"></i></div></div>`).join('') : `<p class="mut">Respuesta correcta: ${esc(p.correcta)}</p>`}</div>
    <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>Respuesta</th><th>Pts</th></tr>${R.map(r => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.respuesta)}</td><td>${r.final ?? '—'}</td></tr>`).join('')}</table></div>`;
  }
  $('#main').innerHTML = `<div class="card"><div class="row">${selSesion()}<button class="btn sm gold" id="mailall">✉ Enviar copias por correo</button><select id="pp" style="max-width:520px">${P.map(x => `<option value="${esc(x.id)}" ${x.id === paso ? 'selected' : ''}>${esc((x.titulo || x.pregunta).slice(0, 70))} (${x.tipo})</option>`).join('')}</select></div>
  ${p.tipo === 'abierta' ? `<div class="hint" style="margin-top:8px"><b>Pauta:</b> ${esc(p.modelo || '—')}</div><div class="row" style="margin-top:10px"><button class="btn" id="ia" ${pend ? '' : 'disabled'}>🤖 Corregir con IA (${pend} pendientes)</button><button class="btn gold" id="ap" ${ia ? '' : 'disabled'}>✔ Aprobar sugerencias de IA (${ia})</button></div><div id="iam"></div>` : ''}</div>${detalle}`;
  $('#sel').onchange = e => { T.sel = e.target.value; T.pasoCorr = null; vCorr(); }; $('#pp').onchange = e => vCorr(e.target.value);
  $('#mailall').onclick = () => modalEnvio({
    titulo: '✉ Enviar copias de la sesión', cuerpo: '<p class="small mut">Cada estudiante que respondió recibe, desde tu correo, un comprobante formal con sus respuestas, puntajes y retroalimentación disponibles.</p>',
    onSend: async prueba => { const d = await API.call('docEnviarCopias', { sesion: T.sel, prueba }); return prueba ? `🧪 Prueba enviada a <b>${esc(d.para)}</b> (ejemplo con los datos de «${esc(d.ejemplo)}»). Revisa tu bandeja y spam.` : `✅ Correos enviados: ${d.enviados}${d.sinCorreo.length ? `<br>Sin correo registrado: ${esc(d.sinCorreo.join(', '))}` : ''}${d.fallos ? `<br>Fallos: ${d.fallos}` : ''}<br>Cuota diaria restante: ${d.cuotaRestante}`; }
  });
  if (p.tipo === 'abierta') {
    $('#ia').onclick = async () => {
      const b = $('#ia'); b.disabled = true; let tot = 0;
      try { for (let i = 0; i < 40; i++) { const d = await API.call('docCorregirIA', { sesion: T.sel, paso }); tot += d.corregidas; $('#iam').innerHTML = `<p class="small"><span class="spin"></span> Corregidas: ${tot} · pendientes: ${d.pendientes}</p>`; if (!d.pendientes || (!d.corregidas && d.fallos)) { if (d.fallos) toast('Algunas respuestas fallaron, reintenta.'); break; } } } catch (e) { manejar(e); }
      vCorr(paso);
    };
    $('#ap').onclick = async () => { try { const d = await API.call('docAprobarIA', { sesion: T.sel, paso }); toast('Aprobadas: ' + d.aprobadas); vCorr(paso); } catch (e) { manejar(e); } };
    $$('.gv').forEach(b => b.onclick = async () => { const c = b.closest('[data-rut]'); b.disabled = true; try { await API.call('docGuardarNota', { sesion: T.sel, paso, rut: c.dataset.rut, puntaje: $('.pt', c).value, comentario: $('.co', c).value }); b.textContent = '✔'; toast('Guardado'); } catch (e) { manejar(e); b.disabled = false; } });
  }
}

/* ---------- RESULTADOS ---------- */
async function vRes() {
  $('#main').innerHTML = '<div class="c"><span class="spin"></span></div>';
  try { T.resultados = await API.call('docResultados', { curso: T.cursoF || '' }); } catch (e) { return manejar(e); }
  const R = T.resultados;
  $('#main').innerHTML = `<div class="card row"><select id="cf" style="max-width:200px"><option value="">Todos los cursos</option>${R.cursos.map(c => `<option ${c === T.cursoF ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="sp"></span><button class="btn sm ghost" id="csv">⬇ Exportar CSV</button></div>
  <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>Curso</th><th>Avance</th><th>Logro</th><th>Nota</th>${R.sesiones.map(s => `<th title="${esc(s.titulo)}">S${s.numero}</th>`).join('')}</tr>
  ${R.alumnos.map(a => `<tr><td><b>${esc(a.nombre)}</b><div class="small mut">${esc(a.rut)}</div></td><td>${esc(a.curso)}</td><td>${a.progreso.pct_avance}%</td><td>${a.progreso.pct_logro}%</td><td><b>${a.progreso.nota === null ? '—' : String(a.progreso.nota).replace('.', ',')}</b></td>${a.porSesion.map(x => `<td>${x.resp ? x.pct + '%' + (x.pend ? ' ⏳' : '') : '—'}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9" class="mut c">Sin estudiantes inscritos.</td></tr>'}</table></div>`;
  $('#cf').onchange = e => { T.cursoF = e.target.value; vRes(); };
  $('#csv').onclick = () => {
    const f = [['RUT', 'Nombre', 'Curso', 'Avance %', 'Logro %', 'Nota', ...R.sesiones.map(s => 'S' + s.numero + ' %')], ...R.alumnos.map(a => [a.rut, a.nombre, a.curso, a.progreso.pct_avance, a.progreso.pct_logro, a.progreso.nota ?? '', ...a.porSesion.map(x => x.resp ? x.pct : '')])];
    const csv = '﻿' + f.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'resultados_unidad4.csv'; a.click();
  };
}

/* ---------- ESTUDIANTES ---------- */
async function vEst() {
  $('#main').innerHTML = '<div class="c"><span class="spin"></span></div>';
  let D; try { D = await API.call('docEstudiantes'); } catch (e) { return manejar(e); }
  const fc = T.cursoE || ''; const lista = D.estudiantes.filter(e => !fc || e.curso === fc);
  $('#main').innerHTML = `<div class="grid2"><div class="card"><h3 id="ft">Agregar / editar estudiante</h3>
    <label>RUT</label><input id="er" placeholder="12.345.678-9"><label>Nombre completo</label><input id="en" placeholder="Nombres y apellidos">
    <label>Curso</label><input id="ec" list="cl" placeholder="Ej: 3° Medio A"><datalist id="cl">${D.cursos.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <label>Correo institucional</label><input id="em" type="email" placeholder="rut@andaliensur.cl"><div class="hint">Si lo dejas vacío no recibirá copias por correo.</div>
    <div id="em1"></div><button class="btn block" id="eg" style="margin-top:12px">Guardar estudiante</button></div>
  <div class="card"><h3>Importar lista</h3><p class="small mut">Copia las filas desde Excel/Sheets (Correos · Curso · Nombre Alumno · Electivo) y pégalas aquí. El RUT se toma del correo. Si el RUT ya existe, se actualizan nombre y curso.</p><textarea id="ei" style="min-height:130px" placeholder="23211642-0@andaliensur.cl&#9;3° Medio A&#9;Sepulveda Castro, Ezequiel Camilo&#9;Economía y Sociedad"></textarea><div id="eim"></div><button class="btn block gold" id="eb" style="margin-top:10px">Importar</button></div></div>
  <div class="card"><div class="row"><h3 class="sp" style="margin:0">Cursos</h3><button class="btn sm" id="enl3">✉ Enviar enlace por correo</button></div><div class="row" style="margin-top:8px">${D.cursos.map(c => `<span class="chip navy" style="font-size:.85rem">${esc(c)} <a href="#" data-rn="${esc(c)}" style="color:#fff;text-decoration:none" title="Renombrar">✎</a> <a href="#" data-dc="${esc(c)}" style="color:#fff;text-decoration:none" title="Eliminar curso">✕</a></span>`).join('')}</div><div class="hint">Un curso nuevo se crea al asignárselo a un estudiante. ✎ renombra el curso para todos sus estudiantes.</div></div>
  <div class="card row"><select id="ef" style="max-width:220px"><option value="">Todos los cursos (${D.estudiantes.length})</option>${D.cursos.map(c => `<option ${c === fc ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="sp small mut">${lista.length} estudiantes</span></div>
  <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>RUT</th><th>Curso</th><th>Correo</th><th>Último ingreso</th><th></th></tr>
  ${lista.map(e => `<tr><td><b>${esc(e.nombre)}</b></td><td>${esc(e.rut)}</td><td>${esc(e.curso)}</td><td class="small">${esc(e.correo) || '<span class="chip warn">sin correo</span>'}</td><td class="small">${e.ultimo ? fmtFecha(e.ultimo, true) : '—'}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-ed="${esc(e.rut)}">Editar</button> <button class="btn sm ghost" data-del="${esc(e.rut)}">🗑</button></td></tr>`).join('') || '<tr><td colspan="6" class="c mut">Sin estudiantes. Importa tu lista o agrega uno.</td></tr>'}</table></div>`;
  $('#er').oninput = e => { e.target.value = formatRut(e.target.value); };
  $('#ef').onchange = e => { T.cursoE = e.target.value; vEst(); };
  $('#eg').onclick = async () => { try { await API.call('docGuardarEstudiante', { estudiante: { rut: $('#er').value, nombre: $('#en').value, curso: $('#ec').value, correo: $('#em').value } }); toast('Estudiante guardado ✅'); vEst(); } catch (e) { $('#em1').innerHTML = `<div class="err">${esc(e.message)}</div>`; if (e.code === 'SESION_EXPIRADA') manejar(e); } };
  $('#eb').onclick = async ev => {
    const b = ev.target; b.disabled = true; b.textContent = 'Importando…';
    try { const d = await API.call('docImportar', { texto: $('#ei').value }); $('#eim').innerHTML = `<div class="fb ok">Agregados: <b>${d.agregados}</b> · Actualizados: <b>${d.actualizados}</b>${d.errores.length ? `</div><div class="err">Con problemas (${d.errores.length}):<br>${d.errores.map(x => `Línea ${x.linea}: ${esc(x.motivo)} (${esc(x.texto)})`).join('<br>')}` : ''}</div>`; setTimeout(() => { if (!d.errores.length) vEst(); }, 1200); }
    catch (e) { manejar(e); } b.disabled = false; b.textContent = 'Importar';
  };
  $$('[data-ed]').forEach(b => b.onclick = () => { const e = D.estudiantes.find(x => x.rut === b.dataset.ed); $('#er').value = e.rut; $('#en').value = e.nombre; $('#ec').value = e.curso; $('#em').value = e.correo; $('#ft').scrollIntoView({ behavior: 'smooth' }); });

  $('#enl3').onclick = () => enviarEnlaceUI();
  $$('[data-dc]').forEach(a => a.onclick = async ev => {
    ev.preventDefault(); const cu = a.dataset.dc; const k = D.estudiantes.filter(x => x.curso === cu).length; let destino = '';
    if (k) {
      const otros = D.cursos.filter(x => x !== cu); const r = prompt(`El curso «${cu}» tiene ${k} estudiante(s).\n\nEscribe el nombre del curso al que quieres moverlos${otros.length ? ' (' + otros.join(', ') + ')' : ''},\no escribe ELIMINAR para quitarlos de la asignatura.`);
      if (r === null || !r.trim()) return; destino = r.trim().toUpperCase() === 'ELIMINAR' ? '__eliminar__' : r.trim();
      if (destino === '__eliminar__' && !confirm(`Se quitarán ${k} estudiantes de la asignatura (sus respuestas quedan en la planilla). ¿Seguro?`)) return;
    } else if (!confirm(`¿Eliminar el curso «${cu}»?`)) return;
    try { const d = await API.call('docEliminarCurso', { curso: cu, destino }); toast('Curso eliminado (' + d.accion_realizada + ')'); vEst(); } catch (e) { manejar(e); }
  });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar a este estudiante de la asignatura? Sus respuestas quedan en la planilla.')) return; try { await API.call('docEliminarEstudiante', { rut: b.dataset.del }); vEst(); } catch (e) { manejar(e); } });
  $$('[data-rn]').forEach(a => a.onclick = async ev => { ev.preventDefault(); const n = prompt('Nuevo nombre para el curso «' + a.dataset.rn + '»:', a.dataset.rn); if (!n || n === a.dataset.rn) return; try { const d = await API.call('docRenombrarCurso', { de: a.dataset.rn, a: n }); toast(`Curso renombrado (${d.estudiantes} estudiantes)`); vEst(); } catch (e) { manejar(e); } });
}

/* ---------- SESIONES (editor) ---------- */
function vSes() {
  if (T.edit) return editor();
  $('#main').innerHTML = `<div class="row" style="margin-bottom:10px"><h2 class="sp" style="margin:0">Sesiones de la unidad</h2><button class="btn" id="nueva">＋ Nueva sesión</button></div>
  <div class="card row" style="gap:10px"><b>Total de sesiones de la unidad:</b><input id="tot" type="number" min="1" max="60" value="${esc((T.cfg && T.cfg.total_sesiones) || 14)}" style="width:90px"><button class="btn sm" id="tots">Guardar</button><span class="small mut">Creadas: ${T.sesiones.length}. Se usa para calcular el avance de los estudiantes.</span><button class="btn sm ghost" id="rell">＋ Crear las que faltan</button></div>
  ${T.sesiones.map(s => `<div class="card row"><div class="ses" style="width:auto;cursor:default"><div class="n" style="width:42px;height:42px;border-radius:12px;background:var(--navy);color:#fff;display:grid;place-items:center;font:700 1rem Poppins">${s.numero}</div></div><div class="sp"><b>${esc(s.titulo)}</b> ${chipSes(s.temporal)}<div class="small mut">${s.fecha ? '📅 ' + fmtDia(s.fecha) + ' · ' : ''}${s.pasos.length} pasos · ${s.material.length} materiales · ${s.apertura ? fmtFecha(s.apertura) : 'sin apertura'} → ${s.cierre ? fmtFecha(s.cierre) : 'sin cierre'}</div></div><button class="btn sm ghost" data-v="${esc(s.id)}">👁 Ver</button><button class="btn sm ghost" data-e="${esc(s.id)}">Editar</button><button class="btn sm ghost" data-d="${esc(s.id)}">🗑</button></div>`).join('') || '<div class="card mut c">No hay sesiones.</div>'}`;
  $('#nueva').onclick = () => { const mx = Math.max(0, ...T.sesiones.map(s => s.numero)); T.edit = { id: '', numero: mx + 1, titulo: '', descripcion: '', apertura: Date.now(), cierre: Date.now() + 7 * 864e5, estado: 'borrador', bloqueo: 'SI', ritmo: 'libre', paso_actual: 0, pasos: [], material: [], pauta_ia: '' }; editor(); };
  $('#tots').onclick = async () => { const v = Math.max(1, Math.min(60, +$('#tot').value || 14)); try { await API.call('docGuardarConfig', { config: { total_sesiones: String(v) } }); T.cfg = { ...T.cfg, total_sesiones: String(v) }; toast('Total de sesiones: ' + v + ' ✅'); vSes(); } catch (e) { manejar(e); } };
  $('#rell').onclick = async () => { const tot = Math.max(1, Math.min(60, +$('#tot').value || 14)); const hay = new Set(T.sesiones.map(s => s.numero)); const faltan = []; for (let i = 1; i <= tot; i++) if (!hay.has(i)) faltan.push(i); if (!faltan.length) return toast('Ya están creadas todas las sesiones.'); if (!confirm('Se crearán ' + faltan.length + ' sesiones vacías (en borrador): ' + faltan.join(', ') + '. ¿Continuar?')) return; try { for (const i of faltan) await API.call('docGuardarSesion', { sesion: { numero: i, titulo: 'Sesión ' + i, estado: 'borrador', pasos: [], material: [] } }); T.sesiones = (await API.call('docSesiones')).sesiones; toast('Sesiones creadas ✅'); vSes(); } catch (e) { manejar(e); } };
  $$('[data-v]').forEach(b => b.onclick = () => verComoEstudiante(b.dataset.v));
  $$('[data-e]').forEach(b => b.onclick = () => { T.edit = JSON.parse(JSON.stringify(T.sesiones.find(s => s.id === b.dataset.e))); editor(); });
  $$('[data-d]').forEach(b => b.onclick = async () => { if (!confirm('¿Eliminar la sesión? Las respuestas de los estudiantes se conservan en la planilla.')) return; try { await API.call('docEliminarSesion', { id: b.dataset.d }); T.sesiones = (await API.call('docSesiones')).sesiones; vSes(); } catch (e) { manejar(e); } });
}
const TIPOS = { diapositiva: 'Diapositiva (texto)', documento: 'Archivo / Canva / video incrustado', opcion: 'Selección múltiple', vf: 'Verdadero/Falso', numerica: 'Respuesta numérica', encuesta: 'Encuesta (sin correcta)', nube: 'Nube de palabras (Menti)', escala: 'Escala 1 a 5 (Menti)', abierta: 'Pregunta abierta (IA)' };
function campo(k, etiqueta, v, tipo = 'text', extra = '') { return `<label>${etiqueta}</label>${tipo === 'area' ? `<textarea data-k="${k}">${esc(v ?? '')}</textarea>` : `<input data-k="${k}" type="${tipo}" value="${esc(v ?? '')}" ${extra}>`}`; }
const PH_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb2f0"/><stop offset="1" stop-color="#2f6fb5"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="600" cy="180" r="90" fill="#ffffff55"/><path d="M0 600 L260 330 L430 480 L560 380 L800 600Z" fill="#ffffff44"/></svg>');
const urlDrive = (r, ancho) => 'https://lh3.googleusercontent.com/d/' + r.id + (/gif/i.test(r.mime || '') ? '' : '=w' + (ancho || 1600));
/** Barra de formato de texto (negrita, cursiva, subrayado, resaltado, color, tamaño, viñetas). */
function fmtBar() {
  return `<div class="fmtbar" role="toolbar" aria-label="Formato de texto"><button type="button" data-f="bold" title="Negrita (Ctrl+B)"><b>B</b></button><button type="button" data-f="italic" title="Cursiva (Ctrl+I)"><i>I</i></button><button type="button" data-f="underline" title="Subrayado (Ctrl+U)"><u>U</u></button><span class="sep"></span>
  <button type="button" data-f="hl" title="Resaltar con marcador">🖍</button><button type="button" data-f="color" title="Color del texto"><span style="color:#ef4444;font-weight:800">A</span><span style="display:block;height:3px;background:#ef4444;border-radius:2px;margin-top:-4px"></span></button><span class="sep"></span>
  <button type="button" data-f="menos" title="Letra más pequeña">A−</button><button type="button" data-f="normal" title="Tamaño normal">A</button><button type="button" data-f="mas" title="Letra más grande">A+</button><span class="sep"></span>
  <button type="button" data-f="ul" title="Lista con viñetas">• Viñetas</button><button type="button" data-f="clear" title="Quitar el formato del texto seleccionado">✖ Formato</button></div>`;
}/** Efectos y diseño de una diapositiva (o de TODA la presentación): 3D, movimiento, formas, filtros, objeto móvil, con vista previa animada. */
function modalEstilo(ed, rerender, global) {
  const slides = $$('#pasos .edslide'); if (!slides.length) return toast('Aún no hay diapositivas.');
  const base = ed || slides[0];
  const val = k => { const e = $(`[data-k="${k}"]`, base); return e ? (e.value !== undefined ? e.value : e.innerText) : ''; };
  const m0 = { titulo: val('titulo').trim() || 'Título de la diapositiva', texto: val('texto').trim() || '- Primera idea\n- Segunda idea\n- Tercera idea', imagen: val('imagen') || PH_IMG, layout: val('layout'), tema: val('tema'), fx: val('fx'), forma: val('forma') || 'completa', filtro: val('filtro'), mov: val('mov'), movx: val('movx'), movy: val('movy'), movvel: val('movvel') || 'normal', obj: val('obj'), objmov: val('objmov') || 'navegar', objw: val('objw') || 24, objy: val('objy') === '' ? 58 : val('objy'), video: val('video'), vaudio: val('vaudio'), vauto: val('vauto'), vloop: val('vloop'), vctrl: val('vctrl'), vini: val('vini') };
  const opts = (obj, actual, vacio) => (global ? '<option value="__">(no cambiar)</option>' : '') + (vacio ? `<option value="" ${!global && !actual ? 'selected' : ''}>${vacio}</option>` : '') + Object.entries(obj).map(([k, v]) => `<option value="${k}" ${!global && actual === k ? 'selected' : ''}>${v}</option>`).join('');
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box ancho"><div class="row"><h3 class="sp" style="margin:0">${global ? '🎨 Estilo de toda la presentación' : '✨ Efectos y movimiento de la diapositiva'}</h3><button type="button" class="btn sm ghost" id="ex" aria-label="Cerrar">✕</button></div>
  <div class="fxprev" id="fxp"></div>
  <div class="card" style="margin:10px 0;background:var(--bg)"><div class="row"><b class="sp">🪄 Movimiento inteligente</b><button type="button" class="btn sm gold" id="${global ? 's_aiall' : 's_ai'}">${global ? 'Sugerir según cada imagen' : 'Analizar imagen y sugerir'}</button></div><div id="s_sug" class="small mut" style="margin-top:6px">La IA reconoce qué muestra la imagen (barco, personas, ciudad, campo, gráfico…) y propone el movimiento que mejor le va. Sin IA disponible, se basa en el texto de la diapositiva.</div></div>
  <div class="grid2"><div><label>Diseño</label><select id="s_lay">${opts(LAYOUTS, m0.layout)}</select></div><div><label>Color</label><select id="s_tema">${opts(TEMAS, m0.tema)}</select></div>
  <div><label>Efecto 3D / animación</label><select id="s_fx">${opts(FXS, m0.fx, 'Ninguno')}</select></div><div><label>Forma de la imagen</label><select id="s_forma">${opts(FORMAS_IMG, m0.forma)}</select></div>
  <div><label>Movimiento de la imagen</label><select id="s_mov">${opts(MOVS, m0.mov, 'Sin movimiento')}</select></div><div><label>Velocidad</label><select id="s_vel">${opts(VELS, m0.movvel)}</select></div>
  <div><label>Filtro de imagen</label><select id="s_filtro">${opts(FILTROS, m0.filtro, 'Sin filtro')}</select></div></div>
  ${global ? '<div class="hint">Se aplica a todas las diapositivas. «(no cambiar)» respeta lo que ya tiene cada una.</div>' : `<label class="row" style="font-weight:500"><input type="checkbox" id="s_all" style="width:20px;min-height:0;height:20px"> Aplicar también a todas las diapositivas</label>
  <details ${m0.obj ? 'open' : ''} style="margin-top:10px"><summary><b>🚢 Objeto en movimiento (opcional)</b></summary>
   <p class="small mut">Agrega una imagen con fondo transparente (PNG), por ejemplo un barco recortado, que se mueve sobre la diapositiva. El «Movimiento de la imagen» de arriba mueve la foto completa (con «Navegar» se mece con olas); el objeto es una pieza aparte que sí puede cruzar la pantalla.</p>
   <div class="row"><input id="s_obj" placeholder="Dirección (URL) de la imagen PNG" value="${esc(m0.obj)}" style="flex:1;min-width:180px"><button type="button" class="btn sm ghost" id="s_objup">⬆ Subir</button><input type="file" id="s_objf" accept="image/*" hidden></div>
   <div class="grid2"><div><label>Movimiento del objeto</label><select id="s_objmov">${Object.entries(OBJMOVS).map(([k, v]) => `<option value="${k}" ${m0.objmov === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div><label>Tamaño</label><input id="s_objw" type="range" min="10" max="50" value="${m0.objw}"></div></div>
   <label>Altura en la diapositiva</label><input id="s_objy" type="range" min="0" max="80" value="${m0.objy}"></details>`}
  <div class="row" style="margin-top:14px"><button type="button" class="btn gold" id="s_ok">Aplicar</button><button type="button" class="btn ghost" id="s_no">Cancelar</button></div><div class="hint">Aquí ves una vista previa animada. Las formas, el 3D y los filtros se aprecian con una imagen.</div></div>`;
  document.body.appendChild(m);
  const cerrar = () => { m.remove(); document.removeEventListener('keydown', escE); }; const escE = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', escE);
  const sel = id => { const e = $('#' + id, m); return e ? e.value : ''; }; const v_ = (id, orig) => { const x = sel(id); return x === '__' ? orig : x; };
  const pint = () => { const o = { ...m0, layout: v_('s_lay', m0.layout), tema: v_('s_tema', m0.tema), fx: v_('s_fx', m0.fx), forma: v_('s_forma', m0.forma), filtro: v_('s_filtro', m0.filtro), mov: v_('s_mov', m0.mov), movvel: v_('s_vel', m0.movvel) }; if (!global) { o.obj = sel('s_obj'); o.objmov = sel('s_objmov'); o.objw = sel('s_objw'); o.objy = sel('s_objy'); } $('#fxp', m).innerHTML = `<div class="mini vivo">${slideStage(o, false)}</div>`; };
  $$('select, input[type=range]', m).forEach(s => s.onchange = s.oninput = pint); if ($('#s_obj', m)) $('#s_obj', m).oninput = pint; pint();
  if ($('#s_objup', m)) { $('#s_objup', m).onclick = () => $('#s_objf', m).click(); $('#s_objf', m).onchange = async ev => { const f = ev.target.files[0]; if (!f) return; $('#s_objup', m).textContent = 'Subiendo…'; try { const r = await subirArchivo(f, () => { }); $('#s_obj', m).value = urlDrive(r, 800); pint(); } catch (er) { toast(er.message, 5000); } $('#s_objup', m).textContent = '⬆ Subir'; }; }
  const nombreMov = k => MOVS[k] || k;
  const analizar = async (url, titulo, texto) => { try { return await API.call('docAnalizarImagen', { url, titulo, texto }); } catch (e) { if (e.code === 'SESION_EXPIRADA') throw e; const r = sugerirPorTexto(titulo + ' ' + texto + ' ' + url); return r; } };
  if ($('#s_ai', m)) $('#s_ai', m).onclick = async () => {
    const url = m0.imagen; const sug = $('#s_sug', m);
    if (!url || url === PH_IMG || url.startsWith('data:')) return toast('Primero agrega una imagen a la diapositiva.');
    sug.innerHTML = '<p><span class="spin"></span> Reconociendo la imagen…</p>';
    let r; try { r = await analizar(url, m0.titulo, m0.texto); } catch (e) { sug.innerHTML = `<div class="err">${esc(e.message)}</div>`; return manejar(e); }
    sug.innerHTML = `<div><b>Detecté:</b> ${esc(r.tipo)} — ${esc(r.descripcion)}${r.sinVision ? ' <span class="chip warn">según el texto de la diapositiva</span>' : ''}</div><div class="row" style="gap:6px;margin-top:8px">${r.propuestas.map((p, i) => `<button type="button" class="btn sm ghost" data-pi="${i}" title="${esc(p.motivo)}">${esc(nombreMov(p.mov))} · ${esc(VELS[p.velocidad] || p.velocidad)}</button>`).join('')}</div><div class="hint" id="s_why"></div>`;
    const aplicar = i => { const p = r.propuestas[i]; $('#s_mov', m).value = p.mov; $('#s_vel', m).value = p.velocidad; m0.movx = r.foco.x; m0.movy = r.foco.y; $('#s_why', m).textContent = '💡 ' + p.motivo; $$('[data-pi]', m).forEach(b => b.classList.toggle('gold', +b.dataset.pi === i)); pint(); };
    $$('[data-pi]', m).forEach(b => b.onclick = () => aplicar(+b.dataset.pi)); aplicar(0);
  };
  if ($('#s_aiall', m)) $('#s_aiall', m).onclick = async () => {
    const con = slides.filter(s => { const u = $('[data-k="imagen"]', s).value; return u && !u.startsWith('data:'); }); const sug = $('#s_sug', m);
    if (!con.length) return toast('Ninguna diapositiva tiene imagen.');
    let i = 0, hechas = 0; sug.innerHTML = `<p><span class="spin"></span> Reconociendo imágenes… 0/${con.length}</p>`;
    const tarea = async () => { while (i < con.length) { const s = con[i++]; const url = $('[data-k="imagen"]', s).value; const r = await analizar(url, ($('[data-k="titulo"]', s).innerText || ''), ($('[data-k="texto"]', s).innerText || '')); const p = r.propuestas[0]; $('[data-k="mov"]', s).value = p.mov; $('[data-k="movvel"]', s).value = p.velocidad; $('[data-k="movx"]', s).value = r.foco.x; $('[data-k="movy"]', s).value = r.foco.y; hechas++; sug.innerHTML = `<p><span class="spin"></span> Reconociendo imágenes… ${hechas}/${con.length}</p>`; } };
    try { await Promise.all([tarea(), tarea(), tarea()]); sug.innerHTML = `<div class="fb ok">✅ Movimiento elegido para ${con.length} diapositiva(s) según lo que muestra cada imagen. Pulsa «Aplicar» para verlo.</div>`; } catch (e) { sug.innerHTML = `<div class="err">${esc(e.message)}</div>`; manejar(e); }
  };  $('#ex', m).onclick = cerrar; $('#s_no', m).onclick = cerrar; m.onclick = e => { if (e.target === m) cerrar(); };
  $('#s_ok', m).onclick = () => {
    const todos = global || ($('#s_all', m) && $('#s_all', m).checked); const objetivos = todos ? slides : [base];
    objetivos.forEach(s => {
      const set = (k, id) => { const x = sel(id); if (x === '__') return; const e = $(`[data-k="${k}"]`, s); if (e) e.value = x; };
      set('layout', 's_lay'); set('tema', 's_tema'); set('fx', 's_fx'); set('forma', 's_forma'); set('filtro', 's_filtro'); set('mov', 's_mov'); set('movvel', 's_vel');
    });
    if (!global) { const put = (k, id) => { const e = $(`[data-k="${k}"]`, base); if (e) e.value = sel(id); }; put('obj', 's_obj'); put('objmov', 's_objmov'); put('objw', 's_objw'); put('objy', 's_objy'); const fx_ = $('[data-k="movx"]', base), fy_ = $('[data-k="movy"]', base); if (fx_) fx_.value = m0.movx ?? ''; if (fy_) fy_.value = m0.movy ?? ''; }
    cerrar(); rerender();
  };
}
/** Video de YouTube dentro de la diapositiva, junto al texto; con o sin audio. */
function modalVideo(ed, rerender) {
  const val = k => { const e = $(`[data-k="${k}"]`, ed); return e ? (e.value !== undefined ? e.value : e.innerText) : ''; };
  const m0 = { titulo: val('titulo').trim() || 'Título de la diapositiva', texto: val('texto').trim() || '- Idea principal\n- Más información', layout: val('layout'), tema: val('tema') };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box ancho"><div class="row"><h3 class="sp" style="margin:0">🎬 Video de YouTube en la diapositiva</h3><button type="button" class="btn sm ghost" id="vx" aria-label="Cerrar">✕</button></div>
  <label>Dirección del video (YouTube)</label><input id="v_url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(val('video'))}"><div id="v_estado" class="small" style="margin:6px 0;min-height:1.2em"></div>
  <div class="fxprev" id="v_prev"></div>
  <div class="grid2"><div><label>Audio</label><select id="v_aud">${Object.entries(VAUDIOS).map(([k, v]) => `<option value="${k}" ${(val('vaudio') || 'silencio') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div><label>Comenzar en el segundo</label><input id="v_ini" type="number" min="0" value="${esc(val('vini'))}" placeholder="0"></div></div>
  <label class="row" style="font-weight:500"><input type="checkbox" id="v_solo" ${val('layout') === 'video' ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Solo video, sin título ni texto (pantalla completa)</label>
  <label class="row" style="font-weight:500"><input type="checkbox" id="v_auto" ${val('vauto') || !val('video') ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Reproducir automáticamente</label>
  <label class="row" style="font-weight:500"><input type="checkbox" id="v_loop" ${val('vloop') ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Repetir en bucle</label>
  <label class="row" style="font-weight:500"><input type="checkbox" id="v_ctrl" ${val('vctrl') !== 'no' ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> Mostrar controles</label>
  <div class="hint">El video ocupa el lugar de la imagen y el texto de la diapositiva aparece junto a él. Elige dónde con «🎨 Diseños» (derecha, izquierda, arriba, dividido, fondo o tarjeta). Con audio, algunos navegadores esperan a que la persona toque la pantalla para reproducir el sonido.</div>
  <div class="row" style="margin-top:12px"><button type="button" class="btn gold" id="v_ok">Aplicar</button><button type="button" class="btn ghost" id="v_no">Cancelar</button><button type="button" class="btn ghost" id="v_del" style="margin-left:auto">Quitar video</button></div></div>`;
  document.body.appendChild(m);
  const cerrar = () => { m.remove(); document.removeEventListener('keydown', escV); }; const escV = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', escV);
  const pint = () => { $('#v_prev', m).innerHTML = ytId($('#v_url', m).value) ? `<div class="mini">${slideStage({ ...m0, video: $('#v_url', m).value, layout: $('#v_solo', m) && $('#v_solo', m).checked ? 'video' : (['solo', 'titulo', 'destacado', 'cita', 'portada', 'video'].includes(m0.layout) ? 'imagen-derecha' : m0.layout) }, false)}</div>` : '<p class="small mut c">Pega un enlace de YouTube para ver la vista previa.</p>'; };
  let tmV; const chequear = () => { clearTimeout(tmV); tmV = setTimeout(async () => { const st = $('#v_estado', m); if (!st) return; const id = ytId($('#v_url', m).value); if (!id) { st.textContent = ''; return; } st.textContent = 'Comprobando el video…'; try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)); if (r.ok) { const j = await r.json(); st.innerHTML = '✅ Se puede reproducir: <b>' + esc(j.title) + '</b> <span class="mut">(' + esc(j.author_name) + ')</span>'; } else if (r.status === 401 || r.status === 403) st.innerHTML = '<span style="color:var(--bad)">⛔ El autor no permite reproducir este video fuera de YouTube. Elige otro video.</span>'; else if (r.status === 404) st.innerHTML = '<span style="color:var(--bad)">⛔ El video no existe, es privado o fue eliminado.</span>'; else st.textContent = ''; } catch (e) { st.textContent = ''; } }, 450); };
  $('#v_url', m).oninput = () => { pint(); chequear(); }; pint(); chequear();
  $('#vx', m).onclick = cerrar; $('#v_no', m).onclick = cerrar; m.onclick = e => { if (e.target === m) cerrar(); };
  const put = (k, v) => { const e = $(`[data-k="${k}"]`, ed); if (e) e.value = v; };
  $('#v_del', m).onclick = () => { put('video', ''); cerrar(); rerender(); };
  $('#v_ok', m).onclick = () => {
    const u = $('#v_url', m).value.trim(); if (u && !ytId(u)) return toast('Pega un enlace de YouTube válido (youtube.com/watch?v=… o youtu.be/…).', 4500);
    put('video', u); put('vaudio', $('#v_aud', m).value); put('vauto', $('#v_auto', m).checked ? '1' : ''); put('vloop', $('#v_loop', m).checked ? '1' : ''); put('vctrl', $('#v_ctrl', m).checked ? 'si' : 'no'); put('vini', $('#v_ini', m).value);
    if (u && $('#v_solo', m).checked) put('layout', 'video'); else if (u && ['solo', 'titulo', 'destacado', 'cita', 'portada', 'video', ''].includes(val('layout'))) put('layout', 'imagen-derecha');
    cerrar(); rerender();
  };
}
/** Galería de diseños tipo Canva: muestra TU diapositiva en cada diseño y cada color para elegir con un toque. */
function galeria(ed, rerender) {
  const val = k => { const e = $(`[data-k="${k}"]`, ed); return e ? (e.value !== undefined ? e.value : e.innerText) : ''; };
  const ph = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb2f0"/><stop offset="1" stop-color="#2f6fb5"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="600" cy="180" r="90" fill="#ffffff55"/><path d="M0 600 L260 330 L430 480 L560 380 L800 600Z" fill="#ffffff44"/></svg>');
  const base = { titulo: val('titulo').trim() || 'Título de la diapositiva', texto: val('texto').trim() || '- Primera idea\n- Segunda idea\n- Tercera idea', imagen: val('imagen') || ph, credito: '', layout: val('layout'), tema: val('tema'), video: val('video') };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box ancho"><div class="row"><h3 class="sp" style="margin:0">🎨 Elige un diseño</h3><button type="button" class="btn sm ghost" id="gx" aria-label="Cerrar">✕</button></div><p class="small mut">Toca el que más te guste. Tu texto y tu imagen se conservan.</p>
  <b>Diseño</b><div class="galeria">${Object.entries(LAYOUTS).filter(([k]) => k !== 'video' || ytId(base.video)).map(([k, v]) => `<button type="button" data-lay="${k}" class="${k === base.layout ? 'on' : ''}"><div class="mini">${slideStage({ ...base, layout: k }, false)}</div><small>${v}</small></button>`).join('')}</div>
  <b>Colores</b><div class="galeria">${Object.entries(TEMAS).map(([k, v]) => `<button type="button" data-tema="${k}" class="${k === base.tema ? 'on' : ''}"><div class="mini">${slideStage({ ...base, tema: k }, false)}</div><small>${v}</small></button>`).join('')}</div>
  <label class="row" style="font-weight:500"><input type="checkbox" id="gall" style="width:20px;min-height:0;height:20px"> Aplicar el color elegido a toda la presentación</label></div>`;
  document.body.appendChild(m);
  const cerrar = () => { m.remove(); document.removeEventListener('keydown', escG); }; const escG = e => { if (e.key === 'Escape') cerrar(); }; document.addEventListener('keydown', escG);
  $('#gx', m).onclick = cerrar; m.onclick = e => { if (e.target === m) cerrar(); };
  $$('[data-lay]', m).forEach(b => b.onclick = () => { $('[data-k="layout"]', ed).value = b.dataset.lay; cerrar(); rerender(); });
  $$('[data-tema]', m).forEach(b => b.onclick = () => { const t = b.dataset.tema; if ($('#gall', m).checked) $$('.edslide [data-k="tema"]').forEach(s => s.value = t); else $('[data-k="tema"]', ed).value = t; cerrar(); rerender(); });
}/* ---------- Editor de preguntas "como se ven" (estilo Kahoot): se escribe sobre los recuadros ---------- */
function tileEd(i, txt, ok, tipo) {
  return `<div class="tile edt t${i % 4} ${ok ? 'ok' : ''}"><span class="sh">${FORMAS[i % 4]}</span><span class="q-opt" contenteditable="plaintext-only" spellcheck="false" data-opt data-ph="Alternativa ${i + 1}">${esc(txt)}</span>${tipo === 'opcion' ? '<button type="button" class="q-ok" data-a="ok" title="Marcar como respuesta correcta">✓</button>' : ''}<button type="button" class="q-rm" data-a="rmopt" title="Quitar alternativa">✕</button></div>`;
}
function preguntaEditor(p) {
  const tipo = p.tipo; let s = `<div class="edq"><div class="qstage"><div class="q-head" contenteditable="plaintext-only" spellcheck="false" data-k="pregunta" data-ph="${tipo === 'nube' ? 'Escribe la pregunta (ej: ¿Qué palabra asocias con comercio?)' : 'Escribe tu pregunta aquí'}">${esc(p.pregunta)}</div>`;
  s += `<div class="q-meta"><label title="Tiempo para responder en vivo">⏱ <input data-k="tiempo" type="number" min="5" value="${p.tiempo || ''}" placeholder="${tiempoDefCliente(tipo)}"> s</label>${tipo !== 'encuesta' && tipo !== 'nube' && tipo !== 'escala' ? `<label title="Puntos">⭐ <input data-k="puntos" type="number" step="0.5" min="0" value="${p.puntos ?? 1}"> pts</label>` : `<input data-k="puntos" type="hidden" value="${p.puntos ?? 1}">`}</div>`;
  if (tipo === 'opcion' || tipo === 'encuesta') {
    const ops = [...(p.opciones || [])]; while (ops.length < (tipo === 'opcion' ? 4 : 3)) ops.push('');
    s += `<div class="tiles q-tiles">${ops.map((o, i) => tileEd(i, o, tipo === 'opcion' && i === (p.correcta ?? 0), tipo)).join('')}</div><div class="c" style="margin-top:8px"><button type="button" class="btn sm ghost" data-a="addopt" style="color:#fff;border-color:rgba(255,255,255,.5)">＋ Agregar alternativa</button></div>${tipo === 'opcion' ? '<div class="q-hint">Toca el ✓ de la alternativa correcta.</div>' : '<div class="q-hint">Encuesta: no hay alternativa correcta.</div>'}`;
  } else if (tipo === 'vf') {
    s += `<div class="tiles q-tiles"><div class="tile t1 ${p.correcta !== 'F' ? 'ok' : ''}" data-v="V" style="min-height:70px"><span class="sh">✔</span><span>Verdadero</span><button type="button" class="q-ok" data-a="ok">✓</button></div><div class="tile t0 ${p.correcta === 'F' ? 'ok' : ''}" data-v="F" style="min-height:70px"><span class="sh">✖</span><span>Falso</span><button type="button" class="q-ok" data-a="ok">✓</button></div></div><div class="q-hint">Toca el ✓ de la respuesta correcta.</div>`;
  } else if (tipo === 'numerica') {
    s += `<div class="q-num"><label>Respuesta correcta <input data-k="correcta" type="number" step="any" value="${p.correcta ?? 0}"></label><label>Tolerancia ± <input data-k="tolerancia" type="number" step="any" value="${p.tolerancia ?? 0.01}"></label></div>`;
  } else if (tipo === 'nube') {
    s += '<div class="nube" style="background:#fff;border-radius:14px;margin-top:10px"><span style="font-size:2rem;color:#e21b3c">oferta</span> <span style="font-size:1.3rem;color:#1368ce">precio</span> <span style="font-size:1.7rem;color:#26890c">mercado</span> <span style="font-size:1.1rem;color:#d89e00">demanda</span></div><div class="q-hint">Así se verá la nube con las palabras de los estudiantes.</div>';
  } else if (tipo === 'escala') {
    s += '<div class="escala" style="margin-top:10px">' + [1, 2, 3, 4, 5].map(n => `<button type="button" class="esc" disabled>${n}</button>`).join('') + '</div><div class="q-hint">Los estudiantes valoran de 1 a 5. Redacta una afirmación.</div>';
  } else {
    s += '<textarea disabled placeholder="Aquí escribirán su respuesta los estudiantes…" style="margin-top:10px;background:#fff"></textarea>';
  }
  s += '</div>';
  if (tipo === 'abierta') s += campo('titulo', 'Título corto (para identificarla)', p.titulo) + campo('campos', 'Campos de respuesta (uno por línea)', (p.campos || ['Tu respuesta']).join('\n'), 'area') + campo('modelo', 'Respuesta modelo / pauta (la usa la IA)', p.modelo, 'area') + campo('rubrica', 'Rúbrica', p.rubrica, 'area');
  else if (tipo !== 'encuesta' && tipo !== 'nube' && tipo !== 'escala') s += `<details style="margin-top:8px" ${p.explicacion ? 'open' : ''}><summary class="small mut">💡 Explicación (se muestra al responder)</summary>${campo('explicacion', '', p.explicacion, 'area')}</details>`;
  return s + '</div>';
}
function tiempoDefCliente(t) { return { opcion: 20, vf: 15, numerica: 40, encuesta: 30, nube: 45, escala: 20, abierta: 180 }[t] || 20; }
function pasoForm(p, i) {
  let f = '';
  if (p.tipo === 'documento') f = campo('titulo', 'Título', p.titulo) + campo('texto', 'Texto de apoyo (opcional)', p.texto, 'area') + campo('url', 'Enlace (Canva, Google Slides, YouTube, Drive…) — o sube un archivo con el botón de abajo', p.url) + `<input type="hidden" data-k="driveId" value="${esc(p.driveId || '')}"><input type="hidden" data-k="mime" value="${esc(p.mime || '')}">` + (p.driveId ? '<div class="chip ok" style="margin-top:8px">📎 Archivo subido a tu Drive</div>' : '');
  else if (p.tipo === 'diapositiva') f = `<div class="edslide">${fmtBar()}${slideStage(p, true)}<div class="tb"><select data-k="layout" title="Diseño">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}" ${(p.layout || (p.imagen ? 'imagen-derecha' : 'solo')) === k ? 'selected' : ''}>${v}</option>`).join('')}</select><select data-k="tema" title="Tema de color">${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}" ${(p.tema || 'azul') === k ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="btn sm" data-a="gal">🎨 Diseños</button><button class="btn sm" data-a="fx">✨ Efectos</button><button class="btn sm" data-a="vid">🎬 Video</button><button class="btn sm ghost" data-a="img">🖼 Imagen…</button>${p.imagen ? '<button class="btn sm ghost" data-a="noimg">✕ Quitar imagen</button>' : ''}</div><div class="hint">Escribe directamente sobre la diapositiva. Selecciona un texto y usa la barra de formato (negrita, color, resaltado, tamaño, viñetas).</div><input type="hidden" data-k="imagen" value="${esc(p.imagen || '')}"><input type="hidden" data-k="credito" value="${esc(p.credito || '')}"><input type="hidden" data-k="fx" value="${esc(p.fx || '')}"><input type="hidden" data-k="forma" value="${esc(p.forma || '')}"><input type="hidden" data-k="filtro" value="${esc(p.filtro || '')}">${['mov', 'movvel', 'movx', 'movy', 'obj', 'objmov', 'objw', 'objy', 'video', 'vaudio', 'vauto', 'vloop', 'vctrl', 'vini'].map(k => `<input type="hidden" data-k="${k}" value="${esc(p[k] ?? '')}">`).join('')}<div class="imgpanel"></div></div>`;
  else f = preguntaEditor(p);
  return `<div class="paso-ed" data-i="${i}"><div class="row"><span class="chip navy">${i + 1}</span><select data-k="tipo" style="max-width:240px">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="sp"></span><button class="btn sm ghost" data-a="up">↑</button><button class="btn sm ghost" data-a="dn">↓</button><button class="btn sm ghost" data-a="rm">✕</button></div>${f}</div>`;
}
function leerPasos() {
  return $$('#pasos .paso-ed').map(c => {
    const g = k => { const e = $(`[data-k="${k}"]`, c); if (!e) return undefined; if (e.dataset && e.dataset.rich) return htmlAMarkup(e); return e.value !== undefined ? e.value : e.innerText.replace(/ /g, ' ').replace(/\n+$/, ''); };
    const p = { id: T.edit.pasos[+c.dataset.i]?.id || 'n' + Math.random().toString(36).slice(2, 7), tipo: g('tipo') };
    if (p.tipo === 'documento') { p.titulo = g('titulo'); p.texto = g('texto'); p.url = g('url'); p.driveId = g('driveId'); p.mime = g('mime'); return p; }
    if (p.tipo === 'diapositiva') { p.titulo = g('titulo'); p.texto = g('texto'); p.imagen = g('imagen'); p.credito = g('credito'); p.layout = g('layout'); p.tema = g('tema'); p.fx = g('fx'); p.forma = g('forma'); p.filtro = g('filtro'); ['mov', 'movvel', 'movx', 'movy', 'obj', 'objmov', 'objw', 'objy', 'video', 'vaudio', 'vauto', 'vloop', 'vctrl', 'vini'].forEach(k => p[k] = g(k)); return p; }
    p.pregunta = g('pregunta'); p.puntos = +g('puntos') || 1; if (+g('tiempo')) p.tiempo = +g('tiempo');
    if (g('titulo') !== undefined) p.titulo = g('titulo');
    if (p.tipo === 'opcion' || p.tipo === 'encuesta') { const ops = []; let corr = 0; $$('.q-tiles .tile', c).forEach(t => { const tx = ($('[data-opt]', t).innerText || '').trim(); if (!tx) return; if (t.classList.contains('ok')) corr = ops.length; ops.push(tx); }); p.opciones = ops; if (p.tipo === 'opcion') p.correcta = corr; }
    if (p.tipo === 'vf') { const t = $('.q-tiles .tile.ok', c); p.correcta = t && t.dataset.v === 'F' ? 'F' : 'V'; }
    if (p.tipo === 'numerica') { p.correcta = +g('correcta'); p.tolerancia = +g('tolerancia') || 0.01; }
    if (p.tipo === 'abierta') { p.campos = (g('campos') || '').split('\n').map(x => x.trim()).filter(Boolean); p.modelo = g('modelo'); p.rubrica = g('rubrica'); }
    if (g('explicacion') !== undefined) p.explicacion = g('explicacion');
    return p;
  });
}
function leerMat() { return $$('.mat').map(c => ({ tipo: $('.mt', c).value, titulo: $('.mti', c).value, url: $('.mu', c).value, descripcion: $('.md', c).value, driveId: c.dataset.did || '', mime: c.dataset.mime || '' })); }
function editor() {
  const e = T.edit;
  $('#main').innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="bk">← Volver</button><h2 class="sp" style="margin:0">${e.id ? 'Editar' : 'Nueva'} sesión ${e.numero}</h2><button class="btn" id="sv">💾 Guardar</button></div>
  <div class="card"><div class="grid2"><div>${campo('numero', 'N° de sesión', e.numero, 'number')}</div><div><label>Estado</label><select id="est"><option value="borrador" ${e.estado === 'borrador' ? 'selected' : ''}>Borrador (oculta)</option><option value="publicada" ${e.estado === 'publicada' ? 'selected' : ''}>Publicada</option></select></div></div>
  ${campo('titulo', 'Título', e.titulo)}${campo('descripcion', 'Descripción', e.descripcion, 'area')}
  <label>Fecha de la sesión (opcional)</label><input id="fe" type="date" value="${esc(e.fecha || '')}"><div class="hint">Los estudiantes la ven en la lista de sesiones. No cambia el plazo para responder (eso se define abajo).</div>
  <div class="grid2"><div><label>Abre (plazo)</label><input id="ap" type="datetime-local" value="${aInputLocal(e.apertura)}"></div><div><label>Cierra (plazo límite para actividades)</label><input id="ci" type="datetime-local" value="${aInputLocal(e.cierre)}"></div></div>
  <label>Modo concentración (bloqueo al salir de la app)</label><select id="bl"><option value="SI" ${e.bloqueo !== 'NO' ? 'selected' : ''}>Activado</option><option value="NO" ${e.bloqueo === 'NO' ? 'selected' : ''}>Desactivado</option></select>
  ${campo('pauta_ia', 'Notas para la IA (errores frecuentes, criterios)', e.pauta_ia, 'area')}</div>
  <div class="card"><div class="row"><h3 class="sp" style="margin:0 0 4px">🎬 La clase: presentación con actividades</h3><button type="button" class="btn sm gold" id="gs">🎨 Estilo de toda la presentación</button></div>
  <p class="small mut">Todo en una sola secuencia, en el orden en que se verá: diapositivas, archivos, videos y actividades (estilo Kahoot/Menti). En modo en vivo tú avanzas paso a paso desde el celular.</p>
  <div class="outline row" style="gap:6px">${e.pasos.map((p, i) => `<a href="#" class="chip ${ESACT(p) ? 'warn' : 'navy'}" data-go="${i}" title="${esc(p.titulo || p.pregunta || '')}">${i + 1} ${ICONO[p.tipo] || '•'}</a>`).join('') || '<span class="mut small">Aún no hay pasos.</span>'}</div>
  <div class="row" style="margin-top:12px"><label style="margin:0">Insertar nuevos pasos:</label><select id="pos" style="max-width:330px"><option value="">al final</option>${e.pasos.map((p, i) => `<option value="${i}" ${T.pos === i ? 'selected' : ''}>después del paso ${i + 1} · ${esc((p.titulo || p.pregunta || p.tipo).slice(0, 30))}</option>`).join('')}</select>
  </div><div class="row" style="gap:6px;margin-top:10px">${[['diapositiva', '🖼 Diapositiva'], ['video', '🎬 Solo video'], ['opcion', '🔺 Opción múltiple'], ['vf', '✔ V/F'], ['numerica', '🔢 Numérica'], ['encuesta', '📊 Encuesta'], ['nube', '☁ Nube'], ['escala', '⭐ Escala'], ['abierta', '✍ Abierta'], ['documento', '📎 Archivo/enlace']].map(([k, l]) => `<button type="button" class="btn sm" data-add="${k}">${l}</button>`).join('')}</div></div>
  <div id="pasos">${e.pasos.map(pasoForm).join('')}</div>
  <div class="card"><h3>⬆ Subir archivos completos</h3><p class="small mut">Arrastra o elige PDF, PowerPoint, Word, imágenes o videos. Se guardan en tu Drive y quedan dentro de esta sesión; no necesitas copiar nada. Máx. 300 MB por archivo. Se insertan donde indica «Insertar nuevos pasos».</p>
  <div class="grid2"><div class="drop" data-dest="paso">📽️ <b>Como un paso de la clase</b><div class="small mut">PDF, PowerPoint, imagen, video…</div></div><div class="drop" data-dest="split">✂️ <b>PDF → una diapositiva por página</b><div class="small mut">Así puedes meter actividades entre medio</div></div></div>
  <div class="drop" data-dest="mat" style="margin-top:10px">📚 <b>Al material y videos</b> <span class="small mut">(los estudiantes lo ven cuando quieran)</span></div>
  <input type="file" id="fi" multiple hidden accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm,.m4v,.mp3"><div id="upm"></div>
  <div class="hint">PowerPoint: para dividirlo por diapositivas, expórtalo a PDF (Archivo → Exportar → PDF) y usa «PDF → una diapositiva por página». Canva: Compartir → «Ver» → copia el enlace y pégalo en un paso «Archivo / Canva / video incrustado».</div></div>
  <div id="iaq"></div>
  <h3>Material y videos <button class="btn sm ghost" id="am">＋</button></h3><div id="mats">${e.material.map(matForm).join('')}</div>`;
  const rep = () => { e.titulo = $('[data-k="titulo"]').value; };
  const refrescar = () => { e.pasos = leerPasos(); e.material = leerMat(); const sc = scrollY; editor(); scrollTo(0, sc); };
  $('#bk').onclick = () => { T.edit = null; vSes(); };
  $('#am').onclick = () => { e.pasos = leerPasos(); e.material = [...leerMat(), { tipo: 'video', titulo: '', url: '', descripcion: '' }]; copiarCab(); editor(); };
  const posIns = () => { const v = $('#pos').value; return v === '' ? e.pasos.length : +v + 1; };
  const insertar = (nuevos, mats = []) => { const i = posIns(); const ps = leerPasos(); ps.splice(Math.min(i, ps.length), 0, ...nuevos); e.pasos = ps; e.material = [...leerMat(), ...mats]; copiarCab(); T.pos = i + nuevos.length - 1; editor(); };
  $$('[data-add]').forEach(b => b.onclick = () => { insertar([nuevoPaso(b.dataset.add)]); if (b.dataset.add === 'video') { const card = $$('#pasos .paso-ed')[T.pos]; const bt = card && $('[data-a="vid"]', card); if (bt) bt.click(); } });
  $$('[data-go]').forEach(a => a.onclick = ev => { ev.preventDefault(); const el = $$('#pasos .paso-ed')[+a.dataset.go]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  montarIA(e, nuevos => { insertar(nuevos); toast(`${nuevos.length} actividad(es) agregadas. Recuerda pulsar «Guardar».`, 5000); });
  let destino = 'paso';
  $$('.drop').forEach(d => { d.onclick = () => { destino = d.dataset.dest; $('#fi').click(); }; d.ondragover = ev => { ev.preventDefault(); d.classList.add('on'); }; d.ondragleave = () => d.classList.remove('on'); d.ondrop = ev => { ev.preventDefault(); d.classList.remove('on'); destino = d.dataset.dest; subir([...ev.dataTransfer.files]); }; });
  $('#fi').onchange = ev => { subir([...ev.target.files]); ev.target.value = ''; };
  async function subir(files) {
    const box = $('#upm'); const nuevosP = [], nuevosM = []; const modo = destino;
    for (const f of files) {
      if (modo === 'split') {
        if (!/\.pdf$/i.test(f.name)) { box.insertAdjacentHTML('beforeend', `<div class="err">${esc(f.name)}: para dividir debe ser PDF.</div>`); continue; }
        try { nuevosP.push(...await dividirPDF(f, box)); } catch (er) { box.insertAdjacentHTML('beforeend', `<div class="err">${esc(f.name)}: ${esc(er.message)}</div>`); if (er.code === 'SESION_EXPIRADA') return manejar(er); }
        continue;
      }
      const row = document.createElement('div'); row.className = 'upl'; row.innerHTML = `<span>${esc(f.name)}</span><div class="bar"><i style="width:0"></i></div><b>0%</b>`; box.appendChild(row);
      try {
        const r = await subirArchivo(f, p => { $('i', row).style.width = p * 100 + '%'; $('b', row).textContent = Math.round(p * 100) + '%'; });
        const nombre = f.name.replace(/\.[^.]+$/, ''); $('b', row).textContent = '✅';
        if (modo === 'paso') nuevosP.push({ id: 'd' + Date.now().toString(36) + nuevosP.length, tipo: 'documento', titulo: nombre, driveId: r.id, mime: r.mime });
        else nuevosM.push({ tipo: (r.mime || '').startsWith('video/') ? 'video' : 'documento', titulo: nombre, driveId: r.id, mime: r.mime, url: '', descripcion: '' });
      } catch (er) { row.innerHTML = `<span class="err" style="margin:0">${esc(f.name)}: ${esc(er.message)}</span>`; if (er.code === 'SESION_EXPIRADA') return manejar(er); }
    }
    if (!nuevosP.length && !nuevosM.length) return;
    insertar(nuevosP, nuevosM); toast('Archivos agregados a la clase. Recuerda pulsar «Guardar».', 5000);
  }
  function copiarCab() { const q = k => $(`#main > .card [data-k="${k}"]`).value; e.numero = +q('numero'); e.titulo = q('titulo'); e.descripcion = q('descripcion'); e.pauta_ia = q('pauta_ia'); e.fecha = $('#fe') ? $('#fe').value : (e.fecha || ''); e.estado = $('#est').value; e.bloqueo = $('#bl').value; e.apertura = $('#ap').value ? new Date($('#ap').value).getTime() : 0; e.cierre = $('#ci').value ? new Date($('#ci').value).getTime() : 0; }
  $('#pasos').onchange = ev => { if (ev.target.dataset.k === 'tipo') { const i = +ev.target.closest('.paso-ed').dataset.i; const ps = leerPasos(); ps[i] = { id: ps[i].id, tipo: ps[i].tipo, titulo: ps[i].titulo, texto: ps[i].texto, pregunta: ps[i].pregunta, puntos: ps[i].puntos || 1, opciones: ['', '', '', ''], correcta: ps[i].tipo === 'vf' ? 'V' : 0, campos: ['Tu respuesta'] }; e.pasos = ps; e.material = leerMat(); copiarCab(); editor(); } };
  $('#pasos').onclick = ev => { const a = ev.target.dataset.a; if (!a || ['img', 'noimg', 'gal', 'fx', 'vid', 'ok', 'addopt', 'rmopt'].includes(a)) return; const i = +ev.target.closest('.paso-ed').dataset.i; const ps = leerPasos(); if (a === 'rm') ps.splice(i, 1); if (a === 'up' && i > 0) [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]]; if (a === 'dn' && i < ps.length - 1) [ps[i + 1], ps[i]] = [ps[i], ps[i + 1]]; e.pasos = ps; e.material = leerMat(); copiarCab(); editor(); };
  $('#pasos').addEventListener('click', ev => {
    const a = ev.target.dataset.a; if (!['ok', 'addopt', 'rmopt'].includes(a)) return;
    const card = ev.target.closest('.paso-ed'); const tipo = $('[data-k="tipo"]', card).value; const box = $('.q-tiles', card);
    const renum = () => $$('.tile', box).forEach((t, i) => { if (tipo === 'vf') return; t.className = `tile edt t${i % 4}${t.classList.contains('ok') ? ' ok' : ''}`; $('.sh', t).textContent = FORMAS[i % 4]; $('[data-opt]', t).dataset.ph = 'Alternativa ' + (i + 1); });
    if (a === 'ok') { const t = ev.target.closest('.tile'); $$('.tile', box).forEach(x => x.classList.remove('ok')); t.classList.add('ok'); }
    else if (a === 'addopt') { const n = $$('.tile', box).length; if (n >= 6) return toast('Máximo 6 alternativas.'); box.insertAdjacentHTML('beforeend', tileEd(n, '', false, tipo)); renum(); const nt = $$('.tile', box)[n]; $('[data-opt]', nt).focus(); }
    else if (a === 'rmopt') { if ($$('.tile', box).length <= 2) return toast('Debe haber al menos 2 alternativas.'); ev.target.closest('.tile').remove(); if (tipo === 'opcion' && !$('.tile.ok', box)) $('.tile', box).classList.add('ok'); renum(); }
  });  const rerender = () => { e.pasos = leerPasos(); e.material = leerMat(); copiarCab(); const sc = scrollY; editor(); scrollTo(0, sc); };
  $('#pasos').addEventListener('change', ev => { const k = ev.target.dataset.k; if (k === 'layout' || k === 'tema') rerender(); });
  if ($('#gs')) $('#gs').onclick = () => modalEstilo(null, rerender, true);
  /* --- formato de texto sobre la diapositiva --- */
  const richDe = ed => { const s = getSelection(); if (!s || !s.rangeCount) return null; let nodo = s.anchorNode; nodo = nodo && (nodo.nodeType === 3 ? nodo.parentElement : nodo); const r = nodo && nodo.closest && nodo.closest('[data-rich]'); return r && ed.contains(r) ? r : null; };
  $('#pasos').addEventListener('mousedown', ev => { if (ev.target.closest('.fmtbar')) ev.preventDefault(); });   // conserva la selección al tocar la barra
  $('#pasos').addEventListener('paste', ev => { if (!(ev.target.closest && ev.target.closest('[data-rich]'))) return; ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text/plain')); });
  $('#pasos').addEventListener('click', ev => {
    const bar = ev.target.closest('.fmtbar'); if (!bar) return; const btn = ev.target.closest('button'); if (!btn) return; const ed = bar.closest('.edslide');
    const cerrarPop = () => { const p0 = $('.fmtpop', bar); if (p0) p0.remove(); };
    const rich = richDe(ed); const ejec = (cmd, val) => { document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); rich.dispatchEvent(new Event('input', { bubbles: true })); };
    if (btn.dataset.sw) { cerrarPop(); if (!rich) return toast('Selecciona primero un texto.'); if (btn.dataset.sw === 'color') ejec('foreColor', btn.dataset.v); else { try { ejec('hiliteColor', btn.dataset.v); } catch (e) { ejec('backColor', btn.dataset.v); } } return; }
    const f = btn.dataset.f; if (!f) return;
    if (f === 'color' || f === 'hl') {
      const ya = $('.fmtpop', bar); cerrarPop(); if (ya && ya.dataset.k === f) return;
      const mapa = f === 'color' ? FMT_COLORES : FMT_RESALTES;
      bar.insertAdjacentHTML('beforeend', `<div class="fmtpop" data-k="${f}"><div class="t">${f === 'color' ? 'Color del texto' : 'Color del marcador'}</div>${Object.entries(mapa).map(([k, v]) => `<button type="button" data-sw="${f}" data-v="${v}" title="${k}" style="background:${v}"></button>`).join('')}</div>`); return;
    }
    cerrarPop();
    if (!rich) return toast('Selecciona primero un texto de la diapositiva.');
    if (f === 'bold' || f === 'italic' || f === 'underline') return ejec(f);
    if (f === 'mas') return ejec('fontSize', '5'); if (f === 'menos') return ejec('fontSize', '2'); if (f === 'normal') return ejec('fontSize', '3');
    if (f === 'ul') { if (rich.dataset.k !== 'texto') return toast('Las viñetas se usan en el texto de la diapositiva, no en el título.'); return ejec('insertUnorderedList'); }
    if (f === 'clear') { const s = getSelection(); const rg = s.getRangeAt(0); $$('span[class*="tc-"],span[class*="hl-"],span[class*="ts-"]', rich).forEach(sp => { if (rg.intersectsNode(sp)) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); } }); return ejec('removeFormat'); }
  });
  $('#pasos').addEventListener('click', ev => {
    const a = ev.target.dataset.a; if (a !== 'img' && a !== 'noimg' && a !== 'gal' && a !== 'fx' && a !== 'vid') return;
    const ed = ev.target.closest('.edslide'); const set = (src, cred) => { $('[data-k="imagen"]', ed).value = src; $('[data-k="credito"]', ed).value = cred || ''; rerender(); };
    if (a === 'gal') return galeria(ed, rerender);
    if (a === 'fx') return modalEstilo(ed, rerender, false);
    if (a === 'vid') return modalVideo(ed, rerender);
    if (a === 'noimg') return set('', '');
    const panel = $('.imgpanel', ed); const titulo = ($('[data-k="titulo"]', ed).innerText || '').trim();
    panel.innerHTML = `<div class="card" style="margin-top:8px"><div class="row"><input class="iq" placeholder="Buscar imágenes en internet… (ej: puerto de Valparaíso)" value="${esc(titulo)}" style="flex:1;min-width:180px"><button class="btn sm iqb">🔍 Buscar</button></div><div class="row" style="margin-top:6px"><input class="iu" placeholder="…o pega la dirección (URL) de una imagen" style="flex:1;min-width:180px"><button class="btn sm ghost iub">Usar URL</button><button class="btn sm ghost iup">⬆ Subir</button><input type="file" class="iuf" accept="image/*" hidden></div><div class="imgres"></div><div class="hint">Resultados de Wikimedia Commons y Openverse (licencias libres). El crédito del autor queda en la diapositiva.</div></div>`;
    const res = $('.imgres', panel);
    const buscar = async () => { const q = $('.iq', panel).value.trim(); if (!q) return; res.innerHTML = '<span class="spin"></span>'; const r = await buscarImagenes(q); res.innerHTML = r.length ? r.map((x, i) => `<button data-i="${i}" title="${esc(x.credito)}"><img src="${esc(x.thumb)}" loading="lazy" alt="" onerror="this.parentNode.remove()"></button>`).join('') : '<p class="mut small">Sin resultados. Prueba otras palabras (en inglés suele dar más).</p>'; res.onclick = ev2 => { const b = ev2.target.closest('button'); if (b) set(r[+b.dataset.i].src, r[+b.dataset.i].credito); }; };
    $('.iqb', panel).onclick = buscar; $('.iq', panel).onkeydown = ev2 => { if (ev2.key === 'Enter') buscar(); }; buscar();
    $('.iub', panel).onclick = () => { const u = $('.iu', panel).value.trim(); if (!/^https:\/\//i.test(u)) return toast('Pega una dirección que empiece con https://'); set(u, ''); };
    $('.iup', panel).onclick = () => $('.iuf', panel).click();
    $('.iuf', panel).onchange = async ev2 => { const f = ev2.target.files[0]; if (!f) return; res.innerHTML = '<span class="spin"></span> Subiendo…'; try { const r = await subirArchivo(f, () => { }); set(urlDrive(r, 1600), ''); } catch (er) { res.innerHTML = `<div class="err">${esc(er.message)}</div>`; } };
  });
  $('#mats').onclick = ev => { if (ev.target.dataset.rm !== undefined) { const m = leerMat(); m.splice(+ev.target.dataset.rm, 1); e.pasos = leerPasos(); e.material = m; copiarCab(); editor(); } };
  $('#sv').onclick = async () => {
    copiarCab(); e.pasos = leerPasos(); e.material = leerMat();
    const b = $('#sv'); b.disabled = true;
    try { const { id } = await API.call('docGuardarSesion', { sesion: e }); T.sesiones = (await API.call('docSesiones')).sesiones; T.sel = T.sel || id; T.edit = null; toast('Sesión guardada ✅'); vSes(); } catch (er) { manejar(er); b.disabled = false; }
  };
}
const ICONO = { diapositiva: '🖼', documento: '📎', opcion: '🔺', vf: '✔', numerica: '🔢', encuesta: '📊', nube: '☁', escala: '⭐', abierta: '✍' };
function nuevoPaso(t) {
  const id = 'n' + Math.random().toString(36).slice(2, 7);
  return ({
    diapositiva: { id, tipo: t, titulo: '', texto: '', layout: 'solo', tema: 'azul' }, video: { id, tipo: 'diapositiva', titulo: '', texto: '', layout: 'video', tema: 'oscuro', video: '', vaudio: 'proy', vauto: '1', vctrl: 'si' }, documento: { id, tipo: t, titulo: '', url: '' },
    opcion: { id, tipo: t, pregunta: '', opciones: ['', '', '', ''], correcta: 0, puntos: 1 }, vf: { id, tipo: t, pregunta: '', correcta: 'V', puntos: 1 },
    numerica: { id, tipo: t, pregunta: '', correcta: 0, tolerancia: 0.01, puntos: 2 }, encuesta: { id, tipo: t, pregunta: '', opciones: ['', '', ''], puntos: 1 },
    nube: { id, tipo: t, pregunta: '', puntos: 1 }, escala: { id, tipo: t, pregunta: '', puntos: 1 }, abierta: { id, tipo: t, pregunta: '', campos: ['Tu respuesta'], puntos: 3 }
  })[t];
}
/** Divide un PDF en páginas sueltas (un archivo por página) para usarlas como diapositivas y poder intercalar actividades. */
async function dividirPDF(file, box) {
  await cargarLib('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
  const src = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true }); const n = src.getPageCount();
  if (n > 80) throw new Error('El PDF tiene más de 80 páginas. Divídelo en partes.');
  const base = file.name.replace(/\.[^.]+$/, ''); const out = [];
  const row = document.createElement('div'); row.className = 'upl'; row.innerHTML = `<span>${esc(file.name)} → ${n} diapositivas</span><div class="bar"><i style="width:0"></i></div><b>0/${n}</b>`; box.appendChild(row);
  for (let i = 0; i < n; i++) {
    const d = await PDFLib.PDFDocument.create(); const [pg] = await d.copyPages(src, [i]); d.addPage(pg);
    const f = new File([await d.save()], `${base} - ${i + 1}.pdf`, { type: 'application/pdf' });
    const r = await subirArchivo(f, () => { });
    out.push({ id: 'd' + Date.now().toString(36) + i, tipo: 'documento', titulo: `${base} · ${i + 1}`, driveId: r.id, mime: r.mime });
    $('i', row).style.width = (i + 1) / n * 100 + '%'; $('b', row).textContent = `${i + 1}/${n}`;
  }
  return out;
}
/* ---------- Generador de actividades con IA (a partir del tema, la sesión o un documento) ---------- */
function cargarLib(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar la librería para leer el archivo. Revisa tu internet.')); document.head.appendChild(s); }); }
async function extraerTexto(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.csv')) return await file.text();
  if (n.endsWith('.pdf')) {
    await cargarLib('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; let t = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 60) && t.length < 16000; i++) { const c = await (await pdf.getPage(i)).getTextContent(); t += c.items.map(x => x.str).join(' ') + '\n'; }
    return t;
  }
  if (n.endsWith('.docx') || n.endsWith('.pptx')) {
    await cargarLib('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); const z = await JSZip.loadAsync(file); let t = '';
    const txt = async (name, tag) => { const doc = new DOMParser().parseFromString(await z.file(name).async('string'), 'application/xml'); return [...doc.getElementsByTagName(tag)].map(p => p.textContent).filter(Boolean).join('\n'); };
    if (n.endsWith('.docx')) t = await txt('word/document.xml', 'w:p');
    else { const sl = Object.keys(z.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0])); for (const k of sl) t += await txt(k, 'a:p') + '\n\n'; }
    return t;
  }
  throw new Error('Formato no compatible para leer texto. Usa PDF, Word (.docx), PowerPoint (.pptx) o TXT. (Los .doc/.ppt antiguos: guárdalos como .docx/.pptx.)');
}
/* ---- Generación fiel al documento: fuente y verificación visibles ---- */
const marcado = p => (p.verificada === false || (p.cifras && p.cifras.length)) ? '' : 'checked';
function insignia(p) {
  if (p.verificada === undefined) return '';
  let h = p.verificada ? '<span class="chip ok" title="La cita aparece en tu documento">✅ Respaldada por el documento</span>' : '<span class="chip warn" title="No se encontró esa cita en tu documento">⚠️ No se encontró en el documento — revisa</span>';
  if (p.cifras && p.cifras.length) h += ` <span class="chip bad">🔢 Cifras que no están en el documento: ${esc(p.cifras.join(', '))}</span>`;
  if (p.fuente) h += `<div class="small mut" style="margin-top:4px">📄 «${esc(p.fuente)}»</div>`;
  return h;
}
function avisoGen(d) {
  let h = d.modo === 'fiel' ? '<div class="fb ok small" style="margin-top:10px">📄 <b>Modo fiel al documento:</b> el contenido sale solo de tu documento o texto. Cada elemento muestra su fuente; los que no se pudieron respaldar quedan <b>sin marcar</b> para que los revises.</div>'
    : '<div class="fb neu small" style="margin-top:10px">ℹ️ <b>Sin documento:</b> la IA usa conocimiento general. Revisa cifras, fechas y definiciones antes de usarlo. Sube un documento o pega tu texto para que se ciña a tu material.</div>';
  if (d.truncado) h += '<div class="fb bad small" style="margin-top:8px">⚠️ Tu documento es muy largo: se usaron solo los primeros 16.000 caracteres. Divídelo por temas para cubrirlo completo.</div>';
  return h;
}
const limpiarGen = p => { const q = { ...p }; delete q.fuente; delete q.verificada; delete q.cifras; delete q.imagen_q; return q; };function montarIA(e, agregar) {
  const box = $('#iaq'); if (!box) return;
  const T_ = [['opcion', 'Opción múltiple'], ['vf', 'Verdadero/Falso'], ['numerica', 'Numérica'], ['encuesta', 'Encuesta'], ['nube', 'Nube de palabras'], ['escala', 'Escala 1-5'], ['abierta', 'Abierta']];
  box.innerHTML = `<div class="card"><h3>🤖 Crear actividades con IA <span class="chip gold">estilo Kahoot / Menti</span></h3><p class="small mut">La IA propone preguntas acordes a esta sesión (título, descripción y diapositivas) y, si quieres, a un documento que subas. Tú revisas y eliges cuáles agregar.</p>
  <label>Tema o instrucciones (opcional)</label><input id="iat" placeholder="Ej: ventaja comparativa y costo de oportunidad">
  <div class="grid2"><div><label>Cantidad</label><input id="ian" type="number" min="1" max="12" value="6"></div><div><label>Dificultad</label><select id="iad"><option>fácil</option><option selected>media</option><option>difícil</option></select></div></div>
  <label>Tipos de actividad</label><div class="row">${T_.map(([k, l]) => `<label class="row" style="margin:0;font-weight:500"><input type="checkbox" class="iatp" value="${k}" ${['opcion', 'vf', 'numerica', 'nube'].includes(k) ? 'checked' : ''} style="width:20px;min-height:0;height:20px"> ${l}</label>`).join('')}</div>
  <label>Documento (PDF, Word, PowerPoint o TXT) — opcional</label><input type="file" id="iaf" accept=".pdf,.docx,.pptx,.txt,.md"><div class="hint" id="iafs"></div>
  <label>…o pega texto aquí (opcional)</label><textarea id="iax" style="min-height:70px"></textarea>
  <button class="btn block" id="iag" style="margin-top:12px">✨ Generar preguntas</button><div id="iar"></div></div>`;
  let textoDoc = '';
  montarClaseIA(e, agregar, () => ({ tema: $('#iat').value || e.titulo, texto: ($('#iax').value + '\n' + textoDoc).trim(), tipos: $$('.iatp').filter(x => x.checked).map(x => x.value), nivel: $('#iad').value }));
  $('#iaf').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return; $('#iafs').textContent = 'Leyendo documento…';
    try { textoDoc = await extraerTexto(f); $('#iafs').textContent = textoDoc.trim() ? `✅ Texto leído (${textoDoc.length.toLocaleString('es-CL')} caracteres; se usan los primeros ~12.000).` : '⚠️ No se encontró texto (¿es un PDF escaneado/imagen?).'; }
    catch (er) { textoDoc = ''; $('#iafs').textContent = '❌ ' + er.message; }
  };
  $('#iag').onclick = async () => {
    const b = $('#iag'); b.disabled = true; b.textContent = 'Generando…'; $('#iar').innerHTML = '';
    try {
      const tipos = $$('.iatp').filter(x => x.checked).map(x => x.value);
      const d = await API.call('docGenerarIA', { sesion: e.id || '', tema: $('#iat').value || e.titulo, cantidad: +$('#ian').value, nivel: $('#iad').value, tipos, texto: ($('#iax').value + '\n' + textoDoc).trim() });
      const lbl = { opcion: 'Opción múltiple', vf: 'V/F', numerica: 'Numérica', encuesta: 'Encuesta', nube: 'Nube', escala: 'Escala', abierta: 'Abierta' };
      $('#iar').innerHTML = `<h3 style="margin-top:14px">Propuestas (${d.preguntas.length})</h3>${avisoGen(d)}` + d.preguntas.map((q, i) => `<label class="paso-ed" style="display:block;cursor:pointer"><input type="checkbox" class="iasel" data-i="${i}" ${marcado(q)} style="width:20px;min-height:0;height:20px;display:inline-block;vertical-align:middle"> <span class="chip navy">${lbl[q.tipo]}</span> <b>${esc(q.pregunta)}</b> ${insignia(q)}${q.opciones ? '<ol type="A" class="small" style="margin:6px 0 0 18px">' + q.opciones.map((o, j) => `<li ${q.tipo === 'opcion' && j === q.correcta ? 'style="color:var(--ok);font-weight:700"' : ''}>${esc(o)}</li>`).join('') + '</ol>' : ''}${q.tipo === 'vf' ? `<div class="small">Correcta: ${q.correcta === 'V' ? 'Verdadero' : 'Falso'}</div>` : ''}${q.tipo === 'numerica' ? `<div class="small">Correcta: ${esc(q.correcta)}</div>` : ''}${q.explicacion ? `<div class="small mut">💡 ${esc(q.explicacion)}</div>` : ''}${q.modelo ? `<div class="small mut">Pauta: ${esc(q.modelo)}</div>` : ''}</label>`).join('') + '<button class="btn gold block" id="iaadd">➕ Agregar las seleccionadas a la sesión</button>';
      $('#iaadd').onclick = () => { const sel = $$('.iasel').filter(x => x.checked).map(x => d.preguntas[+x.dataset.i]); if (!sel.length) return toast('Selecciona al menos una.'); agregar(sel.map(limpiarGen)); };
    } catch (er) { $('#iar').innerHTML = `<div class="err">${esc(er.message)}</div>`; if (er.code === 'SESION_EXPIRADA') manejar(er); }
    b.disabled = false; b.textContent = '✨ Generar preguntas';
  };
}
/** Genera una clase completa: diapositivas atractivas con imágenes sugeridas + actividades intercaladas */
function montarClaseIA(e, agregar, getCtx) {
  const box = $('#iaq'); if (!box) return;
  box.insertAdjacentHTML('beforeend', `<div class="card"><h3>🎨 Generar una clase completa</h3><p class="small mut">Crea una presentación atractiva (portada, viñetas, ideas destacadas e imágenes acordes) con actividades intercaladas, usando el tema, la sesión y el documento de arriba. Después puedes editar todo directamente sobre las diapositivas.</p>
  <div class="grid2"><div><label>Diapositivas</label><input id="ids" type="number" min="3" max="14" value="8"><div class="hint">Documento largo: usa 12 a 14 para cubrirlo completo.</div></div><div><label class="row" style="margin:20px 0 0;font-weight:500"><input type="checkbox" id="ida" checked style="width:20px;min-height:0;height:20px"> Intercalar actividades</label><label class="row" style="margin:6px 0 0;font-weight:500"><input type="checkbox" id="idi" checked style="width:20px;min-height:0;height:20px"> Buscar imágenes automáticamente</label></div></div>
  <details style="margin-top:10px"><summary><b>🎛 Diseño de las diapositivas (opcional)</b> <span class="small mut">si eliges uno, se respeta en todas</span></summary><div class="grid2">
  <div><label>Color</label><select id="id_tema"><option value="">Automático (la IA elige)</option>${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
  <div><label>Diseño</label><select id="id_lay"><option value="">Variado (la IA alterna)</option>${Object.entries(LAYOUTS).filter(([k]) => k !== 'video').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
  <div><label>Efecto 3D</label><select id="id_fx"><option value="">Automático</option><option value="none">Ninguno</option>${Object.entries(FXS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
  <div><label>Movimiento de imágenes</label><select id="id_mov"><option value="">Automático (según cada imagen)</option><option value="none">Ninguno</option>${Object.entries(MOVS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div></details>
  <button class="btn gold block" id="idg" style="margin-top:12px">🎨 Generar clase</button><div id="idr"></div></div>`);
  $('#idg').onclick = async () => {
    const b = $('#idg'), out = $('#idr'); b.disabled = true; b.textContent = 'Diseñando la clase…'; out.innerHTML = '';
    try {
      const c = getCtx(); const d = await API.call('docGenerarClaseIA', { sesion: e.id || '', tema: c.tema, texto: c.texto, tipos: c.tipos, nivel: c.nivel, diapos: +$('#ids').value, actividades: $('#ida').checked });
      const pasos = d.pasos;
      if ($('#idi').checked) {
        const con = pasos.filter(p => p.imagen_q); let i = 0, hechas = 0; out.innerHTML = `<p><span class="spin"></span> Buscando imágenes… 0/${con.length}</p>`;
        const worker = async () => { while (i < con.length) { const p = con[i++]; try { const r = await buscarImagenes(p.imagen_q); if (r[0]) { p.imagen = r[0].src; p.credito = r[0].credito; } } catch (er) { } hechas++; out.innerHTML = `<p><span class="spin"></span> Buscando imágenes… ${hechas}/${con.length}</p>`; } };
        await Promise.all([worker(), worker(), worker()]);
        const conImg = pasos.filter(p => p.tipo === 'diapositiva' && p.imagen); let j = 0, listas = 0; out.innerHTML = `<p><span class="spin"></span> Eligiendo el movimiento acorde a cada imagen… 0/${conImg.length}</p>`;
        const tarea2 = async () => { while (j < conImg.length) { const p = conImg[j++]; let r; try { r = await API.call('docAnalizarImagen', { url: p.imagen, titulo: p.titulo, texto: p.texto }); } catch (er) { r = sugerirPorTexto((p.imagen_q || '') + ' ' + p.titulo + ' ' + p.texto); } const pr = r.propuestas[0]; p.mov = pr.mov; p.movvel = pr.velocidad; p.movx = r.foco.x; p.movy = r.foco.y; listas++; out.innerHTML = `<p><span class="spin"></span> Eligiendo el movimiento acorde a cada imagen… ${listas}/${conImg.length}</p>`; } };
        if (!$('#id_mov').value) await Promise.all([tarea2(), tarea2(), tarea2()]);   // si elegiste un movimiento, se respeta y no se analiza
      }
      let kfx = 0; const dg = { tema: $('#id_tema').value, lay: $('#id_lay').value, fx: $('#id_fx').value, mov: $('#id_mov').value }; pasos.forEach(p => { delete p.imagen_q; if (p.tipo !== 'diapositiva') return; if (dg.tema) p.tema = dg.tema; if (dg.lay) p.layout = dg.lay; if (dg.mov) { p.mov = dg.mov === 'none' ? '' : dg.mov; delete p.movx; delete p.movy; } if (dg.fx) { p.fx = dg.fx === 'none' ? '' : dg.fx; return; } if (!dg.lay) { if (!p.imagen && ['imagen-derecha', 'imagen-izquierda', 'fondo'].includes(p.layout)) p.layout = 'solo'; if (p.imagen && p.layout === 'solo') p.layout = 'imagen-derecha'; } if (p.imagen && ['imagen-derecha', 'imagen-izquierda', 'dividido'].includes(p.layout)) { p.forma = 'tarjeta'; p.fx = ['inclinado', '', 'polaroid', 'flotante'][kfx++ % 4]; } else if (p.imagen && ['fondo', 'portada'].includes(p.layout) && !p.mov) p.fx = 'zoom'; });
      out.innerHTML = `<h3 style="margin-top:14px">Vista previa (${pasos.length} pasos)</h3>${avisoGen(d)}` + pasos.map((p, i) => `<label class="paso-ed" style="display:block;cursor:pointer"><input type="checkbox" class="idsel" data-i="${i}" ${marcado(p)} style="width:20px;min-height:0;height:20px;vertical-align:middle"> <span class="chip ${p.tipo === 'diapositiva' ? 'navy' : 'warn'}">${ICONO[p.tipo] || ''} ${i + 1} · ${p.tipo === 'diapositiva' ? 'Diapositiva' : TIPOS[p.tipo] || p.tipo}</span> ${insignia(p)}${p.tipo === 'diapositiva' ? `<div class="mini" style="max-width:380px;margin-top:8px">${slideStage(p, false)}</div>` : `<div class="small" style="margin-top:6px"><b>${esc(p.pregunta)}</b></div>`}</label>`).join('') + '<button class="btn gold block" id="idadd">➕ Agregar la clase seleccionada</button>';
      $('#idadd').onclick = () => { const sel = $$('.idsel').filter(x => x.checked).map(x => pasos[+x.dataset.i]); if (!sel.length) return toast('Selecciona al menos un paso.'); agregar(sel.map(limpiarGen)); };
    } catch (er) { out.innerHTML = `<div class="err">${esc(er.message)}</div>`; if (er.code === 'SESION_EXPIRADA') manejar(er); }
    b.disabled = false; b.textContent = '🎨 Generar clase';
  };
}
function matForm(m, i) { return `<div class="paso-ed mat" data-did="${esc(m.driveId || '')}" data-mime="${esc(m.mime || '')}">${m.driveId ? '<span class="chip ok">📎 Archivo subido a tu Drive</span>' : ''}<div class="row"><select class="mt" style="max-width:160px">${['video', 'documento', 'enlace'].map(t => `<option ${m.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><input class="mti" placeholder="Título" value="${esc(m.titulo)}" style="flex:1;min-width:160px"><button class="btn sm ghost" data-rm="${i}">✕</button></div><input class="mu" placeholder="URL (YouTube, Drive, PDF en el repositorio…)" value="${esc(m.url)}" style="margin-top:8px"><input class="md" placeholder="Descripción (opcional)" value="${esc(m.descripcion || '')}" style="margin-top:8px"></div>`; }

/* ---------- INFORMES ---------- */
async function vInf() {
  $('#main').innerHTML = '<div class="c"><span class="spin"></span></div>';
  try { T.resultados = await API.call('docResultados', { curso: T.cursoF || '' }); } catch (e) { return manejar(e); }
  const R = T.resultados;
  $('#main').innerHTML = `<div class="card"><div class="row"><select id="cf" style="max-width:200px"><option value="">Todos los cursos</option>${R.cursos.map(c => `<option ${c === T.cursoF ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="sp"></span><button class="btn gold" id="pc" ${T.cursoF ? '' : 'disabled'}>📄 PDF de todo el curso</button><button class="btn" id="pm">✉ Enviar informe por correo (${T.cursoF || 'todos'})</button></div><div class="hint">Selecciona un curso para generar el PDF conjunto (una hoja por estudiante). Los PDF se guardan también en tu Drive («Informes Economía U4»).</div></div>
  <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>Curso</th><th>Logro</th><th>Nota</th><th>Observación del docente (aparece en el informe)</th><th></th></tr>
  ${R.alumnos.map(a => `<tr data-rut="${esc(a.rut)}"><td><b>${esc(a.nombre)}</b><div class="small mut">${esc(a.rut)}</div></td><td>${esc(a.curso)}</td><td>${a.progreso.pct_logro}%</td><td>${a.progreso.nota === null ? '—' : String(a.progreso.nota).replace('.', ',')}</td><td><textarea class="ob" style="min-height:56px">${esc(a.observacion)}</textarea></td><td><button class="btn sm gold pdf">PDF</button></td></tr>`).join('')}</table></div>`;
  $('#cf').onchange = e => { T.cursoF = e.target.value; vInf(); };
  const gen = async (b, datos) => { const t = b.textContent; b.disabled = true; b.textContent = '…'; try { const d = await API.call('docInforme', datos); descargarBase64(d.nombre, d.base64); toast('Informe generado ✅'); } catch (e) { manejar(e); } b.disabled = false; b.textContent = t; };
  $('#pc').onclick = e => gen(e.target, { curso: T.cursoF });
  $('#pm').onclick = () => modalEnvio({
    titulo: '✉ Enviar informe por correo', cuerpo: `<p class="small mut">Se envía el informe PDF formal a cada estudiante de «${esc(T.cursoF || 'todos los cursos')}» que tenga correo registrado.</p>`,
    onSend: async prueba => { const r = await lotes('docEnviarInformes', { curso: T.cursoF || '', prueba, maximo: 12 }); return prueba ? `🧪 Prueba enviada a <b>${esc(r.ult.para)}</b> con el informe de «${esc(r.ult.ejemplo)}» como ejemplo. Revisa tu bandeja y spam.` : `✅ Informes enviados: ${r.ok}${r.fallos ? ` · fallos: ${r.fallos}` : ''}`; }
  });
  $$('.pdf').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); try { await API.call('docGuardarObs', { rut: tr.dataset.rut, observacion: $('.ob', tr).value }); } catch (e) { return manejar(e); } gen(b, { ruts: [tr.dataset.rut] }); });
  $$('.ob').forEach(t => t.onchange = () => API.call('docGuardarObs', { rut: t.closest('tr').dataset.rut, observacion: t.value }).then(() => toast('Observación guardada')).catch(manejar));
}

/* ---------- AJUSTES ---------- */
function vCfg() {
  const c = T.cfg;
  const f = (k, l, h = '') => `<label>${l}</label><input data-c="${k}" value="${esc(c[k])}">${h ? `<div class="hint">${h}</div>` : ''}`;
  $('#main').innerHTML = `<div class="card"><h3>Ajustes generales</h3>${f('colegio', 'Establecimiento')}${f('asignatura', 'Asignatura')}${f('nombre_unidad', 'Nombre de la unidad')}${f('docente', 'Nombre del docente (aparece en informes)')}${f('total_sesiones', 'Total de sesiones planificadas', 'Se usa para calcular el progreso. Puedes cambiarlo cuando quieras (14 por defecto).')}${f('cursos', 'Cursos (separados por coma)', 'Aparecen como opciones al inscribirse.')}${f('exigencia', '% de exigencia para la nota 4,0')}${f('logo_url', 'URL del logo para los informes (opcional)')}
  <label>¿Los estudiantes pueden descargar su informe?</label><select data-c="informe_visible"><option value="NO" ${c.informe_visible !== 'SI' ? 'selected' : ''}>No (solo yo)</option><option value="SI" ${c.informe_visible === 'SI' ? 'selected' : ''}>Sí</option></select>
  <label>Enviar copia por correo al estudiante cuando termina de participar</label><select data-c="correo_auto"><option value="SI" ${c.correo_auto !== 'NO' ? 'selected' : ''}>Sí, automáticamente</option><option value="NO" ${c.correo_auto === 'NO' ? 'selected' : ''}>No (solo cuando yo la envíe)</option></select><div class="hint">Los correos salen desde tu cuenta de Google. Cuenta personal: ~100 por día; Google Workspace: ~1.500.</div>
  ${f('correo_docente', 'Correo del docente (para pruebas)', 'Aquí llegan los correos de prueba. Escríbelo una vez. Los correos reales a estudiantes salen desde tu cuenta de Google.')}${f('url_app', 'Dirección (URL) de la plataforma para los estudiantes', 'Es el enlace que llevan los correos. Ej: https://leandrobascunan-code.github.io/econom-a/')}${f('modelo_ia', 'Modelo de IA (Groq) — déjalo vacío para elegir uno disponible automáticamente', 'Estado de la clave de IA: ' + (c.tiene_ia ? '✅ configurada' : '❌ falta GROQ_API_KEY en las propiedades del script'))}
  <button class="btn block" id="gc" style="margin-top:14px">Guardar ajustes</button></div>
  <div class="card"><h3>Datos</h3><p class="small mut">Toda la información (estudiantes, asistencia, respuestas y eventos de salida/reingreso) queda en tu planilla de Google.</p><a class="btn ghost" target="_blank" rel="noopener" href="${esc(T.planilla || '#')}">Abrir planilla de datos</a></div>`;
  $('#gc').onclick = async () => { const o = {}; $$('[data-c]').forEach(e => o[e.dataset.c] = e.value); try { await API.call('docGuardarConfig', { config: o }); T.cfg = { ...T.cfg, ...o }; toast('Ajustes guardados ✅'); } catch (e) { manejar(e); } };
}

const t0 = store.get('dtok'); if (t0) { API.token = t0; arrancar(); } else login();
