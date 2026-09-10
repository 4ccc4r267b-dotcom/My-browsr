import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Calendar, MapPin, Users, Trash2, CheckCircle2 } from "lucide-react";
import { canManageClub } from "@/lib/roles";
import { QRCodeCanvas } from "qrcode.react";

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [ev, setEv] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [registered, setRegistered] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [qrCode, setQrCode] = useState(null);

  const canManage = canManageClub(user?.role);

  const load = async () => {
    try {
      const [{ data: e }, { data: c }] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/comments/event/${id}`),
      ]);
      setEv(e); setComments(c);
      if (canManage) {
        const { data: att } = await api.get(`/events/${id}/attendees`);
        setAttendees(att);
        setRegistered(att.some(a => a.user_id === user.id));
        api.get(`/events/${id}/qrcode`).then(r => setQrCode(r.data.checkin_code)).catch(() => {});
      } else {
        // Check my events
        const { data: mine } = await api.get("/me/events");
        setRegistered(mine.some(m => m.id === id));
      }
    } catch (err) {
      toast.error("تعذّر تحميل الفعالية");
    }
  };

  useEffect(() => { load(); }, [id]);

  const register = async () => {
    try {
      await api.post(`/events/${id}/register`);
      toast.success("تم تسجيلكِ في الفعالية 🎉");
      setRegistered(true);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const remove = async () => {
    if (!confirm("حذف الفعالية؟")) return;
    await api.delete(`/events/${id}`);
    toast.success("تم الحذف");
    nav("/events");
  };

  const addComment = async () => {
    if (!text.trim()) return;
    try {
      await api.post(`/comments/event/${id}`, { content: text });
      setText("");
      const { data: c } = await api.get(`/comments/event/${id}`);
      setComments(c);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const attend = async (uid) => {
    try {
      const { data } = await api.post(`/events/${id}/attend/${uid}`);
      if (data.status === "already") toast.info("تم تسجيل الحضور مسبقاً");
      else toast.success(`تم منح ${data.points_awarded} نقطة`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  if (!ev) return <div className="text-[#6B7B88]">جاري التحميل...</div>;
  const remaining = Math.max(ev.capacity - (ev.registered_count || 0), 0);

  return (
    <div className="space-y-6" data-testid="event-detail">
      <Link to="/events" className="text-sm text-[#6B7B88] hover:text-[#1C2B39] inline-flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> عودة للفعاليات
      </Link>
      <div className="bg-white border border-[#DFE8EE] rounded-3xl overflow-hidden">
        {ev.image_url && <div className="aspect-[21/9] overflow-hidden bg-[#F0F5F8]"><img src={ev.image_url} alt="" className="w-full h-full object-cover" /></div>}
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Badge className="bg-[#EAF1F6] text-[#2E4659] border-0 rounded-full">فعالية</Badge>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">{ev.title}</h1>
              <p className="text-[#3A4A58] mt-4 leading-[1.9]">{ev.description}</p>
            </div>
            <div className="min-w-[240px] bg-[#FAFCFD] border border-[#DFE8EE] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-[#3A4A58]"><Calendar className="w-4 h-4 text-[#2E8378]" />{new Date(ev.date).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</div>
              <div className="flex items-center gap-2 text-sm text-[#3A4A58]"><MapPin className="w-4 h-4 text-[#2E8378]" />{ev.location}</div>
              <div className="flex items-center gap-2 text-sm text-[#3A4A58]"><Users className="w-4 h-4 text-[#2E8378]" />باقي {remaining} من {ev.capacity}</div>
              <div className="text-xs text-[#6B7B88] pt-1">+{ev.points} نقطة مصباح عند الحضور</div>
              {registered ? (
                <Button disabled data-testid="event-register-btn" className="w-full mt-3 bg-[#EBF6F0] text-[#2D6A4F] hover:bg-[#EBF6F0] rounded-full">
                  <CheckCircle2 className="w-4 h-4 ml-1" /> مسجّلة
                </Button>
              ) : (
                <Button data-testid="event-register-btn" onClick={register} disabled={remaining <= 0}
                  className="w-full mt-3 bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">
                  {remaining <= 0 ? "المقاعد ممتلئة" : "سجّليني في الفعالية"}
                </Button>
              )}
              {canManage && (
                <Button data-testid="event-delete-btn" onClick={remove} variant="outline" className="w-full mt-2 rounded-full text-[#B91C1C]">
                  <Trash2 className="w-4 h-4 ml-1" /> حذف الفعالية
                </Button>
              )}
              {canManage && qrCode && (
                <div className="mt-3 pt-3 border-t border-[#EAF0F4] text-center" data-testid="event-qr-box">
                  <div className="text-xs text-[#6B7B88] mb-2">رمز دخول الفعالية — اعرضيه للحاضرات ليمسحنه بالكاميرا</div>
                  <div className="bg-white p-3 inline-block rounded-xl border border-[#DFE8EE]">
                    <QRCodeCanvas value={qrCode} size={150} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManage && attendees.length > 0 && (
        <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
          <h3 className="font-display text-xl mb-4">قائمة المسجلات ({attendees.length})</h3>
          <div className="divide-y divide-[#EAF0F4]">
            {attendees.map(a => (
              <div key={a.id} className="py-3 flex items-center justify-between" data-testid={`attendee-row-${a.user_id}`}>
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9"><AvatarFallback className="bg-[#EAF1F6] text-[#2E4659]">{(a.user_name || "؟")[0]}</AvatarFallback></Avatar>
                  <div>
                    <div className="text-sm font-semibold">{a.user_name}</div>
                    <div className="text-xs text-[#6B7B88]">{a.attended ? "✓ حضرت" : "لم تحضر بعد"}</div>
                  </div>
                </div>
                {!a.attended && (
                  <Button size="sm" data-testid={`attend-btn-${a.user_id}`} onClick={() => attend(a.user_id)} className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full">تسجيل حضور</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
        <h3 className="font-display text-xl mb-4">النقاش والتعليقات</h3>
        <div className="space-y-4 mb-4">
          {comments.length === 0 && <div className="text-sm text-[#6B7B88]">لا تعليقات بعد. كوني أول من يعلّق!</div>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
              <Avatar className="w-9 h-9 shrink-0"><AvatarFallback className="bg-[#EDF5F2] text-[#2E8378]">{(c.user_name || "؟")[0]}</AvatarFallback></Avatar>
              <div className="flex-1 bg-[#FAFCFD] border border-[#EAF0F4] rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.user_name}</span>
                  <span className="text-[11px] text-[#6B7B88]">{new Date(c.created_at).toLocaleString("ar-SA")}</span>
                </div>
                <div className="text-sm text-[#3A4A58] mt-1 leading-relaxed">{c.content}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea data-testid="comment-input" value={text} onChange={e => setText(e.target.value)} placeholder="اكتبي تعليقكِ..." className="min-h-[60px]" />
          <Button data-testid="comment-submit" onClick={addComment} className="bg-[#1C2B39] text-white self-end rounded-full">إرسال</Button>
        </div>
      </div>
    </div>
  );
}
