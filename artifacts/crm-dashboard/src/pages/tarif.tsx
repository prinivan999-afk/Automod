import { useState, useEffect } from "react";
import { useAnalyzeTariff, useSaveTariffSettings, useGetTariffSettings, getGetTariffSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, Save, Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { AnalyzeTariffResponse } from "@workspace/api-client-react/src/generated/api.schemas";
import { useLocation } from "wouter";

function countTariffItems(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function Tarif() {
  const queryClient = useQueryClient();
  const { data: currentSettings } = useGetTariffSettings({ query: { staleTime: 0 } });
  const [, setLocation] = useLocation();
  
  const [rawText, setRawText] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [analyzedResult, setAnalyzedResult] = useState<AnalyzeTariffResponse | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<"loading" | "active" | "trial" | "expired" | "none" | "no-account">("loading");

  useEffect(() => {
    const raw = localStorage.getItem("crm_profile");
    if (!raw) {
      setLicenseStatus("no-account");
      return;
    }
    try {
      const profile = JSON.parse(raw);
      if (!profile?.apiToken) { setLicenseStatus("no-account"); return; }
      fetch(`/api/license/status?apiToken=${encodeURIComponent(profile.apiToken)}`)
        .then(r => r.json())
        .then(data => setLicenseStatus(data.status ?? "none"))
        .catch(() => setLicenseStatus("none"));
    } catch {
      setLicenseStatus("no-account");
    }
  }, []);

  const analyzeMutation = useAnalyzeTariff();
  const saveMutation = useSaveTariffSettings();

  const PLATFORM = '["Telegram"]';

  const handleAnalyze = () => {
    if (!rawText.trim()) {
      toast.error("Введите текст прайс-листа");
      return;
    }
    
    analyzeMutation.mutate(
      { data: { rawText, businessType: businessType || undefined, platforms: PLATFORM } },
      {
        onSuccess: (data) => {
          setAnalyzedResult(data);
          setLastAnalyzedText(rawText);
          toast.success("Тариф успешно проанализирован");
        },
        onError: () => {
          toast.error("Ошибка анализа тарифа");
        }
      }
    );
  };

  const handleSave = () => {
    if (!analyzedResult) return;

    saveMutation.mutate(
      { 
        data: { 
          rawText, 
          businessType: analyzedResult.businessType, 
          structuredData: JSON.stringify(analyzedResult.items), 
          botPrompt: analyzedResult.botPrompt,
          platforms: PLATFORM,
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTariffSettingsQueryKey() });
          setAnalyzedResult(null);
          setRawText("");
          setBusinessType("");
          toast.success("Настройки тарифа сохранены. Бот обновлён.");
        },
        onError: () => {
          toast.error("Ошибка сохранения настроек");
        }
      }
    );
  };

  if (licenseStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Проверка подписки...
      </div>
    );
  }

  if (licenseStatus === "no-account" || licenseStatus === "none" || licenseStatus === "expired") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-1">Доступ закрыт</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {licenseStatus === "no-account"
              ? "Войдите в аккаунт, чтобы пользоваться тарифом."
              : "Для настройки прайса необходима активная подписка. Активируйте пробный период или введите лицензионный ключ."}
          </p>
        </div>
        <Button onClick={() => setLocation("/profil")}>
          {licenseStatus === "no-account" ? "Войти" : "Активировать подписку"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройка прайса и шаблона</h1>
        <p className="text-muted-foreground">AI разбирает ваш прайс в структуру — бот работает по жёсткому шаблону с вашими данными</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Прайс-лист</CardTitle>
            <CardDescription>Вставьте прайс в любом формате. AI извлечёт структуру: названия, цены, единицы — и вставит в шаблон бота. Сам шаблон (правила поведения) остаётся неизменным.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessType">Тип бизнеса (опционально)</Label>
              <Input 
                id="businessType" 
                placeholder="Например: Кондитерская, Фотограф" 
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex-1 flex flex-col">
              <Label htmlFor="rawText">Текст прайс-листа</Label>
              <Textarea 
                id="rawText" 
                placeholder="Вставьте сюда список товаров, услуг, цен и условий..." 
                className="flex-1 min-h-[300px] resize-none font-mono text-sm"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>
          </CardContent>
          {(!analyzedResult || rawText !== lastAnalyzedText) && (
            <CardFooter className="flex-col gap-2">
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzeMutation.isPending || !rawText.trim()}
                className="w-full"
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализируем... до 30 сек</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Анализировать через AI</>
                )}
              </Button>
              {analyzeMutation.isPending && (
                <p className="text-xs text-muted-foreground text-center">
                  AI обрабатывает ваш прайс-лист — пожалуйста, подождите
                </p>
              )}
            </CardFooter>
          )}
        </Card>

        <div className="space-y-6">
          {analyzedResult ? (
            <>
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    Результат анализа
                  </CardTitle>
                  <CardDescription>
                    Тип: {analyzedResult.businessType}. Платформа: Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Название</TableHead>
                          <TableHead>Цена</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyzedResult.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {item.name}
                              {item.description && <div className="text-xs text-muted-foreground mt-1">{item.description}</div>}
                            </TableCell>
                            <TableCell>{item.price} {item.unit && <span className="text-muted-foreground text-xs">/ {item.unit}</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-2">
                    <Label>Шаблон бота с вашими данными</Label>
                    <p className="text-xs text-muted-foreground">Правила поведения зафиксированы — AI только подставил ваш прайс</p>
                    <Textarea 
                      readOnly 
                      value={analyzedResult.botPrompt} 
                      className="h-32 bg-muted/30 font-mono text-xs"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleSave} 
                    disabled={saveMutation.isPending}
                    variant="default"
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" /> Сохранить тариф
                  </Button>
                </CardFooter>
              </Card>
            </>
          ) : (
            <Card className="h-full flex items-center justify-center bg-muted/10 border-dashed">
              <CardContent className="text-center text-muted-foreground py-12">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Заполните прайс-лист слева и нажмите "Анализировать"</p>
              </CardContent>
            </Card>
          )}

          {currentSettings && !analyzedResult && (
            <Card>
              <CardHeader>
                <CardTitle>Текущий активный тариф</CardTitle>
                <CardDescription>Бот использует эти настройки в данный момент</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Тип бизнеса:</span> <span className="font-medium">{currentSettings.businessType}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Платформа:</span>{" "}
                  <span className="font-medium">Telegram</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Распознано позиций:</span>{" "}
                  <span className="font-medium">{countTariffItems(currentSettings.structuredData)}</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRawText(currentSettings.rawText);
                    setBusinessType(currentSettings.businessType);
                  }}
                >
                  Загрузить в редактор
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
