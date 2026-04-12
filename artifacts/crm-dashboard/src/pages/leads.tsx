import { useState } from "react";
import { useListLeads, LeadStatus, LeadPlatform } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PlatformIcon } from "@/components/badges";
import { Link } from "wouter";
import { Clock, Search, ArrowUpRight, Star } from "lucide-react";
import { format } from "date-fns";

export default function LeadsList() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<LeadPlatform | "all">("all");
  const [search, setSearch] = useState("");

  const { data: leads, isLoading } = useListLeads({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(platformFilter !== "all" ? { platform: platformFilter } : {}),
  });

  const filteredLeads = leads?.filter((lead) => 
    lead.clientName.toLowerCase().includes(search.toLowerCase()) || 
    lead.service.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Leads</h1>
          <p className="text-muted-foreground mt-1">Manage and track your operational targets.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={(val: any) => setPlatformFilter(val)}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="Telegram">Telegram</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="MAX">MAX</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse font-mono">Loading telemetry...</div>
        ) : filteredLeads && filteredLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Deadline</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead, i) => (
                  <tr 
                    key={lead.id} 
                    className={`hover:bg-muted/20 transition-colors group ${lead.isPriority ? 'bg-primary/5' : ''}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {lead.isPriority && <Star className="w-4 h-4 text-primary fill-primary" />}
                        <span className="font-medium text-foreground">{lead.clientName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{lead.service}</td>
                    <td className="px-4 py-4">
                      <PlatformIcon platform={lead.platform} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {lead.deadline ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {lead.deadline}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-muted-foreground">{lead.price || "-"}</td>
                    <td className="px-4 py-4 text-right">
                      <Link 
                        href={`/leads/${lead.id}`}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground group-hover:text-primary"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <h3 className="text-lg font-medium">No leads found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
}
