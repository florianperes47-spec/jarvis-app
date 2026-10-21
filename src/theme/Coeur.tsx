/**
 * Le cœur animé de l'appli (indicateur d'écoute et bouton micro), entièrement réglé par le thème (jetons.ts) : un
 * autre design ne touche qu'à ce fichier et aux jetons. `leger` (iPad du salon, 2 Go) : pas d'animation, la couleur
 * seule dit l'état.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { type EtatCoeur, theme } from "./jetons.ts";

const LIBELLE: Record<EtatCoeur, string> = {
  arret: "Micro arrêté", ecoute: "J'écoute", parole: "Je t'écoute", reflechit: "Je réfléchis", parle: "Jarvis parle",
  pause: "En pause", erreur: "Problème",
};

export function Coeur({ etat, leger = false, taille, onPress, onLongPress }: {
  etat: EtatCoeur; leger?: boolean; taille?: number; onPress?: () => void; onLongPress?: () => void;
}) {
  const t = theme();
  const d = taille ?? t.coeur.taille;
  const echelle = useRef(new Animated.Value(1)).current;
  const pulse = leger ? null : t.coeur.pulsation[etat];
  useEffect(() => {
    if (!pulse) { echelle.setValue(1); return; }
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(echelle, { toValue: pulse.echelle, duration: pulse.ms / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(echelle, { toValue: 1, duration: pulse.ms / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [pulse, echelle]);
  const couleur = t.coeur.couleur[etat];
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={800} accessibilityRole="button"
      accessibilityLabel={`${LIBELLE[etat]}. Touche pour parler.`} hitSlop={8}>
      <Animated.View style={[styles.anneau, { width: d, height: d, borderRadius: d / 2, borderColor: couleur,
        transform: [{ scale: echelle }] }]}>
        <View style={{ width: d * 0.42, height: d * 0.42, borderRadius: d * 0.21, backgroundColor: couleur }} />
      </Animated.View>
    </Pressable>
  );
}

export function libelle(etat: EtatCoeur): string { return LIBELLE[etat]; }

export function Etiquette({ texte }: { texte: string }) {
  const t = theme();
  return <Text style={{ color: t.couleurs.doux, fontSize: t.police.aide }} numberOfLines={2}>{texte}</Text>;
}

const styles = StyleSheet.create({
  anneau: { borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,15,18,0.85)" },
});
