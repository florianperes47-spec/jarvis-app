/** Styles communs des écrans de l'appli, tirés du thème (src/theme/jetons.ts). */
import { StyleSheet } from "react-native";
import { theme } from "../theme/jetons";

const t = theme(), c = t.couleurs;

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fond },
  grow: { flex: 1 },
  pair: { flex: 1, alignSelf: "center", justifyContent: "center", gap: 12, padding: 16 },
  titre: { color: c.texte, fontSize: t.police.titre, letterSpacing: t.police.espacementTitre, fontWeight: "300",
    textAlign: "center", marginBottom: 8 },
  texte: { color: c.texte, fontSize: t.police.texte },
  aide: { color: c.doux, fontSize: t.police.aide, lineHeight: 19 },
  camera: { width: "100%", aspectRatio: 1, borderRadius: t.rayon.grand, overflow: "hidden" },
  champ: { color: c.texte, borderColor: c.bord, borderWidth: 1, borderRadius: t.rayon.moyen, padding: 14, fontSize: t.police.texte },
  ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  erreur: { color: c.alerte, fontSize: 14 },
  bouton: { backgroundColor: c.accent, borderRadius: 14, padding: 16, alignItems: "center" },
  boutonTexte: { color: c.accentTexte, fontSize: 17, fontWeight: "600" },
  lien: { color: c.accent, fontSize: 15, textAlign: "center", padding: 12 },
  coin: { position: "absolute", top: 0, right: 0, width: 44, height: 44 },
});
