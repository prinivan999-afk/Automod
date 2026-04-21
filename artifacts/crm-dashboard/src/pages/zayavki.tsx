import { Link } from "wouter";
import {
  useListLeadChatMessages,
  useListLeads,
  useUpdateLeadStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Search, Filter, Inbox, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React from "react";

export default function ZayavkiList() {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<"active" | "completed">("active");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: leads, isLoading } = useListLeads({ platform: "Telegram" });
  const { data: chatMessages, isLoading: chatLoading } = useListLeadChatMessages();

  const updateStatus = useUpdateLeadStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).includes("/api/leads") });
        queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).includes("/api/analytics") });
        toast({ title: "Заявка закрыта", description: "Заявка перенесена в раздел «Завершённые»." });
      },
      onError: (e: any) => {
        toast({ title: "Не удалось закрыть заявку", description: e?.message ?? "Попробуйте ещё раз.", variant: "destructive" });
      },
    },
  });

  const filteredLeads = leads
    ?.filter((lead) => (view === "completed" ? lead.status === "completed" : lead.status !== "completed"))
    .filter((lead) => view === "completed" || statusFilter === "all" || lead.status === statusFilter)
    .filter((lead) =>
      lead.clientName.toLowerCase().includes(search.toLowerCase()) ||
      lead.service.toLowerCase().includes(search.toLowerCase())
    );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "hot":
        return { label: "Горячая заявка", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
      case "warm":
        return { label: "Тёплая заявка", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
      case "cold":
        return { label: "Холодная заявка", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      case "completed":
        return { label: "Завершена", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
      default:
        return { label: "Заявка", className: "bg-muted text-muted-foreground" };
    }
  };

  const extractPhone = (details?: string | null): string | null => {
    if (!details) return null;
    const m = details.match(/(\+?\d[\d\s\-()]{7,})/);
    return m?.[1]?.trim() ?? null;
  };

  const getInitial = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    return clean.charAt(0).toUpperCase() || "?";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Заявки из Telegram</h1>
        <p className="text-muted-foreground">Заявки, поступившие через AI-бота в Telegram</p>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="leads">Заявки</TabsTrigger>
          <TabsTrigger value="chat">Чат уведомлений</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <Card>
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
                <button
                  onClick={() => setView("active")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === "active" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Активные
                </button>
                <button
                  onClick={() => setView("completed")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === "completed" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Завершённые
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени или услуге..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {view === "active" && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все статусы</SelectItem>
                      <SelectItem value="hot">Горячие</SelectItem>
                      <SelectItem value="warm">Тёплые</SelectItem>
                      <SelectItem value="cold">Холодные</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredLeads && filteredLeads.length > 0 ? (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLeads.map((lead) => {
                    const statusBadge = getStatusBadge(lead.status);
                    const phone = extractPhone(lead.details);
                    const rows = [
                      { emoji: "📦", label: "Услуга", value: lead.service },
                      lead.quantity ? { emoji: "📊", label: "Объём", value: lead.quantity } : null,
                      lead.price ? { emoji: "💰", label: "Сумма", value: lead.price } : null,
                      lead.deadline ? { emoji: "📅", label: "Дата", value: lead.deadline } : null,
                      phone ? { emoji: "📞", label: "Телефон", value: phone } : null,
                    ].filter(Boolean) as { emoji: string; label: string; value: string }[];

                    return (
                      <div
                        key={lead.id}
                        className="bg-card border border-border rounded-2xl p-5 saas-card space-y-4 flex flex-col"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {getInitial(lead.clientName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{lead.clientName}</p>
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm flex-1">
                          {rows.map(({ emoji, label, value }) => (
                            <div key={label} className="flex items-start justify-between gap-3">
                              <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                                <span>{emoji}</span>{label}
                              </span>
                              <span className="font-medium text-right break-words">{value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(lead.createdAt), "d MMM, HH:mm", { locale: ru })}
                          </span>
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            {lead.status !== "completed" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 whitespace-nowrap"
                                    disabled={updateStatus.isPending}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Закрыть
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Закрыть заявку?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Заявка от <span className="font-semibold">{lead.clientName}</span> будет помечена как завершённая и перенесена в раздел «Завершённые».
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        updateStatus.mutate({ id: lead.id, data: { status: "completed" as any } })
                                      }
                                    >
                                      Закрыть заявку
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <Button asChild size="sm" className="rounded-xl font-semibold">
                              <Link href={`/zayavki/${lead.id}`}>Открыть →</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <MessageCircle className="w-12 h-12 mb-4 text-muted" />
                  <p className="text-lg font-medium">
                    {view === "completed" ? "Завершённых заявок нет" : "Заявок пока нет"}
                  </p>
                  <p className="text-sm">
                    {view === "completed"
                      ? "После закрытия заявки она появится здесь"
                      : "Когда покупатель напишет боту, заявка появится здесь"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Чат уведомлений</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chatLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : chatMessages && chatMessages.length > 0 ? (
                chatMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <MessageCircle className="w-4 h-4 text-blue-400" />
                        {message.title}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.createdAt), "d MMM yyyy, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-foreground font-sans">{message.message}</pre>
                    {message.leadId && (
                      <Button asChild variant="link" className="mt-2 px-0">
                        <Link href={`/zayavki/${message.leadId}`}>Открыть заявку</Link>
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                  <Inbox className="mx-auto mb-4 h-12 w-12 opacity-40" />
                  <p className="font-medium">Уведомлений пока нет</p>
                  <p className="text-sm">Здесь появятся уведомления о новых заявках</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
