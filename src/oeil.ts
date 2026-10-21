/**
 * L'œil de poche (lot 2b du 20/10) : la requête que l'appli native fera quand elle aura son écran « appareil photo ».
 * Prévue seulement : elle n'est PAS encore dans `PERMISES` (ecoute/routes.ts), donc la passerelle de la vue web la
 * refuse tant que l'écran n'existe pas. En attendant, la page web de l'iPhone a déjà son bouton 📷 (jarvis-oeil.js).
 *
 * Contrat du serveur (src/jarvis/ui/lot2b_web.py) :
 * - GET  api/oeil → { actif, taille_max_mo, cote_max_px } ; ne montrer le bouton que si `actif` ;
 * - POST api/oeil?audio=1, corps = la photo BRUTE en JPEG (jamais un formulaire multipart), réduite par l'appli à
 *   `cote_max_px` de côté (ce qui retire aussi les métadonnées et la position GPS), en-têtes `X-Jarvis: 1` et
 *   `X-Oeil-Question` (encodée en URI, facultative) → { reply, usd, audio?, flux? } ou { error }.
 * Mode perso (Flo) seulement : jamais en mode foyer (le Jarvis du foyer ferme la route).
 * Rien n'est gardé : ni dans l'appli (la photo n'est pas enregistrée dans la photothèque), ni sur le PC.
 */
import type { Mode } from "./adresse.ts";
import type { Requete } from "./ecoute/routes.ts";

export function oeil(mode: Mode): Requete | null {
  return mode === "foyer" ? null : { chemin: "api/oeil?audio=1", methode: "POST", type: "image/jpeg" };
}

export function oeilEtat(mode: Mode): Requete | null {
  return mode === "foyer" ? null : { chemin: "api/oeil", methode: "GET" };
}

export function enTetesOeil(question: string): Record<string, string> {
  return { "X-Jarvis": "1", "Content-Type": "image/jpeg", "X-Oeil-Question": encodeURIComponent(question.trim()) };
}
