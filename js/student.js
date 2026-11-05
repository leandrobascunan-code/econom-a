/* Aplicación del estudiante */
const App = $('#app');
const S = { cfg: null, perfil: null, sesiones: [], progreso: null, ses: null, idx: 0, hb: null, poll: null, enPart: false, bloqueado: false, ritmoDoc: false, pasoDoc: 0 };
const params = new URLSearchParams(location.search);
const sesionQR = params.get('s');

function hero(titulo, sub, extra = '') {
  return `<div class="hero"><div class="in"><div class="brand"><span class="dot">$</span>${esc(S.cfg?.asignatura || 'Economía y Sociedad')} · ${esc(S.cfg?.nombre_unidad || 'Unidad 4')}</div><h1>${titulo}</h1><p>${sub}</p>${extra}</div></div>`;
}
function cargando(t = 'Cargando…') { App.innerHTML = `<div class="c" style="padding:90px 20px"><span class="spin"></span><p class="mut">${t}</p></div>`; }

async function iniciar() {
  try { S.cfg = await API.call('config'); } catch (e) { App.innerHTML = `<div class="wrap"><div class="card err" style="margin-top:40px">${esc(e.message)}</div></div>`; return; }
  document.title = `${S.cfg.asignatura} · ${S.cfg.nombre_unidad}`;
  const t = store.get('tok'), p = store.get('perfil');
  if (t && p) { API.token = t; S.perfil = JSON.parse(p); return inicio(); }
  vistaAuth();
}

/* ---------- Inscripción / ingreso ---------- */
function vistaAuth() {
  App.innerHTML = `${hero('¡Bienvenido/a!', 'Participa en clases desde tu celular.')}
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
  App.innerHTML = `${hero('Hola, ' + esc(S.perfil.nombre.split(' ')[0]) + ' 👋', esc(S.perfil.curso) + ' · ' + esc(S.perfil.rut), ring)}
  <div class="wrap pull">
    <div class="row noprint" style="margin-bottom:10px;justify-content:flex-end"><button class="btn sm ghost" id="inf">📄 Mi informe</button><button class="btn sm ghost" id="out">Salir</button></div>
    <h2 style="margin-top:6px">Sesiones</h2>
    ${S.sesiones.length ? S.sesiones.map(tarjetaSesion).join('') : '<div class="card c mut">Aún no hay sesiones publicadas.</div>'}
  </div>`;
  $$('.ses').forEach(b => b.onclick = () => verSesion(b.dataset.id));
  $('#out').onclick = cerrarSesion;
  $('#inf').onclick = async ev => { ev.target.disabled = true; try { const d = await API.call('miInforme'); descargarBase64(d.nombre, d.base64); } catch (e) { toast(e.message, 4500); } ev.target.disabled = false; };
  if (sesionQR && S.sesiones.some(s => s.id === sesionQR)) { const q = sesionQR; history.replaceState(null, '', location.pathname); verSesion(q); }
}
function chipEstado(e) { return { abierta: '<span class="chip ok">Abierta</span>', cerrada: '<span class="chip bad">Plazo cerrado</span>', proximamente: '<span class="chip warn">Próximamente</span>' }[e] || ''; }
function tarjetaSesion(s) {
  return `<button class="card ses ${s.estado} row" data-id="${esc(s.id)}" style="gap:14px"><div class="n">${s.numero}</div><div class="sp"><div class="row" style="gap:8px"><b>${esc(s.titulo)}</b></div>
  <div class="small mut">${s.estado === 'abierta' ? 'Cierra: ' + fmtFecha(s.cierre) : s.estado === 'cerrada' ? 'Cerró: ' + fmtFecha(s.cierre) : 'Abre: ' + fmtFecha(s.apertura)}</div>
  <div class="bar" style="margin:8px 0 4px"><i style="width:${s.actividades ? Math.round(s.respondidas / s.actividades * 100) : 0}%"></i></div>
  <div class="small mut">${s.respondidas}/${s.actividades} actividades${s.pendientes ? ' · ' + s.pendientes + ' en revisión' : ''}${s.nota !== null ? ' · Nota ' + String(s.nota).replace('.', ',') : ''}</div></div>${chipEstado(s.estado)}</button>`;
}

/* ---------- Sesión: material + participar ---------- */
async function verSesion(id) {
  cargando('Abriendo la sesión…');
  try { S.ses = await API.call('sesion', { sesion: id }); } catch (e) { if (!manejar(e)) { toast(e.message); inicio(); } return; }
  pintarSesion('part');
}
function pintarSesion(tab) {
  const s = S.ses; const r = s.respuestas || {}; const acts = s.pasos.filter(p => p.tipo !== 'diapositiva');
  const hechas = acts.filter(p => r[p.id]).length;
  let cuerpo = '';
  if (tab === 'mat') {
    cuerpo = s.material.length ? s.material.map(m => {
      const emb = m.tipo === 'video' ? ytEmbed(m.url) : '';
      return `<div class="card"><div class="row"><span style="font-size:1.4rem">${m.tipo === 'video' ? '🎬' : m.tipo === 'enlace' ? '🔗' : '📄'}</span><b>${esc(m.titulo)}</b></div>
      ${m.descripcion ? `<p class="small mut">${esc(m.descripcion)}</p>` : ''}
      ${emb ? `<div class="video"><iframe src="${emb}" allowfullscreen loading="lazy"></iframe></div>` : ''}
      ${m.url ? `<a class="btn sm ghost" style="margin-top:10px" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir ${m.tipo === 'video' ? 'en YouTube' : 'material'}</a>` : '<div class="small mut">El docente aún no publica este enlace.</div>'}</div>`;
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
        <button class="btn block" id="ent">${hechas ? 'Continuar participando' : 'Entrar a participar'} →</button>`
        : `<div class="info">${s.estado === 'cerrada' ? 'El plazo terminó: ya no puedes responder actividades, pero puedes revisar el material y tus resultados.' : 'Esta sesión aún no se abre.'}</div>`}`;
  }
  App.innerHTML = `<div class="hero"><div class="in"><button class="btn sm ghost" id="back" style="color:#fff;border-color:rgba(255,255,255,.4)">← Volver</button><h1>Sesión ${s.numero}</h1><p>${esc(s.titulo)}</p></div></div>
  <div class="wrap pull"><div class="tabs"><button class="tab ${tab === 'part' ? 'on' : ''}" data-t="part">Participar</button><button class="tab ${tab === 'mat' ? 'on' : ''}" data-t="mat">Material y videos</button><button class="tab ${tab === 'res' ? 'on' : ''}" data-t="res">Mis resultados</button></div>${cuerpo}</div>`;
  $('#back').onclick = inicio; $$('.tab').forEach(b => b.onclick = () => pintarSesion(b.dataset.t));
  if ($('#ent')) $('#ent').onclick = () => entrarPart();
  if ($('#mail')) $('#mail').onclick = async ev => { ev.target.disabled = true; try { const d = await API.call('enviarCopia', { sesion: s.id }); toast(d.estado === 'enviado' ? '📧 Copia enviada a tu correo institucional.' : 'Ya te enviamos una copia hace unos minutos.', 4500); } catch (e) { toast(e.message, 5000); } ev.target.disabled = false; };
}

/* ---------- Modo participación ---------- */
async function entrarPart() {
  const s = S.ses; const b = $('#ent'); b.disabled = true;
  try {
    const d = await API.call('entrar', { sesion: s.id });
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) { }
    S.enPart = true; S.bloqueado = d.estado === 'bloqueado'; S.ritmoDoc = d.ritmo === 'docente'; S.pasoDoc = d.paso_actual;
    const primero = s.pasos.findIndex(p => p.tipo !== 'diapositiva' && !s.respuestas[p.id]);
    S.idx = S.ritmoDoc ? Math.min(d.paso_actual, s.pasos.length - 1) : Math.max(0, Math.min(S.idx, s.pasos.length - 1));
    if (!S.ritmoDoc && S.idx === 0 && primero > 0 && Object.keys(s.respuestas).length) S.idx = primero;
    document.addEventListener('visibilitychange', alVisibilidad); window.addEventListener('pagehide', alSalirPagina); window.addEventListener('beforeunload', antesDeCerrar);
    S.hb = setInterval(latir, 15000);
    if (S.bloqueado) return pintarBloqueo(); pintarPaso();
  } catch (e) { if (!manejar(e)) { toast(e.message, 4500); b.disabled = false; } }
}
function detenerPart() {
  S.enPart = false; clearInterval(S.hb); clearInterval(S.poll);
  document.removeEventListener('visibilitychange', alVisibilidad); window.removeEventListener('pagehide', alSalirPagina); window.removeEventListener('beforeunload', antesDeCerrar);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
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
    const d = await API.call('latido', { sesion: S.ses.id });
    if (d.estado === 'bloqueado') { S.bloqueado = true; return pintarBloqueo(); }
    if (d.cerrada) { toast('El plazo de la sesión terminó.'); return finalizarPart(); }
    if (d.ritmo === 'docente' && (d.paso_actual !== S.pasoDoc || !S.ritmoDoc)) { const avanzo = d.paso_actual !== S.pasoDoc; S.ritmoDoc = true; S.pasoDoc = d.paso_actual; if (avanzo) { S.idx = d.paso_actual; pintarPaso(); } }
    else if (d.ritmo !== 'docente' && S.ritmoDoc) { S.ritmoDoc = false; pintarPaso(); }
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
      if (d.estado === 'activo') { clearInterval(S.poll); S.bloqueado = false; ov.remove(); toast('✅ El docente te autorizó. ¡Sigue participando!'); try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } pintarPaso(); }
    } catch (e) { manejar(e); }
  }, 4000);
}
async function finalizarPart() { detenerPart(); const o = $('.lock'); if (o) o.remove(); await verSesion(S.ses.id); }

/* ---------- Pasos ---------- */
function pintarPaso() {
  const s = S.ses; const p = s.pasos[S.idx]; const n = s.pasos.length; const lim = S.ritmoDoc ? S.pasoDoc : n - 1;
  let html = '';
  if (p.tipo === 'diapositiva') html = `<div class="card slide"><h2>${esc(p.titulo)}</h2>${md(p.texto)}${p.imagen ? `<img src="${esc(p.imagen)}" alt="" style="max-width:100%;border-radius:12px;margin-top:10px">` : ''}</div>`;
  else html = `<div class="card">${cuerpoActividad(p)}</div>`;
  const prev = document.querySelector('.part'); if (prev) prev.remove();
  const w = document.createElement('div'); w.className = 'part';
  w.innerHTML = `<div class="top"><div class="row"><span class="live"></span><b class="sp small">Sesión ${s.numero} · ${S.idx + 1}/${n}</b>${S.ritmoDoc ? '<span class="chip navy">Guiado por el docente</span>' : ''}<button class="btn sm ghost" id="sal" style="color:#fff;border-color:rgba(255,255,255,.4)">Terminar</button></div><div class="bar" style="margin-top:8px;background:rgba(255,255,255,.2)"><i style="width:${(S.idx + 1) / n * 100}%"></i></div></div>
  <div class="body">${html}${S.ritmoDoc && S.idx >= S.pasoDoc && S.idx < n - 1 ? '<p class="c mut small">⏳ Espera: tu docente avanzará a la siguiente diapositiva.</p>' : ''}</div>
  <div class="foot"><button class="btn ghost" id="ant" ${S.idx === 0 ? 'disabled' : ''}>← Anterior</button><span class="sp"></span><button class="btn" id="sig" ${S.idx >= lim ? 'disabled' : ''}>Siguiente →</button></div>`;
  document.body.appendChild(w);
  $('#ant').onclick = () => { S.idx--; pintarPaso(); }; $('#sig').onclick = () => { S.idx++; pintarPaso(); };
  $('#sal').onclick = async () => { if (confirm('¿Terminar tu participación en esta sesión? Podrás volver mientras el plazo esté abierto.')) { await API.call('salir', { sesion: s.id, motivo: 'terminó voluntariamente' }).catch(() => { }); S.bloqueado = false;
    API.call('enviarCopia', { sesion: s.id, auto: true }).then(d => { if (d.estado === 'enviado') toast('📧 Te enviamos una copia de tus actividades a tu correo institucional.', 5000); }).catch(() => { }); detenerPart(); w.remove(); const l = $('.lock'); if (l) l.remove(); verSesion(s.id); } };
  if (p.tipo !== 'diapositiva') enlazarActividad(p);
}

function cuerpoActividad(p) {
  const r = S.ses.respuestas[p.id]; const hecho = !!r; const L = 'ABCDEFGH';
  let h = `<div class="row"><span class="chip navy">${p.tipo === 'encuesta' ? 'Encuesta' : 'Actividad'}</span><span class="chip">${p.puntos} pt${p.puntos > 1 ? 's' : ''}</span></div><h3 style="margin-top:10px">${esc(p.pregunta)}</h3>`;
  const corr = p.correcta;
  if (p.tipo === 'opcion') {
    h += p.opciones.map((o, i) => { let c = 'opt'; if (hecho) { if (i === corr) c += ' good'; else if (String(i) === String(r.respuesta)) c += ' wrong'; } return `<button class="${c}" data-i="${i}" ${hecho ? 'disabled' : ''}><span class="k">${L[i]}</span><span>${esc(o)}</span></button>`; }).join('');
  } else if (p.tipo === 'vf') {
    h += ['V', 'F'].map(v => { let c = 'opt'; if (hecho) { if (v === corr) c += ' good'; else if (v === r.respuesta) c += ' wrong'; } return `<button class="${c}" data-v="${v}" ${hecho ? 'disabled' : ''}><span class="k">${v}</span><span>${v === 'V' ? 'Verdadero' : 'Falso'}</span></button>`; }).join('');
  } else if (p.tipo === 'numerica') {
    h += `<input id="num" inputmode="decimal" placeholder="Escribe un número" value="${hecho ? esc(r.respuesta) : ''}" ${hecho ? 'disabled' : ''}>${hecho ? '' : '<button class="btn block" id="env" style="margin-top:12px">Responder</button>'}`;
  } else if (p.tipo === 'encuesta') {
    h += hecho ? '<div id="res"><div class="fb ok">✅ Respuesta registrada. ¡Gracias por participar!</div></div>' : p.opciones.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${L[i]}</span><span>${esc(o)}</span></button>`).join('');
  } else {
    let vals = []; if (hecho) { try { vals = JSON.parse(r.respuesta); } catch (e) { vals = [r.respuesta]; } }
    h += (p.campos?.length ? p.campos : ['Tu respuesta']).map((c, i) => `<label for="c${i}">${esc(c)}</label><textarea id="c${i}" maxlength="1500">${esc(vals[i] || '')}</textarea>`).join('') + `<button class="btn block" id="env" style="margin-top:12px">${hecho ? 'Actualizar respuesta' : 'Enviar respuesta'}</button>`;
  }
  if (hecho) h += feedback(p, r);
  return h + '<div id="fb"></div>';
}
function feedback(p, r) {
  if (p.tipo === 'encuesta') return '';
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
      if (d.resultados) { const t = d.resultados.reduce((a, b) => a + b, 0) || 1; $('#res').innerHTML = p.opciones.map((o, i) => `<div style="margin:10px 0"><div class="row small"><span class="sp">${esc(o)}</span><b>${Math.round(d.resultados[i] / t * 100)}%</b></div><div class="bar"><i style="width:${d.resultados[i] / t * 100}%"></i></div></div>`).join(''); }
    } catch (e) {
      if (e.message === 'BLOQUEADO') { S.bloqueado = true; return pintarBloqueo(); }
      if (!manejar(e)) fb.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  };
  if (p.tipo === 'opcion' || p.tipo === 'encuesta') $$('.opt:not([disabled])').forEach(b => b.onclick = () => enviar(b.dataset.i));
  else if (p.tipo === 'vf') $$('.opt:not([disabled])').forEach(b => b.onclick = () => enviar(b.dataset.v));
  else if (p.tipo === 'numerica') { if ($('#env')) $('#env').onclick = () => enviar($('#num').value); }
  else $('#env').onclick = () => enviar((p.campos?.length ? p.campos : ['x']).map((_, i) => $('#c' + i).value));
}

iniciar();
