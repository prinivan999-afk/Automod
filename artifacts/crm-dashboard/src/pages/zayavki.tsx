import { Link } from "wouter";
import {
  getListBotAccountsQueryKey,
  useListBotAccounts,
  useListLeadChatMessages,
  useListLeads,
  useSaveBotAccount,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageCircle, Instagram, MessageSquare, Search, Filter, Bot, Send, Inbox } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React from "react";
import { toast } from "sonner";

type Platform = "Telegram" | "Instagram" | "MAX";

export default function ZayavkiList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [accountPlatform, setAccountPlatform] = React.useState<Platform>("Telegram");
  const [accountName, setAccountName] = React.useState("");
  const [accountHandle, setAccountHandle] = React.useState("");
  const [notificationChat, setNotificationChat] = React.useState("");

  const queryParams: any = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (platformFilter !== "all") queryParams.platform = platformFilter;

  const { data: leads, isLoading } = useListLeads(queryParams);
  const { data: accounts, isLoading: accountsLoading } = useListBotAccounts();
  const { data: chatMessages, isLoading: chatLoading } = useListLeadChatMessages();
  const saveAccount = useSaveBotAccount();

  const filteredLeads = leads?.filter(lead => 
    lead.clientName.toLowerCase().includes(search.toLowerCase()) || 
    lead.service.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveAccount = () => {
    if (!accountName.trim() || !accountHandle.trim() || !notificationChat.trim()) {
      toast.error("Заполните название аккаунта, ссылку/логин и чат для уведомлений");
      return;
    }

    saveAccount.mutate(
      {
        data: {
          platform: accountPlatform,
          accountName: accountName.trim(),
          accountHandle: accountHandle.trim(),
          notificationChat: notificationChat.trim(),
          isActive: true,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBotAccountsQueryKey() });
          setAccountName("");
          setAccountHandle("");
          setNotificationChat("");
          toast.success("Аккаунт подключён к CRM");
        },
        onError: () => {
          toast.error("Не удалось сохранить аккаунт");
        },
      },
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Telegram":
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case "Instagram":
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case "MAX":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Заявки и аккаунты</h1>
        <p className="text-muted-foreground">Подключите аккаунты, принимайте обращения и получайте итог заявки в чат CRM</p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Bot className="h-4 w-4" />
        <AlertTitle>Как должна работать система</AlertTitle>
        <AlertDescription>
          Владелец бизнеса добавляет свои аккаунты Telegram, MAX или Instagram. Сайт хранит настройки, AI-бот общается с покупателями от имени бизнеса, а после сбора данных создаёт заявку и отправляет её итог в чат ниже.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="leads">Заявки</TabsTrigger>
          <TabsTrigger value="accounts">Аккаунты</TabsTrigger>
          <TabsTrigger value="chat">Чат</TabsTrigger>
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
              
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
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

                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Платформа" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все платформы</SelectItem>
                    <SelectItem value="Telegram">Telegram</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="MAX">MAX</SelectItem>
                  </SelectContent>
                </Select>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Услуга/Товар</TableHead>
                      <TableHead>Канал</TableHead>
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
                            {lead.clientName}
                            {lead.isPriority && (
                              <Badge variant="outline" className="border-primary text-primary h-5 px-1.5 text-[10px] priority-glow">
                                VIP
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.service}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(lead.platform)}
                            <span>{lead.platform}</span>
                          </div>
                        </TableCell>
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
                  <Search className="w-12 h-12 mb-4 text-muted" />
                  <p className="text-lg font-medium">Заявок пока нет</p>
                  <p className="text-sm">Когда сайт создаст заявку из переписки, она появится здесь</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Данные аккаунта клиента</CardTitle>
                <CardDescription>Эти данные нужны, чтобы CRM понимала, от какого аккаунта вести диалог и куда отправлять итог заявки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Приложение</Label>
                  <Select value={accountPlatform} onValueChange={(value) => setAccountPlatform(value as Platform)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="MAX">MAX</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Название аккаунта</Label>
                  <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Например: Цветы на Арбате" />
                </div>
                <div className="space-y-2">
                  <Label>Логин, ссылка или ID аккаунта</Label>
                  <Input value={accountHandle} onChange={(event) => setAccountHandle(event.target.value)} placeholder="@flowers_bot или ссылка на профиль" />
                </div>
                <div className="space-y-2">
                  <Label>Чат для отправки заявок</Label>
                  <Input value={notificationChat} onChange={(event) => setNotificationChat(event.target.value)} placeholder="Например: Основной чат менеджера" />
                </div>
                <Button onClick={handleSaveAccount} disabled={saveAccount.isPending} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {saveAccount.isPending ? "Сохраняем..." : "Подключить аккаунт"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Подключённые аккаунты</CardTitle>
                <CardDescription>По одному активному аккаунту на каждую платформу</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : accounts && accounts.length > 0 ? (
                  accounts.map((account) => (
                    <div key={account.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-medium">
                          {getPlatformIcon(account.platform)}
                          {account.accountName}
                        </div>
                        <Badge variant={account.isActive ? "default" : "outline"}>{account.isActive ? "Активен" : "Отключён"}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">Аккаунт: {account.accountHandle}</div>
                      <div className="text-sm text-muted-foreground">Чат заявок: {account.notificationChat}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    <Bot className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    <p>Аккаунты ещё не подключены</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Чат заявок</CardTitle>
              <CardDescription>Сюда автоматически попадает итог после создания заявки</CardDescription>
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
                        {getPlatformIcon(message.platform)}
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
                  <p className="font-medium">В чате пока нет сообщений</p>
                  <p className="text-sm">Создайте заявку — её данные автоматически появятся здесь</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
