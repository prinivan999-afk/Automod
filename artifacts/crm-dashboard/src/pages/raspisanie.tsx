import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Save,
  Trash2,
  Users,
  Plus,
  CalendarOff,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Coffee,
} from "lucide-react";
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
  breakStart: string | null;
  breakEnd: string | null;
  bufferMinutes: number;
  dayName?: string;
}

interface Appointment {
  id: number;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  clientName: string;
  status: string;
  service?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface Override {
  id: number;
  date: string;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

interface Service {
  id: number;
  name: string;
  durationMinutes: number;
  price: string | null;
  active: boolean;
  sortOrder: number;
}

const defaultSchedule: ScheduleDay[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  isWorking: d >= 1 && d <= 5,
  startTime: "09:00",
  endTime: "18:00",
  slotDuration: 30,
  breakStart: null,
  breakEnd: null,
  bufferMinutes: 0,
}));

type Tab = "schedule" | "appointments" | "calendar" | "services" | "overrides";

export default function Raspisanie() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>(defaultSchedule);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadSchedule(), loadAppointments(), loadOverrides(), loadServices()]);
    setLoading(false);
  };

  const loadSchedule = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/schedule`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setSchedule(
            data.map((d: ScheduleDay) => ({
              ...d,
              breakStart: d.breakStart ?? null,
              breakEnd: d.breakEnd ?? null,
              bufferMinutes: d.bufferMinutes ?? 0,
            }))
          );
        }
      }
    } catch (e) {
      console.error("Failed to load schedule", e);
    }
  };

  const loadAppointments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/appointments`, { headers: getAuthHeaders() });
      if (res.ok) setAppointments(await res.json());
    } catch (e) {
      console.error("Failed to load appointments", e);
    }
  };

  const loadOverrides = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/schedule/overrides`, { headers: getAuthHeaders() });
      if (res.ok) setOverrides(await res.json());
    } catch (e) {
      console.error("Failed to load overrides", e);
    }
  };

  const loadServices = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/services`, { headers: getAuthHeaders() });
      if (res.ok) setServices(await res.json());
    } catch (e) {
      console.error("Failed to load services", e);
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
        toast.success("График работы сохранён.");
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
    setSchedule((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d)));
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const upcomingAppointments = appointments
    .filter((a) => a.status === "booked" && a.date >= todayStr)
    .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "schedule", label: "График", icon: Calendar },
    { id: "appointments", label: "Записи", icon: Users, badge: upcomingAppointments.length || undefined },
    { id: "calendar", label: "Календарь", icon: CalendarDaysIcon },
    { id: "services", label: "Услуги", icon: Briefcase, badge: services.length || undefined },
    { id: "overrides", label: "Исключения", icon: CalendarOff, badge: overrides.length || undefined },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Расписание</h1>
        <p className="text-muted-foreground">
          График, услуги, исключения по датам и календарь записей. Бот напомнит клиенту за сутки и за час.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? "default" : "outline"}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2"
            size="sm"
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge ? <Badge className="ml-1 h-5 px-1.5 text-[10px]">{t.badge}</Badge> : null}
          </Button>
        ))}
      </div>

      {activeTab === "schedule" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              График работы по дням
            </CardTitle>
            <CardDescription>
              Рабочие часы, перерыв на обед и буфер между записями. Команда для клиентов:{" "}
              <code className="bg-muted px-1 rounded text-xs">/zapisi</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : (
              schedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors ${
                    day.isWorking ? "bg-card" : "bg-muted/10 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.isWorking}
                      onCheckedChange={(v) => updateDay(day.dayOfWeek, "isWorking", v)}
                    />
                    <div className="min-w-[110px]">
                      <p className="font-medium text-sm">{DAY_NAMES[day.dayOfWeek]}</p>
                      <p className="text-xs text-muted-foreground">{DAY_SHORT[day.dayOfWeek]}</p>
                    </div>
                    {!day.isWorking && (
                      <span className="text-sm text-muted-foreground ml-2">Выходной</span>
                    )}
                  </div>

                  {day.isWorking && (
                    <div className="flex flex-wrap gap-3 pl-12">
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
                            {[15, 20, 30, 45, 60, 90, 120].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n} мин
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Coffee className="w-3 h-3" /> Обед с
                        </Label>
                        <Input
                          type="time"
                          value={day.breakStart ?? ""}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, "breakStart", e.target.value || null)
                          }
                          className="w-28 h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">до</Label>
                        <Input
                          type="time"
                          value={day.breakEnd ?? ""}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, "breakEnd", e.target.value || null)
                          }
                          className="w-28 h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Буфер (мин)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={day.bufferMinutes}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, "bufferMinutes", parseInt(e.target.value) || 0)
                          }
                          className="w-24 h-8 text-sm"
                        />
                      </div>
                    </div>
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
      )}

      {activeTab === "appointments" && (
        <AppointmentsList
          appointments={upcomingAppointments}
          onDelete={handleDeleteAppointment}
        />
      )}

      {activeTab === "calendar" && (
        <CalendarView
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          appointments={appointments}
          overrides={overrides}
          schedule={schedule}
        />
      )}

      {activeTab === "services" && (
        <ServicesManager services={services} onChange={loadServices} />
      )}

      {activeTab === "overrides" && (
        <OverridesManager overrides={overrides} onChange={loadOverrides} />
      )}
    </div>
  );
}

// ── Tiny inline icon to avoid extra import ──
function CalendarDaysIcon(props: any) {
  return <Calendar {...props} />;
}

// ── Appointments list ──
function AppointmentsList({
  appointments,
  onDelete,
}: {
  appointments: Appointment[];
  onDelete: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Предстоящие записи</CardTitle>
        <CardDescription>
          Бот напоминает клиенту за сутки и за час до встречи.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-4 h-12 w-12 opacity-40" />
            <p className="font-medium">Записей пока нет</p>
            <p className="text-sm mt-1">Когда клиент выберет время, запись появится здесь</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt) => {
              const dateObj = new Date(apt.date + "T00:00:00");
              const formatted = dateObj.toLocaleDateString("ru-RU", {
                weekday: "short",
                day: "numeric",
                month: "long",
              });
              return (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 text-center">
                      <p className="text-lg font-bold leading-none">{apt.timeSlot}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatted}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{apt.clientName}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {apt.service && (
                          <Badge variant="secondary" className="text-xs">
                            {apt.service}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {apt.durationMinutes} мин
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(apt.id)}
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
  );
}

// ── Month calendar view ──
function CalendarView({
  month,
  onMonthChange,
  appointments,
  overrides,
  schedule,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  appointments: Appointment[];
  overrides: Override[];
  schedule: ScheduleDay[];
}) {
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7; // make Monday=0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(month.getFullYear(), month.getMonth(), d);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      cells.push({ date: dt, iso });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [month]);

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (a.status !== "booked") continue;
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [appointments]);

  const overridesByDate = useMemo(() => {
    const map = new Map<string, Override>();
    for (const o of overrides) map.set(o.date, o);
    return map;
  }, [overrides]);

  const monthLabel = month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Календарь</CardTitle>
          <CardDescription>
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </CardDescription>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const t = new Date();
              onMonthChange(new Date(t.getFullYear(), t.getMonth(), 1));
            }}
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((c, i) => {
            if (!c.date || !c.iso) return <div key={i} className="aspect-square" />;
            const list = apptsByDate.get(c.iso) ?? [];
            const ovr = overridesByDate.get(c.iso);
            const dow = c.date.getDay();
            const dayCfg = schedule.find((s) => s.dayOfWeek === dow);
            const isWorking = ovr ? ovr.isWorking : dayCfg?.isWorking ?? false;
            const isToday = c.iso === todayIso;
            return (
              <div
                key={i}
                className={`aspect-square rounded-md border p-1 flex flex-col text-left overflow-hidden ${
                  isToday ? "border-primary ring-1 ring-primary/40" : ""
                } ${!isWorking ? "bg-muted/30" : ""}`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className={isToday ? "text-primary" : ""}>{c.date.getDate()}</span>
                  {ovr && !ovr.isWorking && (
                    <CalendarOff className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 mt-0.5 space-y-0.5 overflow-hidden">
                  {list.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="text-[10px] leading-tight bg-primary/15 text-primary rounded px-1 truncate"
                      title={`${a.timeSlot} ${a.clientName}${a.service ? " — " + a.service : ""}`}
                    >
                      {a.timeSlot} {a.clientName}
                    </div>
                  ))}
                  {list.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{list.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Services manager ──
function ServicesManager({ services, onChange }: { services: Service[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const addService = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          durationMinutes: parseInt(duration) || 30,
          price: price.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("Услуга добавлена");
        setName("");
        setPrice("");
        onChange();
      } else {
        toast.error("Ошибка");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleService = async (svc: Service) => {
    await fetch(`${BASE_URL}/api/services/${svc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ active: !svc.active }),
    });
    onChange();
  };

  const deleteService = async (id: number) => {
    if (!confirm("Удалить услугу?")) return;
    await fetch(`${BASE_URL}/api/services/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    toast.success("Удалено");
    onChange();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Услуги
        </CardTitle>
        <CardDescription>
          Бот спросит услугу и подберёт слоты по её длительности.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Название</Label>
              <Input
                placeholder="Маникюр"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Длительность (мин)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Цена (опц.)</Label>
              <Input
                placeholder="2500₽"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <Button onClick={addService} disabled={saving || !name.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </div>
        </div>

        {services.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Услуги пока не добавлены</p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  s.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Switch checked={s.active} onCheckedChange={() => toggleService(s)} />
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {s.durationMinutes} мин
                      </Badge>
                      {s.price && (
                        <Badge variant="secondary" className="text-xs">
                          {s.price}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteService(s.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Overrides manager (holidays / custom-hour days) ──
function OverridesManager({
  overrides,
  onChange,
}: {
  overrides: Override[];
  onChange: () => void;
}) {
  const [date, setDate] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const addOverride = async () => {
    if (!date) {
      toast.error("Укажите дату");
      return;
    }
    if (isWorking && (!startTime || !endTime)) {
      toast.error("Укажите время начала и конца");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/schedule/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          date,
          isWorking,
          startTime: isWorking ? startTime : null,
          endTime: isWorking ? endTime : null,
          note: note.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("Исключение сохранено");
        setDate("");
        setStartTime("");
        setEndTime("");
        setNote("");
        setIsWorking(false);
        onChange();
      } else {
        toast.error("Ошибка");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (id: number) => {
    await fetch(`${BASE_URL}/api/schedule/overrides/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    toast.success("Удалено");
    onChange();
  };

  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOff className="w-5 h-5" />
          Исключения по датам
        </CardTitle>
        <CardDescription>
          Праздники, отпуск, нестандартные часы. Перекрывают обычный график.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Дата</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Заметка</Label>
              <Input
                placeholder="Праздник / отпуск"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isWorking} onCheckedChange={setIsWorking} />
            <span className="text-sm">{isWorking ? "Рабочий день с особыми часами" : "Выходной"}</span>
          </div>
          {isWorking && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Начало</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Конец</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}
          <Button onClick={addOverride} disabled={saving} className="w-full">
            <Plus className="w-4 h-4 mr-1" /> Добавить исключение
          </Button>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <CalendarOff className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Исключений нет</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((o) => {
              const d = new Date(o.date + "T00:00:00").toLocaleDateString("ru-RU", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <div key={o.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{d}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <Badge variant={o.isWorking ? "secondary" : "outline"} className="text-xs">
                        {o.isWorking ? `${o.startTime} – ${o.endTime}` : "Выходной"}
                      </Badge>
                      {o.note && (
                        <span className="text-xs text-muted-foreground">{o.note}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteOverride(o.id)}
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
  );
}
