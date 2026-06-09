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
  verified_at?: string;  // ISO time of the last real password/strong-factor sign-in
};

const KEY = "saved_accounts_v1";
const ALWAYS_ASK_KEY = "login_always_ask_pw";
const MAX = 6;

// Device-level "extra security": when on, saved profiles never quick-login from a
// stored token — the password is required every time.
export async function getAlwaysAskPassword(): Promise<boolean> {
  try { return (await storage.getItem<boolean>(ALWAYS_ASK_KEY, false)) === true; } catch { return false; }
}
export async function setAlwaysAskPassword(on: boolean): Promise<void> {
  try { await storage.setItem(ALWAYS_ASK_KEY, on); } catch {}
}

// How long a saved profile can quick-login (tap to sign in) before we require
// the password again, for security on a shared/lost device.
export const REAUTH_DAYS = 7;

export function needsReauth(acc: SavedAccount): boolean {
  if (!acc.verified_at) return true;
  const ts = new Date(acc.verified_at).getTime();
  if (!ts) return true;
  return Date.now() - ts > REAUTH_DAYS * 24 * 60 * 60 * 1000;
}

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
// `verified` = the user just proved their identity (password / 2FA / phone),
// which resets the re-auth clock; a silent token refresh preserves the prior
// verification time so the periodic password prompt still fires on schedule.
export async function addSavedAccount(a: SavedAccount, verified = true): Promise<void> {
  if (!a?.user_id || !a?.token) return;
  const list = await getSavedAccounts();
  const existing = list.find((x) => x.user_id === a.user_id);
  const verified_at = verified
    ? new Date().toISOString()
    : (existing?.verified_at || new Date().toISOString());
  await save([{ ...a, verified_at }, ...list.filter((x) => x.user_id !== a.user_id)]);
}

export async function removeSavedAccount(userId: string): Promise<void> {
  const list = await getSavedAccounts();
  await save(list.filter((x) => x.user_id !== userId));
}
