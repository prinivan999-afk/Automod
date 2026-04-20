import { useGetAutomodActivity } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User } from "lucide-react";

export default function ActivityPage() {
  const { data: activity, isLoading } = useGetAutomodActivity();

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Активность</h1>
        <p className="text-sm text-muted-foreground">Последние сообщения, обработанные AutoMod</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 bg-card border rounded-xl p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : activity && activity.length > 0 ? (
        <div className="space-y-4">
          {activity.map((msg) => (
            <div key={msg.id} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  ID: {msg.businessConnectionId.substring(0, 8)}...
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString("ru-RU", {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">@{msg.fromUsername || "пользователь"}</p>
                  <p className="text-sm text-foreground bg-secondary/50 p-2 rounded-lg rounded-tl-none inline-block">
                    {msg.userMessage}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-primary">AutoMod</p>
                  <p className="text-sm text-foreground bg-primary/10 p-2 rounded-lg rounded-tl-none inline-block">
                    {msg.aiResponse}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-xl bg-card">
          <p className="text-muted-foreground">Активности пока нет</p>
        </div>
      )}
    </div>
  );
}
