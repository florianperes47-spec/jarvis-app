/** Lecture du profil embarqué et rappel J-2 (06/11) ; la logique est dans ../signature.ts. */
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { dateRappel, expirationDepuisProfil } from "../signature";

export function expiration(): Date | null {
  try {
    const f = new File(Paths.bundle, "embedded.mobileprovision");
    if (!f.exists) return null;
    const octets = f.bytesSync();
    let texte = "";
    for (let i = 0; i < octets.length; i++) texte += String.fromCharCode(octets[i]);
    return expirationDepuisProfil(texte);
  } catch {
    return null;
  }
}

const CLE = "signature-j2";

/** Programme (ou reprogramme) le rappel J-2 ; une seule notification à la fois, remplacée à chaque lancement. */
export async function programmerRappel(): Promise<void> {
  const fin = expiration();
  try {
    for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
      if ((n.content.data as { cle?: string } | null)?.cle === CLE) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    if (!fin) return;
    const quand = dateRappel(fin, new Date());
    if (!quand) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: "Jarvis expire bientôt", body: "Ouvre SideStore, LocalDevVPN activé, puis Refresh All.",
        data: { cle: CLE }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quand },
    });
  } catch {
    // notifications refusées : la date reste affichée dans les Réglages
  }
}
