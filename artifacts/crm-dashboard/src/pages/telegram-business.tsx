import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
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
import { Bot, MessageSquare, Users, Activity, Info, PlusCircle, Zap, Settings, List, MessagesSquare, Ban, CheckCircle2, Lock, Star } from "lucide-react";
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
  { id: "chats", label: "Чаты", icon: MessagesSquare },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "activity", label: "Активность", icon: List },
] as const;

type TabId = (typeof TABS)[number]["id"];

type AutomodChat = {
  id: number;
  userId: number | null;
  businessConnectionId: string;
  chatId: string;
  chatTitle: string | null;
  chatUsername: string | null;
  chatType: string | null;
  isExcluded: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

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

function useChats() {
  return useQuery({
    queryKey: ["automod-chats"],
    queryFn: () => customFetch<AutomodChat[]>("/api/automod/chats", { headers: getHeaders() }),
  });
}

function useToggleChatExclude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<AutomodChat>(`/api/automod/chats/${id}/toggle-exclude`, {
        method: "PATCH",
        headers: getHeaders(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["automod-chats"], (old: AutomodChat[] | undefined) =>
        old ? old.map((c) => (c.id === updated.id ? updated : c)) : old
      );
    },
  });
}

function ChatsTab() {
  const { data: chats, isLoading } = useChats();
  const toggleExclude = useToggleChatExclude();
  const { toast } = useToast();

  const handleToggle = (chat: AutomodChat) => {
    toggleExclude.mutate(chat.id, {
      onSuccess: (updated) => {
        toast({
          title: updated.isExcluded ? "Чат заблокирован" : "Чат разблокирован",
          description: updated.isExcluded
            ? `Бот больше не будет отвечать в «${updated.chatTitle || updated.chatId}»`
            : `Бот снова будет отвечать в «${updated.chatTitle || updated.chatId}»`,
        });
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось обновить статус чата", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Здесь отображаются все чаты, в которых бот получал сообщения. Отключите чаты, в которых бот не должен отвечать.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : chats && chats.length > 0 ? (
        <div className="space-y-3">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`bg-card border rounded-xl p-4 flex items-center justify-between gap-4 transition-colors ${
                chat.isExcluded ? "opacity-60 border-destructive/30" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  chat.isExcluded
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}>
                  {(chat.chatTitle || chat.chatUsername || chat.chatId)[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {chat.chatTitle || chat.chatUsername || `Chat ${chat.chatId}`}
                    </span>
                    {chat.isExcluded && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Заблокирован</Badge>
                    )}
                  </div>
                  {chat.chatUsername && (
                    <p className="text-xs text-muted-foreground">@{chat.chatUsername}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Тип: {chat.chatType || "личный"} · Последнее сообщение:{" "}
                    {new Date(chat.lastSeenAt).toLocaleString("ru-RU", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {chat.isExcluded ? (
                  <Ban className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                <Switch
                  checked={!chat.isExcluded}
                  onCheckedChange={() => handleToggle(chat)}
                  disabled={toggleExclude.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-14 border border-dashed rounded-xl bg-card space-y-3">
          <MessagesSquare className="w-8 h-8 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium">Чатов пока нет</p>
            <p className="text-sm text-muted-foreground mt-1">
              Чаты появятся автоматически, когда бот получит первые сообщения через Business-аккаунт
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  const [licenseStatus, setLicenseStatus] = useState<"loading" | "active" | "trial" | "expired" | "none" | "no-account">("loading");
  const [plan, setPlan] = useState<"basic" | "business">("basic");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const raw = localStorage.getItem("crm_profile");
    if (!raw) { setLicenseStatus("no-account"); return; }
    try {
      const profile = JSON.parse(raw);
      if (!profile?.apiToken) { setLicenseStatus("no-account"); return; }
      // Sync token for API calls
      localStorage.setItem("automod_api_token", profile.apiToken);
      fetch(`/api/license/status?apiToken=${encodeURIComponent(profile.apiToken)}`)
        .then(r => r.json())
        .then(data => {
          setLicenseStatus(data.status ?? "none");
          setPlan(data.plan ?? "basic");
        })
        .catch(() => setLicenseStatus("none"));
    } catch {
      setLicenseStatus("no-account");
    }
  }, []);

  if (licenseStatus === "loading") {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (licenseStatus === "no-account") {
    return (
      <div className="max-w-sm mx-auto py-16 text-center space-y-4">
        <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Требуется аккаунт</h2>
        <p className="text-muted-foreground text-sm">Войдите в профиль, чтобы получить доступ к Telegram Business</p>
        <Button onClick={() => setLocation("/profile")} className="w-full rounded-xl">Перейти в профиль</Button>
      </div>
    );
  }

  const hasAccess = plan === "business" && (licenseStatus === "active" || licenseStatus === "trial");

  if (!hasAccess) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Telegram Business</h1>
          <p className="text-muted-foreground text-sm">
            {licenseStatus === "expired" || licenseStatus === "none"
              ? "Ваша подписка истекла или отсутствует. Активируйте тариф Business для доступа."
              : "Эта функция доступна только на тарифе Business."}
          </p>
        </div>

        <div className="bg-card border-2 border-primary rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">Тариф Business</p>
              <p className="text-sm text-muted-foreground">1 399 ₽ / месяц</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              "Всё из тарифа Базовый",
              "ИИ-автоответы в Telegram Business",
              "Управление и блокировка чатов",
              "Статистика по сообщениям",
              "1 Business-аккаунт включён",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full rounded-xl font-semibold" size="lg" onClick={() => setLocation("/profile")}>
            Активировать Business
          </Button>
        </div>
      </div>
    );
  }

  const ActiveComponent = {
    overview: OverviewTab,
    connections: ConnectionsTab,
    chats: ChatsTab,
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
        <Badge variant="default" className="shrink-0 gap-1.5 mt-1">
          <Star className="w-3 h-3" />
          Business
        </Badge>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
