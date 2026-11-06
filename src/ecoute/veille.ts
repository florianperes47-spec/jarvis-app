/**
 * Règles pures de la veille du mot sur l'appareil (06/11), testées sans iPhone (tests/eveil.test.mjs) ; le module
 * natif est dans natif/eveil.ts.
 */
/** Sensibilité du réglage → seuil du score (0-1). Mesuré sur le banc : banc/eveil/banc_eveil.py. */
export const SEUILS_EVEIL = { haute: 0.3, normale: 0.5, basse: 0.7 } as const;

/** base64 de PCM int16 (petit-boutiste) → Int16Array. */
export function pcmDeBase64(b64: string): Int16Array {
  const bin = globalThis.atob(b64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new Int16Array(octets.buffer, 0, Math.floor(octets.length / 2));
}

/** Les dernières `secondes` d'un PCM (pour garder la fin de « Jarvis » et le début de la phrase qui suit). */
export function fin(pcm: Int16Array, secondes: number, rate = 16000): Int16Array {
  const n = Math.min(pcm.length, Math.round(secondes * rate));
  return pcm.slice(pcm.length - n);
}

/**
 * Le micro de l'appareil doit-il veiller (module natif) maintenant ? Seulement quand rien d'autre n'a le micro ni le
 * son : ni Jarvis qui parle, ni son de la page, ni phrase en cours, ni conversation ouverte, ni demande en attente
 * (dans ces cas l'écoute d'avant reprend la main, inchangée).
 */
export function veilleVoulue(e: { reglage: boolean; disponible: boolean; actif: boolean; permis: boolean; parle: boolean;
  sonDePage: boolean; premierPlan: boolean; arrierePlan: boolean; enParole: boolean; conversation: boolean;
  occupe: boolean; reveille: boolean }): boolean {
  if (!e.reglage || !e.disponible || !e.actif || !e.permis) return false;
  if (e.parle || e.sonDePage || e.conversation || e.occupe) return false;
  if (!e.premierPlan && !e.arrierePlan) return false;
  return e.reveille || !e.enParole;              // après le mot, le module garde le micro jusqu'à la fin de la phrase
}
