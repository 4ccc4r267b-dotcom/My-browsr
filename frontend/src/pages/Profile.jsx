import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";

function levelInfo(p) {
  if (p >= 601) return { name: "مصباح ذهبي", next: null, min: 601 };
  if (p >= 201) return { name: "قنديل متألق", next: 601, min: 201 };
  return { name: "سراج مبتدئ", next: 201, min: 0 };
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", major: "", year: "" });
  const [achievements, setAchievements] = useState([]);
  const [myEvents, setMyEvents] = useState([]);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", major: user.major || "", year: user.year || "" });
    api.get("/me/achievements").then(r => setAchievements(r.data)).catch(() => {});
    api.get("/me/events").then(r => setMyEvents(r.data)).catch(() => {});
  }, [user?.id]);

  const save = async () => {
    try {
      await api.put("/auth/me", { name: form.name, major: form.major, year: parseInt(form.year, 10) || 0 });
      await refresh();
      toast.success("تم حفظ التعديلات");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const lvl = levelInfo(user?.points || 0);
  const progress = lvl.next ? Math.round(((user.points - lvl.min) / (lvl.next - lvl.min)) * 100) : 100;
  const initials = (user?.name || "؟").trim().split(" ").slice(0, 2).map(s => s[0]).join("");

  return (
    <div className="space-y-6" data-testid="profile-page">
      <div className="bg-white border border-[#DFE8EE] rounded-3xl p-6 sm:p-8 flex flex-wrap items-center gap-6">
        <Avatar className="w-20 h-20"><AvatarFallback className="bg-[#EAF1F6] text-[#2E4659] text-2xl">{initials}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-[200px]">
          <div className="font-display text-2xl font-bold">{user?.name}</div>
          <div className="text-sm text-[#6B7B88]">{user?.email}</div>
          <div className="mt-2 flex gap-2 flex-wrap"><Badge className="bg-[#EAF1F6] text-[#2E4659] border-0 rounded-full">{lvl.name}</Badge>{user?.major && <Badge className="bg-[#EDF5F2] text-[#2E8378] border-0 rounded-full">{user.major}</Badge>}</div>
        </div>
        <div className="min-w-[220px]">
          <div className="text-xs text-[#6B7B88]">نقاط مصباح</div>
          <div className="font-display text-3xl font-bold">{user?.points || 0}</div>
          {lvl.next && <Progress value={progress} className="h-1.5 mt-2" />}
        </div>
      </div>

      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
        <h3 className="font-display text-xl mb-4">تعديل البروفايل</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>الاسم</Label><Input data-testid="prof-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>التخصص</Label><Input data-testid="prof-major" value={form.major} onChange={e => setForm({...form, major: e.target.value})} /></div>
          <div><Label>السنة الدراسية</Label><Input data-testid="prof-year" type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} /></div>
        </div>
        <Button data-testid="prof-save" onClick={save} className="mt-4 bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">حفظ</Button>
      </div>

      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
        <h3 className="font-display text-xl mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-[#7BA7C9]" /> إنجازاتي</h3>
        {achievements.length === 0 && <div className="text-sm text-[#6B7B88]">لم تحصلي على إنجازات بعد. احضري فعاليات لتبدأ رحلتك 💫</div>}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map(a => (
            <div key={a.id} className="bg-[#FAFCFD] border border-[#EAF0F4] rounded-xl p-4" data-testid={`ach-${a.id}`}>
              <div className="text-2xl mb-1">🏅</div>
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-[11px] text-[#6B7B88] mt-1">+{a.points} نقطة · {new Date(a.created_at).toLocaleDateString("ar-SA")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
        <h3 className="font-display text-xl mb-4">فعالياتي المسجلة</h3>
        {myEvents.length === 0 && <div className="text-sm text-[#6B7B88]">لم تسجلي بأي فعالية بعد.</div>}
        <div className="divide-y divide-[#EAF0F4]">
          {myEvents.map(e => (
            <div key={e.id} className="py-3 flex items-center justify-between" data-testid={`my-ev-${e.id}`}>
              <div>
                <div className="font-semibold text-sm">{e.title}</div>
                <div className="text-xs text-[#6B7B88] mt-0.5">{new Date(e.date).toLocaleDateString("ar-SA")} · {e.location}</div>
              </div>
              <Badge className={e.attended ? "bg-[#EBF6F0] text-[#2D6A4F] border-0" : "bg-[#F0F5F8] text-[#6B7B88] border-0"}>
                {e.attended ? "حضرت ✓" : "قادمة"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
