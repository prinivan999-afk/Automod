import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Save, Trash2, Users, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function getAuthHeaders(): Record<string, string> {
  try {
    const saved = localStorage.getItem("crm_profile");
    if (!saved) return {};
    const profile = JSON.parse(saved);
    if (profile?.apiToken) return { Authorization: `Bearer ${profile.apiToken}` };
  } catch {}
  return {};
}

interface ScheduleDay {
  id?: number;
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
  dayName?: string;
}

interface Appointment {
  id: number;
  date: string;
  timeSlot: string;
  clientName: string;
  status: string;
  createdAt: string;
}

const defaultSchedule: ScheduleDay[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  isWorking: d >= 1 && d <= 5,
  startTime: "09:00",
  endTime: "18:00",
  slotDuration: 30,
}));

export default function Raspisanie() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>(defaultSchedule);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"schedule" | "appointments">("schedule");

  const [gcalStatus, setGcalStatus] = useState<{ configured: boolean; connected: boolean; email: string | null } | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);

  useEffect(() => {
    loadSchedule();
    loadAppointments();
    loadGcalStatus();
  }, []);

  const loadGcalStatus = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/calendar/google/status`, { headers: getAuthHeaders() });
      if (res.ok) setGcalStatus(await res.json());
    } catch (e) {
      console.error("Failed to load gcal status", e);
    }
  };

  const connectGoogle = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/calendar/google/auth`, { headers: getAuthHeaders() });
      if (!res.ok) {
        toast.error("Не удалось получить ссылку авторизации");
        return;
      }
      const { url } = await res.json();
      const win = window.open(url, "_blank", "width=520,height=640");
      const interval = setInterval(async () => {
        if (win?.closed) {
          clearInterval(interval);
          await loadGcalStatus();
          setGcalLoading(false);
        }
      }, 1000);
    } catch {
      toast.error("Ошибка подключения");
      setGcalLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm("Отключить Google Calendar? Существующие записи останутся в обоих местах, но новые перестанут синхронизироваться.")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/calendar/google/disconnect`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Google Calendar отключён");
        await loadGcalStatus();
      }
    } catch {
      toast.error("Ошибка отключения");
    }
  };

  const loadSchedule = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/schedule`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) setSchedule(data);
      }
    } catch (e) {
      console.error("Failed to load schedule", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/appointments`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (e) {
      console.error("Failed to load appointments", e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ days: schedule }),
      });
      if (res.ok) {
        toast.success("График работы сохранён! Бот будет предлагать слоты по этому расписанию.");
      } else {
        toast.error("Ошибка сохранения");
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/appointments/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        toast.success("Запись удалена");
      }
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  const updateDay = (dayOfWeek: number, field: keyof ScheduleDay, value: any) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const upcomingAppointments = appointments
    .filter((a) => a.status === "booked" && a.date >= todayStr)
    .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot))
    .slice(0, 20);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Расписание</h1>
        <p className="text-muted-foreground">Настройте график работы — бот будет предлагать свободные слоты клиентам</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "schedule" ? "default" : "outline"}
          onClick={() => setActiveTab("schedule")}
          className="flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          График работы
        </Button>
        <Button
          variant={activeTab === "appointments" ? "default" : "outline"}
          onClick={() => { setActiveTab("appointments"); loadAppointments(); }}
          className="flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Записи
          {upcomingAppointments.length > 0 && (
            <Badge className="ml-1 h-5 px-1.5 text-[10px]">{upcomingAppointments.length}</Badge>
          )}
        </Button>
      </div>

      {activeTab === "schedule" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Google Calendar
              </CardTitle>
              <CardDescription>
                Двусторонняя синхронизация: новые записи попадают в ваш Google-календарь, а занятые слоты оттуда автоматически блокируются для бота.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gcalStatus === null ? (
                <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
              ) : !gcalStatus.configured ? (
                <p className="text-sm text-muted-foreground">
                  Google OAuth не настроен на сервере. Добавьте <code className="bg-muted px-1 rounded text-xs">GOOGLE_CLIENT_ID</code> и <code className="bg-muted px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code> в Secrets.
                </p>
              ) : gcalStatus.connected ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Подключено: <b>{gcalStatus.email ?? "Google Calendar"}</b></span>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectGoogle}>
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Отключить
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Не подключено</p>
                  <Button onClick={connectGoogle} disabled={gcalLoading} size="sm">
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    {gcalLoading ? "Ожидание..." : "Подключить Google Calendar"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                График работы по дням
              </CardTitle>
              <CardDescription>
                Укажите рабочие часы. Бот будет показывать клиентам доступные слоты на основе этого расписания.
                Команда для клиентов: <code className="bg-muted px-1 rounded text-xs">/zapisi</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : (
                schedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border p-4 transition-colors ${
                      day.isWorking ? "bg-card" : "bg-muted/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Switch
                        checked={day.isWorking}
                        onCheckedChange={(v) => updateDay(day.dayOfWeek, "isWorking", v)}
                      />
                      <div>
                        <p className="font-medium text-sm">{DAY_NAMES[day.dayOfWeek]}</p>
                        <p className="text-xs text-muted-foreground">{DAY_SHORT[day.dayOfWeek]}</p>
                      </div>
                    </div>

                    {day.isWorking && (
                      <div className="flex flex-wrap gap-3 flex-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Начало</Label>
                          <Input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => updateDay(day.dayOfWeek, "startTime", e.target.value)}
                            className="w-28 h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Конец</Label>
                          <Input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => updateDay(day.dayOfWeek, "endTime", e.target.value)}
                            className="w-28 h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Слот (мин)</Label>
                          <Select
                            value={String(day.slotDuration)}
                            onValueChange={(v) => updateDay(day.dayOfWeek, "slotDuration", parseInt(v))}
                          >
                            <SelectTrigger className="w-24 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 мин</SelectItem>
                              <SelectItem value="20">20 мин</SelectItem>
                              <SelectItem value="30">30 мин</SelectItem>
                              <SelectItem value="45">45 мин</SelectItem>
                              <SelectItem value="60">60 мин</SelectItem>
                              <SelectItem value="90">90 мин</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {generateSlotsCount(day.startTime, day.endTime, day.slotDuration)} слотов
                          </Badge>
                        </div>
                      </div>
                    )}

                    {!day.isWorking && (
                      <span className="text-sm text-muted-foreground">Выходной</span>
                    )}
                  </div>
                ))
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Сохраняем..." : "Сохранить расписание"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "appointments" && (
        <Card>
          <CardHeader>
            <CardTitle>Предстоящие записи</CardTitle>
            <CardDescription>
              Записи созданные через бота. Клиенты могут выбрать время командой <code className="bg-muted px-1 rounded text-xs">/zapisi</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-4 h-12 w-12 opacity-40" />
                <p className="font-medium">Записей пока нет</p>
                <p className="text-sm mt-1">Когда клиент выберет время в боте, запись появится здесь</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((apt) => {
                  const dateObj = new Date(apt.date + "T00:00:00");
                  const formatted = dateObj.toLocaleDateString("ru-RU", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  });
                  return (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-4">
                        <div className="w-14 text-center">
                          <p className="text-lg font-bold leading-none">{apt.timeSlot}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatted}</p>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{apt.clientName}</p>
                          <Badge variant="outline" className="text-xs mt-0.5">
                            {apt.status === "booked" ? "Записан" : apt.status}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteAppointment(apt.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function generateSlotsCount(start: string, end: string, slotMinutes: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.floor(total / slotMinutes));
}
