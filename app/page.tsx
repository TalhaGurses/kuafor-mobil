"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";
import { markLogin } from "./lib/sessionGuard";



export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      }
    } catch (error) {
      console.error("Session kontrol hatası:", error);
    }
  }, [router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async () => {
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return setMsg(error.message);
      markLogin(remember);
      router.replace("/dashboard");
    } catch (err) {
      setMsg("Beklenmeyen bir hata oluştu");
      console.error("Login hatası:", err);
    }
  };

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 520, margin: "60px auto" }}>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
          <span className="dot" />
          <div style={{ textAlign: "center" }}>
            <div className="h1">RAST BARBER BEAUTY</div>
            <div className="sub">Premium Kuaför Yönetim Paneli</div>
          </div>
        </div>

        <div className="hr" />

        <div className="grid">
          <div>
            <div className="label">E-posta</div>
            <input 
              className="input input-gold" 
              placeholder="ornek@kuafor.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div>
            <div className="label">Şifre</div>
            <input 
              className="input input-gold" 
              type="password" 
              placeholder="••••••••" 
              value={pass} 
              onChange={(e) => setPass(e.target.value)}
            />
          </div>

          <label className="badge badge-gold" style={{ cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={remember} 
              onChange={(e) => setRemember(e.target.checked)} 
            />
            <span>Bu cihazı hatırla (önerilir)</span>
          </label>

          <button className="btn btn-gold" onClick={login}>✨ Giriş Yap</button>

          {msg && <div className="small" style={{ color: "crimson", textAlign: "center" }}>{msg}</div>}
          <div className="small" style={{ textAlign: "center" }}>
            Not: Güvenlik için oturum belirli aralıklarla (şu an 6 saat) yeniden giriş ister.
          </div>
        </div>
      </div>
    </main>
  );
}
