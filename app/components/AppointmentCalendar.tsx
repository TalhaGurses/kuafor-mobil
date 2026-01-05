"use client";

import { useMemo, useState } from "react";

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

type Staff = { id: string; name: string };

interface AppointmentCalendarProps {
  appointments: Appt[];
  staff: Staff[];
  staffId: string;
  onSelectEvent?: (event: Appt) => void;
}

export default function AppointmentCalendar({
  appointments,
  staff,
  staffId,
  onSelectEvent,
}: AppointmentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => staffId === "ALL" || a.employee_id === staffId);
  }, [appointments, staffId]);

  // Ayın günlerini hesapla
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const getAppointmentsForDay = (date: Date | null) => {
    if (!date) return [];
    return filteredAppointments.filter((a) => {
      const apptDate = new Date(a.starts_at);
      return (
        apptDate.getDate() === date.getDate() &&
        apptDate.getMonth() === date.getMonth() &&
        apptDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const staffColors: Record<string, string> = {};
  staff.forEach((s, i) => {
    const colors = ["#c9a24d", "#4a90d9", "#27ae60", "#e74c3c", "#9b59b6"];
    staffColors[s.id] = colors[i % colors.length];
  });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div>
      {/* Takvim Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button className="btn2" onClick={prevMonth}>◀ Önceki</button>
        <h3 style={{ margin: 0 }}>{monthNames[month]} {year}</h3>
        <button className="btn2" onClick={nextMonth}>Sonraki ▶</button>
      </div>

      {/* Gün İsimleri */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
        {["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"].map((day) => (
          <div key={day} style={{ textAlign: "center", fontWeight: 700, fontSize: 12, padding: 8, color: "#6b7280" }}>
            {day}
          </div>
        ))}
      </div>

      {/* Takvim Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {days.map((date, index) => {
          const dayAppointments = getAppointmentsForDay(date);
          return (
            <div
              key={index}
              style={{
                minHeight: 100,
                padding: 8,
                border: "1px solid var(--line)",
                borderRadius: 8,
                backgroundColor: isToday(date) ? "rgba(201,162,77,0.1)" : "white",
              }}
            >
              {date && (
                <>
                  <div style={{ 
                    fontWeight: isToday(date) ? 900 : 400, 
                    fontSize: 14,
                    color: isToday(date) ? "var(--gold)" : "var(--text)",
                    marginBottom: 4
                  }}>
                    {date.getDate()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.id}
                        onClick={() => onSelectEvent?.(appt)}
                        style={{
                          fontSize: 10,
                          padding: "4px 6px",
                          borderRadius: 4,
                          backgroundColor: staffColors[appt.employee_id] || "#c9a24d",
                          color: "white",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {new Date(appt.starts_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} {appt.customer_name}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
                        +{dayAppointments.length - 3} daha
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {staff.slice(0, 5).map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: staffColors[s.id] }} />
            <span>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

