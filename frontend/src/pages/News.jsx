import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

const tagMap = {
  urgent: { c: "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]", l: "عاجل" },
  opportunity: { c: "bg-[#EDF5F2] text-[#2E8378] border-[#BFD8E8]", l: "فرصة" },
  congrats: { c: "bg-[#EBF6F0] text-[#2D6A4F] border-[#B7DFCB]", l: "تهنئة" },
  info: { c: "bg-[#EAF1F6] text-[#2E4659] border-[#C9D9E6]", l: "إعلان" },
};

export default function News() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tag: "info" });

  const load = () => api.get("/announcements").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/announcements", form);
      toast.success("تم النشر");
      setOpen(false); setForm({ title: "", content: "", tag: "info" });
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!confirm("حذف الإعلان؟")) return;
    await api.delete(`/announcements/${id}`);
    load();
  };

  return (
    <div className="space-y-6" data-testid="news-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">إعلانات النادي</h1>
          <p className="text-sm text-[#6B7B88] mt-1">آخر التعاميم والتنويهات من إدارة نادي مصباح.</p>
        </div>
        {user?.role === "admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-ann-btn" className="bg-[#1C2B39] text-white rounded-full"><Plus className="w-4 h-4 ml-1" /> إعلان جديد</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">إعلان جديد</DialogTitle>
                <DialogDescription>سيصل الإعلان لجميع عضوات النادي.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>العنوان</Label><Input data-testid="ann-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>المحتوى</Label><Textarea data-testid="ann-content" value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={4} /></div>
                <div><Label>التصنيف</Label>
                  <Select value={form.tag} onValueChange={v => setForm({...form, tag: v})}>
                    <SelectTrigger data-testid="ann-tag"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">إعلان</SelectItem>
                      <SelectItem value="urgent">عاجل</SelectItem>
                      <SelectItem value="opportunity">فرصة</SelectItem>
                      <SelectItem value="congrats">تهنئة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="ann-submit" onClick={create} className="bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">نشر</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.length === 0 && <div className="col-span-full text-[#6B7B88] text-center py-12">لا توجد إعلانات.</div>}
        {items.map(a => {
          const t = tagMap[a.tag] || tagMap.info;
          return (
            <div key={a.id} className="bg-white border border-[#DFE8EE] rounded-2xl p-6" data-testid={`ann-card-${a.id}`}>
              <div className="flex items-start justify-between gap-4">
                <span className={`text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full border ${t.c}`}>{t.l}</span>
                {user?.role === "admin" && (
                  <button data-testid={`ann-del-${a.id}`} onClick={() => remove(a.id)} className="text-[#B91C1C] hover:opacity-70"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              <div className="font-display text-xl mt-3">{a.title}</div>
              <div className="text-sm text-[#3A4A58] mt-2 leading-[1.9]">{a.content}</div>
              <div className="text-[11px] text-[#6B7B88] mt-4">— {a.author_name} · {new Date(a.created_at).toLocaleDateString("ar-SA")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
