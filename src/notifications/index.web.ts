// Aperçu web : pas de notifications (rien n'est programmé).
import type { Tableau } from "./alertes";

export async function preparer(): Promise<boolean> { return false; }
export async function suivre(_tableau: Tableau): Promise<void> {}
export async function arreter(): Promise<void> {}
