/**
 * Mot d'éveil sur l'appareil (06/11, module natif modules/jarvis-eveil) : le micro reste dans l'iPhone ou l'iPad,
 * rien ne part au hub avant « Jarvis ». Absent (Expo Go, web, ancienne IPA) : `disponible()` est faux et l'appli
 * garde son écoute d'avant (le hub décide du mot).
 */
import { requireOptionalNativeModule } from "expo";

export { fin, pcmDeBase64, SEUILS_EVEIL, veilleVoulue } from "../ecoute/veille";

export type EtatEveil = { etat: "ecoute" | "arret" | "coupe" | "mesure"; raison: string; msMoyen?: number; msPire?: number;
  morceaux?: number };
export type Reveil = { score: number; avant: string; msChaine: number };

type Abonnement = { remove(): void };
type Module = {
  demarrer(seuil: number, modele: string): Promise<void>;
  arreter(): void;
  flux(actif: boolean): void;
  reglerSeuil(seuil: number): void;
  actif(): boolean;
  autoControle(extraits: string[], modele: string): Promise<number[]>;
  addListener(evenement: "eveil", f: (r: Reveil) => void): Abonnement;
  addListener(evenement: "pcm", f: (p: { b64: string }) => void): Abonnement;
  addListener(evenement: "etat", f: (e: EtatEveil) => void): Abonnement;
};

const NATIF = requireOptionalNativeModule<Module>("JarvisEveil");

/** Le modèle du mot embarqué (06/11 : « hey jarvis » d'openWakeWord ; « jarvis_fr » quand il sera entraîné). */
export const MODELE = "hey_jarvis_v0.1.onnx";

export function disponible(): boolean {
  return NATIF != null;
}

export const eveil = {
  demarrer: (seuil: number) => NATIF ? NATIF.demarrer(seuil, MODELE) : Promise.reject(new Error("module absent")),
  arreter: () => { NATIF?.arreter(); },
  flux: (actif: boolean) => { NATIF?.flux(actif); },
  actif: () => NATIF?.actif() ?? false,
  autoControle: (extraits: string[]) => NATIF ? NATIF.autoControle(extraits, MODELE) : Promise.resolve([]),
  surEveil: (f: (r: Reveil) => void): Abonnement => NATIF ? NATIF.addListener("eveil", f) : { remove() {} },
  surPcm: (f: (p: { b64: string }) => void): Abonnement => NATIF ? NATIF.addListener("pcm", f) : { remove() {} },
  surEtat: (f: (e: EtatEveil) => void): Abonnement => NATIF ? NATIF.addListener("etat", f) : { remove() {} },
};
