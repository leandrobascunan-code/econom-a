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
/** 'AAAA-MM-DD' -> 'mié, 12 nov' (sin problemas de zona horaria) */
function fmtDia(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return ''; return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }); }
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
  if ((x = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(u))) return { src: 'https://www.youtube-nocookie.com/embed/' + x[1] + '?enablejsapi=1&rel=0&playsinline=1', video: true };
  if ((x = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u))) return { src: 'https://drive.google.com/file/d/' + x[1] + '/preview' };
  if ((x = /docs\.google\.com\/(presentation|document|spreadsheets)\/d\/([\w-]+)/.exec(u))) return { src: 'https://docs.google.com/' + x[1] + '/d/' + x[2] + (x[1] === 'presentation' ? '/embed?start=false&loop=false' : '/preview') };
  if (/^https:\/\/(www\.)?canva\.com\/design\//.test(u)) return { src: u.split('?')[0].replace(/\/(edit|watch)$/, '/view') + '?embed' };
  if ((x = /vimeo\.com\/(\d+)/.exec(u))) return { src: 'https://player.vimeo.com/video/' + x[1], video: true };
  return null;
}
function bloqueEmbed(m) {
  const e = embedInfo(m); if (!e) return '';
  return `<div class="doc ${e.video ? 'v' : ''}"><iframe src="${esc(e.src)}" allow="fullscreen; autoplay; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}
function urlAbrir(m) { return m.driveId ? 'https://drive.google.com/file/d/' + m.driveId + '/view' : (m.url || ''); }
/* ---- Diapositivas visuales (estilo presentación) ---- */
const LAYOUTS = { video: 'Solo video (sin texto)', portada: 'Portada', titulo: 'Solo título', solo: 'Solo texto', 'imagen-derecha': 'Imagen a la derecha', 'imagen-izquierda': 'Imagen a la izquierda', 'imagen-arriba': 'Imagen arriba', dividido: 'Dividido 50/50', fondo: 'Imagen de fondo', tarjeta: 'Tarjeta sobre imagen', destacado: 'Idea destacada', cita: 'Cita' };
const TEMAS = { azul: 'Azul marino', claro: 'Claro', oscuro: 'Oscuro', dorado: 'Dorado', oceano: 'Océano', atardecer: 'Atardecer', bosque: 'Bosque', minimal: 'Minimal', marfil: 'Marfil', neon: 'Neón' };
const FXS = { inclinado: 'Inclinado 3D', flotante: 'Flotante 3D', profundidad: 'Profundidad 3D', polaroid: 'Polaroid', extruido: 'Título en relieve 3D', zoom: 'Zoom suave' };
const FORMAS_IMG = { completa: 'Completa (según diseño)', tarjeta: 'Tarjeta con sombra', circulo: 'Círculo', arco: 'Arco' };
const FILTROS = { bn: 'Blanco y negro', sepia: 'Sepia', duotono: 'Duotono azul', vivo: 'Colores vivos', suave: 'Suave', oscuro: 'Oscuro' };
/* ---- Formato de texto: negrita, cursiva, subrayado, resaltado, colores y tamaños ----
   El texto se guarda como texto plano con marcas {{etiqueta|texto}} (ej: {{b|importante}}, {{c:rojo|ojo}}, {{h:amarillo|clave}}).
   Se muestra con clases CSS predefinidas (no se guarda HTML), por eso es seguro y igual en todas las pantallas. */
const FMT_COLORES = { rojo: '#ef4444', naranja: '#f97316', ambar: '#f59e0b', verde: '#22c55e', turquesa: '#14b8a6', azul: '#3b82f6', morado: '#a855f7', rosa: '#ec4899', blanco: '#ffffff', negro: '#111827', gris: '#9ca3af' };
const FMT_RESALTES = { amarillo: '#fde047', verde: '#86efac', celeste: '#7dd3fc', rosa: '#f9a8d4', naranja: '#fdba74' };
const FMT_TAMANOS = ['chico', 'grande', 'enorme'];
const RE_TAG = /^(b|i|u|c:[a-z]+|h:[a-z]+|s:[a-z]+)$/;
function envolverHtml(tag, inner) {
  if (tag === 'b') return '<b>' + inner + '</b>'; if (tag === 'i') return '<i>' + inner + '</i>'; if (tag === 'u') return '<u>' + inner + '</u>';
  const [k, v] = tag.split(':');
  if (k === 'c' && FMT_COLORES[v]) return `<span class="tc-${v}">${inner}</span>`;
  if (k === 'h' && FMT_RESALTES[v]) return `<span class="hl-${v}">${inner}</span>`;
  if (k === 's' && FMT_TAMANOS.includes(v)) return `<span class="ts-${v}">${inner}</span>`;
  return inner;
}
function inlineTokens(s) {
  let out = '', i = 0;
  while (i < s.length) {
    if (s.startsWith('{{', i)) {
      const bar = s.indexOf('|', i + 2);
      if (bar > 0 && RE_TAG.test(s.slice(i + 2, bar))) {
        let depth = 1, j = bar + 1;
        while (j < s.length) { if (s.startsWith('{{', j)) { depth++; j += 2; } else if (s.startsWith('}}', j)) { depth--; if (depth === 0) break; j += 2; } else j++; }
        if (depth === 0) { out += envolverHtml(s.slice(i + 2, bar), inlineTokens(s.slice(bar + 1, j))); i = j + 2; continue; }
      }
    }
    out += esc(s[i]); i++;
  }
  return out;
}
function inline(t) { return inlineTokens(String(t ?? '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
/* HTML editable (contenteditable) -> texto con marcas */
const rgbHex = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : String(c || '').toLowerCase(); };
const nombreDe = (mapa, hex) => Object.keys(mapa).find(k => mapa[k] === hex) || '';
const BLOQUE = /^(DIV|P|UL|OL|H[1-6])$/;
function unirNodos(nodos) { let out = ''; [...nodos].forEach(n => { const s = nodoAMarkup(n); if (n.nodeType === 1 && BLOQUE.test(n.tagName) && out && !out.endsWith('\n')) out += '\n'; out += s; }); return out; }
function envolverLineas(s, t) { return s.split('\n').map(seg => seg.trim() ? '{{' + t + '|' + seg + '}}' : seg).join('\n'); }
function nodoAMarkup(n) {
  if (n.nodeType === 3) return n.nodeValue.replace(/ /g, ' ').replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }');
  if (n.nodeType !== 1) return '';
  const tag = n.tagName; if (tag === 'BR') return '\n';
  if (tag === 'UL' || tag === 'OL') return [...n.children].map(li => '- ' + unirNodos(li.childNodes).replace(/\n+$/, '')).join('\n') + '\n';
  const inner = unirNodos(n.childNodes);
  if (BLOQUE.test(tag) || tag === 'LI') return inner.endsWith('\n') ? inner : inner + '\n';
  if (!inner.trim()) return inner;
  const st = n.style || {}, cl = String(n.className || ''); const tags = [];
  if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || +st.fontWeight >= 600) tags.push('b');
  if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') tags.push('i');
  if (tag === 'U' || /underline/.test(st.textDecorationLine || st.textDecoration || '')) tags.push('u');
  const col = nombreDe(FMT_COLORES, rgbHex(st.color)) || nombreDe(FMT_COLORES, String(n.getAttribute('color') || '').toLowerCase()) || (/(?:^|\s)tc-([a-z]+)/.exec(cl) || [])[1] || '';
  if (col && FMT_COLORES[col]) tags.push('c:' + col);
  const hl = nombreDe(FMT_RESALTES, rgbHex(st.backgroundColor)) || (/(?:^|\s)hl-([a-z]+)/.exec(cl) || [])[1] || '';
  if (hl && FMT_RESALTES[hl]) tags.push('h:' + hl);
  const fsMap = { small: 'chico', 'x-small': 'chico', large: 'grande', 'x-large': 'enorme', 'xx-large': 'enorme' }, fsAttr = { 1: 'chico', 2: 'chico', 4: 'grande', 5: 'enorme', 6: 'enorme', 7: 'enorme' };
  const sz = fsMap[st.fontSize] || fsAttr[n.getAttribute('size')] || (/(?:^|\s)ts-([a-z]+)/.exec(cl) || [])[1] || '';
  if (sz && FMT_TAMANOS.includes(sz)) tags.push('s:' + sz);
  return tags.reduce((acc, t) => envolverLineas(acc, t), inner);
}
function htmlAMarkup(root) { return unirNodos(root.childNodes).replace(/\n{3,}/g, '\n\n').replace(/\n+$/, ''); }
function textoRico(t) {
  let html = '', ul = false;
  String(t || '').split('\n').forEach(l => {
    const m = /^\s*[-•]\s+(.*)$/.exec(l);
    if (m) { if (!ul) { html += '<ul>'; ul = true; } html += '<li>' + inline(m[1]) + '</li>'; }
    else { if (ul) { html += '</ul>'; ul = false; } if (l.trim()) html += '<p>' + inline(l) + '</p>'; }
  });
  return html + (ul ? '</ul>' : '');
}
const MOVS = { 'paneo-der': 'Paneo → derecha', 'paneo-izq': 'Paneo ← izquierda', vaiven: 'Oleaje (vaivén)', navegar: 'Navegar (barco con olas)', flotar: 'Flotar', diagonal: 'Recorrido diagonal', 'zoom-foco': 'Acercarse al punto de interés', respirar: 'Respirar (zoom suave)', 'tilt-arriba': 'Subir (edificios, altura)', 'tilt-abajo': 'Bajar', brillo: 'Destello de luz', viento: 'Viento (campo, árboles)', travelling: 'Travelling rápido (transporte)' };
const VELS = { lento: 'Lento', normal: 'Normal', rapido: 'Rápido' };
const OBJMOVS = { navegar: 'Navegar de lado a lado', flotar: 'Flotar', volar: 'Volar en diagonal', girar: 'Girar' };
const VAUDIOS = { silencio: 'Sin audio', audio: 'Con audio en todas las pantallas', proy: 'Audio solo en la proyección del docente' };
function ytId(u) { const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(String(u || '')); return m ? m[1] : ''; }
function ytUrl(p, proj) {
  const id = ytId(p.video); if (!id) return '';
  const silencio = p.vaudio === 'audio' ? false : p.vaudio === 'proy' ? !proj : true;
  const q = new URLSearchParams({ mute: silencio ? 1 : 0, autoplay: (proj || p.vauto) ? 1 : 0, controls: p.vctrl === 'no' ? 0 : 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 });
  if (p.vloop) { q.set('loop', 1); q.set('playlist', id); }
  const ini = Number(p.vini) || 0; if (ini > 0) q.set('start', ini);
  return 'https://www.youtube-nocookie.com/embed/' + id + '?' + q.toString();
}
/** edit=true: título y texto editables sobre la diapositiva.  opts.live: reproduce el video (si no, muestra su miniatura).  opts.proj: es la proyección del docente. */
function slideStage(p, edit, opts) {
  opts = opts || {}; const vid = ytId(p.video); const hay = !!(p.imagen || vid);
  const lay = p.layout === 'video' ? (vid ? 'video' : 'solo') : (LAYOUTS[p.layout] ? p.layout : (hay ? 'imagen-derecha' : 'solo')); const th = TEMAS[p.tema] ? p.tema : 'azul';
  const fx = FXS[p.fx] ? p.fx : '', fo0 = FORMAS_IMG[p.forma] ? p.forma : 'completa', fi = FILTROS[p.filtro] ? p.filtro : '';
  const fo = ['inclinado', 'flotante', 'polaroid', 'profundidad'].includes(fx) && fo0 === 'completa' ? 'tarjeta' : fo0;   // los efectos 3D necesitan la imagen como tarjeta
  const mov = MOVS[p.mov] ? p.mov : '', vel = VELS[p.movvel] ? p.movvel : 'normal';
  const fxCls = (fx ? 'fx-' + fx + ' ' : '') + 'forma-' + fo + (fi ? ' filt-' + fi : '') + (mov ? ' mov-' + mov : '') + ' vel-' + vel + (vid ? ' con-video' : '');
  let media = '';
  if (vid) media = opts.live ? `<div class="st-img st-vid"><iframe src="${esc(ytUrl(p, opts.proj))}" title="Video" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<div class="st-img st-vid"><img src="https://img.youtube.com/vi/${vid}/hqdefault.jpg" alt="" referrerpolicy="no-referrer"><span class="st-play">▶</span></div>`;
  else if (p.imagen) media = `<div class="st-img"><img src="${esc(p.imagen)}" alt="" referrerpolicy="no-referrer" draggable="false"></div>`;
  const cl = v => Math.max(0, Math.min(100, Number(v))); const foco = (p.movx !== undefined && p.movx !== '' && p.movy !== undefined && p.movy !== '' && !isNaN(Number(p.movx)) && !isNaN(Number(p.movy))) ? ` style="--fx:${cl(p.movx)}%;--fy:${cl(p.movy)}%"` : '';
  const obj = p.obj ? `<img class="st-obj om-${OBJMOVS[p.objmov] ? p.objmov : 'navegar'}" src="${esc(p.obj)}" alt="" referrerpolicy="no-referrer" draggable="false" style="--ow:${Math.max(8, Math.min(60, Number(p.objw) || 24))}%;--oy:${Math.max(0, Math.min(80, p.objy === '' || p.objy === undefined ? 58 : Number(p.objy)))}%">` : '';
  const t = edit ? `<h2 class="st-t" contenteditable="true" spellcheck="false" data-rich="1" data-k="titulo" data-ph="Título">${inline(p.titulo)}</h2>` : `<h2 class="st-t">${inline(p.titulo)}</h2>`;
  const b = edit ? `<div class="st-b" contenteditable="true" spellcheck="false" data-rich="1" data-k="texto" data-ph="Escribe aquí…">${textoRico(p.texto)}</div>` : `<div class="st-b">${textoRico(p.texto)}</div>`;
  return `<div class="stage th-${th} lay-${lay} ${hay ? 'con-img' : ''} ${fxCls}"${foco}><div class="st-deco"></div>${media}<div class="st-txt">${t}${b}</div>${obj}${p.credito ? `<div class="st-credit">${esc(p.credito)}</div>` : ''}<img class="st-logo" src="img/insignia.png" alt=""></div>`;
}
/** Sin IA de visión: propone movimientos según palabras del título, el texto o la dirección de la imagen. */
function sugerirPorTexto(txt) {
  const t = String(txt || '').toLowerCase();
  const R = [
    [/barco|buque|nave|puerto|marítim|naveg|mar\b|oc[eé]ano|ship|port\b|cargo|vessel|sea\b|ocean/, 'barco o puerto', 'navegar', 'lento', 'vaiven', 'paneo-der', 50, 55],
    [/persona|gente|trabajador|multitud|familia|estudiante|consumidor|ciudadan|people|worker|crowd|team|person/, 'personas', 'zoom-foco', 'lento', 'respirar', 'paneo-izq', 50, 38],
    [/ciudad|edificio|banco|bolsa|rascacielo|skyline|torre|city|building|tower|stock/, 'ciudad o edificios', 'tilt-arriba', 'lento', 'paneo-der', 'respirar', 50, 40],
    [/cami[oó]n|tren|avi[oó]n|carretera|transporte|log[ií]stic|contenedor|truck|train|plane|highway|container|transport/, 'transporte', 'travelling', 'normal', 'paneo-der', 'tilt-abajo', 50, 55],
    [/dinero|moneda|billete|precio|inflaci|comercio|mercado|d[oó]lar|money|coin|price|market|trade|econom/, 'dinero o comercio', 'brillo', 'normal', 'respirar', 'zoom-foco', 50, 50],
    [/gr[aá]fico|tabla|mapa|dato|infograf|chart|graph|map\b|table|statistic/, 'gráfico o mapa', 'zoom-foco', 'lento', 'paneo-izq', 'respirar', 50, 45],
    [/campo|cultivo|agr[ií]col|cosecha|fruta|vi[ñn]a|vino|[aá]rbol|farm|crop|harvest|vineyard|wheat/, 'campo o cultivos', 'viento', 'lento', 'paneo-der', 'flotar', 50, 60],
    [/paisaje|natural|monta[ñn]a|r[ií]o|lago|landscape|mountain|river|forest/, 'paisaje', 'paneo-der', 'lento', 'flotar', 'diagonal', 50, 50],
    [/f[aá]brica|industria|miner[ií]a|cobre|planta|factory|industry|mine\b|copper/, 'industria', 'tilt-arriba', 'lento', 'travelling', 'respirar', 50, 45]
  ];
  const r = R.find(x => x[0].test(t));
  const mk = (m, v, why) => ({ mov: m, velocidad: v, motivo: why });
  if (!r) return { tipo: 'imagen', descripcion: 'No se pudo reconocer el contenido; se propone un movimiento suave general.', foco: { x: 50, y: 50 }, personas: false, sinVision: true, propuestas: [mk('zoom-foco', 'lento', 'Acercamiento suave al centro.'), mk('paneo-der', 'lento', 'Recorrido lateral lento.'), mk('respirar', 'lento', 'Zoom que respira.')] };
  const por = { navegar: 'La imagen se mece como sobre las olas.', vaiven: 'Vaivén de oleaje.', 'paneo-der': 'Recorrido lateral lento.', 'zoom-foco': 'Acercamiento lento al punto de interés.', respirar: 'Zoom suave que respira.', 'paneo-izq': 'Recorrido lateral lento.', 'tilt-arriba': 'Sube mostrando la altura.', travelling: 'Barrido rápido que da sensación de avance.', 'tilt-abajo': 'Baja recorriendo la escena.', brillo: 'Destello de luz que da valor.', viento: 'Balanceo como el viento.', flotar: 'Flota suavemente.', diagonal: 'Recorrido diagonal.' };
  return { tipo: r[1], descripcion: 'Según el texto, la imagen probablemente muestra ' + r[1] + '.', foco: { x: r[6], y: r[7] }, personas: r[1] === 'personas', sinVision: true, propuestas: [mk(r[2], r[3], por[r[2]]), mk(r[4], 'lento', por[r[4]]), mk(r[5], 'lento', por[r[5]])] };
}/* ---- Videos que no se pueden reproducir: detectar el motivo y ofrecer una salida ---- */
const ERR_YT = { 2: 'El enlace del video no es válido.', 5: 'El navegador no pudo reproducir este video.', 100: 'El video fue eliminado o es privado.', 101: 'El autor no permite reproducir este video fuera de YouTube.', 150: 'El autor no permite reproducir este video fuera de YouTube.', 153: 'YouTube no pudo cargar el reproductor.' };
function vigilarVideos() {
  document.querySelectorAll('.st-vid iframe:not([data-vig]), .doc.v iframe:not([data-vig])').forEach(f => {
    f.dataset.vig = '1'; if (!/youtube/.test(f.src)) return;
    const hs = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) { } };
    f.addEventListener('load', () => { hs(); setTimeout(hs, 700); setTimeout(hs, 2200); });
  });
}
window.addEventListener('message', ev => {
  if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(ev.origin)) return;
  let d; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (e) { return; }
  if (!d || d.event !== 'onError') return;
  const f = [...document.querySelectorAll('iframe')].find(x => x.contentWindow === ev.source); if (!f) return;
  const code = Number(d.info);
  if (code === 153 && !f.dataset.fb) { f.dataset.fb = '1'; f.src = f.src.replace('youtube-nocookie.com', 'youtube.com'); return; }   // reintento con el dominio normal
  const box = f.closest('.st-vid, .doc'); if (!box || box.querySelector('.vid-err')) return;
  const id = (/embed\/([\w-]{11})/.exec(f.src) || [])[1] || '';
  box.insertAdjacentHTML('beforeend', `<div class="vid-err"><div class="ve-ic">⚠️</div><b>Este video no se puede reproducir aquí</b><p>${esc(ERR_YT[code] || 'YouTube no permitió reproducirlo.')}</p>${id ? `<a class="btn gold" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">▶ Abrir en YouTube</a>` : ''}<small>Sugerencia: elige otro video, o súbelo a tu Drive para incrustarlo.</small></div>`);
});/** Reduce el tamaño del texto de cada diapositiva hasta que quepa completo (nada se corta, ni arriba ni abajo). */
function ajustarDiapos(root) {
  (root || document).querySelectorAll('.stage').forEach(st => {
    const box = st.querySelector('.st-txt'); if (!box || !st.clientWidth) return;
    let fs = 1; st.style.setProperty('--fs', 1); let g = 0;
    while (g++ < 14 && fs > 0.38 && (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)) { fs -= 0.06; st.style.setProperty('--fs', fs.toFixed(2)); }
  });
}
(function () {
  let t; const pedir = () => { clearTimeout(t); t = setTimeout(() => { ajustarDiapos(); vigilarVideos(); }, 40); };
  const ini = () => { new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true }); window.addEventListener('resize', pedir); document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.stage')) pedir(); }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(pedir); pedir(); };
  if (document.body) ini(); else document.addEventListener('DOMContentLoaded', ini);
})();/** Busca imágenes libres en internet (Wikimedia Commons y Openverse). Devuelve [{src, thumb, credito}] */
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
  return '<div class="res-list">' + etqs.map((e, i) => {
    const ok = correcta === i; const pc = Math.round((cuentas[i] || 0) / t * 100);
    return `<div class="res-row ${ok ? 'ok' : ''} ${correcta >= 0 && !ok ? 'no' : ''}"><div class="res-ico t${i % 4}">${ok ? '✓' : FORMAS[i % 4]}</div><div class="res-main"><div class="res-top"><b class="res-et">${esc(e)}</b>${ok ? '<span class="res-tag">✔ Respuesta correcta</span>' : ''}<span class="res-n">${cuentas[i] || 0} · ${pc}%</span></div><div class="res-bar"><i class="t${i % 4}" style="width:${(cuentas[i] || 0) / max * 100}%"></i></div></div></div>`;
  }).join('') + '</div>';
}
/** Tarjeta destacada con la respuesta correcta, el % de acierto y la explicación. */
function bannerCorrecta(p, a, correcta) {
  let txt = '';
  if (p.tipo === 'opcion' && (p.opciones || [])[correcta] !== undefined) txt = 'ABCDEFGH'[correcta] + ') ' + p.opciones[correcta];
  else if (p.tipo === 'vf' && (correcta === 'V' || correcta === 'F')) txt = correcta === 'V' ? 'Verdadero' : 'Falso';
  else if (p.tipo === 'numerica' && correcta !== undefined && correcta !== null) txt = String(correcta);
  if (!txt) return '';
  return `<div class="res-banner"><div class="rb-ic">✅</div><div class="rb-tx"><div class="rb-t">Respuesta correcta</div><div class="rb-v">${esc(txt)}</div></div><div class="rb-pct"><b>${a && a.pctOk !== undefined ? a.pctOk : 0}%</b><span>acertó</span></div></div>${p.explicacion ? `<div class="res-expl">💡 ${esc(p.explicacion)}</div>` : ''}`;
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
  if (p.tipo === 'opcion' || p.tipo === 'encuesta') return (p.tipo === 'opcion' ? bannerCorrecta(p, a, correcta) : '') + h + barras((p.opciones || []).map((o, i) => 'ABCDEFGH'[i] + '. ' + o), a.cuentas || [], p.tipo === 'opcion' ? correcta : -1);
  if (p.tipo === 'vf') return bannerCorrecta(p, a, correcta) + h + barras(['Verdadero', 'Falso'], a.cuentas || [0, 0], correcta === 'V' ? 0 : correcta === 'F' ? 1 : -1);
  if (p.tipo === 'escala') return h + barras(['1 · Muy en desacuerdo', '2', '3', '4', '5 · Muy de acuerdo'], a.cuentas || [0, 0, 0, 0, 0], -1) + `<p class="c"><b>Promedio: ${a.media}</b></p>`;
  if (p.tipo === 'nube') return h + nubeHtml(a.palabras);
  if (p.tipo === 'numerica') { const vs = a.valores || []; return bannerCorrecta(p, a, correcta) + h + (vs.length ? barras(vs.map(v => 'Respondieron: ' + v.v), vs.map(v => v.n), vs.findIndex(v => Number(v.v) === Number(correcta))) : ''); }
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
