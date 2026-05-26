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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  MessageSquare,
  Users,
  Activity,
  Settings,
  MessagesSquare,
  Ban,
  CheckCircle2,
  Lock,
  Star,
  Zap,
  Copy,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  List,
  ExternalLink,
  CircleDot,
} from "lucide-react";

// ─── Auth ────────────────────────────────────────────────────────────────────
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("automod_api_token");
  return token ? { "x-api-token": token } : {};
};

setAuthTokenGetter(() => localStorage.getItem("automod_api_token"));

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useAutomodStats() {
  return useQuery({
    queryKey: ["automod-stats"],
    queryFn: () => customFetch<AutomodStats>("/api/automod/stats", { headers: getHeaders() }),
    refetchInterval: 30_000,
  });
}
function useAutomodSettings() {
  return useQuery({
    queryKey: ["automod-settings"],
    queryFn: () => customFetch<AutomodSettings>("/api/automod/settings", { headers: getHeaders() }),
  });
}
function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveAutomodSettingsBody) =>
      customFetch<AutomodSettings>("/api/automod/settings", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => qc.setQueryData(["automod-settings"], data),
  });
}
function useConnections() {
  return useQuery({
    queryKey: ["automod-connections"],
    queryFn: () => customFetch<BusinessConnection[]>("/api/automod/connections", { headers: getHeaders() }),
  });
}
function useToggleConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      customFetch<BusinessConnection>(`/api/automod/connections/${id}/toggle`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["automod-connections"], (old: BusinessConnection[] | undefined) =>
        old ? old.map((c) => (c.id === updated.id ? updated : c)) : old
      );
      qc.invalidateQueries({ queryKey: ["automod-stats"] });
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
    refetchInterval: 15_000,
  });
}
function useToggleChatExclude() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<AutomodChat>(`/api/automod/chats/${id}/toggle-exclude`, {
        method: "PATCH",
        headers: getHeaders(),
      }),
    onSuccess: (updated) =>
      qc.setQueryData(["automod-chats"], (old: AutomodChat[] | undefined) =>
        old ? old.map((c) => (c.id === updated.id ? updated : c)) : old
      ),
  });
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Обзор", icon: Activity },
  { id: "chats", label: "Чаты", icon: MessagesSquare },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "activity", label: "История", icon: List },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ─── Main export ─────────────────────────────────────────────────────────────
export default function TelegramBusinessPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [licenseStatus, setLicenseStatus] = useState<
    "loading" | "active" | "trial" | "expired" | "none" | "no-account"
  >("loading");
  const [plan, setPlan] = useState<"basic" | "business">("basic");
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const raw = localStorage.getItem("crm_profile");
    if (!raw) { setLicenseStatus("no-account"); return; }
    try {
      const profile = JSON.parse(raw);
      if (!profile?.apiToken) { setLicenseStatus("no-account"); return; }
      localStorage.setItem("automod_api_token", profile.apiToken);
      fetch(`/api/license/status?apiToken=${encodeURIComponent(profile.apiToken)}`)
        .then((r) => r.json())
        .then((data) => {
          setLicenseStatus(data.status ?? "none");
          setPlan(data.plan ?? "basic");
        })
        .catch(() => setLicenseStatus("none"));
      fetch("/api/users/bot-info", {
        headers: { Authorization: `Bearer ${profile.apiToken}` },
      })
        .then((r) => r.json())
        .then((d) => setBotUsername(d.botUsername ?? null))
        .catch(() => {});
    } catch {
      setLicenseStatus("no-account");
    }
  }, []);

  if (licenseStatus === "loading") {
    return (
      <div className="space-y-4 pt-6 max-w-3xl">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (licenseStatus === "no-account") {
    return (
      <div className="max-w-sm mx-auto py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Требуется аккаунт</h2>
        <p className="text-sm text-muted-foreground">
          Войдите в профиль, чтобы получить доступ к Telegram Business
        </p>
        <Button onClick={() => setLocation("/profil")} className="w-full">
          Перейти в профиль
        </Button>
      </div>
    );
  }

  const hasAccess =
    plan === "business" && (licenseStatus === "active" || licenseStatus === "trial");

  if (!hasAccess) {
    return <UpgradeWall licenseStatus={licenseStatus} onNavigate={setLocation} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business</h1>
        <p className="text-muted-foreground">
          Бот отвечает на сообщения от вашего имени в личных чатах Telegram
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2"
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab botUsername={botUsername} />}
      {activeTab === "chats" && <ChatsTab />}
      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "activity" && <ActivityTab />}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ botUsername }: { botUsername: string | null }) {
  const { data: stats } = useAutomodStats();
  const { data: connections } = useConnections();
  const { data: settings } = useAutomodSettings();
  const toggleConn = useToggleConnection();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!botUsername) return;
    navigator.clipboard.writeText(`@${botUsername}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activeCount = connections?.filter((c) => c.isEnabled).length ?? 0;
  const totalCount = connections?.length ?? 0;
  const isGlobalOn = settings?.isEnabled ?? false;

  return (
    <div className="space-y-5">
      {/* Status hero */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              isGlobalOn && activeCount > 0
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              <Bot className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">AutoMind Bot</h2>
                {botUsername && (
                  <Badge variant="outline" className="font-mono text-xs">
                    @{botUsername}
                  </Badge>
                )}
                <Badge
                  variant={isGlobalOn && activeCount > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {isGlobalOn && activeCount > 0 ? "Работает" : "Выключен"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {activeCount > 0
                  ? `Подключён к ${activeCount} из ${totalCount} аккаунт${totalCount === 1 ? "а" : "ов"}`
                  : "Нет активных подключений — выполните шаги ниже"}
              </p>
            </div>
            {botUsername && (
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copied ? "Скопировано!" : "Скопировать @username"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon={MessageSquare}
          label="Сегодня ответов"
          value={stats?.todayMessages ?? "—"}
        />
        <StatCard
          icon={Zap}
          label="Всего обработано"
          value={stats?.totalMessagesHandled ?? "—"}
        />
        <StatCard
          icon={Users}
          label="Аккаунтов"
          value={totalCount > 0 ? `${activeCount}/${totalCount}` : "0"}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Connections quick list */}
      {(connections?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Подключённые аккаунты
          </h3>
          {connections!.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  conn.isEnabled
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {conn.isEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{conn.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.username ? `@${conn.username}` : conn.businessConnectionId.slice(0, 12) + "..."}
                    {" · "}
                    {conn.messagesHandled} ответов
                  </p>
                </div>
              </div>
              <Switch
                checked={conn.isEnabled}
                onCheckedChange={(v) =>
                  toggleConn.mutate(
                    { id: conn.id, isEnabled: v },
                    {
                      onSuccess: () => toast({ title: v ? "Аккаунт включён" : "Аккаунт выключен" }),
                    }
                  )
                }
                disabled={toggleConn.isPending}
              />
            </div>
          ))}
        </div>
      )}

      {/* Setup guide */}
      <SetupGuide botUsername={botUsername} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: any;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function SetupGuide({ botUsername }: { botUsername: string | null }) {
  const steps = [
    {
      n: 1,
      title: "Включите Business Mode в BotFather",
      desc: "Откройте @BotFather → /mybots → выберите вашего бота → Bot Settings → Business Mode → Enable. Без этого шага бот не сможет принимать сообщения через Business-аккаунт.",
      highlight: true,
    },
    {
      n: 2,
      title: "Откройте Telegram → Настройки",
      desc: "Перейдите в настройки своего аккаунта (должен быть Telegram Business или Premium).",
    },
    {
      n: 3,
      title: "Telegram Business → Чат-боты",
      desc: "Найдите раздел «Telegram Business» и нажмите «Чат-боты» → «Добавить чат-бот».",
    },
    {
      n: 4,
      title: botUsername ? `Найдите и выберите @${botUsername}` : "Введите username бота",
      desc: "Найдите бота в поиске и выберите его. Настройте: Все личные чаты или только выбранные.",
    },
    {
      n: 5,
      title: "Готово — аккаунт появится выше",
      desc: "После подключения аккаунт автоматически появится в списке. Бот начнёт отвечать на ваши входящие сообщения.",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Как подключить бота к Telegram Business
        </CardTitle>
        <CardDescription>
          Следуйте этим шагам в приложении Telegram
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {step.n}
                </div>
                {i < steps.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[20px]" />}
              </div>
              <div className={`pb-5 flex-1 min-w-0 ${i < steps.length - 1 ? "" : ""}`}>
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {botUsername && (
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Username вашего бота</p>
              <p className="font-mono font-semibold text-sm">@{botUsername}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Chats tab ────────────────────────────────────────────────────────────────
function ChatsTab() {
  const { data: chats, isLoading } = useChats();
  const toggleExclude = useToggleChatExclude();
  const { toast } = useToast();

  const active = chats?.filter((c) => !c.isExcluded) ?? [];
  const excluded = chats?.filter((c) => c.isExcluded) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <MessagesSquare className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <p className="font-medium">Чатов пока нет</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Чаты появятся автоматически, когда кто-то напишет вам в Telegram — бот ответит и чат появится здесь
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = (chat: AutomodChat) => {
    toggleExclude.mutate(chat.id, {
      onSuccess: (updated) =>
        toast({
          title: updated.isExcluded ? "Бот отключён для этого чата" : "Бот включён для этого чата",
        }),
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const ChatRow = ({ chat }: { chat: AutomodChat }) => (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border bg-card p-3.5 transition-opacity ${
        chat.isExcluded ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
          chat.isExcluded
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        }`}>
          {(chat.chatTitle || chat.chatUsername || "?")[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {chat.chatTitle || chat.chatUsername || `Chat ${chat.chatId}`}
            </span>
            {chat.isExcluded ? (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                Исключён
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Активен</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(chat.lastSeenAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <Switch
        checked={!chat.isExcluded}
        onCheckedChange={() => handleToggle(chat)}
        disabled={toggleExclude.isPending}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Управляйте тем, в каких чатах бот может отвечать. Всего чатов: <strong>{chats.length}</strong>, активных:{" "}
        <strong className="text-green-500">{active.length}</strong>, исключённых:{" "}
        <strong>{excluded.length}</strong>.
      </p>

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Активные ({active.length})
          </p>
          {active.map((c) => <ChatRow key={c.id} chat={c} />)}
        </div>
      )}

      {excluded.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Исключённые ({excluded.length})
          </p>
          {excluded.map((c) => <ChatRow key={c.id} chat={c} />)}
        </div>
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const { data: settings, isLoading } = useAutomodSettings();
  const saveSettings = useSaveSettings();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch, reset } =
    useForm<SaveAutomodSettingsBody>({
      defaultValues: { aiName: "AutoMind", systemPrompt: "", tone: "professional", isEnabled: true },
    });
  const watchTone = watch("tone");
  const watchEnabled = watch("isEnabled");

  useEffect(() => {
    if (settings)
      reset({
        aiName: settings.aiName,
        systemPrompt: settings.systemPrompt,
        tone: settings.tone,
        isEnabled: settings.isEnabled,
      });
  }, [settings, reset]);

  if (isLoading)
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );

  const onSubmit = (data: SaveAutomodSettingsBody) => {
    saveSettings.mutate(data, {
      onSuccess: () => toast({ title: "Настройки сохранены" }),
      onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
      {/* Global toggle */}
      <Card>
        <CardContent className="pt-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Автоответы включены</p>
            <p className="text-sm text-muted-foreground">Бот будет отвечать на входящие сообщения</p>
          </div>
          <Switch
            checked={watchEnabled}
            onCheckedChange={(v) => setValue("isEnabled", v, { shouldDirty: true })}
          />
        </CardContent>
      </Card>

      {/* Bot name */}
      <div className="space-y-2">
        <Label htmlFor="aiName" className="font-semibold">Имя ассистента</Label>
        <Input
          id="aiName"
          placeholder="Например: Алекс, Менеджер, AutoMind"
          {...register("aiName", { required: true })}
        />
        <p className="text-xs text-muted-foreground">
          Так будет представляться ИИ при общении с клиентами.
        </p>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label className="font-semibold">Тон общения</Label>
        <RadioGroup
          value={watchTone}
          onValueChange={(v) => setValue("tone", v as AutomodSettingsTone, { shouldDirty: true })}
          className="grid grid-cols-1 gap-2"
        >
          {[
            { value: "friendly", label: "Дружелюбный", desc: "Неформально, тёплый стиль" },
            { value: "professional", label: "Профессиональный", desc: "Вежливо, по делу" },
            { value: "formal", label: "Официальный", desc: "Строго деловой" },
          ].map((tone) => (
            <Label
              key={tone.value}
              className={`flex items-center gap-3 border p-3.5 rounded-xl cursor-pointer transition-colors ${
                watchTone === tone.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value={tone.value} />
              <div>
                <p className="font-medium text-sm">{tone.label}</p>
                <p className="text-xs text-muted-foreground">{tone.desc}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* System prompt */}
      <div className="space-y-2">
        <Label htmlFor="systemPrompt" className="font-semibold">Инструкции для ИИ</Label>
        <Textarea
          id="systemPrompt"
          placeholder="Расскажите о вашем бизнесе, услугах, ценах и правилах общения. Чем больше контекста — тем точнее ответы бота..."
          className="min-h-[160px] resize-none"
          {...register("systemPrompt")}
        />
        <p className="text-xs text-muted-foreground">
          Дайте ИИ контекст: кто вы, что продаёте, как отвечать на частые вопросы.
        </p>
      </div>

      <Button type="submit" disabled={saveSettings.isPending} className="w-full">
        {saveSettings.isPending ? "Сохранение..." : "Сохранить настройки"}
      </Button>
    </form>
  );
}

// ─── Activity tab ─────────────────────────────────────────────────────────────
function ActivityTab() {
  const { data: activity, isLoading } = useActivity();

  if (isLoading)
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-card border rounded-xl p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );

  if (!activity || activity.length === 0)
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <p className="font-medium">Диалогов пока нет</p>
          <p className="text-sm text-muted-foreground">
            Здесь появятся переписки бота с клиентами
          </p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Последние {Math.min(activity.length, 20)} диалогов
      </p>
      {activity.slice(0, 20).map((msg) => (
        <Card key={msg.id}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2">
                <CircleDot className="w-3 h-3 text-green-500" />
                <span className="text-xs font-medium">
                  @{msg.fromUsername || "пользователь"}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {new Date(msg.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Client message */}
            <div className="flex gap-3">
              <div className="mt-1 w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                {(msg.fromUsername || "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Клиент</p>
                <div className="text-sm bg-muted/60 rounded-xl rounded-tl-none px-3 py-2 inline-block max-w-sm">
                  {msg.userMessage}
                </div>
              </div>
            </div>

            {/* Bot reply */}
            <div className="flex gap-3">
              <div className="mt-1 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary mb-1 font-medium">AutoMind</p>
                <div className="text-sm bg-primary/10 rounded-xl rounded-tl-none px-3 py-2 inline-block max-w-sm">
                  {msg.aiResponse}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Upgrade wall ─────────────────────────────────────────────────────────────
function UpgradeWall({
  licenseStatus,
  onNavigate,
}: {
  licenseStatus: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Telegram Business</h1>
        <p className="text-muted-foreground text-sm">
          {licenseStatus === "expired" || licenseStatus === "none"
            ? "Ваша подписка истекла. Активируйте тариф Business для доступа к автоответам."
            : "Эта функция доступна только на тарифе Business."}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-primary" />
          <p className="font-semibold">Что входит в Business</p>
        </div>
        {[
          "Бот отвечает от вашего имени в личных чатах",
          "Управление исключениями по чатам",
          "История переписок в панели",
          "Настройка тона и инструкций для ИИ",
          "Подключение нескольких аккаунтов",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            {f}
          </div>
        ))}
      </div>

      <Button className="w-full" onClick={() => onNavigate("/tarif")}>
        Перейти к тарифам
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
