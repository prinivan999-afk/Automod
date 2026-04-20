import { useGetAutomodStats, useGetAutomodActivity } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Bot, MessageSquare, Users } from "lucide-react";

export default function HomePage() {
  const { data: stats, isLoading: statsLoading } = useGetAutomodStats();
  const { data: activity, isLoading: activityLoading } = useGetAutomodActivity();

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Главная</h1>
        <p className="text-sm text-muted-foreground">Обзор состояния AutoMod</p>
      </header>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className={`p-2 rounded-full ${stats.isGlobalEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Статус</p>
              <p className="text-lg font-semibold">{stats.isGlobalEnabled ? "Активен" : "Выключен"}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Сегодня</p>
              <p className="text-lg font-semibold">{stats.todayMessages}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Аккаунты</p>
              <p className="text-lg font-semibold">{stats.activeConnections} / {stats.totalConnections}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Обработано</p>
              <p className="text-lg font-semibold">{stats.totalMessagesHandled}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Последняя активность</h2>

        {activityLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="space-y-3">
            {activity.slice(0, 3).map((msg) => (
              <div key={msg.id} className="bg-card border rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-primary">@{msg.fromUsername || "пользователь"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-foreground line-clamp-1 opacity-80 mb-1">"{msg.userMessage}"</p>
                <p className="text-muted-foreground line-clamp-1">→ {msg.aiResponse}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 border border-dashed rounded-xl bg-card">
            <p className="text-muted-foreground text-sm">Активности пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
}
