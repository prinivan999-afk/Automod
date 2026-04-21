import { Link } from "wouter";
import {
  useListLeadChatMessages,
  useListLeads,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Search, Filter, Inbox } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React from "react";

export default function ZayavkiList() {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const queryParams: any = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  queryParams.platform = "Telegram";

  const { data: leads, isLoading } = useListLeads({ platform: "Telegram", ...(statusFilter !== "all" ? { status: statusFilter as any } : {}) });
  const { data: chatMessages, isLoading: chatLoading } = useListLeadChatMessages();

  const filteredLeads = leads?.filter(lead =>
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
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или услуге..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

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
                            <p className="font-semibold truncate flex items-center gap-2">
                              {lead.clientName}
                              {lead.isPriority && (
                                <Badge variant="outline" className="border-primary text-primary h-5 px-1.5 text-[10px]">
                                  VIP
                                </Badge>
                              )}
                            </p>
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

                        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(lead.createdAt), "d MMM, HH:mm", { locale: ru })}
                          </span>
                          <Button asChild size="sm" className="rounded-xl font-semibold">
                            <Link href={`/zayavki/${lead.id}`}>Открыть →</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <MessageCircle className="w-12 h-12 mb-4 text-muted" />
                  <p className="text-lg font-medium">Заявок пока нет</p>
                  <p className="text-sm">Когда покупатель напишет боту, заявка появится здесь</p>
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
