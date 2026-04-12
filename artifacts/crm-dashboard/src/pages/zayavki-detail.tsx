import { useRoute, Link } from "wouter";
import { useGetLead, useUpdateLeadStatus, getGetLeadQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, User, Package, MessageCircle, AlertCircle, Clock, DollarSign, Text } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { UpdateLeadStatusBodyStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export default function ZayavkiDetail() {
  const [, params] = useRoute("/zayavki/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useGetLead(id, { query: { enabled: !!id } });
  const updateStatus = useUpdateLeadStatus();

  if (!id) return <div>Неверный ID заявки</div>;

  const handleStatusChange = (status: UpdateLeadStatusBodyStatus) => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetLeadQueryKey(id), data);
          toast.success("Статус заявки обновлён");
        },
        onError: () => {
          toast.error("Не удалось обновить статус");
        }
      }
    );
  };

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!lead) {
    return <div className="p-12 text-center">Заявка не найдена</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/zayavki"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Заявка #{lead.id}</h1>
            <Badge className={getStatusColor(lead.status)}>{getStatusText(lead.status)}</Badge>
            {lead.isPriority && (
              <Badge variant="outline" className="border-primary text-primary priority-glow">
                Приоритет
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Создана {format(new Date(lead.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация о заказе</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" /> Клиент
                  </div>
                  <div className="font-medium text-lg">{lead.clientName}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Платформа
                  </div>
                  <div className="font-medium">{lead.platform}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Package className="w-4 h-4" /> Услуга / Товар
                  </div>
                  <div className="font-medium">{lead.service}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Package className="w-4 h-4" /> Количество
                  </div>
                  <div className="font-medium">{lead.quantity || "Не указано"}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Цена
                  </div>
                  <div className="font-medium">{lead.price || "Не указана"}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Дедлайн
                  </div>
                  <div className="font-medium">{lead.deadline || "Без сроков"}</div>
                </div>
              </div>

              {lead.details && (
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <Text className="w-4 h-4" /> Детали
                  </div>
                  <div className="whitespace-pre-wrap">{lead.details}</div>
                </div>
              )}

              {lead.comment && (
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4" /> Комментарий от бота
                  </div>
                  <div className="whitespace-pre-wrap italic">{lead.comment}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {lead.recommendation && (
            <Card className="border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <AlertCircle className="w-5 h-5" />
                  Рекомендация AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{lead.recommendation}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Изменить статус</CardTitle>
              <CardDescription>Управление жизненным циклом заявки</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant={lead.status === "hot" ? "default" : "outline"} 
                className={`w-full justify-start ${lead.status === "hot" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
                onClick={() => handleStatusChange("hot")}
                disabled={updateStatus.isPending}
              >
                Горячий
              </Button>
              <Button 
                variant={lead.status === "warm" ? "default" : "outline"} 
                className={`w-full justify-start ${lead.status === "warm" ? "bg-amber-500 hover:bg-amber-600 text-amber-950" : ""}`}
                onClick={() => handleStatusChange("warm")}
                disabled={updateStatus.isPending}
              >
                Тёплый
              </Button>
              <Button 
                variant={lead.status === "cold" ? "default" : "outline"} 
                className={`w-full justify-start ${lead.status === "cold" ? "bg-muted text-muted-foreground" : ""}`}
                onClick={() => handleStatusChange("cold")}
                disabled={updateStatus.isPending}
              >
                Холодный
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
