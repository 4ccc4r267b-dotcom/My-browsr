import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Users, GraduationCap, Trophy, Calendar } from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#FAFCFD] text-[#1C2B39] grain">
      {/* Nav */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="شعار نادي مصباح كلية الأعمال" className="w-12 h-12 rounded-xl object-cover border border-[#D8E3EC] bg-white" />
            <div>
              <div className="font-display text-xl font-bold">نادي مصباح</div>
              <div className="text-[11px] text-[#2C7A7B] font-semibold">كلية الأعمال</div>
            </div>
          </div>
          <Link
            data-testid="landing-cta-top"
            to={user ? "/dashboard" : "/auth"}
            className="inline-flex items-center gap-2 rounded-full bg-[#1C2B39] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#3A4A58] transition-colors"
          >
            {user ? "الدخول للوحة" : "انضمي للنادي"}
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative lantern-glow">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#DFE8EE] px-4 py-1.5 text-xs text-[#6B7B88]">
              <Sparkles className="w-3.5 h-3.5 text-[#7BA7C9]" />
              منصة الجيل الجديد لعضوات نادي مصباح
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.15]">
              نور، معرفة، وفعاليات
              <br />
              <span className="text-[#3D5A73]">تُشعل حماس</span> عضواتنا.
            </h1>
            <p className="text-base sm:text-lg text-[#3A4A58] leading-[1.9] max-w-2xl">
              منصة موحدة تجمع الطالبات، الدكاترة المشرفات، وإدارة النادي في مكان واحد.
              سجّلي في الفعاليات، تابعي ورش الدكاترة، واجمعي نقاط مصباح لتتصدّري لوحة الشرف.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                data-testid="landing-cta-primary"
                to={user ? "/dashboard" : "/auth"}
                className="inline-flex items-center gap-2 rounded-full bg-[#3D5A73] hover:bg-[#2E4659] text-white px-7 py-3.5 text-sm font-semibold shadow-md transition-all"
              >
                ابدئي رحلتكِ الآن
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                data-testid="landing-cta-secondary"
                className="inline-flex items-center gap-2 rounded-full border border-[#DFE8EE] bg-white text-[#1C2B39] px-7 py-3.5 text-sm font-semibold hover:bg-[#F0F5F8]"
              >
                تعرّفي على المميزات
              </a>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-4 max-w-lg">
              {[
                { k: "+180", v: "عضوة نشطة" },
                { k: "24", v: "ورشة تخصصية" },
                { k: "56", v: "فعالية سنوية" },
              ].map(s => (
                <div key={s.v} className="text-right">
                  <div className="font-display text-2xl font-bold text-[#1C2B39]">{s.k}</div>
                  <div className="text-xs text-[#6B7B88] mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#DFE8EE] shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1664574654700-75f1c1fad74e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwzfHx1bml2ZXJzaXR5JTIwc3R1ZGVudHMlMjBhcmFiJTIwd29tZW4lMjBzdHVkeWluZ3xlbnwwfHx8fDE3ODkwMjI1MjN8MA&ixlib=rb-4.1.0&q=85"
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2B39]/60 via-transparent to-transparent" />
              <div className="absolute bottom-5 right-5 left-5 bg-white/95 backdrop-blur rounded-2xl p-4 border border-[#DFE8EE]">
                <div className="text-[10px] tracking-widest text-[#2E8378] font-bold">هذا الأسبوع</div>
                <div className="font-display text-lg mt-1">ملتقى قياديات مصباح الأول</div>
                <div className="text-xs text-[#6B7B88] mt-1">القاعة الكبرى · باقي 12 مقعد</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[#DFE8EE] bg-[#F0F5F8]/50">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-right mb-12 max-w-2xl">
            <div className="text-xs tracking-widest text-[#2E8378] font-bold mb-3">المميزات</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1C2B39]">
              كل ما تحتاجه عضوة النادي في مكان واحد
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Calendar, title: "فعاليات مصباح", d: "سجّلي في الملتقيات والندوات والبطولات بضغطة زر." },
              { icon: GraduationCap, title: "ورش الدكاترة", d: "محتوى تخصصي، فيديو، وملفات PDF من نخبة الأكاديميات." },
              { icon: Trophy, title: "نقاط ومستويات", d: "اجمعي نقاطكِ من الحضور واصعدي مستويات مصباح." },
              { icon: Users, title: "مجتمع دافئ", d: "تواصلي مع زميلاتكِ والمشرفات عبر تعليقات وإعلانات النادي." },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-[#DFE8EE] p-6 hover:border-[#7BA7C9] transition-colors">
                <div className="w-11 h-11 rounded-xl bg-[#EDF5F2] flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#2E8378]" />
                </div>
                <div className="font-display text-lg font-bold mb-2">{f.title}</div>
                <p className="text-sm text-[#3A4A58] leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#DFE8EE]">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#6B7B88]">© نادي مصباح — كلية الأعمال · جميع الحقوق محفوظة</div>
          <div className="text-xs text-[#6B7B88]">صُنع بحبٍ للطالبات ✦</div>
        </div>
      </footer>
    </div>
  );
}
