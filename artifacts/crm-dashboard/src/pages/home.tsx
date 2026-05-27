import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Send, ExternalLink, X, Plug2, FileText, MessageSquare, BellRing, Check, Bot, Star } from "lucide-react";
import { useState } from "react";

const BOT_USERNAME = "AutoMind5_bot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;

const steps = [
  { icon: Plug2, label: "Подключаете Telegram", desc: "Одна кнопка — бот уже в вашем аккаунте" },
  { icon: FileText, label: "Загружаете прайс", desc: "Вставьте текст — AI разберёт структуру" },
  { icon: MessageSquare, label: "Бот отвечает клиентам", desc: "24/7, без вашего участия" },
  { icon: BellRing, label: "Получаете заявки", desc: "Уведомление в Telegram — сразу закрываете сделку" },
];

const features = [
  "Бот работает 24/7 — клиенты не ждут",
  "AI парсит прайс в структуру — шаблон остаётся жёстким",
  "Горячие заявки — всегда на первом месте",
  "Уведомления в Telegram мгновенно",
  "Расписание и запись — без лишних звонков",
  "Аналитика по лидам в одном месте",
];

const plans = [
  {
    name: "Базовый",
    price: "990",
    desc: "Всё необходимое для старта",
    icon: null,
    highlight: false,
    features: [
      "AI-бот в Telegram",
      "Приём заявок 24/7",
      "Аналитика по лидам",
      "Расписание и запись",
      "AI разбор прайс-листа",
    ],
  },
  {
    name: "Business",
    price: "1 399",
    desc: "Для бизнеса с активными клиентами",
    icon: Star,
    highlight: true,
    features: [
      "Всё из Базового",
      "Автоматизация чатов Telegram",
      "ИИ ответчик в твоих личных чатах",
      "Управление чатами бота",
      "1 Business-аккаунт включён",
    ],
  },
];

export default function Home() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="space-y-16">

      {/* ── HERO ── */}
      <section className="text-center space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Работает прямо сейчас
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
          ИИ отвечает клиентам<br />вместо вас
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Принимает заявки в Telegram, автоматически отвечает в Business-чатах и превращает диалоги в заказы — пока вы занимаетесь делом.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Button size="lg" className="gap-2 font-semibold rounded-xl px-6" onClick={() => setShowGuide((v) => !v)}>
            <Send className="w-4 h-4" />
            Попробовать бесплатно
          </Button>
          <Button size="lg" variant="outline" className="rounded-xl px-6" asChild>
            <Link href="/zayavki">Смотреть заявки</Link>
          </Button>
        </div>
      </section>

      {/* ── TELEGRAM GUIDE ── */}
      {showGuide && (
        <section className="bg-card border border-border rounded-2xl p-6 saas-card relative max-w-lg mx-auto">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Подключение Telegram-бота</h2>
              <p className="text-sm text-muted-foreground">Займёт меньше минуты</p>
            </div>
          </div>
          <div className="space-y-4 mb-6">
            {[
              { step: 1, title: "Перейдите к боту", desc: `Откройте @${BOT_USERNAME} в Telegram` },
              { step: 2, title: "Нажмите Start", desc: "Запустите бота нажав кнопку Start или /start" },
              { step: 3, title: "Введите ваш username", desc: "Укажите @username чтобы бот знал, чьи заявки принимать" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button asChild size="lg" className="w-full gap-2 font-semibold rounded-xl">
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Открыть бота
            </a>
          </Button>
        </section>
      )}

      {/* ── КАК ЭТО РАБОТАЕТ ── */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Как это работает</h2>
          <p className="text-muted-foreground">Четыре шага — и бот работает за вас</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(({ icon: Icon, label, desc }, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 saas-card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Шаг {i + 1}
                </span>
              </div>
              <p className="font-semibold text-sm leading-snug">{label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ПРИМЕР ЗАЯВКИ ── */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Пример заявки</h2>
          <p className="text-muted-foreground">Вот что приходит в CRM после диалога с ботом</p>
        </div>
        <div className="max-w-sm mx-auto bg-card border border-border rounded-2xl p-6 saas-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
              А
            </div>
            <div>
              <p className="font-semibold">Анна Иванова</p>
              <span className="text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                Горячая заявка
              </span>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            {[
              { emoji: "🎂", label: "Товар", value: "Торт на заказ" },
              { emoji: "⚖️", label: "Объём", value: "2 кг" },
              { emoji: "💰", label: "Сумма", value: "5 000 ₽" },
              { emoji: "📅", label: "Дата", value: "15 апреля" },
            ].map(({ emoji, label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span>{emoji}</span>{label}
                </span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <Button className="w-full rounded-xl font-semibold" asChild>
              <Link href="/zayavki">Открыть заявки →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── ТАРИФЫ ── */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Тарифы</h2>
          <p className="text-muted-foreground">Выберите план под ваши задачи</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-2xl p-8 saas-card text-center space-y-6 ${
                plan.highlight
                  ? "border-2 border-primary shadow-lg shadow-primary/10"
                  : "border border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Рекомендуем
                  </span>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{plan.name}</p>
                <p className="text-4xl font-extrabold text-foreground">{plan.price} ₽</p>
                <p className="text-sm text-muted-foreground mt-1">в месяц</p>
                <p className="text-xs text-muted-foreground mt-2">{plan.desc}</p>
              </div>
              <ul className="space-y-2.5 text-sm text-left">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className={`w-4 h-4 shrink-0 ${plan.highlight ? "text-primary" : "text-primary"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full rounded-xl font-semibold"
                size="lg"
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => setShowGuide(true)}
              >
                Подключить
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── ПОЧЕМУ AUTOMIND ── */}
      <section className="space-y-8 pb-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Почему AutoMind</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 saas-card flex gap-3 items-start">
              <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-snug">{f}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
