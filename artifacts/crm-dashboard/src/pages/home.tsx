import { Link } from "wouter";
import { useListLeads, useGetLeadsByPlatform } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Instagram, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function Home() {
  const { data: leads, isLoading: leadsLoading } = useListLeads({ status: "hot" });
  const { data: platforms, isLoading: platformsLoading } = useGetLeadsByPlatform();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Telegram":
        return <MessageCircle className="w-5 h-5 text-blue-400" />;
      case "Instagram":
        return <Instagram className="w-5 h-5 text-pink-500" />;
      case "MAX":
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default:
        return <MessageCircle className="w-5 h-5" />;
    }
  };

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
            Управляйте заявками в едином окне
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-бот общается с клиентами, собирает информацию о заказах и передает их прямо в CRM. Не упускайте ни одной заявки.
          </p>
          <div className="pt-4 flex gap-4">
            <Button asChild size="lg" className="font-semibold">
              <Link href="/zayavki">Перейти к заявкам</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/tarif">Настроить тариф</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connected Channels */}
        <div className="col-span-1 space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Подключённые каналы</h2>
          {platformsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {platforms && platforms.length > 0 ? (
                platforms.map((p) => (
                  <Card key={p.platform} className="bg-card">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        {getPlatformIcon(p.platform)}
                        {p.platform}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold">{p.count}</div>
                      <p className="text-xs text-muted-foreground">заявок всего</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Каналы пока не подключены
                  </CardContent>
                </Card>
              )}
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
                          <Badge variant="outline" className="border-primary text-primary priority-glow">
                            Приоритет
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {getPlatformIcon(lead.platform)}
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
                <p className="text-sm">Все новые заявки появятся здесь</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Why Choose Us */}
      <section className="pt-8 border-t border-border">
        <h2 className="text-2xl font-bold tracking-tight mb-8 text-center">Почему именно мы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "AI-бот работает 24/7 — не пропускает ни одного клиента", icon: CheckCircle2 },
            { title: "Поддержка Telegram, Instagram и MAX в одном окне", icon: CheckCircle2 },
            { title: "Автоматически анализирует запросы и расставляет приоритеты", icon: CheckCircle2 },
            { title: "Gemini AI обрабатывает ваш прайс-лист и настраивает бота", icon: CheckCircle2 },
            { title: "Заявки в реальном времени — вы всегда в курсе", icon: CheckCircle2 },
            { title: "Простая настройка — загрузи прайс и бот готов", icon: CheckCircle2 },
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
