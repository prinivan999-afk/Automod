import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useGetAutomodSettings, useSaveAutomodSettings } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { SaveAutomodSettingsBody, AutomodSettingsTone } from "@workspace/api-client-react";

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetAutomodSettings();
  const saveSettings = useSaveAutomodSettings();
  const { toast } = useToast();

  const { register, handleSubmit, setValue, watch, reset } = useForm<SaveAutomodSettingsBody>({
    defaultValues: {
      aiName: "AutoMod",
      systemPrompt: "",
      tone: "professional",
      isEnabled: true,
    }
  });

  const watchTone = watch("tone");
  const watchIsEnabled = watch("isEnabled");

  useEffect(() => {
    if (settings) {
      reset({
        aiName: settings.aiName,
        systemPrompt: settings.systemPrompt,
        tone: settings.tone,
        isEnabled: settings.isEnabled,
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SaveAutomodSettingsBody) => {
    saveSettings.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Настройки сохранены",
          description: "Конфигурация AutoMod обновлена.",
        });
      },
      onError: () => {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить настройки. Попробуйте ещё раз.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-sm text-muted-foreground">Настройте, как AutoMod отвечает клиентам</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">AutoMod включён</Label>
            <p className="text-sm text-muted-foreground">Включить или отключить бота полностью</p>
          </div>
          <Switch
            checked={watchIsEnabled}
            onCheckedChange={(checked) => setValue("isEnabled", checked, { shouldDirty: true })}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aiName">Имя ассистента</Label>
            <Input
              id="aiName"
              placeholder="Например: Алекс, Поддержка"
              {...register("aiName", { required: true })}
              className="bg-card"
            />
          </div>

          <div className="space-y-3">
            <Label>Тон общения</Label>
            <RadioGroup
              value={watchTone}
              onValueChange={(val) => setValue("tone", val as AutomodSettingsTone, { shouldDirty: true })}
              className="grid grid-cols-1 gap-2"
            >
              <Label className="flex items-center space-x-3 space-y-0 bg-card border p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="friendly" />
                <div className="space-y-1">
                  <p className="font-medium text-sm leading-none">Дружелюбный</p>
                  <p className="text-xs text-muted-foreground">Неформально, тёплый стиль</p>
                </div>
              </Label>
              <Label className="flex items-center space-x-3 space-y-0 bg-card border p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="professional" />
                <div className="space-y-1">
                  <p className="font-medium text-sm leading-none">Профессиональный</p>
                  <p className="text-xs text-muted-foreground">Вежливо, по делу</p>
                </div>
              </Label>
              <Label className="flex items-center space-x-3 space-y-0 bg-card border p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="formal" />
                <div className="space-y-1">
                  <p className="font-medium text-sm leading-none">Официальный</p>
                  <p className="text-xs text-muted-foreground">Строго деловой, максимально уважительный</p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">Инструкции для ИИ</Label>
            <Textarea
              id="systemPrompt"
              placeholder="Опишите ваш бизнес, услуги, цены и как бот должен отвечать на вопросы..."
              className="min-h-[150px] bg-card resize-none"
              {...register("systemPrompt")}
            />
            <p className="text-xs text-muted-foreground">
              Дайте ИИ контекст о вашем бизнесе, чтобы он мог точно отвечать на вопросы.
            </p>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={saveSettings.isPending}
        >
          {saveSettings.isPending ? "Сохранение..." : "Сохранить настройки"}
        </Button>
      </form>
    </div>
  );
}
