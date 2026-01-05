"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { enforceSession, setupAuthStateListener, signOutAndClear } from "../lib/sessionGuard";
import AppointmentCalendar from "../components/AppointmentCalendar";
import jsPDF from "jspdf";


type Staff = { id: string; name: string };
type Appt = {
  id: string;
  employee_id: string;
  customer_name: string;
  phone: string | null;
  service: string;
  price: number;
  cost: number;
  starts_at: string;
  duration_min: number;
  status: string;
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export default function Dashboard() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [staffId, setStaffId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "completed" | "canceled">("all");
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"appointments" | "calendar" | "reports">("appointments");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  // Form
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("Saç Kesim");
  const [price, setPrice] = useState<number | "">("");
  const [cost, setCost] = useState<number | "">("");
  const [date, setDate] = useState<string>(() => {
    // Client-side'da bugünün tarihini al
    if (typeof window !== "undefined") {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return "";
  });
  const [time, setTime] = useState<string>("10:00");
  const [duration, setDuration] = useState<number>(30);
  const [sendSms, setSendSms] = useState(false);

  const timeSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

  // Telefon validasyonu - opsiyonel, sadece rakam kabul et
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Sadece rakam
    if (value.length > 11) value = value.slice(0, 11);
    setPhone(value);
  };

  // Fiyat değişikliği - 0 yerine boş bırak
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setPrice(value === "" ? "" : Number(value));
    }
  };

  // Gider değişikliği
  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setCost(value === "" ? "" : Number(value));
    }
  };

  // Bildirim izni iste
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    } else if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadAll = useCallback(async () => {
    setMsg("");
    try {
      const s = await supabase.from("staff").select("id,name").eq("is_active", true).order("name");
      if (s.error) return setMsg(s.error.message);
      setStaff(s.data ?? []);

      const a = await supabase.from("appointments").select("*").order("starts_at", { ascending: true });
      if (a.error) return setMsg(a.error.message);
      setAppts((a.data ?? []) as unknown as Appt[]);
    } catch (error) {
      console.error("Veri yükleme hatası:", error);
      setMsg("Veri yüklenirken hata oluştu");
    }
  }, []);

  useEffect(() => {
    // Auth state listener kur - oturum kapatılınca yönlendir
    setupAuthStateListener(() => {
      router.replace("/");
    });
    
    (async () => {
      try {
        const ok = await enforceSession();
        const { data } = await supabase.auth.getSession();
        if (!data.session || !ok) {
          router.replace("/");
        } else {
          await loadAll();
        }
      } catch (error) {
        console.error("Session kontrol hatası:", error);
        router.replace("/");
      }
    })();
  }, [router, loadAll]);

  const filtered = useMemo(() => {
    let result = appts;
    if (staffId !== "ALL") {
      result = result.filter(x => x.employee_id === staffId);
    }
    if (statusFilter !== "all") {
      result = result.filter(x => x.status === statusFilter);
    }
    return result;
  }, [appts, staffId, statusFilter]);

  // KPI: gün/hafta/ay/yıl - sadece scheduled ve completed randevular
  const kpi = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now), dayEnd = endOfDay(now);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // pazartesi
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 1);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear()+1, 0, 1);

    function sumBetween(start: Date, end: Date) {
      let income = 0, expense = 0;
      for (const x of appts) {
        // Sadece scheduled ve completed - iptal olanları sayma
        if (x.status === "canceled") continue;
        const t = new Date(x.starts_at).getTime();
        if (t >= start.getTime() && t < end.getTime()) {
          income += Number(x.price || 0);
          expense += Number(x.cost || 0);
        }
      }
      return { income, expense, net: income - expense };
    }

    return {
      day: sumBetween(dayStart, dayEnd),
      week: sumBetween(weekStart, weekEnd),
      month: sumBetween(monthStart, monthEnd),
      year: sumBetween(yearStart, yearEnd),
    };
  }, [appts]);

  async function addAppt() {
    setMsg("");
    if (staffId === "ALL") return setMsg("Randevu eklemek için çalışan seç.");
    if (!customer.trim()) return setMsg("Müşteri adı zorunlu.");
    if (!service.trim()) return setMsg("Hizmet zorunludur.");
    if (price === "" || price === 0) return setMsg("Ücret zorunludur.");
    const iso = new Date(`${date}T${time}:00`).toISOString();

    const res = await supabase.from("appointments").insert({
      employee_id: staffId,
      customer_name: customer,
      phone: phone || null,
      service,
      price: Number(price) || 0,
      cost: Number(cost) || 0,
      starts_at: iso,
      duration_min: duration,
      status: "scheduled",
    });

    if (res.error) return setMsg(res.error.message);

    // SMS gönderimi (sadece telefon varsa)
    if (sendSms && phone && phone.length >= 10) {
      try {
        await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone,
            message: `Sayın ${customer}, ${date} tarihinde saat ${time}'de ${service} randevunuz oluşturuldu. RAST BARBER BEAUTY`,
          }),
        });
      } catch (smsError) {
        console.error("SMS gönderilemedi:", smsError);
      }
    }

    setCustomer(""); setPhone(""); setService("Saç Kesim"); setPrice(""); setCost("");
    await loadAll();
    setMsg("✅ Randevu eklendi" + (sendSms && phone ? " ve SMS gönderildi" : ""));
  }

  async function delAppt(id: string) {
    if (!confirm("Randevu silinsin mi?")) return;
    const res = await supabase.from("appointments").delete().eq("id", id);
    if (res.error) return setMsg(res.error.message);
    await loadAll();
  }

  async function markComplete(id: string) {
    const res = await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
    if (res.error) return setMsg(res.error.message);
    setMsg("✅ Randevu tamamlandı olarak işaretlendi");
    await loadAll();
  }

  async function markCanceled(id: string) {
    if (!confirm("Randevu iptal edilsin mi?")) return;
    const res = await supabase.from("appointments").update({ status: "canceled" }).eq("id", id);
    if (res.error) return setMsg(res.error.message);
    setMsg("❌ Randevu iptal edildi");
    await loadAll();
  }

  async function logout() {
    await signOutAndClear();
    router.replace("/");
  }

  // CSV Export
  function exportCSV() {
    const headers = ["Tarih", "Müşteri", "Telefon", "Hizmet", "Ücret", "Gider", "Çalışan", "Durum"];
    const rows = filtered.map((a) => {
      const staffMember = staff.find((s) => s.id === a.employee_id);
      return [
        new Date(a.starts_at).toLocaleString("tr-TR"),
        a.customer_name,
        a.phone || "",
        a.service,
        a.price.toString(),
        a.cost.toString(),
        staffMember?.name || "",
        a.status,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rapor_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  // PDF Export - Geliştirilmiş format
  function exportPDF() {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(24);
    doc.setTextColor(201, 162, 77); // Altın renk
    doc.text("RAST BARBER BEAUTY", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Randevu Raporu", 105, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 14, 45);
    doc.text(`Toplam Randevu: ${filtered.length}`, 14, 52);
    
    // Tablo başlığı
    doc.setFillColor(201, 162, 77);
    doc.rect(14, 60, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("No", 16, 66);
    doc.text("Tarih/Saat", 30, 66);
    doc.text("Müşteri", 75, 66);
    doc.text("Hizmet", 115, 66);
    doc.text("Ücret", 150, 66);
    doc.text("Durum", 175, 66);
    
    // Veriler
    let y = 72;
    doc.setTextColor(0, 0, 0);
    
    filtered.forEach((a, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Alternatif satır renkleri
      if (index % 2 === 0) {
        doc.setFillColor(246, 247, 251);
        doc.rect(14, y - 4, 182, 8, "F");
      }
      
      doc.setFontSize(8);
      doc.text(`${index + 1}`, 16, y);
      doc.text(new Date(a.starts_at).toLocaleString("tr-TR").slice(0, 16), 30, y);
      doc.text(a.customer_name.slice(0, 20), 75, y);
      doc.text(a.service.slice(0, 18), 115, y);
      doc.text(`${a.price}₺`, 150, y);
      doc.text(a.status, 175, y);
      y += 8;
    });
    
    // Özet
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(201, 162, 77);
    doc.text("AYLIK ÖZET", 105, y, { align: "center" });
    
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Toplam Gelir: ${kpi.month.income}₺`, 14, y);
    doc.text(`Toplam Gider: ${kpi.month.expense}₺`, 80, y);
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 0);
    doc.text(`Net Kar: ${kpi.month.net}₺`, 150, y);
    
    doc.save(`rapor_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // Yaklaşan randevu uyarısı - Kuaför sahibine bildirim
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const next = filtered.find(a => {
        const dt = new Date(a.starts_at).getTime();
        return dt > now && dt - now <= 10 * 60 * 1000 && a.status === "scheduled";
      });
      if (next && notificationPermission === "granted") {
        // Browser notification - Kuaför sahibi ekranda olmasa bile görür
        new Notification("⏰ Yaklaşan Randevu!", {
          body: `${next.customer_name} - ${new Date(next.starts_at).toLocaleTimeString()}`,
          icon: "/icon-192.png",
          tag: `appt-${next.id}`,
        });
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [filtered, notificationPermission]);

  return (
    <main className="container">
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          <div>
            <div className="h1">RAST BARBER BEAUTY</div>
            <div className="sub">Premium Kuaför Yönetim Paneli</div>
          </div>
        </div>
        <button className="btn2" onClick={logout}>Çıkış</button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div style={{ minWidth: 200, flex: 1 }}>
          <div className="label">Çalışan Filtresi</div>
          <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="ALL">Tüm çalışanlar (Genel)</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ minWidth: 180 }}>
          <div className="label">Durum Filtresi</div>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">Tüm Durumlar</option>
            <option value="scheduled">Bekleyen</option>
            <option value="completed">Tamamlanan</option>
            <option value="canceled">İptal Edilen</option>
          </select>
        </div>

        <div className="badge mono badge-gold">
          <b>Bugün Net:</b>&nbsp;{kpi.day.net}₺
        </div>
        <div className="badge mono badge-gold">
          <b>Bu Ay Net:</b>&nbsp;{kpi.month.net}₺
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi" style={{ marginTop: 12 }}>
        <div className="card card-gold">
          <div className="small">Bugün</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{kpi.day.income}₺</div>
          <div className="small">Gider: {kpi.day.expense}₺ • Net: {kpi.day.net}₺</div>
        </div>
        <div className="card card-gold">
          <div className="small">Bu Hafta</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{kpi.week.income}₺</div>
          <div className="small">Gider: {kpi.week.expense}₺ • Net: {kpi.week.net}₺</div>
        </div>
        <div className="card card-gold">
          <div className="small">Bu Ay</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{kpi.month.income}₺</div>
          <div className="small">Gider: {kpi.month.expense}₺ • Net: {kpi.month.net}₺</div>
        </div>
        <div className="card card-gold">
          <div className="small">Bu Yıl</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{kpi.year.income}₺</div>
          <div className="small">Gider: {kpi.year.expense}₺ • Net: {kpi.year.net}₺</div>
        </div>
      </div>

      <div className="hr" />

      {/* Tab Menu - Belirgin butonlar */}
      <div className="row" style={{ marginBottom: 16 }}>
        <button 
          className={`btn-tab ${activeTab === "appointments" ? "active" : ""}`} 
          onClick={() => setActiveTab("appointments")}
        >
          📋 Randevular
        </button>
        <button 
          className={`btn-tab ${activeTab === "calendar" ? "active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          📅 Takvim
        </button>
        <button 
          className={`btn-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          📊 Raporlar
        </button>
      </div>

      {activeTab === "appointments" && (
        <div className="grid grid2">
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Yeni Randevu</div>
            <div className="small">Müşteri bilgilerini doldurun.</div>

            <div className="grid" style={{ marginTop: 12 }}>
              <div className="grid grid2">
                <div>
                  <div className="label">Müşteri Adı</div>
                  <input className="input input-gold" placeholder="Örn: Talha Eren" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                </div>
                <div>
                  <div className="label">Telefon (Opsiyonel)</div>
                  <input 
                    className="input input-gold" 
                    placeholder="05xx xxx xx xx" 
                    value={phone} 
                    onChange={handlePhoneChange}
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="grid grid2">
                <div>
                  <div className="label">İşlem / Hizmet</div>
                  <input className="input input-gold" placeholder="Saç, Sakal, Boya..." value={service} onChange={(e) => setService(e.target.value)} />
                </div>
                <div>
                  <div className="label">Süre (dk)</div>
                  <input className="input input-gold" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid2">
                <div>
                  <div className="label">Ücret (₺)</div>
                  <input 
                    className="input input-gold" 
                    type="text" 
                    placeholder="0" 
                    value={price} 
                    onChange={handlePriceChange}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="label">Gider (₺) (opsiyonel)</div>
                  <input 
                    className="input input-gold" 
                    type="text" 
                    placeholder="0" 
                    value={cost} 
                    onChange={handleCostChange}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid2">
                <div>
                  <div className="label">Tarih</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      className="input input-gold" 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn btn-gold" 
                      onClick={() => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, "0");
                        const day = String(now.getDate()).padStart(2, "0");
                        setDate(`${year}-${month}-${day}`);
                      }}
                      style={{ padding: "12px 16px", whiteSpace: "nowrap" }}
                    >
                      Bugün
                    </button>
                  </div>
                </div>
                <div>
                  <div className="label">Saat</div>
                  <input className="input input-gold" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="label">Hızlı Saat Seç</div>
                <div className="slotRow">
                  {timeSlots.map(s => (
                    <div key={s} className={`slot ${time === s ? "slotOn" : ""}`} onClick={() => setTime(s)}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <label className="badge badge-gold">
                <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
                <span>Müşteriye SMS gönder</span>
              </label>

              <button className="btn btn-gold" onClick={addAppt}>✨ Randevu Ekle</button>
              {msg && <div className="small" style={{ color: msg.startsWith("✅") ? "green" : "crimson" }}>{msg}</div>}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Randevular</div>
            <div className="small">Çalışan filtresine göre listelenir.</div>

            <div className="hr" />

            <div className="grid">
              {/* Bekleyen Randevular */}
              {filtered.filter(a => a.status === "scheduled").length > 0 && (
                <>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#92400e", marginTop: 8 }}>⏳ Bekleyen Randevular</div>
                  {filtered.filter(a => a.status === "scheduled").slice(0, 25).map(a => (
                    <div key={a.id} className="card" style={{ padding: 12, borderLeft: "4px solid #f59e0b" }}>
                      <div className="listItem">
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {a.customer_name} • <span className="mono">{a.price}₺</span>
                          </div>
                          <div className="small">
                            {a.service} • {new Date(a.starts_at).toLocaleString()} {a.phone ? `• ${a.phone}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm btn-green" onClick={() => markComplete(a.id)} title="Tamamla">✓</button>
                          <button className="btn btn-sm btn-red" onClick={() => markCanceled(a.id)} title="İptal">✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Tamamlanan Randevular */}
              {filtered.filter(a => a.status === "completed").length > 0 && (
                <>
                  <div className="hr" />
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#166534" }}>✅ Tamamlanan Randevular</div>
                  {filtered.filter(a => a.status === "completed").slice(0, 50).map(a => (
                    <div key={a.id} className="card" style={{ padding: 12, borderLeft: "4px solid #22c55e", background: "#f0fdf4" }}>
                      <div className="listItem">
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {a.customer_name} • <span className="mono">{a.price}₺</span>
                          </div>
                          <div className="small">
                            {a.service} • {new Date(a.starts_at).toLocaleString()} {a.phone ? `• ${a.phone}` : ""}
                          </div>
                        </div>
                        <button className="btn2 btn-sm" onClick={() => delAppt(a.id)}>Sil</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* İptal Edilen Randevular */}
              {filtered.filter(a => a.status === "canceled").length > 0 && (
                <>
                  <div className="hr" />
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#991b1b" }}>❌ İptal Edilen Randevular</div>
                  {filtered.filter(a => a.status === "canceled").slice(0, 50).map(a => (
                    <div key={a.id} className="card" style={{ padding: 12, borderLeft: "4px solid #ef4444", background: "#fef2f2" }}>
                      <div className="listItem">
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {a.customer_name} • <span className="mono">{a.price}₺</span>
                          </div>
                          <div className="small">
                            {a.service} • {new Date(a.starts_at).toLocaleString()} {a.phone ? `• ${a.phone}` : ""}
                          </div>
                        </div>
                        <button className="btn2 btn-sm" onClick={() => delAppt(a.id)}>Sil</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {filtered.length === 0 && <div className="small">Bu filtrede randevu yok.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="card">
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>Randevu Takvimi</div>
          <AppointmentCalendar 
            appointments={appts} 
            staff={staff} 
            staffId={staffId}
          />
        </div>
      )}

      {activeTab === "reports" && (
        <div className="card">
          <div style={{ fontWeight: 900, fontSize: 16 }}>Raporlar ve İhracat</div>
          <div className="small">Verilerinizi CSV veya PDF olarak dışa aktarın.</div>

          <div className="grid" style={{ marginTop: 16 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>CSV İhracatı</div>
              <div className="small" style={{ marginBottom: 12 }}>Excel'de açılabilir format</div>
              <button className="btn" onClick={exportCSV}>CSV İndir</button>
            </div>

            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📑</div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>PDF Raporu</div>
              <div className="small" style={{ marginBottom: 12 }}>Yazdırılabilir format</div>
              <button className="btn" onClick={exportPDF}>PDF İndir</button>
            </div>

            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Bu Ay Özeti</div>
              <div className="small" style={{ marginBottom: 12 }}>Gelir: {kpi.month.income}₺</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: "green" }}>
                {kpi.month.net}₺ Net
              </div>
            </div>
          </div>

          <div className="hr" />

          <div style={{ fontWeight: 900, marginBottom: 12 }}>Detaylı İstatistikler</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="card">
              <div className="small">Toplam Randevu</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900 }}>{filtered.length}</div>
            </div>
            <div className="card">
              <div className="small">Toplam Gelir</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: "green" }}>{kpi.month.income}₺</div>
            </div>
            <div className="card">
              <div className="small">Toplam Gider</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: "crimson" }}>{kpi.month.expense}₺</div>
            </div>
            <div className="card">
              <div className="small">Net Kar</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: kpi.month.net >= 0 ? "green" : "crimson" }}>
                {kpi.month.net}₺
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
