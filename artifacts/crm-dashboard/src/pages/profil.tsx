import { useState } from "react";
import { useRegisterUser } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Copy, Check, Key, User, Send } from "lucide-react";
import { toast } from "sonner";

export default function Profil() {
  const [telegramUsername, setTelegramUsername] = useState("");
  const [profile, setProfile] = useState<{ telegramUsername: string; apiToken: string } | null>(() => {
    const saved = localStorage.getItem("crm_profile");
    return saved ? JSON.parse(saved) : null;
  });
  const [copied, setCopied] = useState(false);

  const registerMutation = useRegisterUser();

  const botUsername = "YourCRMBot";

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
          setProfile({ telegramUsername: data.telegramUsername, apiToken: data.apiToken });
          localStorage.setItem("crm_profile", JSON.stringify({ telegramUsername: data.telegramUsername, apiToken: data.apiToken }));
          toast.success("Профиль сохранён!");
        },
        onError: () => {
          toast.error("Ошибка регистрации");
        },
      }
    );
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Скопировано!");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройка профиля</h1>
        <p className="text-muted-foreground">Подключите Telegram-бота к вашему аккаунту</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ваш профиль
          </CardTitle>
          <CardDescription>
            Укажите ваш Telegram-юзернейм. Покупатели будут писать боту, указывая ваш @username, чтобы начать диалог.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {registerMutation.isPending ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </div>

          {profile && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                <Check className="w-4 h-4" />
                Профиль зарегистрирован
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Telegram</p>
                  <p className="font-medium">@{profile.telegramUsername}</p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500/30">Активен</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {profile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API-токен
              </CardTitle>
              <CardDescription>
                Ваш уникальный токен. Отправьте его боту командой <code className="bg-muted px-1 rounded text-xs">/token</code>, чтобы заявки приходили вам в Telegram.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 font-mono text-sm break-all">
                <span className="flex-1 text-xs">{profile.apiToken}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => handleCopy(profile.apiToken)}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  Как привязать Telegram для уведомлений:
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Откройте нашего бота в Telegram</li>
                  <li>Отправьте команду: <code className="bg-muted px-1 rounded text-xs">/token {profile.apiToken.slice(0, 8)}...</code></li>
                  <li>Бот подтвердит привязку</li>
                  <li>Теперь новые заявки будут приходить вам в Telegram!</li>
                </ol>
                <Button
                  className="w-full mt-2"
                  onClick={() => handleCopy(`/token ${profile.apiToken}`)}
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Скопировать команду для бота
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Как работает бот для ваших покупателей
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                  <p>В описании вашего канала или профиля разместите ссылку на бота и укажите ваш юзернейм: <strong>@{profile.telegramUsername}</strong></p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                  <p>Покупатель открывает бота и пишет <strong>@{profile.telegramUsername}</strong></p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</span>
                  <p>Gemini AI начинает диалог от имени вашего бизнеса, узнаёт детали заказа</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">4</span>
                  <p>Когда клиент готов — заявка автоматически создаётся в CRM и приходит вам в Telegram</p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Текст для описания канала/профиля:</p>
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-mono text-xs">
                    {`Для заказа напишите нашему боту и укажите @${profile.telegramUsername}`}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-6 w-6"
                    onClick={() => handleCopy(`Для заказа напишите нашему боту и укажите @${profile.telegramUsername}`)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
