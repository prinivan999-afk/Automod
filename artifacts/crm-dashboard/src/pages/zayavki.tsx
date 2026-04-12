import { useState } from "wouter";
import { Link } from "wouter";
import { useListLeads } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Instagram, MessageSquare, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React from "react";

export default function ZayavkiList() {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const queryParams: any = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (platformFilter !== "all") queryParams.platform = platformFilter;

  const { data: leads, isLoading } = useListLeads(queryParams);

  const filteredLeads = leads?.filter(lead => 
    lead.clientName.toLowerCase().includes(search.toLowerCase()) || 
    lead.service.toLowerCase().includes(search.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold tracking-tight">Все заявки</h1>
        <p className="text-muted-foreground">Управление входящими обращениями клиентов</p>
      </div>

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
              <p className="text-sm">По вашему запросу ничего не найдено</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
