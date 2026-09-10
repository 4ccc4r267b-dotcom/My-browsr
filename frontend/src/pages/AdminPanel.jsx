import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Calendar, GraduationCap, Award, Trash2 } from "lucide-react";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roles";

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);

  const load = async () => {
    const [{ data: s }, { data: us }, { data: pu }] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/users"),
      api.get("/admin/users", { params: { pending_only: true } }),
    ]);
    setStats(s); setUsers(us); setPending(pu);
  };
  useEffect(() => { load(); }, []);

  const approve = async (uid, role) => {
    try {
      await api.post(`/admin/users/${uid}/approve`, { approved: true, role });
      toast.success("تم قبول العضوة");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const reject = async (uid) => {
    if (!confirm("رفض العضوة؟ سيتم حذف الحساب.")) return;
    await api.delete(`/admin/users/${uid}`);
    toast.success("تم الرفض");
    load();
  };
  const changeRole = async (uid, role) => {
    try {
      await api.put(`/admin/users/${uid}/role`, { role });
      toast.success("تم تحديث الدور");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="admin-panel">
      <div>
        <h1 className="font-display text-3xl font-bold">لوحة إدارة النادي</h1>
        <p className="text-sm text-[#6B7B88] mt-1">مؤشرات، عضويات، وأدوار.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, l: "العضوات", v: stats.total_users, c: "text-[#2E4659]", bg: "bg-[#EAF1F6]" },
            { icon: Calendar, l: "الفعاليات", v: stats.total_events, c: "text-[#2E8378]", bg: "bg-[#EDF5F2]" },
            { icon: GraduationCap, l: "الورش", v: stats.total_workshops, c: "text-[#2D6A4F]", bg: "bg-[#EBF6F0]" },
            { icon: Award, l: "مجموع النقاط", v: stats.total_points_awarded, c: "text-[#1C2B39]", bg: "bg-[#F0F5F8]" },
          ].map(s => (
            <div key={s.l} className="bg-white border border-[#DFE8EE] rounded-2xl p-5" data-testid={`stat-${s.l}`}>
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-5 h-5 ${s.c}`} /></div>
              <div className="font-display text-2xl font-bold">{s.v}</div>
              <div className="text-xs text-[#6B7B88] mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="bg-[#F0F5F8]">
          <TabsTrigger value="pending" data-testid="tab-pending">في الانتظار ({pending.length})</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-users">جميع العضوات</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
            {pending.length === 0 && <div className="text-[#6B7B88] text-sm text-center py-6">لا توجد طلبات في الانتظار.</div>}
            <div className="divide-y divide-[#EAF0F4]">
              {pending.map(u => (
                <div key={u.id} className="py-4 flex flex-wrap items-center gap-4 justify-between" data-testid={`pending-row-${u.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10"><AvatarFallback className="bg-[#EAF1F6] text-[#2E4659]">{(u.name || "؟")[0]}</AvatarFallback></Avatar>
                    <div>
                      <div className="font-semibold text-sm">{u.name}</div>
                      <div className="text-xs text-[#6B7B88]">{u.email} · {u.major || "غير محدد"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" data-testid={`approve-${u.id}`} onClick={() => approve(u.id, u.role)} className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full">قبول كـ {roleLabel(u.role)}</Button>
                    <Button size="sm" variant="outline" data-testid={`reject-${u.id}`} onClick={() => reject(u.id)} className="rounded-full text-[#B91C1C]">رفض</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-right text-[#6B7B88] text-xs">
                <tr><th className="pb-3 font-normal">العضوة</th><th className="pb-3 font-normal">البريد</th><th className="pb-3 font-normal">التخصص</th><th className="pb-3 font-normal">النقاط</th><th className="pb-3 font-normal">الدور</th><th className="pb-3 font-normal">الحالة</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-[#EAF0F4]" data-testid={`user-row-${u.id}`}>
                    <td className="py-3 font-semibold">{u.name}</td>
                    <td className="py-3 text-[#6B7B88] text-xs">{u.email}</td>
                    <td className="py-3 text-xs">{u.major || "—"}</td>
                    <td className="py-3">{u.points || 0}</td>
                    <td className="py-3">
                      <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                        <SelectTrigger className="h-8 w-32" data-testid={`role-sel-${u.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">إدارة النادي</SelectItem>
                          {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3"><Badge className={u.is_approved ? "bg-[#EBF6F0] text-[#2D6A4F] border-0" : "bg-[#FEF2F2] text-[#B91C1C] border-0"}>{u.is_approved ? "مقبولة" : "في الانتظار"}</Badge></td>
                    <td className="py-3 text-left">
                      <button data-testid={`del-user-${u.id}`} onClick={() => { if (confirm("حذف العضوة؟")) { api.delete(`/admin/users/${u.id}`).then(load); } }} className="text-[#B91C1C] hover:opacity-70"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
