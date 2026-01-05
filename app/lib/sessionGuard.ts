import { supabase } from "./supabaseClient";

const MAX_HOURS = 6; // burayı değiştir (ör 2 saat / 12 saat)

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function markLogin(remember: boolean) {
  if (!isBrowser()) return; // SSR kontrolü
  const store = remember ? localStorage : sessionStorage;
  store.setItem("login_at", String(Date.now()));
  store.setItem("remember", remember ? "1" : "0");
}

// Tüm oturum verilerini temizle
function clearAllSessionData() {
  if (!isBrowser()) return;
  localStorage.removeItem("login_at");
  localStorage.removeItem("remember");
  sessionStorage.removeItem("login_at");
  sessionStorage.removeItem("remember");
}

// Auth state değişikliğini dinle - oturum kapatılınca yönlendir
let authStateListenerSet = false;
export function setupAuthStateListener(onSignOut: () => void) {
  if (!isBrowser() || authStateListenerSet) return;
  
  authStateListenerSet = true;
  
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      clearAllSessionData();
      onSignOut();
    }
  });
}

export async function signOutAndClear() {
  // Önce storage temizle, sonra Supabase'ye bildir
  clearAllSessionData();
  await supabase.auth.signOut();
}

export async function enforceSession(): Promise<boolean> {
  if (!isBrowser()) return false; // SSR kontrolü
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    // Hata varsa veya session yoksa temizle ve false dön
    if (error || !data.session) {
      clearAllSessionData();
      return false;
    }

    const remember = localStorage.getItem("remember") === "1";
    const store = remember ? localStorage : sessionStorage;

    const loginAtStr = store.getItem("login_at");
    if (!loginAtStr) return true; // ilk kezse sorun yok
    const loginAt = Number(loginAtStr);

    const maxMs = MAX_HOURS * 60 * 60 * 1000;
    if (Date.now() - loginAt > maxMs) {
      // Timeout oldu - temizle ve çıkış yap
      await signOutAndClear();
      return false;
    }
    return true;
  } catch (error) {
    console.error("Session kontrol hatası:", error);
    clearAllSessionData();
    return false;
  }
}
