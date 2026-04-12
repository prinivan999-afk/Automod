import { 
  useGetAnalyticsSummary, 
  useGetLeadsByPlatform, 
  useGetLeadsByStatus, 
  useGetRecentActivity 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flame, Sun, Snowflake, ArrowUpRight, Clock, Star } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge, PlatformIcon } from "@/components/badges";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: platformData, isLoading: loadingPlatform } = useGetLeadsByPlatform();
  const { data: statusData, isLoading: loadingStatus } = useGetLeadsByStatus();
  const { data: recentLeads, isLoading: loadingRecent } = useGetRecentActivity();

  if (loadingSummary || loadingPlatform || loadingStatus || loadingRecent) {
    return <div className="h-[60vh] flex items-center justify-center text-muted-foreground animate-pulse font-mono">Initializing sensors...</div>;
  }

  const PLATFORM_COLORS = {
    Telegram: "#60A5FA",
    Instagram: "#F472B6",
    MAX: "#4ADE80"
  };

  const STATUS_COLORS = {
    hot: "hsl(var(--destructive))",
    warm: "#F59E0B",
    cold: "#64748B"
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time metrics for LeadFlow operations.</p>
        </div>
        <Link href="/add-lead" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          New Entry
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+{summary?.todayLeads || 0} today</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.hotLeads || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to close</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warm Leads</CardTitle>
            <Sun className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.warmLeads || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs follow-up</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Priority</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{summary?.priorityLeads || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">High value targets</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Charts */}
        <Card className="col-span-4 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Platform Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {platformData && platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformData}>
                  <XAxis dataKey="platform" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[entry.platform as keyof typeof PLATFORM_COLORS] || '#00f0ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Status Chart */}
        <Card className="col-span-3 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {statusData && statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusData.map((entry, index) => (
                      <PieCell key={`cell-${index}`} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || '#00f0ff'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', textTransform: 'capitalize' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads Feed */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Link href="/leads" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentLeads?.slice(0, 5).map((lead) => (
              <div key={lead.id} className={`flex items-center justify-between p-4 rounded-lg border border-border bg-card/50 transition-all hover:bg-card hover:border-primary/50 ${lead.isPriority ? 'priority-glow' : ''}`}>
                <div className="flex items-center gap-4">
                  <PlatformIcon platform={lead.platform} />
                  <div>
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                      {lead.clientName}
                    </Link>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <span>{lead.service}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lead.price && <span className="font-mono text-sm text-muted-foreground">{lead.price}</span>}
                  <StatusBadge status={lead.status} />
                </div>
              </div>
            ))}
            {(!recentLeads || recentLeads.length === 0) && (
              <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-lg">
                No recent activity.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
