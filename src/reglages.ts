/**
 * Ce que l'appli garde (chantier 4) : dans le trousseau de l'iPhone (SecureStore), jamais dans le code ni dans git.
 * - l'adresse Tailscale appairée et le mode (perso ou foyer), tirés du code QR ;
 * - les réglages de Flo (écran allumé, écoute continue, sensibilité, micro toujours prêt, arrière-plan,
 *   notifications).
 * AUCUN jeton : la session est le cookie de la page (posé par le code QR à usage unique, gardé par la vue web).
 * Re-appairage : un nouveau code QR remplace l'adresse et le mode (`oublier` efface tout).
 * Aperçu web (captures sans iPhone) : pas de trousseau, réglages en mémoire, appairage simulé par `?apercu=`.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Mode } from "./adresse";
import type { Sensibilite } from "./ecoute/decoupe";
import { migrer, VERSION } from "./reglagesVersion";

export type Reglages = {
  address: string; mode: Mode;
  awake: boolean;            // écran toujours allumé (toujours vrai en foyer)
  continu: boolean;          // écoute continue « Jarvis, … »
  sens: Sensibilite;
  pret: boolean;             // micro toujours prêt (perso) : le bouton micro part sans délai
  arrierePlan: boolean;      // écoute en arrière-plan et écran verrouillé (development build seulement)
  notifs: boolean;           // notifications locales (perso)
  microPage: boolean;        // secours : la page garde son propre micro (comme avant l'appli native)
};

const K = {
  address: "jarvis.adresse", mode: "jarvis.mode", awake: "jarvis.ecran_allume", continu: "jarvis.ecoute_continue",
  sens: "jarvis.sensibilite", pret: "jarvis.micro_pret", arrierePlan: "jarvis.arriere_plan", notifs: "jarvis.notifications",
  microPage: "jarvis.micro_page", version: "jarvis.reglages_version",
} as const;

const WEB = Platform.OS === "web";
const memoire = new Map<string, string>();

async function get(k: string): Promise<string | null> {
  if (WEB) return memoire.get(k) ?? null;
  return SecureStore.getItemAsync(k);
}

async function set(k: string, v: string): Promise<void> {
  if (WEB) { memoire.set(k, v); return; }
  await SecureStore.setItemAsync(k, v);
}

/** Valeurs par défaut : notifications ; écoute continue, micro toujours prêt et arrière-plan COUPÉS (23/10, lot 4 :
 * le micro ne s'ouvre qu'à l'appui, Flo choisit l'écoute continue dans les Réglages). */
export function defaut(address: string, mode: Mode): Reglages {
  return { address, mode, awake: mode === "foyer", continu: false, sens: "normale", pret: false, arrierePlan: false,
    notifs: mode === "perso", microPage: false };
}

export async function charger(): Promise<Reglages | null> {
  if (WEB) return apercu();
  const address = (await get(K.address)) || "";
  const mode = (await get(K.mode)) as Mode | null;
  if (!address || (mode !== "perso" && mode !== "foyer")) return null;
  const r = defaut(address, mode);
  const oui = async (k: string, d: boolean) => { const v = await get(k); return v === null ? d : v === "1"; };
  const sens = await get(K.sens);
  const version = Number(await get(K.version)) || 1;
  const lus: Reglages = {
    ...r,
    awake: mode === "foyer" ? true : await oui(K.awake, r.awake),
    continu: await oui(K.continu, r.continu),
    sens: sens === "haute" || sens === "basse" || sens === "normale" ? sens : r.sens,
    pret: await oui(K.pret, r.pret),
    arrierePlan: await oui(K.arrierePlan, r.arrierePlan),
    notifs: mode === "perso" && await oui(K.notifs, r.notifs),
    microPage: await oui(K.microPage, r.microPage),
  };
  const finaux = migrer(lus, version);
  if (version < VERSION) {
    await set(K.continu, finaux.continu ? "1" : "0"); await set(K.pret, finaux.pret ? "1" : "0");
    await set(K.version, String(VERSION));
  }
  return finaux;
}

export async function enregistrer(r: Reglages): Promise<void> {
  await set(K.address, r.address);
  await set(K.mode, r.mode);
  for (const k of ["awake", "continu", "pret", "arrierePlan", "notifs", "microPage"] as const) await set(K[k], r[k] ? "1" : "0");
  await set(K.sens, r.sens);
  await set(K.version, String(VERSION));        // un choix fait dans les Réglages n'est jamais re-migré
}

/** Nouvel appairage : l'ancienne adresse et le mode sont oubliés (le nouveau code QR les remplace). */
export async function oublier(): Promise<void> {
  if (WEB) { memoire.clear(); return; }
  for (const k of Object.values(K)) await SecureStore.deleteItemAsync(k);
}

/** Aperçu web : `?apercu=perso|foyer` simule un appareil appairé (adresse factice, rien n'est appelé). */
function apercu(): Reglages | null {
  const q = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("apercu");
  if (q !== "perso" && q !== "foyer") return null;
  return defaut("https://apercu.exemple.ts.net", q);
}
