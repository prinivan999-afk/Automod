import { Badge } from "@/components/ui/badge";
import { LeadStatus, LeadPlatform } from "@workspace/api-client-react";
import { Send, Instagram, MessageCircle } from "lucide-react";

export function StatusBadge({ status }: { status: LeadStatus }) {
  if (status === "hot") {
    return <Badge className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent uppercase text-xs tracking-wider font-bold">Hot</Badge>;
  }
  if (status === "warm") {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-black border-transparent uppercase text-xs tracking-wider font-bold">Warm</Badge>;
  }
  return <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-transparent uppercase text-xs tracking-wider font-bold">Cold</Badge>;
}

export function PlatformIcon({ platform }: { platform: LeadPlatform }) {
  if (platform === "Telegram") {
    return (
      <div className="flex items-center gap-1.5 text-blue-400 font-medium text-sm" title="Telegram">
        <Send className="w-4 h-4" />
        <span>TG</span>
      </div>
    );
  }
  if (platform === "Instagram") {
    return (
      <div className="flex items-center gap-1.5 text-pink-400 font-medium text-sm" title="Instagram">
        <Instagram className="w-4 h-4" />
        <span>IG</span>
      </div>
    );
  }
  if (platform === "MAX") {
    return (
      <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm" title="MAX">
        <MessageCircle className="w-4 h-4" />
        <span>MX</span>
      </div>
    );
  }
  return null;
}
