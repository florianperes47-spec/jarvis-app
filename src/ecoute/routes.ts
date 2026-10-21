/**
 * Les routes du PC utilisées par l'écoute native (chantier 4, 20/10), sans rien changer au serveur :
 * - mode perso (Flo, plus tard un proche) : /api/ecoute (écoute continue), /api/voice (bouton micro), /api/flux (son de
 *   la réponse, morceau par morceau), /api/text (raccourci « dire ») ; `speak=0` : la réponse est dite par l'appli,
 *   pas par les enceintes du PC ;
 * - mode foyer (iPad du salon) : /api/salon/ecoute, /api/salon/voix, /api/salon/flux : aucune route perso.
 * Chemins relatifs à l'adresse appairée (la vue web les appelle avec son cookie de session).
 */
import type { Mode } from "../adresse.ts";

export type Requete = { chemin: string; methode: "GET" | "POST"; type?: string };

export function ecoute(mode: Mode, suite: boolean): Requete {
  const s = suite ? "1" : "0";
  return mode === "foyer"
    ? { chemin: `api/salon/ecoute?suite=${s}`, methode: "POST", type: "audio/wav" }
    : { chemin: `api/ecoute?speak=0&suite=${s}`, methode: "POST", type: "audio/wav" };
}

export function parler(mode: Mode): Requete {
  return mode === "foyer"
    ? { chemin: "api/salon/voix", methode: "POST", type: "audio/wav" }
    : { chemin: "api/voice?speak=0", methode: "POST", type: "audio/wav" };
}

export function flux(mode: Mode, id: string, n: number): Requete {
  const q = `id=${encodeURIComponent(id)}&n=${n}`;
  return { chemin: mode === "foyer" ? `api/salon/flux?${q}` : `api/flux?${q}`, methode: "GET" };
}

export function texte(mode: Mode): Requete {
  return mode === "foyer"
    ? { chemin: "api/salon/texte", methode: "POST", type: "application/json" }
    : { chemin: "api/text", methode: "POST", type: "application/json" };
}

/** Tableau de bord (mode perso seulement : notifications locales). */
export const TABLEAU: Requete = { chemin: "api/dashboard", methode: "GET" };

/** Seules routes que la passerelle de la vue web accepte d'appeler pour l'appli. */
export const PERMISES: Record<Mode, RegExp> = {
  perso: /^api\/(ecoute\?speak=0&suite=[01]|voice\?speak=0|flux\?id=[\w%.-]+&n=\d+|text|dashboard)$/,
  foyer: /^api\/salon\/(ecoute\?suite=[01]|voix|flux\?id=[\w%.-]+&n=\d+|texte)$/,
};

export function permise(mode: Mode, chemin: string): boolean {
  return PERMISES[mode].test(chemin);
}

/** Corps JSON en octets (UTF-8) : il passe par la passerelle comme un son. */
export function corpsJson(objet: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(objet));
}
