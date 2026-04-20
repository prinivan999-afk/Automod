import { Link, useLocation } from "wouter";
import { Home, Users, Settings, Activity } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Главная", icon: Home },
    { href: "/connections", label: "Аккаунты", icon: Users },
    { href: "/activity", label: "Активность", icon: Activity },
    { href: "/settings", label: "Настройки", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-card">
      <main className="flex-1 pb-16 overflow-y-auto bg-background">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around px-2 z-50">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
