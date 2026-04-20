import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Activity, FileText, UserCircle, CalendarDays, Sun, Moon } from "lucide-react";
import { useTheme } from "@/App";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useTheme();

  const navItems = [
    { href: "/", label: "Главная", icon: LayoutDashboard },
    { href: "/zayavki", label: "Заявки", icon: Users },
    { href: "/raspisanie", label: "Расписание", icon: CalendarDays },
    { href: "/tarif", label: "Тариф", icon: FileText },
    { href: "/analitika", label: "Аналитика", icon: Activity },
    { href: "/profil", label: "Профиль", icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-60 bg-sidebar border-r border-sidebar-border shrink-0 flex flex-col">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">AutoMind</span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={dark ? "Светлая тема" : "Тёмная тема"}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 pb-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
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

        <div className="px-6 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
          AutoMind v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
