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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hot": return "bg-destructive text-destructive-foreground";
      case "warm": return "bg-amber-500 text-amber-950";
      case "cold": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "hot": return "Горячий";
      case "warm": return "Тёплый";
      case "cold": return "Холодный";
      default: return "Неизвестно";
    }
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Услуга/Товар</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Действие</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-blue-400" />
                            {lead.clientName}
                            {lead.isPriority && (
                              <Badge variant="outline" className="border-primary text-primary h-5 px-1.5 text-[10px]">
                                VIP
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.service}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(lead.createdAt), "d MMM, HH:mm", { locale: ru })}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {getStatusText(lead.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/zayavki/${lead.id}`}>Открыть</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
