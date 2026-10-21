/**
 * Appairage et adresses de l'appli (chantier 4). Le MODE n'est jamais écrit en dur : il vient du code QR d'appairage
 * scanné au premier lancement.
 * - Code QR du téléphone (`jarvis telephone --qr`, chemin `/entree?c=…`) : mode « perso » (Flo sur son Jarvis, ou
 *   plus tard un proche sur le sien, port 8443) : l'interface du téléphone.
 * - Code QR de l'écran du salon (page `/salon/code` du PC, chemin `/salon/entree?c=…`) : mode « foyer » : la page du
 *   salon, aucune donnée de Flo, écran gardé allumé.
 * Tailscale seulement (https://<machine>.<tailnet>.ts.net), jamais Internet. Aucun jeton n'est gardé par l'appli : le
 * code à usage unique pose le cookie de session de la page, et seuls l'adresse et le mode vont dans le trousseau.
 * Fonctions pures, testées par `npm test` (node --test), sans iPhone.
 */

export type Mode = "perso" | "foyer";

export type Pairing = { address: string; entry: string; mode: Mode };

const ENTRIES: Record<string, Mode> = { "/entree": "perso", "/salon/entree": "foyer" };

/** Lit un code QR d'appairage. Rend l'appairage, ou un message d'erreur en français simple. */
export function readPairing(text: string): Pairing | string {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return "Ce code QR n'est pas un lien Jarvis.";
  }
  const problem = checkAddress(url.origin);
  if (problem) return problem;
  const mode = ENTRIES[url.pathname];
  if (!mode || !url.searchParams.get("c")) {
    return "Ce n'est pas un code d'appairage : affiche « jarvis telephone --qr » (perso) ou la page /salon/code (salon).";
  }
  return { address: url.origin, entry: url.toString(), mode };
}

/** Ce que la vue web charge au premier lancement, juste après le scan du code QR.
 * 20/10 au soir : sur le Jarvis de Flo, ouvrir le lien `/entree?c=…` ne consomme plus le code (l'aperçu du lien par
 * l'appareil photo d'iPadOS l'ouvrait une première fois) : la page montre seulement le bouton « Associer cet
 * appareil », et le code n'est consommé que par `POST /entree/associer`. L'appli, qui a scanné le code elle-même,
 * fait directement ce POST (le même que le bouton) : code à usage unique, valable une minute, vérifié et consommé par
 * le PC, qui pose le cookie de session puis renvoie vers « / ». Rien de plus n'est gardé par l'appli.
 * Le salon (`/salon/entree?c=…`) garde son lien, consommé à l'ouverture. */
export const ASSOCIER = "/entree/associer";

export type Source = { uri: string; method?: "POST"; body?: string; headers?: Record<string, string> };

export function entrySource(entry: string): Source {
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    return { uri: entry };
  }
  const code = url.searchParams.get("c");
  if (url.pathname !== "/entree" || !code) return { uri: entry };
  return {
    uri: url.origin + ASSOCIER, method: "POST", body: "c=" + encodeURIComponent(code),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
}

/** 21/10 au soir (IPA iloader) : le PC refuse la page (401/403) quand la vue web n'a plus le cookie de session
 * (appli fermée net juste après l'appairage, avant que iOS ait écrit le cookie ; appli réinstallée : le trousseau
 * garde l'adresse, la vue web a perdu le cookie). Avant, l'appli restait sur « Accès refusé » et la page du PC parlait
 * de Safari et d'écran d'accueil ; maintenant elle revient au scanner avec ce message. "" : pas un refus de session.
 * `appairage` : le refus vient du POST d'appairage lui-même (code périmé ou déjà servi). */
export function messageRefus(status: number, appairage: boolean): string {
  if (status !== 401 && status !== 403) return "";
  return appairage
    ? "Code périmé ou déjà servi : scanne le code tout neuf affiché par « jarvis telephone --qr » (une minute)."
    : "Ton Jarvis ne reconnaît plus cette appli (session perdue) : scanne un nouveau code QR, « jarvis telephone --qr » sur le PC.";
}

export function checkAddress(address: string): string {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return "Adresse illisible : elle commence par https://";
  }
  if (url.protocol !== "https:") return "L'adresse doit commencer par https:// (le micro de l'iPhone l'exige).";
  if (!url.hostname.endsWith(".ts.net")) return "Seulement une adresse Tailscale (…ts.net).";
  return "";
}

/** La page à ouvrir : celle du salon en mode foyer ; sinon l'interface, format téléphone sur un écran étroit (iPhone,
 * iPad en partage d'écran 1/3) et format large sur l'iPad plein écran. `micNatif` (20/10) : l'appli écoute elle-même
 * (micro natif) ; sinon, en secours, la page du salon garde son écoute continue (`?ecoute=continue`). */
export function startUrl(address: string, mode: Mode, widthPt: number, micNatif = false): string {
  const base = address.replace(/\/+$/, "");
  if (mode === "foyer") return micNatif ? `${base}/salon` : `${base}/salon?ecoute=continue`;
  return widthPt < NARROW_PT ? `${base}/?format=phone` : `${base}/`;
}

export const NARROW_PT = 700;      // iPhone 17 Pro Max : 440 ; iPad Air 13" au tiers : environ 320 à 440 ; moitié : 678

/** Même machine et même port que l'adresse appairée : la vue web y reste ; tout le reste part dans Safari. */
export function sameSite(address: string, target: string): boolean {
  if (target === "about:blank") return true;
  try {
    const a = new URL(address), b = new URL(target);
    return a.protocol === b.protocol && a.host === b.host;
  } catch {
    return false;
  }
}
