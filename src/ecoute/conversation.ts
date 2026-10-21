/**
 * Conduite de l'écoute continue native (chantier 4, 20/10) : quoi envoyer, quand, et que faire de la réponse du PC.
 * Mêmes règles que la page web (jarvis.js du 20/10, branche ecoute-ipad-fluide) et le PC (jarvis.ecoute) :
 * - le PC ne répond qu'à « Jarvis, … » (au salon comme chez Flo), ou à une suite dite pendant la conversation
 *   ouverte (30 s après chaque réponse, ou après « Jarvis » seul) : `suite=1` ;
 * - réponses possibles : {ignore[, bruit]}, {nom}, {stop}, ou {heard, reply, audio?, flux?, morceaux?, vue?} ;
 * - limite de débit : 1,2 s entre deux envois, 15 par minute (le salon : 20 côté PC) ;
 * - pas de coupure entre deux demandes : un segment capté pendant que le PC traite le précédent attend (un seul) et
 *   part juste après si le précédent n'a rien donné (« Jarvis »… puis « mets YouTube » dit trop vite) ;
 * - trop de faux déclenchements (plus de 5 par minute) : la sensibilité baisse d'un cran, et revient après 2 min.
 * Fonctions pures (l'heure est passée en paramètre), testées par `npm test`.
 */
import { ORDRE, type Sensibilite } from "./decoupe.ts";

export const CONVERSATION = {
  suiteMs: 30_000, ecartMs: 1200, parMinute: 15, fauxParMinute: 5, reduiteMs: 120_000, erreursMax: 3,
};

export type Reponse = {
  ignore?: boolean; bruit?: boolean; debit?: boolean; nom?: boolean; stop?: boolean; heard?: string; reply?: string;
  audio?: string | null; flux?: string; morceaux?: number; premier?: Record<string, unknown> | null;
  vue?: { name: string; data: unknown }; error?: string;
};

/** Ce que l'appli doit faire d'une réponse. */
export type Suite =
  | { faire: "rien" }                                    // ignoré : on continue d'écouter
  | { faire: "ecoute" }                                  // « Jarvis » seul : « Je t'écoute… », conversation ouverte
  | { faire: "stop" }                                    // « stop » : la réponse en cours se tait
  | { faire: "repondre"; texte: string; entendu: string } // jouer la réponse, puis conversation ouverte
  | { faire: "erreur"; message: string; arret: boolean };

export class Conversation {
  suiteJusque = 0;
  private dernierEnvoi = 0;
  private envois: number[] = [];
  private faux: number[] = [];
  reduite: Sensibilite | null = null;
  private reduiteA = 0;
  private erreurs = 0;

  /** Conversation ouverte : une phrase sans « Jarvis » est une suite. */
  ouverte(now: number): boolean { return now < this.suiteJusque; }

  ouvrir(now: number): void { this.suiteJusque = now + CONVERSATION.suiteMs; }

  fermer(): void { this.suiteJusque = 0; }

  /** Secondes de conversation ouverte qui restent (pour l'affichage). */
  reste(now: number): number { return Math.max(0, Math.ceil((this.suiteJusque - now) / 1000)); }

  /** Limite de débit (le bouton micro n'y est pas soumis). */
  peutEnvoyer(now: number): boolean {
    this.envois = this.envois.filter((t) => now - t < 60_000);
    return now - this.dernierEnvoi >= CONVERSATION.ecartMs && this.envois.length < CONVERSATION.parMinute;
  }

  noterEnvoi(now: number): void { this.dernierEnvoi = now; this.envois.push(now); }

  /** La sensibilité en service : celle choisie, ou un cran de moins après trop de bruit (2 min). */
  sensibilite(choisie: Sensibilite, now: number): Sensibilite {
    if (this.reduite && now - this.reduiteA > CONVERSATION.reduiteMs) this.reduite = null;
    return this.reduite ?? choisie;
  }

  /** Un faux déclenchement (le PC n'a entendu que du bruit). Rend vrai si la sensibilité vient de baisser. */
  faux_declenchement(choisie: Sensibilite, now: number): boolean {
    this.faux = this.faux.filter((t) => now - t < 60_000);
    this.faux.push(now);
    if (this.faux.length <= CONVERSATION.fauxParMinute) return false;
    this.faux = [];
    const i = ORDRE.indexOf(this.sensibilite(choisie, now));
    if (i >= ORDRE.length - 1) return false;
    this.reduite = ORDRE[i + 1]; this.reduiteA = now;
    return true;
  }

  /** La réponse du PC → ce qu'il faut faire. `ok` : statut HTTP 2xx. */
  lire(rep: Reponse, ok: boolean, now: number, choisie: Sensibilite = "normale"): Suite {
    if (!ok || rep.error) {
      this.erreurs += 1;
      const arret = this.erreurs >= CONVERSATION.erreursMax;
      return { faire: "erreur", message: rep.error || "Le PC ne répond pas.", arret };
    }
    this.erreurs = 0;
    if (rep.ignore) {
      if (rep.bruit) this.faux_declenchement(choisie, now);
      return { faire: "rien" };
    }
    if (rep.nom) { this.ouvrir(now); return { faire: "ecoute" }; }
    if (rep.stop) return { faire: "stop" };
    return { faire: "repondre", texte: String(rep.reply || ""), entendu: String(rep.heard || "") };
  }
}

/** Le segment capté pendant que le PC traitait le précédent : part-il après la réponse ? */
export function envoyerEnAttente(suite: Suite): boolean {
  return suite.faire === "rien" || suite.faire === "ecoute" || suite.faire === "erreur";
}
