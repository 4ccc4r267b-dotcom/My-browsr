import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, GraduationCap, Trophy, Megaphone, ArrowLeft } from "lucide-react";

function levelInfo(p) {
  if (p >= 601) return { name: "مصباح ذهبي", next: null, min: 601, tint: "bg-[#EDF5F2] text-[#2E8378]" };
  if (p >= 201) return { name: "قنديل متألق", next: 601, min: 201, tint: "bg-[#EAF1F6] text-[#2E4659]" };
  return { name: "سراج مبتدئ", next: 201, min: 0, tint: "bg-[#EBF6F0] text-[#2D6A4F]" };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [anns, setAnns] = useState([]);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/events").then(r => setEvents(r.data)).catch(() => {}),
      api.get("/me/events").then(r => setMyEvents(r.data)).catch(() => {}),
      api.get("/workshops").then(r => setWorkshops(r.data)).catch(() => {}),
      api.get("/announcements").then(r => setAnns(r.data)).catch(() => {}),
      api.get("/me/achievements").then(r => setAchievements(r.data)).catch(() => {}),
    ]);
  }, []);

  const lvl = levelInfo(user?.points || 0);
  const progress = lvl.next ? Math.round(((user.points - lvl.min) / (lvl.next - lvl.min)) * 100) : 100;
  const upcoming = events.slice(0, 3);
  const upcomingWs = workshops.slice(0, 3);

  return (
    <div className="space-y-8" data-testid="dashboard-root">
      <section className="rounded-3xl bg-gradient-to-br from-[#EAF1F6] via-[#FAFCFD] to-[#EDF5F2] border border-[#DFE8EE] p-6 sm:p-8 grain relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-6 relative">
          <div>
            <div className="text-xs tracking-widest font-bold text-[#2E8378]">مرحباً بعودتكِ</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C2B39] mt-1">{user?.name}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge className={`${lvl.tint} border-0 rounded-full`}>{lvl.name}</Badge>
              {user?.major && <span className="text-xs text-[#6B7B88]">· {user.major}</span>}
              {user?.year > 0 && <span className="text-xs text-[#6B7B88]">· السنة {user.year}</span>}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur border border-[#DFE8EE] rounded-2xl p-4 min-w-[220px]">
            <div className="text-xs text-[#6B7B88]">رصيد نقاط مصباح</div>
            <div className="font-display text-3xl font-bold text-[#1C2B39]" data-testid="user-points">{user?.points || 0}</div>
            {lvl.next && (
              <>
                <Progress value={progress} className="h-1.5 mt-3" />
                <div className="text-[11px] text-[#6B7B88] mt-1.5">{lvl.next - user.points} نقطة للمستوى التالي</div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Calendar, label: "فعالياتي", value: myEvents.length, href: "/events" },
          { icon: GraduationCap, label: "الورش", value: workshops.length, href: "/workshops" },
          { icon: Trophy, label: "الإنجازات", value: achievements.length, href: "/profile" },
          { icon: Megaphone, label: "إعلانات", value: anns.length, href: "/news" },
        ].map(s => (
          <Link key={s.label} to={s.href} data-testid={`stat-${s.label}`} className="bg-white border border-[#DFE8EE] rounded-2xl p-4 hover:border-[#7BA7C9] transition-colors">
            <s.icon className="w-5 h-5 text-[#2E8378] mb-2" />
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-[#6B7B88] mt-0.5">{s.label}</div>
          </Link>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">فعاليات قادمة</h2>
          <Link to="/events" className="text-sm text-[#2E4659] hover:underline inline-flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {upcoming.length === 0 && <div className="text-sm text-[#6B7B88]">لا توجد فعاليات حالياً.</div>}
          {upcoming.map(e => (
            <Link key={e.id} to={`/events/${e.id}`} data-testid={`upcoming-event-${e.id}`} className="group bg-white border border-[#DFE8EE] rounded-2xl overflow-hidden hover:border-[#7BA7C9] transition-colors">
              {e.image_url && <div className="aspect-video overflow-hidden"><img src={e.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" /></div>}
              <div className="p-4">
                <div className="text-[11px] text-[#2E8378] font-bold tracking-wider">{new Date(e.date).toLocaleDateString("ar-SA")}</div>
                <div className="font-display text-lg mt-1 line-clamp-2">{e.title}</div>
                <div className="text-xs text-[#6B7B88] mt-2">باقي {(e.capacity - (e.registered_count || 0))} مقعد</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">ورش الدكاترة</h2>
          <Link to="/workshops" className="text-sm text-[#2E4659] hover:underline inline-flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {upcomingWs.map(w => (
            <Link key={w.id} to={`/workshops/${w.id}`} className="bg-white border border-[#DFE8EE] rounded-2xl p-5 hover:border-[#7BA7C9] transition-colors" data-testid={`upcoming-workshop-${w.id}`}>
              <Badge className="bg-[#EDF5F2] text-[#2E8378] border-0 rounded-full text-[10px]">{w.supervisor_name}</Badge>
              <div className="font-display text-lg mt-3">{w.title}</div>
              <div className="text-xs text-[#6B7B88] mt-2 line-clamp-2">{w.description}</div>
              <div className="text-[11px] text-[#2E8378] mt-3">{new Date(w.scheduled_at).toLocaleDateString("ar-SA")}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">آخر الإعلانات</h2>
          <Link to="/news" className="text-sm text-[#2E4659] hover:underline inline-flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {anns.slice(0, 4).map(a => (
            <div key={a.id} className="bg-white border border-[#DFE8EE] rounded-2xl p-5" data-testid={`ann-${a.id}`}>
              <TagBadge tag={a.tag} />
              <div className="font-display text-lg mt-2">{a.title}</div>
              <div className="text-sm text-[#3A4A58] mt-2 leading-relaxed line-clamp-3">{a.content}</div>
              <div className="text-[11px] text-[#6B7B88] mt-3">{new Date(a.created_at).toLocaleDateString("ar-SA")}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TagBadge({ tag }) {
  const map = {
    urgent: { c: "bg-[#FEF2F2] text-[#B91C1C]", l: "عاجل" },
    opportunity: { c: "bg-[#EDF5F2] text-[#2E8378]", l: "فرصة" },
    congrats: { c: "bg-[#EBF6F0] text-[#2D6A4F]", l: "تهنئة" },
    info: { c: "bg-[#EAF1F6] text-[#2E4659]", l: "إعلان" },
  };
  const m = map[tag] || map.info;
  return <span className={`inline-block text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full ${m.c}`}>{m.l}</span>;
}
