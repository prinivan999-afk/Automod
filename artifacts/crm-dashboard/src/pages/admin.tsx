import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { KeyRound, Copy, ShieldCheck, Star, Crown, RefreshCw, Lock } from "lucide-react";

type GeneratedKey = {
  key: string;
  plan: string;
  durationDays: number;
};

export default function AdminPanel() {
  const [adminSecret, setAdminSecret] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);

  const [basicCount, setBasicCount] = useState("1");
  const [basicDays, setBasicDays] = useState("30");
  const [businessCount, setBusinessCount] = useState("1");
  const [businessDays, setBusinessDays] = useState("30");

  const [isGeneratingBasic, setIsGeneratingBasic] = useState(false);
  const [isGeneratingBusiness, setIsGeneratingBusiness] = useState(false);

  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

  const handleGenerate = async (plan: "basic" | "business") => {
    if (!adminSecret.trim()) {
      toast.error("Введите секретный ключ");
      return;
    }

    const count = plan === "basic" ? parseInt(basicCount) : parseInt(businessCount);
    const durationDays = plan === "basic" ? parseInt(basicDays) : parseInt(businessDays);

    if (!count || count < 1 || count > 100) {
      toast.error("Количество: от 1 до 100");
      return;
    }
    if (!durationDays || durationDays < 1) {
      toast.error("Укажите срок действия в днях");
      return;
    }

    const setLoading = plan === "basic" ? setIsGeneratingBasic : setIsGeneratingBusiness;
    setLoading(true);
    try {
      const res = await fetch("/api/license/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminSecret: adminSecret.trim(), count, plan, durationDays }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        toast.error("Неверный секретный ключ");
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка генерации");
        return;
      }
      const newKeys: GeneratedKey[] = (data.keys as string[]).map((k: string) => ({
        key: k,
        plan,
        durationDays,
      }));
      setGeneratedKeys((prev) => [...newKeys, ...prev]);
      const n = newKeys.length;
      const suffix = n === 1 ? "" : n < 5 ? "а" : "ей";
      toast.success(`Создано ${n} ключ${suffix} (${plan === "business" ? "Business" : "Базовый"})`);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Скопировано!");
  };

  const handleCopyAll = () => {
    const text = generatedKeys.map((k) => k.key).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Все ключи скопированы!");
  };

  const handleClearKeys = () => {
    setGeneratedKeys([]);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Панель администратора</h1>
        <p className="text-muted-foreground">Генерация лицензионных ключей AutoMind</p>
      </div>

      {/* Admin Secret */}
      <Card className="border border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-amber-400">
            <Lock className="w-4 h-4" />
            Секретный ключ администратора
          </CardTitle>
          <CardDescription>Требуется для каждой операции генерации</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type={secretVisible ? "text" : "password"}
              placeholder="Введите admin secret..."
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setSecretVisible((v) => !v)}
            >
              {secretVisible ? "Скрыть" : "Показать"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Generation Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Basic Plan */}
        <Card className="border border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400">Базовый тариф</span>
            </CardTitle>
            <CardDescription>990 ₽/мес · AI-бот, лиды, аналитика, расписание</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Кол-во ключей</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={basicCount}
                  onChange={(e) => setBasicCount(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Срок (дней)</Label>
                <Input
                  type="number"
                  min={1}
                  value={basicDays}
                  onChange={(e) => setBasicDays(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button
              onClick={() => handleGenerate("basic")}
              disabled={isGeneratingBasic}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingBasic ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Генерируем...</>
              ) : (
                <><KeyRound className="w-4 h-4 mr-2" />Создать ключи</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Business Plan */}
        <Card className="border border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400">Business тариф</span>
            </CardTitle>
            <CardDescription>1 399 ₽/мес · всё + Telegram Business AutoMod</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Кол-во ключей</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={businessCount}
                  onChange={(e) => setBusinessCount(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Срок (дней)</Label>
                <Input
                  type="number"
                  min={1}
                  value={businessDays}
                  onChange={(e) => setBusinessDays(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button
              onClick={() => handleGenerate("business")}
              disabled={isGeneratingBusiness}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isGeneratingBusiness ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Генерируем...</>
              ) : (
                <><KeyRound className="w-4 h-4 mr-2" />Создать ключи</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Generated Keys List */}
      {generatedKeys.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Созданные ключи
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border">
                  {generatedKeys.length}
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyAll}>
                  <Copy className="w-3 h-3 mr-1" />
                  Все
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClearKeys} className="text-muted-foreground text-xs">
                  Очистить
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {generatedKeys.map((item, idx) => (
              <div key={idx}>
                {idx > 0 && generatedKeys[idx - 1]?.plan !== item.plan && (
                  <Separator className="my-2" />
                )}
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="flex-1 text-sm font-mono tracking-wide">{item.key}</code>
                  <Badge
                    className={
                      item.plan === "business"
                        ? "bg-purple-500/15 text-purple-400 border-purple-500/30 border text-xs shrink-0"
                        : "bg-blue-500/15 text-blue-400 border-blue-500/30 border text-xs shrink-0"
                    }
                  >
                    {item.plan === "business" ? "Business" : "Базовый"} · {item.durationDays}д
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopyKey(item.key)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
