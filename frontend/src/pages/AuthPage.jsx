import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { ROLE_OPTIONS } from "@/lib/roles";

export default function AuthPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { refresh, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user && user.id) nav("/dashboard");
  }, [user, nav]);

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!email.includes("@")) {
      toast.error("أدخلي بريداً إلكترونياً صحيحاً");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/request-otp", { email: email.toLowerCase().trim() });
      toast.success("تم إرسال رمز التحقق إلى بريدكِ", { description: "قد يستغرق وصول الرسالة دقيقة" });
      setStep("otp");
      setCooldown(45);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "تعذّر إرسال الرمز");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6) {
      toast.error("أدخلي الرمز المكون من 6 خانات");
      return;
    }
    setLoading(true);
    try {
      const payload = { email: email.toLowerCase().trim(), code };
      if (name) payload.name = name;
      if (major) payload.major = major;
      if (year) payload.year = parseInt(year, 10);
      if (role) payload.role = role;
      const { data } = await api.post("/auth/verify-otp", payload);
      await refresh();
      toast.success(`أهلاً ${data.user.name}`);
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "رمز غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFCFD]">
      {/* Left panel (brand) */}
      <div className="hidden lg:block relative overflow-hidden panel-dark-glow">
        <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="شعار نادي مصباح كلية الأعمال" className="w-12 h-12 rounded-xl object-cover border border-white/40 bg-white" />
            <div>
              <div className="font-display text-xl font-bold">نادي مصباح</div>
              <div className="text-[11px] text-[#BBD4E8] font-semibold">كلية الأعمال</div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center py-8">
            <img src="/logo.jpg" alt="" className="w-56 h-56 rounded-3xl object-cover shadow-2xl border border-white/20" />
          </div>
          <div>
            <h2 className="font-display text-3xl leading-tight">
              كوني جزءاً من مجتمع نابض
              <br />
              يُلهم ويُنير الطريق.
            </h2>
            <p className="text-white/80 mt-4 leading-relaxed max-w-md text-sm">
              انضمي لعضوات مصباح، احضري فعاليات مميزة، وشاركي في ورش الدكاترة لتصنعي فرقاً في مسيرتكِ.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel (form) */}
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="text-sm text-[#6B7B88] hover:text-[#1C2B39] inline-flex items-center gap-1 mb-8" data-testid="auth-back-home">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <h1 className="font-display text-3xl font-bold text-[#1C2B39] mb-2">
            {step === "email" ? "أهلاً بكِ في مصباح" : "أدخلي رمز التحقق"}
          </h1>
          <p className="text-sm text-[#6B7B88] mb-8">
            {step === "email"
              ? "أدخلي بريدكِ الجامعي، سنرسل لكِ رمزاً للدخول."
              : `أرسلنا رمزاً مكوّناً من 6 خانات إلى ${email}`}
          </p>

          {step === "email" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-[#3A4A58] mb-2 block">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  data-testid="auth-email-input"
                  dir="ltr"
                  type="email"
                  placeholder="student@university.edu.sa"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-right"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                data-testid="auth-send-otp-btn"
                disabled={loading}
                className="w-full bg-[#3D5A73] hover:bg-[#2E4659] text-white h-11 rounded-full font-semibold"
              >
                {loading ? "جارٍ الإرسال..." : "أرسلي الرمز"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verify} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="auth-otp-input">
                  <InputOTPGroup dir="ltr">
                    {[...Array(6)].map((_, i) => (
                      <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg border-[#DFE8EE]" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#3A4A58] mb-1 block">الاسم (اختياري)</Label>
                  <Input data-testid="auth-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="اسمكِ الكامل" />
                </div>
                <div>
                  <Label className="text-xs text-[#3A4A58] mb-1 block">التخصص (اختياري)</Label>
                  <Input data-testid="auth-major-input" value={major} onChange={e => setMajor(e.target.value)} placeholder="مثال: علوم الحاسب" />
                </div>
                <div>
                  <Label className="text-xs text-[#3A4A58] mb-1 block">السنة الدراسية</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger data-testid="auth-year-select"><SelectValue placeholder="اختاري" /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(y => <SelectItem key={y} value={String(y)}>السنة {y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-[#3A4A58] mb-1 block">الدور</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="auth-role-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                data-testid="auth-verify-btn"
                disabled={loading}
                className="w-full bg-[#3D5A73] hover:bg-[#2E4659] text-white h-11 rounded-full font-semibold"
              >
                {loading ? "جارٍ التحقق..." : "دخول"}
              </Button>
              <div className="text-center text-sm text-[#6B7B88]">
                {cooldown > 0 ? (
                  <span>إعادة الإرسال بعد {cooldown} ثانية</span>
                ) : (
                  <button type="button" onClick={sendOtp} data-testid="auth-resend-btn" className="text-[#2E4659] hover:underline">
                    إعادة إرسال الرمز
                  </button>
                )}
              </div>
              <button type="button" onClick={() => { setStep("email"); setCode(""); }} data-testid="auth-change-email-btn" className="text-xs text-[#6B7B88] hover:text-[#1C2B39] w-full text-center">
                تغيير البريد الإلكتروني
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
