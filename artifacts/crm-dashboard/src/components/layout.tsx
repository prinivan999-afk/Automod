import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Activity, FileText, UserCircle, CalendarDays, Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "@/App";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Главная", icon: LayoutDashboard },
    { href: "/zayavki", label: "Заявки", icon: Users },
    { href: "/raspisanie", label: "Расписание", icon: CalendarDays },
    { href: "/tarif", label: "Тариф", icon: FileText },
    { href: "/analitika", label: "Аналитика", icon: Activity },
    { href: "/profil", label: "Профиль", icon: UserCircle },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-5 py-4 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">AutoMind</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={dark ? "Светлая тема" : "Тёмная тема"}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {/* Close button — only on mobile */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
        AutoMind v1.0
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground overflow-hidden">

      {/* ── Top bar (mobile + collapsed desktop) ── */}
      <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sidebar-foreground">AutoMind</span>
        </div>
        <button
          onClick={toggle}
          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar desktop ── */}
        <aside className="hidden md:flex w-56 bg-sidebar border-r border-sidebar-border shrink-0 flex-col">
          <SidebarContent />
        </aside>

        {/* ── Overlay + drawer mobile ── */}
        {open && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* drawer */}
            <aside className="relative z-10 w-64 bg-sidebar flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto">
          <div className="p-5 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
