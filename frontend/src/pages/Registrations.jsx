import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Calendar, GraduationCap, MapPin } from "lucide-react";

export default function Registrations() {
  const [events, setEvents] = useState([]);
  const [workshops, setWorkshops] = useState([]);

  useEffect(() => {
    api.get("/me/events").then(r => setEvents(r.data)).catch(() => {});
    api.get("/me/workshops").then(r => setWorkshops(r.data)).catch(() => {});
  }, []);

  const empty = events.length === 0 && workshops.length === 0;

  return (
    <div className="space-y-6" data-testid="registrations-page">
      <div>
        <h1 className="font-display text-3xl font-bold">تسجيلاتي</h1>
        <p className="text-sm text-[#6B7B88] mt-1">الفعاليات والورش التي سجّلتِ فيها.</p>
      </div>

      {empty && (
        <div className="bg-white border border-[#DFE8EE] rounded-2xl p-10 text-center text-[#6B7B88]">
          لم تسجلي في أي نشاط بعد.{" "}
          <Link to="/events" data-testid="reg-browse-link" className="text-[#2E4659] font-semibold hover:underline">
            تصفحي الأنشطة
          </Link>
        </div>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2E8378]" /> الفعاليات
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {events.map(e => (
              <Link key={e.id} to={`/events/${e.id}`} data-testid={`reg-event-${e.id}`}
                className="bg-white border border-[#DFE8EE] rounded-2xl p-4 hover:border-[#7BA7C9] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-sm">{e.title}</div>
                  <Badge className={e.attended ? "bg-[#EBF6F0] text-[#2D6A4F] border-0" : "bg-[#F0F5F8] text-[#6B7B88] border-0"}>
                    {e.attended ? "حضرت ✓" : "مسجّلة"}
                  </Badge>
                </div>
                <div className="text-xs text-[#6B7B88] mt-2 flex items-center gap-3 flex-wrap">
                  <span>{new Date(e.date).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{e.location}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {workshops.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#2E8378]" /> الورش
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {workshops.map(w => (
              <Link key={w.id} to={`/workshops/${w.id}`} data-testid={`reg-workshop-${w.id}`}
                className="bg-white border border-[#DFE8EE] rounded-2xl p-4 hover:border-[#7BA7C9] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-sm">{w.title}</div>
                  <Badge className={w.attended ? "bg-[#EBF6F0] text-[#2D6A4F] border-0" : "bg-[#F0F5F8] text-[#6B7B88] border-0"}>
                    {w.attended ? "حضرت ✓" : "مسجّلة"}
                  </Badge>
                </div>
                <div className="text-xs text-[#6B7B88] mt-2">
                  {new Date(w.scheduled_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })} · {w.supervisor_name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
