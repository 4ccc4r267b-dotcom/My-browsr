import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { canManageEvents, roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, GraduationCap, Users } from "lucide-react";

export default function Attendance() {
  const { user } = useAuth();
  const manageable = canManageEvents(user?.role);
  const [events, setEvents] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [selected, setSelected] = useState(null); // {kind, id, title}
  const [attendees, setAttendees] = useState([]);

  useEffect(() => {
    if (!manageable) return;
    api.get("/events").then(r => setEvents(r.data)).catch(() => {});
    api.get("/workshops").then(r => setWorkshops(r.data)).catch(() => {});
  }, [manageable]);

  const openItem = async (kind, item) => {
    setSelected({ kind, id: item.id, title: item.title });
    try {
      const { data } = await api.get(`/${kind}/${item.id}/attendees`);
      setAttendees(data);
    } catch {
      setAttendees([]);
    }
  };

  // تحديث مباشر: أسماء الماسحين للباركود تظهر تلقائياً عند القائدة والنائبة
  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => {
      api.get(`/${selected.kind}/${selected.id}/attendees`).then(r => setAttendees(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [selected?.kind, selected?.id]);

  const attend = async (uid) => {
    try {
      const { data } = await api.post(`/${selected.kind}/${selected.id}/attend/${uid}`);
      if (data.status === "already") toast.info("تم تسجيل الحضور مسبقاً");
      else toast.success(`تم تسجيل الحضور ومنح ${data.points_awarded} نقطة`);
      openItem(selected.kind, { id: selected.id, title: selected.title });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  if (!manageable) {
    return (
      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-10 text-center" data-testid="attendance-denied">
        <h1 className="font-display text-2xl font-bold mb-2">إدارة الحضور</h1>
        <p className="text-sm text-[#6B7B88]">هذه الصفحة مخصصة للإدارة وقائدات الوحدات والدكاترة.</p>
      </div>
    );
  }

  const listBlock = (kind, items) => (
    <div className="space-y-2">
      {items.length === 0 && <div className="text-sm text-[#6B7B88] py-6 text-center">لا يوجد عناصر بعد.</div>}
      {items.map(it => (
        <button key={it.id} data-testid={`att-item-${it.id}`} onClick={() => openItem(kind, it)}
          className={`w-full text-right bg-white border rounded-xl p-4 transition-colors ${selected?.id === it.id ? "border-[#2E8378]" : "border-[#DFE8EE] hover:border-[#7BA7C9]"}`}>
          <div className="font-semibold text-sm">{it.title}</div>
          <div className="text-xs text-[#6B7B88] mt-1">
            {new Date(kind === "events" ? it.date : it.scheduled_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}
            {" · "}{it.registered_count || 0} مسجّلة
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="attendance-page">
      <div>
        <h1 className="font-display text-3xl font-bold">إدارة الحضور</h1>
        <p className="text-sm text-[#6B7B88] mt-1">اختاري النشاط وسجّلي حضور المسجلات — تُمنح النقاط تلقائياً.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Tabs defaultValue="events">
          <TabsList className="bg-[#F0F5F8]">
            <TabsTrigger value="events" data-testid="att-tab-events"><Calendar className="w-4 h-4 ml-1" /> الفعاليات</TabsTrigger>
            <TabsTrigger value="workshops" data-testid="att-tab-workshops"><GraduationCap className="w-4 h-4 ml-1" /> الورش</TabsTrigger>
          </TabsList>
          <TabsContent value="events" className="mt-4">{listBlock("events", events)}</TabsContent>
          <TabsContent value="workshops" className="mt-4">{listBlock("workshops", workshops)}</TabsContent>
        </Tabs>

        <div className="bg-white border border-[#DFE8EE] rounded-2xl p-5" data-testid="att-attendees-panel">
          {!selected ? (
            <div className="text-sm text-[#6B7B88] text-center py-10 flex flex-col items-center gap-2">
              <Users className="w-6 h-6" />
              اختاري نشاطاً لعرض المسجلات
            </div>
          ) : (
            <>
              <h3 className="font-display text-lg font-bold mb-3">
                {selected.title} <span className="text-xs text-[#6B7B88] font-normal">({attendees.length} مسجّلة)</span>
              </h3>
              {attendees.length === 0 && <div className="text-sm text-[#6B7B88] py-6 text-center">لا توجد مسجلات بعد.</div>}
              <div className="divide-y divide-[#EAF0F4]">
                {attendees.map(a => (
                  <div key={a.id} className="py-3 flex items-center justify-between" data-testid={`att-row-${a.user_id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-[#EAF1F6] text-[#2E4659]">{(a.user_name || "؟")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          {a.user_name}
                          {a.user_role && a.user_role !== "student" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDF5F2] text-[#2E8378]">{roleLabel(a.user_role)}</span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B7B88]">{a.attended ? "✓ حضرت" : "لم تحضر بعد"}</div>
                      </div>
                    </div>
                    {!a.attended && (
                      <Button size="sm" data-testid={`att-mark-${a.user_id}`} onClick={() => attend(a.user_id)}
                        className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full">
                        تسجيل حضور
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
