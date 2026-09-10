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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Users, Calendar as CalIcon } from "lucide-react";
import { canManageClub } from "@/lib/roles";

const cats = [
  { v: "all", l: "الكل" },
  { v: "meetup", l: "لقاءات" },
  { v: "seminar", l: "ندوات" },
  { v: "workshop", l: "ورش" },
  { v: "tournament", l: "بطولات" },
];

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", date: "", location: "", capacity: 50, category: "workshop", points: 100, image_url: "" });

  const load = () => api.get("/events", { params: filter === "all" ? {} : { category: filter } }).then(r => setEvents(r.data));
  useEffect(() => { load(); }, [filter]);

  const canCreate = canManageClub(user?.role);

  const create = async () => {
    try {
      await api.post("/events", { ...form, capacity: parseInt(form.capacity), points: parseInt(form.points), date: new Date(form.date).toISOString() });
      toast.success("تم إنشاء الفعالية");
      setOpen(false);
      setForm({ title: "", description: "", date: "", location: "", capacity: 50, category: "workshop", points: 100, image_url: "" });
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="events-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">فعاليات مصباح</h1>
          <p className="text-sm text-[#6B7B88] mt-1">تصفحي الفعاليات المتاحة وسجّلي مقعدك.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-event-btn" className="bg-[#1C2B39] text-white rounded-full">
                <Plus className="w-4 h-4 ml-1" /> فعالية جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">إنشاء فعالية</DialogTitle>
                <DialogDescription>عبّئي التفاصيل التالية.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>العنوان</Label><Input data-testid="ev-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>الوصف</Label><Textarea data-testid="ev-desc" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>التاريخ والوقت</Label><Input data-testid="ev-date" type="datetime-local" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
                  <div><Label>المكان</Label><Input data-testid="ev-loc" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                  <div><Label>السعة</Label><Input data-testid="ev-cap" type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
                  <div><Label>النقاط</Label><Input data-testid="ev-pts" type="number" value={form.points} onChange={e => setForm({...form, points: e.target.value})} /></div>
                  <div className="col-span-2"><Label>التصنيف</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger data-testid="ev-cat"><SelectValue /></SelectTrigger>
                      <SelectContent>{cats.filter(c => c.v !== "all").map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>رابط صورة (اختياري)</Label><Input data-testid="ev-img" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="ev-submit" onClick={create} className="bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">إنشاء</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cats.map(c => (
          <button key={c.v} data-testid={`filter-${c.v}`} onClick={() => setFilter(c.v)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === c.v ? "bg-[#1C2B39] text-white" : "bg-white border border-[#DFE8EE] text-[#3A4A58] hover:bg-[#F0F5F8]"}`}>
            {c.l}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.length === 0 && <div className="text-[#6B7B88] col-span-full py-12 text-center">لا توجد فعاليات في هذا التصنيف.</div>}
        {events.map(e => (
          <Link key={e.id} to={`/events/${e.id}`} data-testid={`event-card-${e.id}`}
            className="group bg-white border border-[#DFE8EE] rounded-2xl overflow-hidden hover:border-[#7BA7C9] transition-all hover:shadow-md">
            {e.image_url && <div className="aspect-video overflow-hidden bg-[#F0F5F8]"><img src={e.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#EAF1F6] text-[#2E4659] border-0 rounded-full text-[10px]">{catLabel(e.category)}</Badge>
                <span className="text-[11px] text-[#6B7B88]">+{e.points} نقطة</span>
              </div>
              <div className="font-display text-xl leading-snug">{e.title}</div>
              <div className="text-sm text-[#3A4A58] mt-2 line-clamp-2 leading-relaxed">{e.description}</div>
              <div className="mt-4 space-y-1.5 text-xs text-[#6B7B88]">
                <div className="flex items-center gap-1.5"><CalIcon className="w-3.5 h-3.5" />{new Date(e.date).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{e.location}</div>
                <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />باقي {Math.max(e.capacity - (e.registered_count || 0), 0)} من {e.capacity}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function catLabel(c) {
  return ({ meetup: "لقاء", seminar: "ندوة", workshop: "ورشة", tournament: "بطولة" })[c] || c;
}
