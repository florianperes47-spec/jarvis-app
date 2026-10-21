/**
 * Le petit widget iOS « Commandes » de l'ambiance Jarvis Flo (Constellation, 20/10) : PRÉPARATION, code seulement.
 * Liste validée par Flo (docs/chantiers/WIDGETS_COMMANDES_2026-10-20.md, README de design/handoff_flo) : sur l'écran
 * d'accueil et l'écran verrouillé, SEULEMENT Écrans (tout éteindre / tout rallumer), Micro privé et Je pars.
 * **Jamais de PowerShell** à ces endroits (ni bouton, ni lien, ni intention).
 *
 * Branchement, sans nouvelle route serveur : un bouton = une phrase déjà en service, envoyée par l'appli comme
 * « Écrire à Jarvis » (`/api/text`, avec les confirmations du serveur). L'intention du widget (Swift, dans
 * `targets/widgets-jarvis`) ouvre l'appli sur le lien `jarvis://dire?texte=…` que `src/raccourcis.ts` lit déjà.
 * Micro privé : aucune commande côté Jarvis le 20/10 ; le bouton est grisé avec la raison, jamais simulé.
 *
 * Le Swift recopie ces phrases à la main : `tests/widgets.test.mjs` vérifie que les deux disent la même chose.
 * Fonctions pures, testées par `npm test`.
 */
import { lireLien, SCHEME } from "../raccourcis.ts";

export type IdCommande = "ecrans-eteindre" | "ecrans-rallumer" | "micro-prive" | "je-pars";

export type CommandeWidget = {
  id: IdCommande;
  /** Texte de la tuile (systemSmall). */
  titre: string;
  /** Texte très court (accessoryRectangular, écran verrouillé). */
  court: string;
  /** Symbole SF (le même dans le Swift). */
  symbole: string;
  /** Phrase envoyée à Jarvis ; null quand la commande n'existe pas côté Jarvis. */
  phrase: string | null;
  /** false : tuile grisée, aucune action. */
  active: boolean;
  /** Pourquoi la tuile est grisée (vide si active). */
  raison: string;
};

/** Phrases comprises par le Jarvis de Flo le 20/10 (intentions/commandes_pc.py et intentions/routines.py). */
export const PHRASES_EN_SERVICE = ["éteins les écrans", "rallume les écrans", "je pars"] as const;

export const RAISON_MICRO = "Pas encore de commande côté Jarvis.";

export const COMMANDES_WIDGET: readonly CommandeWidget[] = [
  { id: "ecrans-eteindre", titre: "Éteindre les écrans", court: "Éteindre", symbole: "display",
    phrase: "éteins les écrans", active: true, raison: "" },
  { id: "ecrans-rallumer", titre: "Rallumer les écrans", court: "Rallumer", symbole: "sun.max",
    phrase: "rallume les écrans", active: true, raison: "" },
  { id: "micro-prive", titre: "Micro privé", court: "Micro", symbole: "mic.slash",
    phrase: null, active: false, raison: RAISON_MICRO },
  { id: "je-pars", titre: "Je pars", court: "Je pars", symbole: "arrow.right",
    phrase: "je pars", active: true, raison: "" },
];

/** Les familles du widget : petit carré de l'accueil, rectangle de l'écran verrouillé. Rien d'autre. */
export const FAMILLES = ["systemSmall", "accessoryRectangular"] as const;

/** Ce qui ne doit JAMAIS apparaître dans les écrans natifs (widget, écran verrouillé, Activité en direct). */
export const INTERDIT = /power\s*shell|pwsh|\.ps1\b|cmd\.exe|invoke-expression|\biex\b/i;

/** Le lien qui ouvre l'appli et envoie la phrase (route `/api/text`, comme « Écrire à Jarvis »). */
export function lienDire(phrase: string): string {
  return `${SCHEME}://dire?texte=${encodeURIComponent(phrase)}`;
}

/** Le lien d'une commande du widget ; null pour une tuile grisée. */
export function lienCommande(c: CommandeWidget): string | null {
  return c.active && c.phrase ? lienDire(c.phrase) : null;
}

/** Les erreurs de la liste (vide = bonne). Sert aux essais et à toute future liste. */
export function verifier(liste: readonly CommandeWidget[] = COMMANDES_WIDGET): string[] {
  const erreurs: string[] = [];
  const ids = new Set<string>();
  for (const c of liste) {
    if (ids.has(c.id)) erreurs.push(`${c.id} : en double`);
    ids.add(c.id);
    if (INTERDIT.test(JSON.stringify(c))) erreurs.push(`${c.id} : PowerShell interdit dans le widget`);
    if (c.active) {
      if (!c.phrase) { erreurs.push(`${c.id} : active sans phrase`); continue; }
      if (!(PHRASES_EN_SERVICE as readonly string[]).includes(c.phrase)) erreurs.push(`${c.id} : phrase pas en service`);
      const o = lireLien(lienDire(c.phrase));
      if (!o || o.ordre !== "dire" || o.texte !== c.phrase) erreurs.push(`${c.id} : lien illisible par l'appli`);
      if (c.raison) erreurs.push(`${c.id} : active avec une raison de grisé`);
    } else {
      if (c.phrase) erreurs.push(`${c.id} : grisée mais avec une phrase (ce serait simulé)`);
      if (!c.raison) erreurs.push(`${c.id} : grisée sans explication`);
    }
  }
  return erreurs;
}
