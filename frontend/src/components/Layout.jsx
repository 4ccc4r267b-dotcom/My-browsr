import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShieldCheck, LogOut, User } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import LampIcon from "@/components/LampIcon";

const desktopLinks = [
  { to: "/dashboard", label: "الرئيسية", testid: "nav-dashboard" },
  { to: "/events", label: "الأنشطة", testid: "nav-events" },
  { to: "/workshops", label: "الورش", testid: "nav-workshops" },
  { to: "/news", label: "الإعلانات", testid: "nav-news" },
  { to: "/leaderboard", label: "لوحة الصدارة", testid: "nav-leaderboard" },
];

const mobileLinks = [
  { to: "/dashboard", label: "الرئيسية", mobileId: "mobile-nav-home" },
  { to: "/events", label: "الأنشطة", mobileId: "mobile-nav-activities" },
  { to: "/registrations", label: "تسجيل", mobileId: "mobile-nav-register" },
  { to: "/attendance", label: "إدارة الحضور", mobileId: "mobile-nav-attendance" },
  { to: "/leaderboard", label: "لوحة الصدارة", mobileId: "mobile-nav-leaderboard" },
  { to: "/profile", label: "ملفي", mobileId: "mobile-nav-profile" },
];

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-3" data-testid="brand-link">
      <img src="/logo.jpg" alt="شعار نادي مصباح كلية الأعمال" className="w-11 h-11 rounded-xl object-cover border border-[#D8E3EC] bg-white" />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold text-[#16232E]">نادي مصباح</div>
        <div className="text-[11px] text-[#2C7A7B] font-semibold">كلية الأعمال</div>
      </div>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = (user?.name || "؟").trim().split(" ").slice(0, 2).map(s => s[0]).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu-trigger"
          className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-[#F0F5F8] transition-colors"
        >
          <Avatar className="h-9 w-9 border border-[#DFE8EE]">
            <AvatarFallback className="bg-[#EAF1F6] text-[#2E4659] font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:block text-right leading-tight">
            <div className="text-sm font-semibold text-[#1C2B39]">{user?.name}</div>
            <div className="text-[11px] text-[#6B7B88]">{roleLabel(user?.role)}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>الحساب</DropdownMenuLabel>
        <DropdownMenuItem data-testid="menu-profile" onClick={() => nav("/profile")}>
          <User className="h-4 w-4 ml-2" /> الملف الشخصي
        </DropdownMenuItem>
        {user?.role === "admin" && (
          <DropdownMenuItem data-testid="menu-admin" onClick={() => nav("/admin")}>
            <ShieldCheck className="h-4 w-4 ml-2" /> لوحة الإدارة
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="menu-logout" onClick={logout} className="text-[#B91C1C]">
          <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen w-full bg-[#FAFCFD]">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#FAFCFD]/85 border-b border-[#DFE8EE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Brand />
          <nav className="hidden md:flex items-center gap-1">
            {desktopLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={l.testid}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-[#EAF1F6] text-[#2E4659]" : "text-[#3A4A58] hover:bg-[#F0F5F8]"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                data-testid="nav-admin"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-[#EBF6F0] text-[#2D6A4F]" : "text-[#3A4A58] hover:bg-[#F0F5F8]"
                  }`
                }
              >
                لوحة الإدارة
              </NavLink>
            )}
          </nav>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-[#DFE8EE] safe-bottom">
        <div className="grid grid-cols-6">
          {mobileLinks.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={l.mobileId}
              className="flex flex-col items-center justify-center py-2 text-[10px] gap-0.5"
            >
              {({ isActive }) => (
                <>
                  <LampIcon active={isActive} />
                  <span className={`whitespace-nowrap leading-tight transition-colors duration-300 ${isActive ? "text-[#C8952A] font-bold" : "text-[#6B7B88]"}`}>
                    {l.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
