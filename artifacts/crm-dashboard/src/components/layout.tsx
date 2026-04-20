import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Activity, FileText, UserCircle, CalendarDays, Sun, Moon, Menu, X, ChevronLeft } from "lucide-react";
import { useTheme } from "@/App";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: "/", label: "Главная", icon: LayoutDashboard },
    { href: "/zayavki", label: "Заявки", icon: Users },
    { href: "/raspisanie", label: "Расписание", icon: CalendarDays },
    { href: "/tarif", label: "Тариф", icon: FileText },
    { href: "/analitika", label: "Аналитика", icon: Activity },
    { href: "/profil", label: "Профиль", icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground overflow-hidden">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
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

        {/* ── Desktop sidebar ── */}
        <aside
          className={`hidden md:flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 transition-all duration-200 ${
            collapsed ? "w-14" : "w-56"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center border-b border-sidebar-border shrink-0 h-14 ${collapsed ? "justify-center px-0" : "px-4 gap-3"}`}>
            {!collapsed && (
              <>
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-bold tracking-tight text-sidebar-foreground flex-1 truncate">AutoMind</span>
              </>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
              title={collapsed ? "Развернуть" : "Свернуть"}
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const linkClass = `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`;

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={100}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} className={linkClass}>
                        <item.icon className="w-4 h-4 shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
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

          {/* Footer */}
          <div className={`border-t border-sidebar-border flex items-center h-12 ${collapsed ? "justify-center" : "px-4 gap-2"}`}>
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
              title={dark ? "Светлая тема" : "Тёмная тема"}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {!collapsed && <span className="text-xs text-muted-foreground">AutoMind v1.0</span>}
          </div>
        </aside>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-10 w-64 bg-sidebar flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="px-4 py-4 flex items-center gap-3 border-b border-sidebar-border">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sidebar-foreground flex-1">AutoMind</span>
                <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
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
              <div className="px-4 py-3 border-t border-sidebar-border text-xs text-muted-foreground">AutoMind v1.0</div>
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
