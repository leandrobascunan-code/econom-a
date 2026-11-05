/* Panel docente */
const App = $('#app');
const T = { tab: 'vivo', sesiones: [], sel: null, timer: null, cfg: null, dash: null, resp: null, edit: null, resultados: null };
const NOMBRE_DOC = 'Leandro Bascuñán';

function shell(contenido) {
  const tabs = [['vivo', '📡 En vivo'], ['corr', '✍️ Corrección'], ['res', '📊 Resultados'], ['est', '👥 Estudiantes'], ['ses', '🗂️ Sesiones'], ['inf', '📄 Informes'], ['cfg', '⚙️ Ajustes']];
  App.innerHTML = `<div class="hero wide"><div class="in"><div class="row"><div class="brand sp"><span class="dot">$</span>Panel docente · Economía y Sociedad · Unidad 4</div><button class="btn sm ghost" id="out" style="color:#fff;border-color:rgba(255,255,255,.4)">Salir</button></div><h1>Hola, ${NOMBRE_DOC}</h1><p>Participación, resultados, corrección con IA e informes.</p></div></div>
  <div class="wrap wide pull"><div class="tabs">${tabs.map(t => `<button class="tab ${T.tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div id="main">${contenido || ''}</div></div>`;
  $('#out').onclick = salir; $$('.tab').forEach(b => b.onclick = () => ir(b.dataset.t));
}
function salir() { clearInterval(T.timer); store.del('dtok'); API.token = null; login(); }
function manejar(e) { if (e.code === 'SESION_EXPIRADA') { toast('Sesión expirada. Ingresa de nuevo.'); salir(); return true; } toast(e.message, 5000); return false; }

/* ---------- Login (solo clave) ---------- */
function login() {
  App.innerHTML = `<div class="hero"><div class="in"><div class="brand"><span class="dot">$</span>Panel docente</div><h1>${NOMBRE_DOC}</h1><p>Administrador · Economía y Sociedad</p></div></div>
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
  ({ vivo: vVivo, corr: vCorr, res: vRes, est: vEst, ses: vSes, inf: vInf, cfg: vCfg })[t]();
}
function selSesion(id = 'sel') {
  return `<select id="${id}" style="max-width:380px">${T.sesiones.map(s => `<option value="${esc(s.id)}" ${s.id === T.sel ? 'selected' : ''}>Sesión ${s.numero} · ${esc(s.titulo)}</option>`).join('')}</select>`;
}

/* ---------- EN VIVO ---------- */
function vVivo() {
  if (!T.sel) { $('#main').innerHTML = '<div class="card c mut">Crea una sesión en la pestaña «Sesiones».</div>'; return; }
  const url = location.href.replace(/docente\.html.*$/, '') + 'index.html?s=' + encodeURIComponent(T.sel);
  $('#main').innerHTML = `<div class="sidebyside"><div><div class="card"><label>Sesión</label>${selSesion()}<div class="qr" style="margin-top:12px"><div id="qr"></div></div><div class="small mut c" style="margin-top:8px;word-break:break-all">${esc(url)}</div><button class="btn sm ghost block" id="fs" style="margin-top:8px">🖥️ QR a pantalla completa</button></div>
  <div class="card"><h3>Control de la clase</h3><div class="row"><button class="btn sm ghost" id="rl">Ritmo libre</button><button class="btn sm" id="rd">Guiar yo</button></div><div class="hint">«Guiar yo»: los estudiantes avanzan solo hasta la diapositiva que tú habilites.</div><label>Habilitar paso</label><select id="paso"></select><div class="row" style="margin-top:8px"><button class="btn sm ghost" id="pa">← Atrás</button><button class="btn sm" id="ps">Siguiente →</button></div></div></div>
  <div id="live"><div class="c"><span class="spin"></span></div></div></div>`;
  new QRCode($('#qr'), { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  $('#sel').onchange = e => { T.sel = e.target.value; vVivo(); };
  $('#fs').onclick = () => { const w = document.createElement('div'); w.className = 'lock'; w.style.background = '#fff'; w.innerHTML = `<div class="c" style="color:#0b2545"><h1 style="font-size:2.2rem">Escanea para participar</h1><div id="qq" style="display:inline-block;padding:16px;background:#fff"></div><p style="font-size:1.1rem">Sesión ${T.sesiones.find(s => s.id === T.sel).numero}</p></div>`; w.onclick = () => w.remove(); document.body.appendChild(w); const sz = Math.min(innerWidth, innerHeight) * .6; new QRCode($('#qq'), { text: url, width: sz, height: sz }); };
  const ctl = async d => { try { await API.call('docPaso', { sesion: T.sel, ...d }); refrescarVivo(); } catch (e) { manejar(e); } };
  $('#rl').onclick = () => ctl({ ritmo: 'libre' }); $('#rd').onclick = () => ctl({ ritmo: 'docente' });
  $('#paso').onchange = e => ctl({ paso: +e.target.value }); $('#pa').onclick = () => ctl({ paso: Math.max(0, (T.dash?.sesion.paso_actual || 0) - 1) }); $('#ps').onclick = () => ctl({ paso: Math.min((T.dash?.sesion.pasos.length || 1) - 1, (T.dash?.sesion.paso_actual || 0) + 1) });
  refrescarVivo(); T.timer = setInterval(refrescarVivo, 8000);
}
async function refrescarVivo() {
  if (T.tab !== 'vivo' || document.hidden || !$('#live')) return;
  try { T.dash = await API.call('docDashboard', { sesion: T.sel }); } catch (e) { return manejar(e); }
  const d = T.dash, s = d.sesion, A = d.alumnos;
  const est = a => a.estado === 'activo' ? (d.ahora - a.ultima > 30000 ? 'sin_senal' : 'activo') : a.estado;
  const n = k => A.filter(a => est(a) === k).length;
  const pasoSel = $('#paso'); if (pasoSel && document.activeElement !== pasoSel) pasoSel.innerHTML = s.pasos.map((p, i) => `<option value="${i}" ${i === s.paso_actual ? 'selected' : ''}>${i + 1}. ${esc((p.titulo || '').slice(0, 40))} ${p.tipo !== 'diapositiva' ? '· ' + p.tipo : ''}</option>`).join('');
  $('#rl').className = 'btn sm ' + (s.ritmo === 'libre' ? '' : 'ghost'); $('#rd').className = 'btn sm ' + (s.ritmo === 'docente' ? '' : 'ghost');
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
  $('#mailall').onclick = async ev => {
    if (!confirm('Se enviará a cada estudiante que respondió, desde tu correo, un comprobante formal con sus respuestas, puntajes y retroalimentación disponibles. ¿Continuar?')) return;
    const b = ev.target; b.disabled = true; b.textContent = 'Enviando…';
    try { const d = await API.call('docEnviarCopias', { sesion: T.sel }); alert(`Correos enviados: ${d.enviados}\nSin correo registrado: ${d.sinCorreo.length ? d.sinCorreo.join(', ') : 'ninguno'}\nFallos: ${d.fallos}\nCuota diaria restante: ${d.cuotaRestante}`); } catch (e) { manejar(e); }
    b.disabled = false; b.textContent = '✉ Enviar copias por correo';
  };
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
  <div class="card"><h3>Cursos</h3><div class="row">${D.cursos.map(c => `<span class="chip navy" style="font-size:.85rem">${esc(c)} <a href="#" data-rn="${esc(c)}" style="color:#fff;text-decoration:none" title="Renombrar">✎</a></span>`).join('')}</div><div class="hint">Un curso nuevo se crea al asignárselo a un estudiante. ✎ renombra el curso para todos sus estudiantes.</div></div>
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
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar a este estudiante de la asignatura? Sus respuestas quedan en la planilla.')) return; try { await API.call('docEliminarEstudiante', { rut: b.dataset.del }); vEst(); } catch (e) { manejar(e); } });
  $$('[data-rn]').forEach(a => a.onclick = async ev => { ev.preventDefault(); const n = prompt('Nuevo nombre para el curso «' + a.dataset.rn + '»:', a.dataset.rn); if (!n || n === a.dataset.rn) return; try { const d = await API.call('docRenombrarCurso', { de: a.dataset.rn, a: n }); toast(`Curso renombrado (${d.estudiantes} estudiantes)`); vEst(); } catch (e) { manejar(e); } });
}

/* ---------- SESIONES (editor) ---------- */
function vSes() {
  if (T.edit) return editor();
  $('#main').innerHTML = `<div class="row" style="margin-bottom:10px"><h2 class="sp" style="margin:0">Sesiones de la unidad</h2><button class="btn" id="nueva">＋ Nueva sesión</button></div>
  ${T.sesiones.map(s => `<div class="card row"><div class="ses" style="width:auto;cursor:default"><div class="n" style="width:42px;height:42px;border-radius:12px;background:var(--navy);color:#fff;display:grid;place-items:center;font:700 1rem Poppins">${s.numero}</div></div><div class="sp"><b>${esc(s.titulo)}</b> ${chipSes(s.temporal)}<div class="small mut">${s.pasos.length} pasos · ${s.material.length} materiales · ${s.apertura ? fmtFecha(s.apertura) : 'sin apertura'} → ${s.cierre ? fmtFecha(s.cierre) : 'sin cierre'}</div></div><button class="btn sm ghost" data-e="${esc(s.id)}">Editar</button><button class="btn sm ghost" data-d="${esc(s.id)}">🗑</button></div>`).join('') || '<div class="card mut c">No hay sesiones.</div>'}`;
  $('#nueva').onclick = () => { const mx = Math.max(0, ...T.sesiones.map(s => s.numero)); T.edit = { id: '', numero: mx + 1, titulo: '', descripcion: '', apertura: Date.now(), cierre: Date.now() + 7 * 864e5, estado: 'borrador', bloqueo: 'SI', ritmo: 'libre', paso_actual: 0, pasos: [], material: [], pauta_ia: '' }; editor(); };
  $$('[data-e]').forEach(b => b.onclick = () => { T.edit = JSON.parse(JSON.stringify(T.sesiones.find(s => s.id === b.dataset.e))); editor(); });
  $$('[data-d]').forEach(b => b.onclick = async () => { if (!confirm('¿Eliminar la sesión? Las respuestas de los estudiantes se conservan en la planilla.')) return; try { await API.call('docEliminarSesion', { id: b.dataset.d }); T.sesiones = (await API.call('docSesiones')).sesiones; vSes(); } catch (e) { manejar(e); } });
}
const TIPOS = { diapositiva: 'Diapositiva', opcion: 'Selección múltiple', vf: 'Verdadero/Falso', numerica: 'Respuesta numérica', encuesta: 'Encuesta (sin correcta)', abierta: 'Pregunta abierta (IA)' };
function campo(k, etiqueta, v, tipo = 'text', extra = '') { return `<label>${etiqueta}</label>${tipo === 'area' ? `<textarea data-k="${k}">${esc(v ?? '')}</textarea>` : `<input data-k="${k}" type="${tipo}" value="${esc(v ?? '')}" ${extra}>`}`; }
function pasoForm(p, i) {
  let f = '';
  if (p.tipo === 'diapositiva') f = campo('titulo', 'Título', p.titulo) + campo('texto', 'Contenido (**negrita**, *cursiva*)', p.texto, 'area') + campo('imagen', 'URL de imagen (opcional)', p.imagen);
  else {
    f = (p.tipo === 'abierta' ? campo('titulo', 'Título corto', p.titulo) : '') + campo('pregunta', 'Pregunta', p.pregunta, 'area');
    if (p.tipo === 'opcion' || p.tipo === 'encuesta') f += campo('opciones', 'Opciones (una por línea)', (p.opciones || []).join('\n'), 'area');
    if (p.tipo === 'opcion') f += campo('correcta', 'N° de la opción correcta (1 = primera)', (p.correcta ?? 0) + 1, 'number');
    if (p.tipo === 'vf') f += `<label>Correcta</label><select data-k="correcta"><option value="V" ${p.correcta === 'V' ? 'selected' : ''}>Verdadero</option><option value="F" ${p.correcta === 'F' ? 'selected' : ''}>Falso</option></select>`;
    if (p.tipo === 'numerica') f += campo('correcta', 'Valor correcto', p.correcta, 'number', 'step="any"') + campo('tolerancia', 'Tolerancia', p.tolerancia ?? 0.01, 'number', 'step="any"');
    if (p.tipo === 'abierta') f += campo('campos', 'Campos de respuesta (uno por línea)', (p.campos || ['Tu respuesta']).join('\n'), 'area') + campo('modelo', 'Respuesta modelo / pauta (la usa la IA)', p.modelo, 'area') + campo('rubrica', 'Rúbrica', p.rubrica, 'area');
    f += campo('puntos', 'Puntos', p.puntos ?? 1, 'number', 'step="0.5" min="0"');
    if (p.tipo !== 'abierta' && p.tipo !== 'encuesta') f += campo('explicacion', 'Explicación (se muestra al responder)', p.explicacion, 'area');
  }
  return `<div class="paso-ed" data-i="${i}"><div class="row"><span class="chip navy">${i + 1}</span><select data-k="tipo" style="max-width:240px">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="sp"></span><button class="btn sm ghost" data-a="up">↑</button><button class="btn sm ghost" data-a="dn">↓</button><button class="btn sm ghost" data-a="rm">✕</button></div>${f}</div>`;
}
function leerPasos() {
  return $$('.paso-ed').map(c => {
    const g = k => { const e = $(`[data-k="${k}"]`, c); return e ? e.value : undefined; };
    const p = { id: T.edit.pasos[+c.dataset.i]?.id || 'n' + Math.random().toString(36).slice(2, 7), tipo: g('tipo') };
    if (p.tipo === 'diapositiva') { p.titulo = g('titulo'); p.texto = g('texto'); p.imagen = g('imagen'); return p; }
    p.pregunta = g('pregunta'); p.puntos = +g('puntos') || 1;
    if (g('titulo') !== undefined) p.titulo = g('titulo');
    if (p.tipo === 'opcion' || p.tipo === 'encuesta') p.opciones = g('opciones').split('\n').map(x => x.trim()).filter(Boolean);
    if (p.tipo === 'opcion') p.correcta = (+g('correcta') || 1) - 1;
    if (p.tipo === 'vf') p.correcta = g('correcta');
    if (p.tipo === 'numerica') { p.correcta = +g('correcta'); p.tolerancia = +g('tolerancia') || 0.01; }
    if (p.tipo === 'abierta') { p.campos = g('campos').split('\n').map(x => x.trim()).filter(Boolean); p.modelo = g('modelo'); p.rubrica = g('rubrica'); }
    if (g('explicacion') !== undefined) p.explicacion = g('explicacion');
    return p;
  });
}
function leerMat() { return $$('.mat').map(c => ({ tipo: $('.mt', c).value, titulo: $('.mti', c).value, url: $('.mu', c).value, descripcion: $('.md', c).value })); }
function editor() {
  const e = T.edit;
  $('#main').innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="bk">← Volver</button><h2 class="sp" style="margin:0">${e.id ? 'Editar' : 'Nueva'} sesión ${e.numero}</h2><button class="btn" id="sv">💾 Guardar</button></div>
  <div class="card"><div class="grid2"><div>${campo('numero', 'N° de sesión', e.numero, 'number')}</div><div><label>Estado</label><select id="est"><option value="borrador" ${e.estado === 'borrador' ? 'selected' : ''}>Borrador (oculta)</option><option value="publicada" ${e.estado === 'publicada' ? 'selected' : ''}>Publicada</option></select></div></div>
  ${campo('titulo', 'Título', e.titulo)}${campo('descripcion', 'Descripción', e.descripcion, 'area')}
  <div class="grid2"><div><label>Abre (plazo)</label><input id="ap" type="datetime-local" value="${aInputLocal(e.apertura)}"></div><div><label>Cierra (plazo límite para actividades)</label><input id="ci" type="datetime-local" value="${aInputLocal(e.cierre)}"></div></div>
  <label>Modo concentración (bloqueo al salir de la app)</label><select id="bl"><option value="SI" ${e.bloqueo !== 'NO' ? 'selected' : ''}>Activado</option><option value="NO" ${e.bloqueo === 'NO' ? 'selected' : ''}>Desactivado</option></select>
  ${campo('pauta_ia', 'Notas para la IA (errores frecuentes, criterios)', e.pauta_ia, 'area')}</div>
  <h3>Material y videos <button class="btn sm ghost" id="am">＋</button></h3><div id="mats">${e.material.map(matForm).join('')}</div>
  <h3 style="margin-top:18px">Presentación y actividades <span class="mut small">(diapositivas, preguntas)</span></h3><div id="pasos">${e.pasos.map(pasoForm).join('')}</div>
  <div class="row"><button class="btn sm" id="ap_">＋ Diapositiva</button><button class="btn sm" id="aq">＋ Actividad</button></div>`;
  const rep = () => { e.titulo = $('[data-k="titulo"]').value; };
  const refrescar = () => { e.pasos = leerPasos(); e.material = leerMat(); const sc = scrollY; editor(); scrollTo(0, sc); };
  $('#bk').onclick = () => { T.edit = null; vSes(); };
  $('#am').onclick = () => { e.pasos = leerPasos(); e.material = [...leerMat(), { tipo: 'video', titulo: '', url: '', descripcion: '' }]; copiarCab(); editor(); };
  $('#ap_').onclick = () => { e.pasos = [...leerPasos(), { tipo: 'diapositiva', titulo: '', texto: '' }]; e.material = leerMat(); copiarCab(); editor(); };
  $('#aq').onclick = () => { e.pasos = [...leerPasos(), { tipo: 'opcion', pregunta: '', opciones: ['', '', '', ''], correcta: 0, puntos: 1 }]; e.material = leerMat(); copiarCab(); editor(); };
  function copiarCab() { const q = k => $(`#main > .card [data-k="${k}"]`).value; e.numero = +q('numero'); e.titulo = q('titulo'); e.descripcion = q('descripcion'); e.pauta_ia = q('pauta_ia'); e.estado = $('#est').value; e.bloqueo = $('#bl').value; e.apertura = $('#ap').value ? new Date($('#ap').value).getTime() : 0; e.cierre = $('#ci').value ? new Date($('#ci').value).getTime() : 0; }
  $('#pasos').onchange = ev => { if (ev.target.dataset.k === 'tipo') { const i = +ev.target.closest('.paso-ed').dataset.i; const ps = leerPasos(); ps[i] = { id: ps[i].id, tipo: ps[i].tipo, titulo: ps[i].titulo, texto: ps[i].texto, pregunta: ps[i].pregunta, puntos: ps[i].puntos || 1, opciones: ['', '', '', ''], correcta: ps[i].tipo === 'vf' ? 'V' : 0, campos: ['Tu respuesta'] }; e.pasos = ps; e.material = leerMat(); copiarCab(); editor(); } };
  $('#pasos').onclick = ev => { const a = ev.target.dataset.a; if (!a) return; const i = +ev.target.closest('.paso-ed').dataset.i; const ps = leerPasos(); if (a === 'rm') ps.splice(i, 1); if (a === 'up' && i > 0) [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]]; if (a === 'dn' && i < ps.length - 1) [ps[i + 1], ps[i]] = [ps[i], ps[i + 1]]; e.pasos = ps; e.material = leerMat(); copiarCab(); editor(); };
  $('#mats').onclick = ev => { if (ev.target.dataset.rm !== undefined) { const m = leerMat(); m.splice(+ev.target.dataset.rm, 1); e.pasos = leerPasos(); e.material = m; copiarCab(); editor(); } };
  $('#sv').onclick = async () => {
    copiarCab(); e.pasos = leerPasos(); e.material = leerMat();
    const b = $('#sv'); b.disabled = true;
    try { const { id } = await API.call('docGuardarSesion', { sesion: e }); T.sesiones = (await API.call('docSesiones')).sesiones; T.sel = T.sel || id; T.edit = null; toast('Sesión guardada ✅'); vSes(); } catch (er) { manejar(er); b.disabled = false; }
  };
}
function matForm(m, i) { return `<div class="paso-ed mat"><div class="row"><select class="mt" style="max-width:160px">${['video', 'documento', 'enlace'].map(t => `<option ${m.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><input class="mti" placeholder="Título" value="${esc(m.titulo)}" style="flex:1;min-width:160px"><button class="btn sm ghost" data-rm="${i}">✕</button></div><input class="mu" placeholder="URL (YouTube, Drive, PDF en el repositorio…)" value="${esc(m.url)}" style="margin-top:8px"><input class="md" placeholder="Descripción (opcional)" value="${esc(m.descripcion || '')}" style="margin-top:8px"></div>`; }

/* ---------- INFORMES ---------- */
async function vInf() {
  $('#main').innerHTML = '<div class="c"><span class="spin"></span></div>';
  try { T.resultados = await API.call('docResultados', { curso: T.cursoF || '' }); } catch (e) { return manejar(e); }
  const R = T.resultados;
  $('#main').innerHTML = `<div class="card"><div class="row"><select id="cf" style="max-width:200px"><option value="">Todos los cursos</option>${R.cursos.map(c => `<option ${c === T.cursoF ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="sp"></span><button class="btn gold" id="pc" ${T.cursoF ? '' : 'disabled'}>📄 PDF de todo el curso</button></div><div class="hint">Selecciona un curso para generar el PDF conjunto (una hoja por estudiante). Los PDF se guardan también en tu Drive («Informes Economía U4»).</div></div>
  <div class="scroll"><table class="t"><tr><th>Estudiante</th><th>Curso</th><th>Logro</th><th>Nota</th><th>Observación del docente (aparece en el informe)</th><th></th></tr>
  ${R.alumnos.map(a => `<tr data-rut="${esc(a.rut)}"><td><b>${esc(a.nombre)}</b><div class="small mut">${esc(a.rut)}</div></td><td>${esc(a.curso)}</td><td>${a.progreso.pct_logro}%</td><td>${a.progreso.nota === null ? '—' : String(a.progreso.nota).replace('.', ',')}</td><td><textarea class="ob" style="min-height:56px">${esc(a.observacion)}</textarea></td><td><button class="btn sm gold pdf">PDF</button></td></tr>`).join('')}</table></div>`;
  $('#cf').onchange = e => { T.cursoF = e.target.value; vInf(); };
  const gen = async (b, datos) => { const t = b.textContent; b.disabled = true; b.textContent = '…'; try { const d = await API.call('docInforme', datos); descargarBase64(d.nombre, d.base64); toast('Informe generado ✅'); } catch (e) { manejar(e); } b.disabled = false; b.textContent = t; };
  $('#pc').onclick = e => gen(e.target, { curso: T.cursoF });
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
  ${f('modelo_ia', 'Modelo de IA (Groq)', 'Estado de la clave de IA: ' + (c.tiene_ia ? '✅ configurada' : '❌ falta GROQ_API_KEY en las propiedades del script'))}
  <button class="btn block" id="gc" style="margin-top:14px">Guardar ajustes</button></div>
  <div class="card"><h3>Datos</h3><p class="small mut">Toda la información (estudiantes, asistencia, respuestas y eventos de salida/reingreso) queda en tu planilla de Google.</p><a class="btn ghost" target="_blank" rel="noopener" href="${esc(T.planilla || '#')}">Abrir planilla de datos</a></div>`;
  $('#gc').onclick = async () => { const o = {}; $$('[data-c]').forEach(e => o[e.dataset.c] = e.value); try { await API.call('docGuardarConfig', { config: o }); T.cfg = { ...T.cfg, ...o }; toast('Ajustes guardados ✅'); } catch (e) { manejar(e); } };
}

const t0 = store.get('dtok'); if (t0) { API.token = t0; arrancar(); } else login();
