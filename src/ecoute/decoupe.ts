/**
 * Découpage des phrases par détection de voix (chantier 4, 20/10) : la même logique que la page web (jarvis.js,
 * listenChunk, revue le 20/10 sur la branche ecoute-ipad-fluide) et que salon.js, reprise pour le micro natif.
 *
 * - Le micro ne s'arrête jamais entre deux demandes : les morceaux arrivent sans fin (≈ 0,1 s chacun) ; un segment
 *   commence après deux morceaux « forts » (avec les 3 morceaux d'avant, pour ne pas couper le début du mot) et se
 *   termine après 0,7 s de calme.
 * - Segments gardés : 0,4 à 15 s de parole, dont au moins 0,25 s de voix ; au-delà de 15 s, c'est un fond sonore
 *   (télé, musique) : on attend un silence avant de reprendre.
 * - Le seuil suit le bruit de fond du lieu (×3, plafonné), jamais sous le seuil de la sensibilité choisie.
 * - Mode « parole » (bouton micro) : tout ce qui suit l'appui, jusqu'à 1 s de calme après la parole, 6 s sans
 *   parole (rien entendu) ou 20 s au plus ; comme le bouton « Parler » de la page.
 *
 * Fonctions pures, testées par `npm test` (node --test), sans iPhone.
 */
import { level } from "./wav.ts";

export type Sensibilite = "haute" | "normale" | "basse";

/** Seuils du micro natif. Plus bas que la page web (0,010 / 0,018 / 0,032) : la page reçoit un son relevé par le
 * gain automatique de Safari ; le micro natif (mode « mesure » d'iOS) donne le son brut. À régler à l'essai réel. */
// 20/10 au soir : rien n'a franchi 0,010 sur l'iPad Air (« Je n'ai rien entendu ») : seuils abaissés ; le seuil réel
// reste au moins 3 fois le bruit de fond appris, et le journal du PC reçoit les niveaux mesurés (diagnostic).
export const SEUILS: Record<Sensibilite, number> = { haute: 0.003, normale: 0.005, basse: 0.010 };
export const ORDRE: Sensibilite[] = ["haute", "normale", "basse"];

export const DECOUPE = {
  minS: 0.4, maxS: 15, finS: 0.7, avant: 3, voixMinS: 0.25, plafondFond: 0.08,
  parole: { finS: 1.0, rienS: 6, maxS: 20 },
};

export type Segment = { morceaux: Int16Array[]; parleS: number; voixS: number; force?: boolean };
export type Resultat =
  | { type: "segment"; segment: Segment }     // une phrase à envoyer
  | { type: "rien" }                           // bouton micro : rien entendu
  | { type: "debut" }                          // la parole commence (pour l'affichage)
  | null;

export class Decoupeur {
  rate: number;
  sens: Sensibilite;
  fond = 0.0015;                    // bruit de fond appris (départ bas : son brut du micro natif)
  private pre: Int16Array[] = [];
  private morceaux: Int16Array[] = [];
  private parle = false;
  private forts = 0;
  private total = 0;
  private calme = 0;
  private voix = 0;
  private attente = false;          // après une parole trop longue : attendre un silence
  private attenteCalme = 0;
  private parole = false;           // mode bouton micro
  dernierNiveau = 0;

  constructor(rate: number, sens: Sensibilite = "normale") {
    this.rate = rate;
    this.sens = sens;
  }

  /** Remise à zéro du segment en cours (le bruit de fond appris est gardé). */
  reset(): void {
    this.pre = []; this.morceaux = []; this.parle = false; this.forts = 0; this.total = 0; this.calme = 0; this.voix = 0;
  }

  /** Bouton micro : tout ce qui suit est la demande (avec les 0,3 s d'avant l'appui). */
  commencerParole(): void {
    const avant = this.pre.slice(-this.avantN());
    this.reset();
    this.parole = true; this.attente = false;
    this.morceaux = avant; this.total = avant.length * this.dureeMorceau(avant[0]);
  }

  /** Second appui sur le bouton : la demande part telle quelle (ou « rien entendu »). */
  finirParole(): Resultat {
    if (!this.parole) return null;
    this.parole = false;
    const morceaux = this.morceaux, voix = this.voix, parle = this.total;
    this.reset();
    return voix >= DECOUPE.voixMinS ? { type: "segment", segment: { morceaux, parleS: parle, voixS: voix, force: true } }
      : { type: "rien" };
  }

  annulerParole(): void { if (this.parole) { this.parole = false; this.reset(); } }

  enParole(): boolean { return this.parole; }

  seuil(): number {
    return Math.max(SEUILS[this.sens], Math.min(this.fond * 3, DECOUPE.plafondFond));
  }

  private dureeMorceau(c: Int16Array | undefined): number { return c ? c.length / this.rate : 0; }

  private avantN(): number { return DECOUPE.avant; }

  /** Un morceau du micro. Rend un segment terminé, « debut », « rien » (bouton micro), ou null. */
  morceau(chunk: Int16Array): Resultat {
    const niveau = level(chunk), s = chunk.length / this.rate;
    this.dernierNiveau = niveau;
    const fort = niveau > this.seuil();
    if (this.parole) return this.morceauParole(chunk, fort, s);
    if (this.attente) {
      this.attenteCalme = fort ? 0 : this.attenteCalme + s;
      if (this.attenteCalme >= DECOUPE.finS) this.attente = false;
      return null;
    }
    if (!this.parle) {
      if (!fort) this.fond = this.fond * 0.95 + niveau * 0.05;          // bruit de fond du lieu
      this.pre.push(chunk); if (this.pre.length > DECOUPE.avant) this.pre.shift();
      this.forts = fort ? this.forts + 1 : 0;
      if (this.forts >= 2) {
        this.parle = true; this.morceaux = this.pre; this.pre = [];
        this.total = this.morceaux.length * s; this.voix = 2 * s; this.calme = 0;
        return { type: "debut" };
      }
      return null;
    }
    this.morceaux.push(chunk); this.total += s;
    if (fort) { this.voix += s; this.calme = 0; } else this.calme += s;
    if (this.total - this.calme > DECOUPE.maxS) { this.reset(); this.attente = true; this.attenteCalme = 0; return null; }
    if (this.calme < DECOUPE.finS) return null;
    const morceaux = this.morceaux, parle = this.total - this.calme, voix = this.voix;
    this.reset();
    if (parle < DECOUPE.minS || voix < DECOUPE.voixMinS) return null;      // trop court : un bruit, pas une phrase
    // Le calme de la fin n'est pas envoyé (on garde 0,3 s), comme la page web.
    const garder = Math.max(1, morceaux.length - Math.floor((DECOUPE.finS - 0.3) / s));
    return { type: "segment", segment: { morceaux: morceaux.slice(0, garder), parleS: parle, voixS: voix } };
  }

  private morceauParole(chunk: Int16Array, fort: boolean, s: number): Resultat {
    this.morceaux.push(chunk); this.total += s;
    if (fort) { this.voix += s; this.calme = 0; this.parle = true; } else this.calme += s;
    const fin = (this.parle && this.calme >= DECOUPE.parole.finS) || this.total >= DECOUPE.parole.maxS;
    if (!this.parle && this.total >= DECOUPE.parole.rienS) { this.parole = false; this.reset(); return { type: "rien" }; }
    return fin ? this.finirParole() : null;
  }
}
