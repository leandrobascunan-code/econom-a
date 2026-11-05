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
function descargarBase64(nombre, b64, tipo = 'application/pdf') {
  const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([a], { type: tipo }));
  const l = document.createElement('a'); l.href = url; l.download = nombre; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
