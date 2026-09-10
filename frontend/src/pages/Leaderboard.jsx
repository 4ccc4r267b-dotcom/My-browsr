import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

export default function Leaderboard() {
  const [top, setTop] = useState([]);
  useEffect(() => { api.get("/leaderboard").then(r => setTop(r.data)); }, []);

  return (
    <div className="space-y-6" data-testid="leaderboard-page">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Trophy className="w-7 h-7 text-[#D9A416]" /> لوحة الصدارة</h1>
        <p className="text-sm text-[#6B7B88] mt-1">أكثر عضوات النادي تألقاً هذا الفصل الدراسي.</p>
      </div>

      <div className="bg-white border border-[#DFE8EE] rounded-3xl overflow-hidden">
        {top.length === 0 && <div className="p-12 text-center text-[#6B7B88]">لا بيانات بعد.</div>}
        {top.map((u, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
          const highlight = i < 3;
          return (
            <div key={u.id} data-testid={`leaderboard-${i}`} className={`flex items-center gap-4 p-5 border-b border-[#EAF0F4] last:border-0 ${highlight ? "bg-gradient-to-l from-[#EDF5F2] via-transparent to-transparent" : ""}`}>
              <div className="w-10 text-center font-display text-xl font-bold">{medal}</div>
              <Avatar className="w-11 h-11"><AvatarFallback className="bg-[#EAF1F6] text-[#2E4659]">{(u.name || "؟")[0]}</AvatarFallback></Avatar>
              <div className="flex-1">
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-[#6B7B88]">{u.major || "طالبة"}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold text-[#2E8378]">{u.points}</div>
                <div className="text-[10px] text-[#6B7B88] tracking-wider">نقطة</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
