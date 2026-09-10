import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { formatApiError, BACKEND_URL } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Users, Trash2, CheckCircle2, FileText } from "lucide-react";
import { isDoctorOrAdmin, roleLabel } from "@/lib/roles";

export default function WorkshopDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [w, setW] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [registered, setRegistered] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  const canManage = isDoctorOrAdmin(user?.role);

  const load = async () => {
    try {
      const [{ data }, { data: c }] = await Promise.all([
        api.get(`/workshops/${id}`),
        api.get(`/comments/workshop/${id}`),
      ]);
      setW(data); setComments(c);
      if (canManage) {
        const { data: att } = await api.get(`/workshops/${id}/attendees`);
        setAttendees(att);
        setRegistered(att.some(a => a.user_id === user.id));
      } else {
        const { data: mine } = await api.get("/me/workshops");
        setRegistered(mine.some(m => m.id === id));
      }
    } catch (err) {
      toast.error("تعذّر تحميل الورشة");
    }
  };

  useEffect(() => { load(); }, [id]);

  const register = async () => {
    try {
      await api.post(`/workshops/${id}/register`);
      toast.success("تم تسجيلكِ في الورشة");
      setRegistered(true);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const remove = async () => {
    if (!confirm("حذف الورشة؟")) return;
    await api.delete(`/workshops/${id}`);
    toast.success("تم الحذف");
    nav("/workshops");
  };

  const addComment = async () => {
    if (!text.trim()) return;
    await api.post(`/comments/workshop/${id}`, { content: text });
    setText("");
    const { data: c } = await api.get(`/comments/workshop/${id}`);
    setComments(c);
  };

  const attend = async (uid) => {
    try {
      const { data } = await api.post(`/workshops/${id}/attend/${uid}`);
      if (data.status === "already") toast.info("مُسجّل مسبقاً");
      else toast.success(`تم منح ${data.points_awarded} نقطة`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  if (!w) return <div className="text-[#6B7B88]">جاري التحميل...</div>;
  const remaining = Math.max(w.capacity - (w.registered_count || 0), 0);

  return (
    <div className="space-y-6" data-testid="workshop-detail">
      <Link to="/workshops" className="text-sm text-[#6B7B88] hover:text-[#1C2B39] inline-flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> عودة للورش
      </Link>

      <div className="bg-white border border-[#DFE8EE] rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <Badge className="bg-[#EDF5F2] text-[#2E8378] border-0 rounded-full">ورشة تخصصية</Badge>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">{w.title}</h1>
            <p className="text-sm text-[#6B7B88] mt-2">بإشراف {w.supervisor_name}</p>
            <p className="text-[#3A4A58] mt-4 leading-[1.9]">{w.description}</p>
          </div>
          <div className="min-w-[240px] bg-[#FAFCFD] border border-[#DFE8EE] rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-[#2E8378]" />{new Date(w.scheduled_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-[#2E8378]" />باقي {remaining} من {w.capacity}</div>
            <div className="text-xs text-[#6B7B88]">+{w.points} نقطة</div>
            {registered ? (
              <Button disabled data-testid="ws-register-btn" className="w-full mt-3 bg-[#EBF6F0] text-[#2D6A4F] hover:bg-[#EBF6F0] rounded-full">
                <CheckCircle2 className="w-4 h-4 ml-1" /> مسجّلة
              </Button>
            ) : (
              <Button data-testid="ws-register-btn" onClick={register} disabled={remaining <= 0}
                className="w-full mt-3 bg-[#3D5A73] hover:bg-[#2E4659] text-white rounded-full">
                {remaining <= 0 ? "المقاعد ممتلئة" : "سجّليني"}
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={remove} data-testid="ws-delete-btn" className="w-full mt-2 rounded-full text-[#B91C1C]">
                <Trash2 className="w-4 h-4 ml-1" /> حذف
              </Button>
            )}
          </div>
        </div>

        {w.video_url && (
          <div className="mt-8">
            <h3 className="font-display text-lg mb-3">فيديو الورشة</h3>
            <div className="aspect-video rounded-2xl overflow-hidden border border-[#DFE8EE]">
              <iframe src={w.video_url} title={w.title} className="w-full h-full" allowFullScreen data-testid="ws-video-iframe" />
            </div>
          </div>
        )}

        {w.materials?.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-lg mb-3">مواد ومصادر</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {w.materials.map((m, i) => (
                <a key={i} href={`${BACKEND_URL}${m.url}`} target="_blank" rel="noreferrer"
                  data-testid={`ws-material-${i}`}
                  className="flex items-center gap-3 bg-[#FAFCFD] border border-[#DFE8EE] rounded-xl p-3 hover:border-[#7BA7C9]">
                  <FileText className="w-5 h-5 text-[#2E8378]" />
                  <div className="text-sm text-[#3A4A58] truncate">{m.name}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {canManage && attendees.length > 0 && (
        <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
          <h3 className="font-display text-xl mb-4">المسجلات ({attendees.length})</h3>
          {attendees.map(a => (
            <div key={a.id} className="py-3 flex items-center justify-between border-b border-[#EAF0F4] last:border-0" data-testid={`ws-att-${a.user_id}`}>
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9"><AvatarFallback className="bg-[#EDF5F2] text-[#2E8378]">{(a.user_name || "؟")[0]}</AvatarFallback></Avatar>
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
              {!a.attended && <Button size="sm" data-testid={`ws-attend-${a.user_id}`} onClick={() => attend(a.user_id)} className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full">حضور</Button>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-[#DFE8EE] rounded-2xl p-6">
        <h3 className="font-display text-xl mb-4">أسئلة ونقاش</h3>
        <div className="space-y-4 mb-4">
          {comments.length === 0 && <div className="text-sm text-[#6B7B88]">لا تعليقات بعد.</div>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="w-9 h-9 shrink-0"><AvatarFallback className="bg-[#EAF1F6] text-[#2E4659]">{(c.user_name || "؟")[0]}</AvatarFallback></Avatar>
              <div className="flex-1 bg-[#FAFCFD] border border-[#EAF0F4] rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{c.user_name}</span>
                  {c.user_role && c.user_role !== "student" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDF5F2] text-[#2E8378]">{roleLabel(c.user_role)}</span>
                  )}
                </div>
                <div className="text-sm text-[#3A4A58] mt-1">{c.content}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea data-testid="ws-comment-input" value={text} onChange={e => setText(e.target.value)} placeholder="اكتبي سؤالكِ..." />
          <Button data-testid="ws-comment-submit" onClick={addComment} className="bg-[#1C2B39] text-white self-end rounded-full">إرسال</Button>
        </div>
      </div>
    </div>
  );
}
