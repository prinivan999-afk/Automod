import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import {
  customFetch,
  setAuthTokenGetter,
  type AutomodStats,
  type AutomodSettings,
  type SaveAutomodSettingsBody,
  type AutomodSettingsTone,
  type BusinessConnection,
  type AutomodMessage,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, MessageSquare, Users, Activity, Info, PlusCircle, Zap, Settings, List } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TABS = [
  { id: "overview", label: "Обзор", icon: Activity },
  { id: "connections", label: "Аккаунты", icon: Users },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "activity", label: "Активность", icon: List },
] as const;

type TabId = (typeof TABS)[number]["id"];

const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("automod_api_token");
  return token ? { "x-api-token": token } : {};
};

function initAuth() {
  setAuthTokenGetter(() => localStorage.getItem("automod_api_token"));
}

initAuth();

function useAutomodStats() {
  return useQuery({
    queryKey: ["automod-stats"],
    queryFn: () => customFetch<AutomodStats>("/api/automod/stats", { headers: getHeaders() }),
  });
}

function useAutomodSettings() {
  return useQuery({
    queryKey: ["automod-settings"],
    queryFn: () => customFetch<AutomodSettings>("/api/automod/settings", { headers: getHeaders() }),
  });
}

function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveAutomodSettingsBody) =>
      customFetch<AutomodSettings>("/api/automod/settings", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => queryClient.setQueryData(["automod-settings"], data),
  });
}

function useConnections() {
  return useQuery({
    queryKey: ["automod-connections"],
    queryFn: () => customFetch<BusinessConnection[]>("/api/automod/connections", { headers: getHeaders() }),
  });
}

function useToggleConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      customFetch<BusinessConnection>(`/api/automod/connections/${id}/toggle`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["automod-connections"], (old: BusinessConnection[] | undefined) =>
        old ? old.map((c) => (c.id === updated.id ? updated : c)) : old
      );
      queryClient.invalidateQueries({ queryKey: ["automod-stats"] });
    },
  });
}

function useActivity() {
  return useQuery({
    queryKey: ["automod-activity"],
    queryFn: () => customFetch<AutomodMessage[]>("/api/automod/activity", { headers: getHeaders() }),
  });
}

function OverviewTab() {
  const { data: stats, isLoading } = useAutomodStats();
  const { data: activity, isLoading: actLoading } = useActivity();

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.isGlobalEnabled ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Статус</p>
              <p className="text-xl font-bold">{stats.isGlobalEnabled ? "Активен" : "Выключен"}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Сегодня</p>
              <p className="text-xl font-bold">{stats.todayMessages}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Аккаунты</p>
              <p className="text-xl font-bold">{stats.activeConnections} / {stats.totalConnections}</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Всего обработано</p>
              <p className="text-xl font-bold">{stats.totalMessagesHandled}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="text-base font-semibold mb-3">Последняя активность</h3>
        {actLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="space-y-3">
            {activity.slice(0, 5).map((msg) => (
              <div key={msg.id} className="bg-card border rounded-lg p-3 text-sm flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-primary">@{msg.fromUsername || "пользователь"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {new Date(msg.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-foreground opacity-80 truncate">"{msg.userMessage}"</p>
                  <p className="text-muted-foreground truncate">→ {msg.aiResponse}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed rounded-xl bg-card">
            <p className="text-muted-foreground text-sm">Активности пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionsTab() {
  const { data: connections, isLoading } = useConnections();
  const toggleConnection = useToggleConnection();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Управление подключёнными Business-аккаунтами</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>Подключить аккаунт</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Чтобы подключить Telegram Business-аккаунт к AutoMod:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Откройте Telegram с вашим Business-аккаунтом</li>
                <li>Перейдите в <strong>Настройки → Telegram Business</strong></li>
                <li>Нажмите <strong>Чат-боты → Добавить бота</strong></li>
                <li>Введите username нашего бота</li>
                <li>Выберите чаты для доступа</li>
                <li>Вернитесь сюда — аккаунт появится автоматически</li>
              </ol>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{conn.name}</h3>
                  <Badge variant={conn.isEnabled ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {conn.isEnabled ? "Активен" : "Выключен"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {conn.username ? `@${conn.username}` : conn.businessConnectionId}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Обработано: {conn.messagesHandled} сообщений
                </p>
              </div>
              <Switch
                checked={conn.isEnabled}
                onCheckedChange={(checked) => toggleConnection.mutate({ id: conn.id, isEnabled: checked })}
                disabled={toggleConnection.isPending}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed rounded-xl bg-card space-y-3">
          <Info className="w-8 h-8 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium">Нет подключённых аккаунтов</p>
            <p className="text-sm text-muted-foreground mt-1">Нажмите "Добавить", чтобы подключить первый аккаунт.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { data: settings, isLoading } = useAutomodSettings();
  const saveSettings = useSaveSettings();
  const { toast } = useToast();

  const { register, handleSubmit, setValue, watch, reset } = useForm<SaveAutomodSettingsBody>({
    defaultValues: { aiName: "AutoMod", systemPrompt: "", tone: "professional", isEnabled: true },
  });

  const watchTone = watch("tone");
  const watchIsEnabled = watch("isEnabled");

  useEffect(() => {
    if (settings) reset({ aiName: settings.aiName, systemPrompt: settings.systemPrompt, tone: settings.tone, isEnabled: settings.isEnabled });
  }, [settings, reset]);

  const onSubmit = (data: SaveAutomodSettingsBody) => {
    saveSettings.mutate(data, {
      onSuccess: () => toast({ title: "Настройки сохранены", description: "Конфигурация AutoMod обновлена." }),
      onError: () => toast({ title: "Ошибка", description: "Не удалось сохранить настройки.", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
      <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">AutoMod включён</Label>
          <p className="text-sm text-muted-foreground mt-0.5">Включить или отключить автоответы</p>
        </div>
        <Switch checked={watchIsEnabled} onCheckedChange={(v) => setValue("isEnabled", v, { shouldDirty: true })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aiName">Имя ассистента</Label>
        <Input id="aiName" placeholder="Например: Алекс, Поддержка" {...register("aiName", { required: true })} />
      </div>

      <div className="space-y-3">
        <Label>Тон общения</Label>
        <RadioGroup value={watchTone} onValueChange={(v) => setValue("tone", v as AutomodSettingsTone, { shouldDirty: true })} className="grid grid-cols-1 gap-2">
          {[
            { value: "friendly", label: "Дружелюбный", desc: "Неформально, тёплый стиль" },
            { value: "professional", label: "Профессиональный", desc: "Вежливо, по делу" },
            { value: "formal", label: "Официальный", desc: "Строго деловой" },
          ].map((tone) => (
            <Label key={tone.value} className="flex items-center gap-3 bg-card border p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={tone.value} />
              <div>
                <p className="font-medium text-sm">{tone.label}</p>
                <p className="text-xs text-muted-foreground">{tone.desc}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">Инструкции для ИИ</Label>
        <Textarea
          id="systemPrompt"
          placeholder="Опишите ваш бизнес, услуги, цены и как бот должен отвечать..."
          className="min-h-[140px] resize-none"
          {...register("systemPrompt")}
        />
        <p className="text-xs text-muted-foreground">Дайте ИИ контекст о вашем бизнесе для точных ответов.</p>
      </div>

      <Button type="submit" disabled={saveSettings.isPending}>
        {saveSettings.isPending ? "Сохранение..." : "Сохранить настройки"}
      </Button>
    </form>
  );
}

function ActivityTab() {
  const { data: activity, isLoading } = useActivity();

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 bg-card border rounded-xl p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
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
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                  {(msg.fromUsername || "U")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">@{msg.fromUsername || "пользователь"}</p>
                  <div className="text-sm bg-muted/60 rounded-lg rounded-tl-none px-3 py-2 inline-block max-w-md">
                    {msg.userMessage}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary mb-1">AutoMod</p>
                  <div className="text-sm bg-primary/10 rounded-lg rounded-tl-none px-3 py-2 inline-block max-w-md">
                    {msg.aiResponse}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed rounded-xl bg-card">
          <p className="text-muted-foreground">Активности пока нет</p>
          <p className="text-sm text-muted-foreground mt-1">Диалоги появятся после первых сообщений через бота</p>
        </div>
      )}
    </div>
  );
}

export default function TelegramBusinessPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [token, setToken] = useState<string | null>(localStorage.getItem("automod_api_token"));
  const [tokenInput, setTokenInput] = useState("");

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-16 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Telegram Business</h1>
          <p className="text-muted-foreground text-sm">Введите API-токен для управления AutoMod</p>
        </div>
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="API-токен"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tokenInput.trim()) {
                localStorage.setItem("automod_api_token", tokenInput.trim());
                setToken(tokenInput.trim());
              }
            }}
          />
          <Button
            className="w-full"
            onClick={() => {
              if (tokenInput.trim()) {
                localStorage.setItem("automod_api_token", tokenInput.trim());
                setToken(tokenInput.trim());
              }
            }}
          >
            Подключить
          </Button>
        </div>
      </div>
    );
  }

  const ActiveComponent = {
    overview: OverviewTab,
    connections: ConnectionsTab,
    settings: SettingsTab,
    activity: ActivityTab,
  }[activeTab];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Telegram Business</h1>
          <p className="text-muted-foreground text-sm mt-1">Управление AutoMod — ИИ автоответами на сообщения</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => {
            localStorage.removeItem("automod_api_token");
            setToken(null);
          }}
        >
          Выйти
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <ActiveComponent />
    </div>
  );
}
