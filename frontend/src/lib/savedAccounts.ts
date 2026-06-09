import { storage } from "@/src/utils/storage";

// Facebook-style "saved profiles": accounts the user has signed into on this
// device, kept so they can tap to log straight back in. Stored in secure storage
// (it holds session tokens) as a JSON string.
export type SavedAccount = {
  user_id: string;
  name: string;
  username?: string | null;
  picture?: string | null;
  token: string;
};

const KEY = "saved_accounts_v1";
const MAX = 6;

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await storage.secureGet<string>(KEY, "");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.user_id && a.token) : [];
  } catch {
    return [];
  }
}

async function save(list: SavedAccount[]): Promise<void> {
  try { await storage.secureSet(KEY, JSON.stringify(list.slice(0, MAX))); } catch {}
}

// Add or refresh an account (most-recent first), keeping its token fresh.
export async function addSavedAccount(a: SavedAccount): Promise<void> {
  if (!a?.user_id || !a?.token) return;
  const list = await getSavedAccounts();
  await save([a, ...list.filter((x) => x.user_id !== a.user_id)]);
}

export async function removeSavedAccount(userId: string): Promise<void> {
  const list = await getSavedAccounts();
  await save(list.filter((x) => x.user_id !== userId));
}
