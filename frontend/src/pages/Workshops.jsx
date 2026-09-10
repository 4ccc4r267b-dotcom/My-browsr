import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, GraduationCap, Upload } from "lucide-react";
import { isDoctorOrAdmin } from "@/lib/roles";

export default function Workshops() {
  const { user } = useAuth();
  const [ws, setWs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", scheduled_at: "", supervisor_name: "", video_url: "", capacity: 30, points: 60, materials: [] });
  const [uploading, setUploading] = useState(false);

  const canCreate = isDoctorOrAdmin(user?.role);

  const load = () => api.get("/workshops").then(r => setWs(r.data));
  useEffect(() => { load(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" }});
      setForm(f => ({ ...f, materials: [...f.materials, { url: data.url, name: data.filename, content_type: data.content_type }] }));
      toast.success("تم رفع الملف");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "فشل الرفع");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const create = async () => {
    try {
      await api.post("/workshops", { ...form, capacity: parseInt(form.capacity), points: parseInt(form.points), scheduled_at: new Date(form.scheduled_at).toISOString() });
      toast.success("تم إنشاء الورشة");
      setOpen(false);
      setForm({ title: "", description: "", scheduled_at: "", supervisor_name: "", video_url: "", capacity: 30, points: 60, materials: [] });
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="workshops-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">ورش الدكاترة</h1>
          <p className="text-sm text-[#6B7B88] mt-1">محتوى تخصصي بإشراف نخبة من الأكاديميات.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-workshop-btn" className="bg-[#1C2B39] text-white rounded-full">
                <Plus className="w-4 h-4 ml-1" /> ورشة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">إنشاء ورشة</DialogTitle>
                <DialogDescription>ارفعي مواد الورشة أو أضيفي روابط فيديو.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>العنوان</Label><Input data-testid="ws-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>الوصف</Label><Textarea data-testid="ws-desc" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الموعد</Label><Input data-testid="ws-date" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} /></div>
                  <div><Label>اسم المشرفة</Label><Input data-testid="ws-sup" value={form.supervisor_name} onChange={e => setForm({...form, supervisor_name: e.target.value})} placeholder={user?.name} /></div>
                  <div><Label>السعة</Label><Input data-testid="ws-cap" type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
                  <div><Label>النقاط</Label><Input data-testid="ws-pts" type="number" value={form.points} onChange={e => setForm({...form, points: e.target.value})} /></div>
                  <div className="col-span-2"><Label>رابط فيديو (YouTube embed)</Label><Input data-testid="ws-video" dir="ltr" value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="https://www.youtube.com/embed/..." /></div>
                </div>
                <div>
                  <Label>مواد الورشة (PDF/صور)</Label>
                  <label className="mt-1 flex items-center gap-2 bg-[#F0F5F8] border border-dashed border-[#DFE8EE] rounded-xl p-3 cursor-pointer hover:bg-[#F1EAD8]">
                    <Upload className="w-4 h-4 text-[#2E8378]" />
                    <span className="text-sm text-[#3A4A58]">{uploading ? "جارٍ الرفع..." : "اختاري ملفاً للرفع"}</span>
                    <input data-testid="ws-file" type="file" className="hidden" onChange={handleFile} accept=".pdf,image/*,video/*" />
                  </label>
                  {form.materials.length > 0 && (
                    <ul className="mt-2 text-xs space-y-1">
                      {form.materials.map((m, i) => <li key={i} className="text-[#3A4A58]">📎 {m.name}</li>)}
                    </ul>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="ws-submit" onClick={create} className="bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">إنشاء</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {ws.length === 0 && <div className="text-[#6B7B88] col-span-full py-12 text-center">لا توجد ورش حالياً.</div>}
        {ws.map(w => (
          <Link key={w.id} to={`/workshops/${w.id}`} data-testid={`workshop-card-${w.id}`}
            className="bg-white border border-[#DFE8EE] rounded-2xl p-5 hover:border-[#7BA7C9] transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5F2] flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5 text-[#2E8378]" />
            </div>
            <Badge className="bg-[#EAF1F6] text-[#2E4659] border-0 rounded-full text-[10px]">{w.supervisor_name}</Badge>
            <div className="font-display text-lg mt-2">{w.title}</div>
            <div className="text-sm text-[#3A4A58] mt-2 line-clamp-2 leading-relaxed">{w.description}</div>
            <div className="mt-4 flex items-center gap-4 text-xs text-[#6B7B88]">
              <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(w.scheduled_at).toLocaleDateString("ar-SA")}</div>
              <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />باقي {Math.max(w.capacity - (w.registered_count || 0), 0)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
