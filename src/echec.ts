/**
 * 06/11 (Flo) : jamais un écran vide quand le hub est injoignable — la cause probable, en clair, d'après l'erreur
 * d'iOS (WKWebView / NSURLError). Testé sans iPhone : tests/echec.test.mjs.
 */
export type Echec = { cause: string; quoiFaire: string };

export function causeEchec(description: string): Echec {
  const d = description.toLowerCase();
  if (/hostname could not be found|cannot find host|-1003|nom d.?h[ôo]te|serveur.*introuvable/.test(d)) {
    return { cause: "Tailscale semble coupé : le nom du hub (…ts.net) ne répond pas.",
      quoiFaire: "Ouvre Tailscale et connecte-le, puis touche Réessayer." };
  }
  if (/not connected to the internet|offline|-1009|hors ligne|pas connecté/.test(d)) {
    return { cause: "L'appareil n'a pas de réseau (Wi-Fi ou 4G).", quoiFaire: "Rétablis le réseau, puis touche Réessayer." };
  }
  if (/timed out|-1001|délai|expir/.test(d)) {
    return { cause: "Le hub ne répond pas (délai dépassé) : éteint, en veille ou Tailscale en relais lent.",
      quoiFaire: "Vérifie que le mini-PC est allumé, puis touche Réessayer." };
  }
  if (/could not connect|connection refused|-1004|refus/.test(d)) {
    return { cause: "Le hub est joignable mais Jarvis n'y répond pas (service arrêté ou en redémarrage).",
      quoiFaire: "Attends une minute (redémarrage) puis touche Réessayer." };
  }
  if (/ssl|certificate|certificat|-120[0-9]/.test(d)) {
    return { cause: "Le certificat HTTPS du hub n'est pas accepté.", quoiFaire: "Signale-le à la session du mini-PC." };
  }
  return { cause: "Jarvis ne répond pas.", quoiFaire: "Vérifie que Tailscale est connecté et que le hub est allumé, puis touche Réessayer." };
}
