/**
 * Le logo JARVIS · PRS INDUSTRIE (choix de Flo, 23/10 ; dessin de la session design, le même que sur les pages) dans
 * les écrans de l'appli : chargement, appairage, Réglages, Jarvis injoignable. Image de l'appli (assets/), donc elle
 * part par la mise à jour OTA ; transparence tirée de la luminance (pas de rectangle sur le fond de l'appli).
 * L'icône et l'écran de démarrage natif, eux, sont dans app.json : nouvelle IPA.
 */
import { Image, useWindowDimensions } from "react-native";

const LOGO = require("../../assets/logo-jarvis.png");
const RATIO = 900 / 210;

export function Logo({ largeur = 300 }: { largeur?: number }) {
  const { width } = useWindowDimensions();
  const l = Math.min(largeur, width - 48);
  return <Image source={LOGO} style={{ width: l, height: l / RATIO, alignSelf: "center" }} resizeMode="contain"
    accessibilityRole="image" accessibilityLabel="Jarvis, PRS Industrie" />;
}
