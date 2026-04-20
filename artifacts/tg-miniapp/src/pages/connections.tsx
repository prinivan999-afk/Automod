import { useListAutomodConnections, useToggleAutomodConnection } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Info, PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConnectionsPage() {
  const { data: connections, isLoading } = useListAutomodConnections();
  const toggleConnection = useToggleAutomodConnection();

  return (
    <div className="p-4 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Аккаунты</h1>
          <p className="text-sm text-muted-foreground">Подключённые Telegram-аккаунты</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-primary h-8 w-8">
              <PlusCircle className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-[90vw] rounded-xl">
            <DialogHeader>
              <DialogTitle>Подключить аккаунт</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Чтобы подключить аккаунт Telegram Business к AutoMod, выполните следующие шаги:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
                <li>Откройте Telegram с вашим Business-аккаунтом</li>
                <li>Перейдите в <strong>Настройки</strong></li>
                <li>Выберите <strong>Telegram Business</strong></li>
                <li>Нажмите <strong>Чат-боты</strong></li>
                <li>Нажмите <strong>Добавить бота</strong> и введите username нашего бота</li>
                <li>Выберите чаты, к которым бот должен иметь доступ</li>
                <li>Вернитесь сюда — аккаунт появится автоматически</li>
              </ol>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="bg-card border rounded-xl p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="font-semibold text-foreground truncate">{conn.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {conn.username ? `@${conn.username}` : conn.businessConnectionId}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Обработано: {conn.messagesHandled} сообщений
                </p>
              </div>
              <Switch
                checked={conn.isEnabled}
                onCheckedChange={(checked) => {
                  toggleConnection.mutate({ id: conn.id, isEnabled: checked });
                }}
                disabled={toggleConnection.isPending}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-xl bg-card space-y-4">
          <Info className="w-8 h-8 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium text-foreground">Нет подключённых аккаунтов</p>
            <p className="text-sm text-muted-foreground mt-1">Нажмите плюс выше, чтобы добавить.</p>
          </div>
        </div>
      )}
    </div>
  );
}
