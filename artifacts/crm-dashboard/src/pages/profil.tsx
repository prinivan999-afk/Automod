import { useState, useEffect } from "react";
import { useRegisterUser, useGetUserProfile, useGetLicenseStatus, useActivateLicense } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Check, User, Send,
  ShieldCheck, ShieldAlert, RefreshCw, Zap, Lock, Clock, Crown
} from "lucide-react";
import { toast } from "sonner";

type Profile = {
  telegramUsername: string;
  apiToken: string;
  telegramUsernameVerified: boolean;
};

export default function Profil() {
  const [telegramUsername, setTelegramUsername] = useState("");
  const [profile, setProfile] = useState<Profile | null>(() => {
    const saved = localStorage.getItem("crm_profile");
    return saved ? JSON.parse(saved) : null;
  });
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");

  const registerMutation = useRegisterUser();
  const activateLicenseMutation = useActivateLicense();

  const { refetch: refetchProfile } = useGetUserProfile(
    { apiToken: profile?.apiToken ?? "" },
    { query: { enabled: false } }
  );

  const {
    data: licenseStatus,
    refetch: refetchLicense,
    isLoading: isLicenseLoading,
  } = useGetLicenseStatus(
    { apiToken: profile?.apiToken ?? "" },
    { query: { enabled: !!profile?.apiToken, refetchInterval: 60_000 } }
  );

  const [tokenMismatch, setTokenMismatch] = useState(false);
  const [loggedInRecoveryToken, setLoggedInRecoveryToken] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [verifyDeepLink, setVerifyDeepLink] = useState<string | null>(null);
  const [isPollingVerification, setIsPollingVerification] = useState(false);

  const handleRefreshStatus = async () => {
    if (!profile?.apiToken) return;
    setIsRefreshing(true);
    try {
      const { data } = await refetchProfile();
      if (data) {
        const updated: Profile = {
          telegramUsername: data.telegramUsername,
          apiToken: data.apiToken,
          telegramUsernameVerified: (data as Profile).telegramUsernameVerified ?? false,
        };
        setProfile(updated);
        localStorage.setItem("crm_profile", JSON.stringify(updated));
        setTokenMismatch(false);
        await refetchLicense();
        if (updated.telegramUsernameVerified) {
          toast.success("Username верифицирован!");
        } else {
          toast.info("Верификация ещё не выполнена. Отправьте /token боту.");
        }
      } else {
        setTokenMismatch(true);
        toast.error("Токен устарел. Восстановите доступ через /mytoken в боте.");
      }
    } catch {
      setTokenMismatch(true);
      toast.error("Токен устарел или недействителен. Восстановите доступ.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVerifyViaTelegram = async () => {
    if (!profile?.apiToken) return;
    setIsRequestingCode(true);
    try {
      const res = await fetch("/api/users/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: profile.apiToken }),
      });
      const data = await res.json();
      if (data.alreadyVerified) {
        toast.success("Аккаунт уже верифицирован!");
        const updated = { ...profile, telegramUsernameVerified: true };
        setProfile(updated);
        localStorage.setItem("crm_profile", JSON.stringify(updated));
        return;
      }
      if (!data.code || !data.botUsername) {
        toast.error("Не удалось получить ссылку. Попробуйте позже.");
        return;
      }
      const deepLink = `https://t.me/${data.botUsername}?start=v_${data.code}`;
      setVerifyDeepLink(deepLink);
      // Open Telegram automatically
      window.open(deepLink, "_blank");
      // Start polling for verification
      setIsPollingVerification(true);
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/users/profile?apiToken=${encodeURIComponent(profile.apiToken)}`);
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.telegramUsernameVerified) {
              clearInterval(pollInterval);
              setIsPollingVerification(false);
              setVerifyDeepLink(null);
              const updated = { ...profile, telegramUsernameVerified: true };
              setProfile(updated);
              localStorage.setItem("crm_profile", JSON.stringify(updated));
              toast.success("✅ Аккаунт успешно верифицирован!");
            }
          }
        } catch { /* ignore */ }
      }, 3000);
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsPollingVerification(false);
      }, 5 * 60 * 1000);
    } catch {
      toast.error("Ошибка при запросе верификации");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleLoggedInRecovery = async () => {
    const token = loggedInRecoveryToken.trim();
    if (!token) { setRecoveryError("Введите токен из бота"); return; }
    setIsRecovering(true);
    setRecoveryError("");
    try {
      const res = await fetch(`/api/users/profile?apiToken=${encodeURIComponent(token)}`);
      if (!res.ok) {
        // Check if current saved token still works — if so, just close recovery
        if (profile?.apiToken) {
          const currentRes = await fetch(`/api/users/profile?apiToken=${encodeURIComponent(profile.apiToken)}`);
          if (currentRes.ok) {
            setTokenMismatch(false);
            setLoggedInRecoveryToken("");
            setRecoveryError("");
            toast.info("Ваш текущий токен работает.");
            return;
          }
        }
        setRecoveryError("Токен не найден. Отправьте /mytoken боту и скопируйте токен из ответа.");
        return;
      }
      const data = await res.json();
      const recovered: Profile = {
        telegramUsername: data.telegramUsername,
        apiToken: data.apiToken,
        telegramUsernameVerified: data.telegramUsernameVerified ?? false,
      };
      setProfile(recovered);
      localStorage.setItem("crm_profile", JSON.stringify(recovered));
      setTokenMismatch(false);
      setLoggedInRecoveryToken("");
      setRecoveryError("");
      toast.success("Доступ восстановлен!");
    } catch {
      setRecoveryError("Ошибка подключения. Попробуйте ещё раз.");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleStartTrial = async () => {
    if (!profile?.apiToken) return;
    setIsStartingTrial(true);
    try {
      const res = await fetch("/api/license/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: profile.apiToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка");
      } else {
        toast.success("Пробный период на 3 дня активирован!");
        await refetchLicense();
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleActivateLicense = () => {
    const key = licenseKey.trim().toUpperCase();
    if (!key || !profile?.apiToken) {
      toast.error("Введите лицензионный ключ");
      return;
    }
    activateLicenseMutation.mutate(
      { data: { apiToken: profile.apiToken, licenseKey: key } },
      {
        onSuccess: () => {
          toast.success("Лицензия активирована!");
          setLicenseKey("");
          refetchLicense();
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg ?? "Неверный или уже использованный ключ");
        },
      }
    );
  };

  const handleRegister = () => {
    const clean = telegramUsername.replace(/^@/, "").trim();
    if (!clean) {
      toast.error("Введите ваш Telegram-юзернейм");
      return;
    }
    registerMutation.mutate(
      { data: { telegramUsername: clean } },
      {
        onSuccess: (data) => {
          const newProfile: Profile = {
            telegramUsername: data.telegramUsername,
            apiToken: data.apiToken,
            telegramUsernameVerified: (data as Profile).telegramUsernameVerified ?? false,
          };
          setProfile(newProfile);
          localStorage.setItem("crm_profile", JSON.stringify(newProfile));
          toast.success("Профиль сохранён!");
        },
        onError: (err: unknown) => {
          const status = (err as any)?.response?.status;
          if (status === 409) {
            toast.error("Этот username уже занят верифицированным аккаунтом");
            setShowRecovery(true);
          } else {
            toast.error("Ошибка регистрации");
          }
        },
      }
    );
  };

  const handleRecoverByToken = async () => {
    const token = recoveryToken.trim();
    if (!token) {
      toast.error("Введите токен");
      return;
    }
    try {
      const res = await fetch(`/api/users/profile?apiToken=${encodeURIComponent(token)}`);
      if (!res.ok) {
        toast.error("Токен не найден. Проверьте правильность токена.");
        return;
      }
      const data = await res.json();
      const recovered: Profile = {
        telegramUsername: data.telegramUsername,
        apiToken: data.apiToken,
        telegramUsernameVerified: data.telegramUsernameVerified ?? false,
      };
      setProfile(recovered);
      localStorage.setItem("crm_profile", JSON.stringify(recovered));
      setShowRecovery(false);
      setRecoveryToken("");
      toast.success("Доступ восстановлен!");
    } catch {
      toast.error("Ошибка при восстановлении");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Скопировано!");
  };


  const isVerified = profile?.telegramUsernameVerified ?? false;

  const statusConfig = {
    trial: { label: "Пробный период", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10", icon: Clock },
    active: { label: "Подписка активна", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10", icon: Crown },
    expired: { label: "Подписка истекла", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", icon: Lock },
    none: { label: "Нет подписки", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", icon: Lock },
  };

  const currentStatus = licenseStatus?.status ?? "none";
  const statusCfg = statusConfig[currentStatus as keyof typeof statusConfig] ?? statusConfig.none;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройка профиля</h1>
        <p className="text-muted-foreground">Управление аккаунтом и подпиской AutoMind</p>
      </div>

      {/* Subscription Status Card */}
      {profile && (
        <Card className={`border ${statusCfg.border}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
              <span className={statusCfg.color}>
                {isLicenseLoading ? "Загрузка..." : statusCfg.label}
              </span>
              {licenseStatus?.daysLeft != null && licenseStatus.daysLeft > 0 && (
                <Badge variant="outline" className={`ml-auto ${statusCfg.color} ${statusCfg.border}`}>
                  {licenseStatus.daysLeft} {licenseStatus.daysLeft === 1 ? "день" : licenseStatus.daysLeft < 5 ? "дня" : "дней"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(currentStatus === "none") && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Начните с бесплатного пробного периода на <strong>3 дня</strong>, затем приобретите ключ за <strong>1 099 ₽</strong> на&nbsp;
                  <a href="https://funpay.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">funpay.com</a>.
                </p>
                <Button onClick={handleStartTrial} disabled={isStartingTrial} className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  {isStartingTrial ? "Активируем..." : "Активировать 3 дня бесплатно"}
                </Button>
              </div>
            )}

            {currentStatus === "expired" && (
              <div className={`rounded-md ${statusCfg.bg} border ${statusCfg.border} p-3 text-sm ${statusCfg.color}`}>
                Пробный период завершён. Приобретите ключ за <strong>1 099 ₽</strong> на{" "}
                <a href="https://funpay.com" target="_blank" rel="noopener noreferrer" className="underline">funpay.com</a> и введите его ниже.
              </div>
            )}

            {currentStatus === "trial" && licenseStatus?.expiresAt && (
              <p className="text-sm text-muted-foreground">
                Пробный период до{" "}
                <strong>{new Date(licenseStatus.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</strong>.
                После — потребуется ключ за 1 099 ₽.
              </p>
            )}

            {currentStatus === "active" && licenseStatus?.expiresAt && (
              <p className="text-sm text-muted-foreground">
                Подписка активна до{" "}
                <strong>{new Date(licenseStatus.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</strong>.
              </p>
            )}

            {/* License Key Input */}
            {(currentStatus === "expired" || currentStatus === "active" || currentStatus === "trial") && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-muted-foreground">Ввести лицензионный ключ</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="AM-XXXX-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleActivateLicense}
                    disabled={activateLicenseMutation.isPending || !licenseKey.trim()}
                    variant={currentStatus === "expired" ? "default" : "outline"}
                  >
                    {activateLicenseMutation.isPending ? "..." : "Активировать"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ваш профиль
          </CardTitle>
          <CardDescription>
            {profile ? "Ваш Telegram-аккаунт привязан к CRM" : "Укажите ваш Telegram-юзернейм для начала работы"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile ? (
            <>
              {/* Registration form — only for new users */}
              <div className="space-y-2">
                <Label htmlFor="username">Ваш Telegram-юзернейм</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="username"
                      placeholder="username"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ""))}
                      className="pl-7"
                    />
                  </div>
                  <Button onClick={handleRegister} disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? "Создаём..." : "Создать аккаунт"}
                  </Button>
                </div>
              </div>

              {/* Recovery block */}
              {showRecovery ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">Восстановление доступа</p>
                    <p className="text-xs text-muted-foreground">
                      Отправьте боту <code className="bg-muted px-1 rounded">/mytoken</code> из Telegram и вставьте полученный токен:
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Вставьте API-токен из бота"
                      value={recoveryToken}
                      onChange={(e) => setRecoveryToken(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={handleRecoverByToken}>Войти</Button>
                  </div>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setShowRecovery(false)}
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => setShowRecovery(true)}
                >
                  Уже есть аккаунт? Войти по токену
                </button>
              )}
            </>
          ) : (
            /* Profile info — for already registered users, no form */
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Telegram</p>
                    <p className="font-medium">@{profile.telegramUsername}</p>
                  </div>
                  {isVerified ? (
                    <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1 border">
                      <ShieldCheck className="w-3 h-3" />
                      Верифицирован
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Не верифицирован
                    </Badge>
                  )}
                </div>

                {!isVerified && (
                  <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-600 dark:text-yellow-400 space-y-3">
                    <p className="font-medium">Требуется верификация</p>
                    <p className="text-xs text-muted-foreground">
                      Нажмите кнопку — откроется Telegram и бот автоматически подтвердит ваш аккаунт. Ничего копировать не нужно.
                    </p>
                    {verifyDeepLink ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                          {isPollingVerification ? "Ожидаем подтверждения от Telegram..." : "Откройте ссылку в Telegram"}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => window.open(verifyDeepLink, "_blank")}
                        >
                          <Send className="w-3 h-3 mr-2" />
                          Открыть Telegram ещё раз
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                        onClick={handleVerifyViaTelegram}
                        disabled={isRequestingCode}
                      >
                        <Send className="w-3 h-3 mr-2" />
                        {isRequestingCode ? "Генерируем ссылку..." : "Подтвердить через Telegram"}
                      </Button>
                    )}
                  </div>
                )}

                {isVerified && (
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <Check className="w-4 h-4" />
                    Telegram подтверждён — покупатели могут вас найти
                  </div>
                )}
              </div>

              {tokenMismatch && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3 mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Токен устарел</p>
                      <p className="text-xs text-muted-foreground">
                        Отправьте <code className="bg-muted px-1 rounded">/mytoken</code> или <code className="bg-muted px-1 rounded">/register</code> боту в Telegram и вставьте полученный токен:
                      </p>
                    </div>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                      onClick={() => { setTokenMismatch(false); setLoggedInRecoveryToken(""); setRecoveryError(""); }}
                    >
                      Закрыть
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Вставьте токен из /mytoken"
                      value={loggedInRecoveryToken}
                      onChange={(e) => { setLoggedInRecoveryToken(e.target.value); setRecoveryError(""); }}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={handleLoggedInRecovery} disabled={isRecovering}>
                      {isRecovering ? "Проверяем..." : "Восстановить"}
                    </Button>
                  </div>
                  {recoveryError && (
                    <p className="text-xs text-red-400">{recoveryError}</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => { localStorage.removeItem("crm_profile"); setProfile(null); }}
                >
                  Выйти из аккаунта
                </button>
                {!tokenMismatch && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setTokenMismatch(true)}
                  >
                    Сменить токен
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client link card */}
      {profile && (
        <>
          {isVerified && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  Ваша ссылка для клиентов
                </CardTitle>
                <CardDescription>
                  Клиент переходит по ссылке — бот сразу знает, что он пишет вам
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Deep link block */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Персональная ссылка</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-foreground break-all">
                      {`https://t.me/AutoMind5_bot?start=${profile.telegramUsername}`}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => handleCopy(`https://t.me/AutoMind5_bot?start=${profile.telegramUsername}`)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Копировать
                    </Button>
                  </div>
                </div>

                {/* How it works */}
                <div className="space-y-3 text-sm">
                  <p className="font-medium text-muted-foreground">Как это работает:</p>
                  {[
                    "Разместите ссылку в описании канала, в шапке профиля или в рекламе",
                    "Клиент нажимает ссылку — бот автоматически открывается уже настроенным на вас",
                    "Gemini AI сразу начинает диалог и выясняет детали заказа по вашему прайсу",
                    "Готовая заявка появляется в CRM и приходит вам уведомлением в Telegram",
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                        {i + 1}
                      </span>
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>

                {/* Short text for sharing */}
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Готовый текст для размещения:</p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-mono text-xs leading-relaxed">
                      {`Для заказа — напишите нашему боту: https://t.me/AutoMind5_bot?start=${profile.telegramUsername}`}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-6 w-6"
                      onClick={() => handleCopy(`Для заказа — напишите нашему боту: https://t.me/AutoMind5_bot?start=${profile.telegramUsername}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
