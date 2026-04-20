import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send, ExternalLink, X, MessageCircle, BarChart2, CalendarDays, Settings } from "lucide-react";
import { useState } from "react";

const BOT_USERNAME = "AutoMind5_bot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;

export default function Home() {
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            AI-бот в Telegram работает по вашим правилам
          </h1>
          <p className="text-xl text-muted-foreground">
            Загрузите прайс — AI разберёт его в структуру и вставит в жёсткий шаблон. Бот общается с клиентами по вашим правилам, узнаёт детали заказа и добавляет заявки в CRM. Стабильно, предсказуемо, без сюрпризов.
          </p>
          <div className="pt-4 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="font-semibold gap-2"
              onClick={() => setShowTelegramGuide((v) => !v)}
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
            <Button asChild size="lg" className="gap-2 font-semibold">
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

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/zayavki", icon: MessageCircle, label: "Заявки", desc: "Все входящие заявки от клиентов", color: "text-blue-400" },
          { href: "/analitika", icon: BarChart2, label: "Аналитика", desc: "Статистика и показатели бизнеса", color: "text-emerald-400" },
          { href: "/raspisanie", icon: CalendarDays, label: "Расписание", desc: "Управление записями клиентов", color: "text-violet-400" },
          { href: "/tarif", icon: Settings, label: "Тариф и бот", desc: "Настройка прайса и AI-бота", color: "text-amber-400" },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}>
            <Card className="bg-card hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-5 flex flex-col gap-3">
                <Icon className={`w-6 h-6 ${color}`} />
                <div>
                  <p className="font-semibold">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Why Choose Us */}
      <section className="pt-4 border-t border-border">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">Почему AutoMind</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "AI-бот работает 24/7 — отвечает клиентам даже когда вы спите" },
            { title: "Принимает заявки через Telegram без вашего участия" },
            { title: "Автоматически расставляет приоритеты — горячие клиенты на первом месте" },
            { title: "AI только парсит прайс в структуру — бот работает по вашему жёсткому шаблону, не придумывает правила сам" },
            { title: "Вы получаете уведомление в Telegram сразу после новой заявки" },
            { title: "Простая настройка — загрузи прайс, бот получает структуру и готов к работе" },
          ].map((feature, i) => (
            <Card key={i} className="bg-card hover:border-primary/50 transition-colors">
              <CardContent className="p-6 flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <p className="font-medium">{feature.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
