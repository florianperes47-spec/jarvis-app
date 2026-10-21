/**
 * Notifications locales du mode Flo (chantier 4, 20/10) : le tableau de bord du PC est relu toutes les minutes tant
 * que l'appli est ouverte ; `alertes.ts` dit quoi programmer, annuler ou montrer tout de suite. Marche dans Expo Go
 * (notifications locales) ; les notifications push (appli fermée depuis longtemps) demandent le compte développeur.
 * Jamais en mode foyer (aucune donnée perso au salon).
 */
import * as Notifications from "expo-notifications";
import { planifier, type Tableau } from "./alertes";

let pret = false;

export async function preparer(): Promise<boolean> {
  if (pret) return true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  const r = await Notifications.requestPermissionsAsync();
  pret = r.granted;
  return pret;
}

let avant: Tableau | null = null;

/** Un nouveau relevé du tableau de bord : programme, annule, ou montre tout de suite. */
export async function suivre(tableau: Tableau): Promise<void> {
  if (!pret) return;
  const programmees = await Notifications.getAllScheduledNotificationsAsync();
  const parCle = new Map<string, string>();
  for (const n of programmees) {
    const cle = (n.content.data as { cle?: string } | null)?.cle;
    if (cle) parCle.set(cle, n.identifier);
  }
  const plan = planifier(avant, tableau, new Set(parCle.keys()));
  avant = tableau;
  for (const cle of plan.annuler) { const id = parCle.get(cle); if (id) await Notifications.cancelScheduledNotificationAsync(id); }
  for (const n of plan.programmer) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.titre, body: n.corps, data: { cle: n.cle }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.quand ?? Date.now()) },
    });
  }
  for (const n of plan.maintenant) {
    await Notifications.scheduleNotificationAsync({ content: { title: n.titre, body: n.corps, data: { cle: n.cle } }, trigger: null });
  }
}

/** Notifications coupées (réglage) ou nouvel appairage : tout ce qui était programmé est annulé. */
export async function arreter(): Promise<void> {
  avant = null;
  if (pret) await Notifications.cancelAllScheduledNotificationsAsync();
}
