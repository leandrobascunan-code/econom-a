/* Utilidades compartidas (estudiante y docente) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { } }
};

/** Texto simple: **negrita**, *cursiva*, saltos de línea. Siempre escapado. */
function md(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
}

function toast(msg, ms = 3200) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

const URL_RESPALDO = 'https://script.google.com/macros/s/AKfycbypxpiJ9zg6P0mStMsiHK7gXmdLnWrPeHdklcmPQj08mXTs5FhTOypkV-d_T1lyPkCZAA/exec';
const API = {
  token: null,
  url() { const u = window.CONFIG && window.CONFIG.API_URL; return u && u.startsWith('https://script.google.com/') ? u : URL_RESPALDO; },
  async call(accion, datos = {}, opts = {}) {
    let r;
    try {
      r = await fetch(this.url(), { method: 'POST', body: JSON.stringify({ accion, token: this.token, ...datos }), keepalive: !!opts.keepalive });
    } catch (e) { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); }
    let j; try { j = await r.json(); } catch (e) { throw new Error('Respuesta inválida del servidor.'); }
    if (!j.ok) { const err = new Error(j.error); err.code = j.error; throw err; }
    return j.datos;
  }
};

function fmtFecha(ms, corto) {
  if (!ms) return '—';
  const d = new Date(ms);
  return corto ? d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtHora(ms) { return ms ? new Date(ms).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; }
function aInputLocal(ms) { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }

function formatRut(v) {
  v = String(v).replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (v.length < 2) return v;
  const cuerpo = v.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return cuerpo + '-' + v.slice(-1);
}
function rutValido(r) {
  r = String(r).replace(/[^0-9kK]/g, '').toUpperCase(); if (r.length < 8) return false;
  const cu = r.slice(0, -1), dv = r.slice(-1); let s = 0, f = 2;
  for (let i = cu.length - 1; i >= 0; i--) { s += +cu[i] * f; f = f === 7 ? 2 : f + 1; }
  const d = 11 - (s % 11); return (d === 11 ? '0' : d === 10 ? 'K' : String(d)) === dv;
}
function ytEmbed(url) {
  const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(url || '');
  return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : '';
}
/** Convierte un enlace o un archivo de Drive en una dirección incrustable (solo sitios permitidos). */
function embedInfo(m) {
  if (m.driveId) { const mi = m.mime || ''; return { src: 'https://drive.google.com/file/d/' + m.driveId + '/preview', video: mi.startsWith('video/') }; }
  const u = String(m.url || ''); let x;
  if ((x = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(u))) return { src: 'https://www.youtube-nocookie.com/embed/' + x[1], video: true };
  if ((x = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u))) return { src: 'https://drive.google.com/file/d/' + x[1] + '/preview' };
  if ((x = /docs\.google\.com\/(presentation|document|spreadsheets)\/d\/([\w-]+)/.exec(u))) return { src: 'https://docs.google.com/' + x[1] + '/d/' + x[2] + (x[1] === 'presentation' ? '/embed?start=false&loop=false' : '/preview') };
  if (/^https:\/\/(www\.)?canva\.com\/design\//.test(u)) return { src: u.split('?')[0].replace(/\/(edit|watch)$/, '/view') + '?embed' };
  if ((x = /vimeo\.com\/(\d+)/.exec(u))) return { src: 'https://player.vimeo.com/video/' + x[1], video: true };
  return null;
}
function bloqueEmbed(m) {
  const e = embedInfo(m); if (!e) return '';
  return `<div class="doc ${e.video ? 'v' : ''}"><iframe src="${esc(e.src)}" allow="fullscreen; autoplay; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;
}
function urlAbrir(m) { return m.driveId ? 'https://drive.google.com/file/d/' + m.driveId + '/view' : (m.url || ''); }
/* ---- Diapositivas visuales (estilo presentación) ---- */
const LAYOUTS = { portada: 'Portada', 'imagen-derecha': 'Imagen a la derecha', 'imagen-izquierda': 'Imagen a la izquierda', solo: 'Solo texto', destacado: 'Destacado', fondo: 'Imagen de fondo' };
const TEMAS = { azul: 'Azul marino', claro: 'Claro', oscuro: 'Oscuro', dorado: 'Dorado' };
function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
function textoRico(t) {
  let html = '', ul = false;
  String(t || '').split('\n').forEach(l => {
    const m = /^\s*[-•]\s+(.*)$/.exec(l);
    if (m) { if (!ul) { html += '<ul>'; ul = true; } html += '<li>' + inline(m[1]) + '</li>'; }
    else { if (ul) { html += '</ul>'; ul = false; } if (l.trim()) html += '<p>' + inline(l) + '</p>'; }
  });
  return html + (ul ? '</ul>' : '');
}
/** edit=true: título y texto editables directamente sobre la diapositiva */
function slideStage(p, edit) {
  const lay = LAYOUTS[p.layout] ? p.layout : (p.imagen ? 'imagen-derecha' : 'solo'); const th = TEMAS[p.tema] ? p.tema : 'azul';
  const img = p.imagen ? `<div class="st-img" style="background-image:url('${esc(p.imagen)}')"></div>` : '';
  const t = edit ? `<h2 class="st-t" contenteditable="plaintext-only" spellcheck="false" data-k="titulo" data-ph="Título">${esc(p.titulo)}</h2>` : `<h2 class="st-t">${esc(p.titulo)}</h2>`;
  const b = edit ? `<div class="st-b" contenteditable="plaintext-only" spellcheck="false" data-k="texto" data-ph="Escribe aquí… (usa «- » para viñetas)">${esc(p.texto)}</div>` : `<div class="st-b">${textoRico(p.texto)}</div>`;
  return `<div class="stage th-${th} lay-${lay} ${p.imagen ? 'con-img' : ''}"><div class="st-deco"></div>${img}<div class="st-txt">${t}${b}</div>${p.credito ? `<div class="st-credit">${esc(p.credito)}</div>` : ''}<img class="st-logo" src="img/insignia.png" alt=""></div>`;
}
/** Busca imágenes libres en internet (Wikimedia Commons y Openverse). Devuelve [{src, thumb, credito}] */
async function buscarImagenes(q) {
  const out = []; const limpia = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const ps = [
    fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap')).then(r => r.json()).then(j => Object.values((j.query && j.query.pages) || {}).forEach(pg => { const ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || !ii.thumburl) return; const m = ii.extmetadata || {}; out.push({ src: ii.thumburl, thumb: ii.thumburl.replace(/\/\d+px-/, '/320px-'), credito: 'Imagen: ' + (limpia(m.Artist && m.Artist.value) || 'Wikimedia Commons') + ' · ' + (limpia(m.LicenseShortName && m.LicenseShortName.value) || 'licencia libre') }); })).catch(() => { }),
    fetch('https://api.openverse.org/v1/images/?page_size=18&mature=false&q=' + encodeURIComponent(q)).then(r => r.json()).then(j => (j.results || []).forEach(r => { if (r.url) out.push({ src: r.url, thumb: r.thumbnail || r.url, credito: 'Imagen: ' + (limpia(r.creator) || 'autor desconocido') + ' · ' + String(r.license || '').toUpperCase() + (r.license_version ? ' ' + r.license_version : '') }); })).catch(() => { })
  ];
  await Promise.all(ps); const vistos = new Set(); return out.filter(x => !vistos.has(x.src) && vistos.add(x.src));
}

/* ---- Visualización de resultados (compartida por estudiantes y proyección del docente) ---- */
const FORMAS = ['▲', '◆', '●', '■'];
function barras(etqs, cuentas, correcta) {
  const t = cuentas.reduce((a, b) => a + b, 0) || 1; const max = Math.max(...cuentas, 1);
  return etqs.map((e, i) => `<div class="bar-row"><div class="row small"><span class="sp">${esc(e)} ${correcta === i ? '✅' : ''}</span><b>${cuentas[i]} · ${Math.round(cuentas[i] / t * 100)}%</b></div><div class="bar big t${i % 4}"><i style="width:${cuentas[i] / max * 100}%"></i></div></div>`).join('');
}
function nubeHtml(palabras) {
  if (!palabras || !palabras.length) return '<p class="mut c">Aún no hay palabras.</p>';
  const max = Math.max(...palabras.map(w => w.n)); const col = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7a3ff2', '#0a2a66'];
  return '<div class="nube">' + palabras.map((w, i) => `<span style="font-size:${(0.95 + 1.9 * w.n / max).toFixed(2)}rem;color:${col[i % col.length]}">${esc(w.t)}</span>`).join(' ') + '</div>';
}
/** p: paso (con opciones/tipo), a: agregado del servidor, correcta: valor correcto (si se conoce) */
function aggHtml(p, a, correcta) {
  if (!a) return '';
  const h = `<p class="small mut c">${a.n} respuesta${a.n === 1 ? '' : 's'}</p>`;
  if (p.tipo === 'opcion' || p.tipo === 'encuesta') return h + barras((p.opciones || []).map((o, i) => 'ABCDEFGH'[i] + '. ' + o), a.cuentas || [], p.tipo === 'opcion' ? correcta : -1);
  if (p.tipo === 'vf') return h + barras(['Verdadero', 'Falso'], a.cuentas || [0, 0], correcta === 'V' ? 0 : correcta === 'F' ? 1 : -1);
  if (p.tipo === 'escala') return h + barras(['1 · Muy en desacuerdo', '2', '3', '4', '5 · Muy de acuerdo'], a.cuentas || [0, 0, 0, 0, 0], -1) + `<p class="c"><b>Promedio: ${a.media}</b></p>`;
  if (p.tipo === 'nube') return h + nubeHtml(a.palabras);
  if (p.tipo === 'numerica') return h + `<p class="c">${a.pctOk}% acertó</p>` + (a.valores || []).map(v => `<div class="row small"><span class="sp">${esc(v.v)}</span><b>${v.n}</b></div>`).join('');
  return h;
}
function podioHtml(top, miAlias) {
  if (!top || !top.length) return '<p class="mut c">Aún no hay puntajes.</p>';
  const med = ['🥇', '🥈', '🥉', '4°', '5°', '6°', '7°', '8°', '9°', '10°'];
  return top.map((x, i) => `<div class="podio-row ${x.alias === miAlias ? 'yo' : ''}"><span class="med">${med[i]}</span><b class="sp">${esc(x.alias)}</b><span class="pp">${x.pts}</span></div>`).join('');
}
function descargarBase64(nombre, b64, tipo = 'application/pdf') {
  const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([a], { type: tipo }));
  const l = document.createElement('a'); l.href = url; l.download = nombre; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
