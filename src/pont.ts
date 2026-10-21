/**
 * Passerelle entre l'appli et la page Jarvis affichée dans la vue web (chantier 4, 20/10).
 *
 * Pourquoi : la session de la page est un cookie `jarvis_session` (httponly) posé par le code QR dans la vue web ;
 * l'appli n'a AUCUN jeton. Les envois du micro natif passent donc par la page elle-même (fetch « same-origin »), qui
 * rend la réponse JSON à l'appli. Rien d'autre : seules les routes de `routes.ts` sont permises, vérifiées des deux
 * côtés (ici et dans le script injecté).
 *
 * Le script injecté dans la page (avant son chargement) :
 * - `__jarvisPont.req(id, chemin, methode, base64, type)` : appelle le PC avec le cookie, rend {id, ok, status, data} ;
 * - micro tenu par l'appli : la page ne peut plus ouvrir le micro (getUserMedia refusé), ses boutons « Parler » et
 *   « Écoute continue » commandent le micro natif (un seul micro, jamais deux) ;
 * - son de la page (réponse écrite, recette, voix de secours) : la page demande d'abord le haut-parleur à l'appli,
 *   qui coupe le micro (Jarvis ne s'entend pas), puis le rend à la fin ;
 * - `__jarvisPont.afficher(entendu, reponse, vue)` : la page du téléphone montre la demande et la réponse
 *   (crochets JVEssai de jarvis.js s'ils existent ; sinon rien, l'appli les montre elle-même).
 * Fonctions pures, testées par `npm test` (le script est joué dans un faux navigateur).
 */
import type { Mode } from "./adresse.ts";
import { PERMISES, permise, type Requete } from "./ecoute/routes.ts";

/** Les boutons de la page repris par le micro natif. */
export const BOUTONS: Record<Mode, { parler: string; ecoute: string }> = {
  perso: { parler: "#btn-hold, [data-ecran-mic]", ecoute: "[data-ecoute]" },
  foyer: { parler: "#micro", ecoute: "[data-ecoute]" },
};

export type MessagePage =
  | { pont: string; id: number; ok: boolean; status: number; data: unknown }
  | { pont: string; evt: "parler" | "ecoute" | "son-fin" | "pret" }
  | { pont: string; evt: "son"; id: string };

/** Le script à injecter avant le chargement de la page. `nonce` : tiré au hasard par l'appli à chaque lancement. */
export function scriptPont(nonce: string, mode: Mode, micro: boolean): string {
  const permis = String(PERMISES[mode]);
  const b = BOUTONS[mode];
  return `(function () {
  if (window.__jarvisPont) return;
  var NONCE = ${JSON.stringify(nonce)}, PERMIS = ${permis}, MICRO = ${micro ? "true" : "false"};
  var DIAG = ${mode === "perso" ? "true" : "false"};
  var PARLER = ${JSON.stringify(b.parler)}, ECOUTE = ${JSON.stringify(b.ecoute)};
  function send(o) { o.pont = NONCE; if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function bytes(b64) { var s = atob(b64), out = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  var attente = {}, n = 0;
  function demanderSon() {
    if (!MICRO) return Promise.resolve();
    return new Promise(function (ok) {
      var id = "s" + (++n); attente[id] = ok; send({ evt: "son", id: id });
      setTimeout(function () { if (attente[id]) { delete attente[id]; ok(); } }, 600);
    });
  }
  var pont = {
    req: function (id, chemin, methode, b64, type) {
      if (!PERMIS.test(chemin)) { send({ id: id, ok: false, status: 0, data: { error: "Route refusée." } }); return; }
      var init = { method: methode, credentials: "same-origin", cache: "no-store", headers: { "X-Jarvis": "1" } };
      if (b64 != null) {
        init.headers["Content-Type"] = type;
        init.body = type === "application/json" ? new TextDecoder().decode(bytes(b64)) : bytes(b64);
      }
      fetch(chemin, init).then(function (r) {
        return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) {} send({ id: id, ok: r.ok, status: r.status, data: d }); });
      }).catch(function (e) { send({ id: id, ok: false, status: 0, data: { error: String((e && e.message) || e) } }); });
    },
    // 20/10 au soir : mesures du micro natif au journal du PC. Seule l'action « diag » peut partir d'ici (jamais
    // une autre action de /api/action), et seulement en mode Flo.
    diag: function (mesures) {
      if (!DIAG || !mesures || typeof mesures !== "object") return;
      var value = {}; for (var k in mesures) { if (Object.prototype.hasOwnProperty.call(mesures, k)) value[k] = mesures[k]; }
      value.son = "micro natif";
      fetch("api/action", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "X-Jarvis": "1", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "diag", value: value }) }).catch(function () {});
    },
    ack: function (id) { var f = attente[id]; if (f) { delete attente[id]; f(); } },
    micro: function (on) { MICRO = !!on; },
    afficher: function (entendu, reponse, vue) {
      var j = window.JVEssai; if (!j) return;
      try {
        if (entendu && j.setCaption) j.setCaption("user", entendu);
        if (reponse && j.setCaption) j.setCaption("jarvis", reponse);
        if (vue && vue.name && j.openView) j.openView(vue.name, vue.data);
      } catch (e) {}
    }
  };
  window.__jarvisPont = pont;
  var md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    var gum = md.getUserMedia.bind(md);
    md.getUserMedia = function (c) {
      if (MICRO && c && c.audio) return Promise.reject(new DOMException("Le micro est tenu par l'appli Jarvis.", "NotAllowedError"));
      return gum(c);
    };
  }
  var M = window.HTMLMediaElement && HTMLMediaElement.prototype, play = M && M.play;
  if (play) {
    M.play = function () {
      var el = this;
      if (!MICRO) return play.call(el);
      if (!el.__jarvisFin) { el.__jarvisFin = true; ["ended", "pause", "error"].forEach(function (e) { el.addEventListener(e, function () { send({ evt: "son-fin" }); }); }); }
      return demanderSon().then(function () { return play.call(el); });
    };
  }
  var ss = window.speechSynthesis;
  if (ss && ss.speak) {
    var speak = ss.speak.bind(ss);
    ss.speak = function (u) {
      if (!MICRO) return speak(u);
      var fin = function () { send({ evt: "son-fin" }); };
      demanderSon().then(function () { try { u.addEventListener("end", fin); u.addEventListener("error", fin); } catch (e) {} speak(u); });
    };
  }
  function prise(e) {
    if (!MICRO || !e.target || !e.target.closest) return;
    var parler = e.target.closest(PARLER), ecoute = !parler && e.target.closest(ECOUTE);
    if (!parler && !ecoute) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.type === "click") send({ evt: parler ? "parler" : "ecoute" });
  }
  ["pointerdown", "pointerup", "touchstart", "touchend", "click"].forEach(function (t) { document.addEventListener(t, prise, { capture: true, passive: false }); });
  send({ evt: "pret" });
})(); true;`;
}

/** L'appel à injecter pour une requête de l'appli, ou null si la route n'est pas permise. */
export function appel(mode: Mode, id: number, req: Requete, corps?: string): string | null {
  if (!permise(mode, req.chemin)) return null;
  const args = [id, req.chemin, req.methode, corps ?? null, req.type ?? null].map((v) => JSON.stringify(v)).join(", ");
  return `window.__jarvisPont && window.__jarvisPont.req(${args}); true;`;
}

/** Mesures du micro natif à écrire au journal du PC (action « diag » figée dans le script, mode Flo seulement). */
export function diag(mesures: Record<string, string | number | boolean>): string {
  return `window.__jarvisPont && window.__jarvisPont.diag(${JSON.stringify(mesures)}); true;`;
}

export function ack(id: string): string {
  return `window.__jarvisPont && window.__jarvisPont.ack(${JSON.stringify(id)}); true;`;
}

export function micro(on: boolean): string {
  return `window.__jarvisPont && window.__jarvisPont.micro(${on ? "true" : "false"}); true;`;
}

export function afficher(entendu: string, reponse: string, vue?: unknown): string {
  return `window.__jarvisPont && window.__jarvisPont.afficher(${JSON.stringify(entendu)}, ${JSON.stringify(reponse)}, ${JSON.stringify(vue ?? null)}); true;`;
}

/** Lit un message de la page ; null s'il ne vient pas de notre script (mauvais nonce, illisible). */
export function lire(raw: string, nonce: string): MessagePage | null {
  try {
    const m = JSON.parse(raw);
    return m && typeof m === "object" && m.pont === nonce ? (m as MessagePage) : null;
  } catch {
    return null;
  }
}

/** Un nonce pour la session de l'appli (pas un secret : il évite seulement de confondre des messages). */
export function nouveauNonce(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 16; i++) s += Math.floor(rand() * 36).toString(36);
  return s;
}
