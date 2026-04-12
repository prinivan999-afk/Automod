import { Link } from "wouter";
import { useListLeads, useGetLeadsByPlatform } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, ArrowRight, CheckCircle2, Send, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";

const BOT_USERNAME = "AutoMind5_bot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;

export default function Home() {
  const { data: leads, isLoading: leadsLoading } = useListLeads({ status: "hot" });
  const { data: platforms, isLoading: platformsLoading } = useGetLeadsByPlatform();
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hot":
        return "bg-destructive text-destructive-foreground";
      case "warm":
        return "bg-amber-500 text-amber-950";
      case "cold":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "hot":
        return "Горячий";
      case "warm":
        return "Тёплый";
      case "cold":
        return "Холодный";
      default:
        return "Неизвестно";
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            AI-бот в Telegram принимает заявки за вас
          </h1>
          <p className="text-xl text-muted-foreground">
            Подключите бота к своему Telegram — он будет общаться с клиентами, узнавать детали заказа и автоматически добавлять заявки в CRM. Вы получаете уведомление и сразу закрываете сделку.
          </p>
          <div className="pt-4 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="font-semibold gap-2"
              onClick={() => setShowTelegramGuide(true)}
            >
              <Send className="w-4 h-4" />
              Подключить Telegram
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/zayavki">Перейти к заявкам</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Telegram Connect Guide */}
      {showTelegramGuide && (
        <section className="bg-card border border-primary/40 rounded-xl p-6 shadow-sm relative">
          <button
            onClick={() => setShowTelegramGuide(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Подключение Telegram-бота</h2>
              <p className="text-sm text-muted-foreground">Займёт меньше минуты</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {[
              {
                step: 1,
                title: "Перейдите к боту",
                desc: `Откройте @${BOT_USERNAME} в Telegram`,
              },
              {
                step: 2,
                title: "Нажмите Start",
                desc: "Запустите бота нажав кнопку Start или написав /start",
              },
              {
                step: 3,
                title: "Введите ваш username",
                desc: "Укажите @username вашего Telegram-аккаунта, чтобы бот знал, чьи заявки принимать",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                  {step}
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="gap-2 font-semibold"
            >
              <a href={BOT_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Открыть бота
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/profil">Настроить профиль</Link>
            </Button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connected Channels */}
        <div className="col-span-1 space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Активный канал</h2>
          {platformsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Telegram card — always shown */}
              <Card className="bg-card border-blue-500/30">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    Telegram
                  </CardTitle>
                  <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                    Активен
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {platforms?.find((p) => p.platform === "Telegram")?.count ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">заявок через бота</p>
                </CardContent>
              </Card>

              <button
                onClick={() => setShowTelegramGuide(true)}
                className="w-full text-left"
              >
                <Card className="bg-card hover:border-primary/50 transition-colors cursor-pointer border-dashed">
                  <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
                    <Send className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Как подключить бота?</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </CardContent>
                </Card>
              </button>
            </div>
          )}
        </div>

        {/* Recent Hot Leads */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Горячие заявки</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/zayavki" className="flex items-center gap-2">
                Все заявки <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <Card className="overflow-hidden">
            {leadsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : leads && leads.length > 0 ? (
              <div className="divide-y divide-border">
                {leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/zayavki/${lead.id}`} className="font-semibold hover:underline">
                          {lead.clientName}
                        </Link>
                        {lead.isPriority && (
                          <Badge variant="outline" className="border-primary text-primary">
                            Приоритет
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-blue-400" />
                        <span>{lead.service}</span>
                        <span>•</span>
                        <span>{format(new Date(lead.createdAt), "d MMMM, HH:mm", { locale: ru })}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(lead.status)}>
                      {getStatusText(lead.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <CheckCircle2 className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">Заявок пока нет</p>
                <p className="text-sm">Подключите бота — и новые заявки появятся здесь</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Why Choose Us */}
      <section className="pt-8 border-t border-border">
        <h2 className="text-2xl font-bold tracking-tight mb-8 text-center">Почему AutoMind</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "AI-бот работает 24/7 — отвечает клиентам даже когда вы спите", icon: CheckCircle2 },
            { title: "Принимает заявки через Telegram без вашего участия", icon: CheckCircle2 },
            { title: "Автоматически расставляет приоритеты — горячие клиенты на первом месте", icon: CheckCircle2 },
            { title: "Gemini AI обрабатывает прайс-лист и настраивает бота под ваш бизнес", icon: CheckCircle2 },
            { title: "Вы получаете уведомление в Telegram сразу после новой заявки", icon: CheckCircle2 },
            { title: "Простая настройка — загрузи прайс, и бот готов к работе", icon: CheckCircle2 },
          ].map((feature, i) => (
            <Card key={i} className="bg-card hover:border-primary/50 transition-colors">
              <CardContent className="p-6 flex gap-4 items-start">
                <feature.icon className="w-6 h-6 text-primary shrink-0" />
                <p className="font-medium">{feature.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
