import { useParams, Link } from "wouter";
import { useGetLead, useUpdateLeadStatus, LeadStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, PlatformIcon } from "@/components/badges";
import { ArrowLeft, Clock, Calendar, DollarSign, ListOrdered, FileText, Zap, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLeadQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function LeadDetail() {
  const { id } = useParams();
  const leadId = Number(id);
  const { data: lead, isLoading } = useGetLead(leadId, { query: { enabled: !!leadId } });
  const updateStatus = useUpdateLeadStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return <div className="h-[60vh] flex items-center justify-center text-muted-foreground animate-pulse font-mono">Fetching dossier...</div>;
  }

  if (!lead) {
    return <div className="text-center p-12">Lead not found</div>;
  }

  const handleStatusChange = (status: LeadStatus) => {
    updateStatus.mutate(
      { id: leadId, data: { status } },
      {
        onSuccess: (updatedLead) => {
          queryClient.setQueryData(getGetLeadQueryKey(leadId), updatedLead);
          toast({
            title: "Status Updated",
            description: `Lead status changed to ${status.toUpperCase()}`,
            className: "bg-card border-border text-foreground",
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link href="/leads" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Link>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{lead.clientName}</h1>
            {lead.isPriority && <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-xs">Priority Target</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={lead.status === "cold" ? "secondary" : "outline"}
              className={lead.status === "cold" ? "border-slate-500 text-white bg-slate-600 hover:bg-slate-700" : ""}
              onClick={() => handleStatusChange("cold")}
              disabled={updateStatus.isPending}
            >
              Cold
            </Button>
            <Button 
              variant={lead.status === "warm" ? "secondary" : "outline"}
              className={lead.status === "warm" ? "border-amber-500 text-black bg-amber-500 hover:bg-amber-600" : ""}
              onClick={() => handleStatusChange("warm")}
              disabled={updateStatus.isPending}
            >
              Warm
            </Button>
            <Button 
              variant={lead.status === "hot" ? "secondary" : "outline"}
              className={lead.status === "hot" ? "border-destructive text-destructive-foreground bg-destructive hover:bg-destructive/90" : ""}
              onClick={() => handleStatusChange("hot")}
              disabled={updateStatus.isPending}
            >
              Hot
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className={`bg-card border-border shadow-lg ${lead.isPriority ? 'priority-glow' : ''}`}>
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Request Details</CardTitle>
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={lead.platform} />
                  <StatusBadge status={lead.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Service Requested</h3>
                <p className="text-lg font-medium">{lead.service}</p>
              </div>

              {lead.details && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Details</h3>
                  <p className="text-base text-foreground/90 whitespace-pre-wrap">{lead.details}</p>
                </div>
              )}

              {lead.comment && (
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Additional Comments
                  </h3>
                  <p className="text-sm text-foreground/80 italic">"{lead.comment}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {lead.recommendation && (
            <Card className="bg-primary/5 border-primary/20 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Zap className="w-5 h-5" /> AI Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-primary/90 font-medium">{lead.recommendation}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created At</p>
                  <p className="font-medium">{format(new Date(lead.createdAt), "MMM d, yyyy HH:mm")}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Deadline</p>
                  <p className="font-medium">{lead.deadline || "Not specified"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estimated Price</p>
                  <p className="font-mono font-medium">{lead.price || "TBD"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <ListOrdered className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Quantity</p>
                  <p className="font-medium">{lead.quantity || "1"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Just a tiny missing import
