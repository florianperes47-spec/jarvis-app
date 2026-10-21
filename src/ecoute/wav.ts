/**
 * Sons de l'écoute native (chantier 4, 20/10) : le micro donne des morceaux PCM 16 bits mono ; le PC attend un WAV
 * 16 kHz mono 16 bits (routes /api/ecoute, /api/voice, /api/salon/ecoute, /api/salon/voix). Fonctions pures, sans
 * React Native, testées par `npm test` (node --test).
 */

export const RATE = 16000;

/** Le niveau (RMS, de 0 à 1) d'un morceau, un échantillon sur quatre comme la page web. */
export function level(chunk: Int16Array): number {
  let sum = 0, n = 0;
  for (let i = 0; i < chunk.length; i += 4) { const v = chunk[i] / 32768; sum += v * v; n += 1; }
  return n ? Math.sqrt(sum / n) : 0;
}

/** Ramène des morceaux à 16 kHz (le plus proche voisin, comme la page web), mis bout à bout. */
export function joinAt16k(chunks: Int16Array[], rate: number): Int16Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const input = new Int16Array(total);
  let at = 0;
  for (const c of chunks) { input.set(c, at); at += c.length; }
  if (rate === RATE) return input;
  const ratio = rate / RATE, out = new Int16Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)];
  return out;
}

/** Un WAV 16 kHz mono 16 bits (en-tête de 44 octets). */
export function wav16k(chunks: Int16Array[], rate: number): Uint8Array {
  const pcm = joinAt16k(chunks, rate);
  const bytes = new Uint8Array(44 + pcm.length * 2), view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => { for (let k = 0; k < s.length; k++) view.setUint8(at + k, s.charCodeAt(k)); };
  text(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return bytes;
}

/** Durée (s) d'un WAV 16 kHz mono 16 bits fait par wav16k. */
export function seconds(wav: Uint8Array): number {
  return Math.max(0, wav.length - 44) / 2 / RATE;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 sans dépendance (Hermes n'a pas Buffer) : le WAV passe par la vue web, qui l'envoie au PC. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}

/** 20/10 au soir (essai sur l'iPad Air) : le flux natif d'Expo Go peut livrer un autre format que celui demandé ;
 * on demande donc le format par défaut (float32, de −1 à 1) et on le ramène ici en int16 mono : plusieurs canaux
 * (micros de l'iPad) → leur moyenne. `int16` reste lu tel quel. */
export type Encodage = "float32" | "int16";

export function versPcm16(data: ArrayBuffer, encodage: Encodage, canaux = 1): Int16Array {
  const n = Math.max(1, Math.floor(canaux || 1));
  const src = encodage === "float32"
    ? new Float32Array(data.slice(0, data.byteLength - (data.byteLength % 4)))
    : new Int16Array(data.slice(0, data.byteLength - (data.byteLength % 2)));
  const out = new Int16Array(Math.floor(src.length / n));
  const echelle = encodage === "float32" ? 32767 : 1;
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let c = 0; c < n; c++) s += src[i * n + c];
    out[i] = Math.max(-32768, Math.min(32767, Math.round((s / n) * echelle)));
  }
  return out;
}

/** Le son brut du micro natif est faible (pas de gain automatique comme dans Safari) : la phrase est remontée avant
 * l'envoi, sa crête portée vers `cible` (0,7 = −3 dBFS), sans dépasser `gainMax`. Jamais d'écrêtage. */
export function normaliser(morceaux: Int16Array[], cible = 0.7, gainMax = 8): Int16Array[] {
  let crete = 0;
  for (const m of morceaux) for (let i = 0; i < m.length; i++) crete = Math.max(crete, Math.abs(m[i]));
  if (!crete) return morceaux;
  const gain = Math.min(gainMax, (cible * 32767) / crete);
  if (gain <= 1.05) return morceaux;
  return morceaux.map((m) => Int16Array.from(m, (v) => Math.max(-32768, Math.min(32767, Math.round(v * gain)))));
}

/** Morceau PCM reçu du micro natif (ArrayBuffer int16 little-endian) → Int16Array (copie alignée). */
export function pcm16(data: ArrayBuffer): Int16Array {
  return new Int16Array(data.slice(0, data.byteLength - (data.byteLength % 2)));
}
