import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Send,
  Loader2,
  Settings,
  ChevronDown,
} from "lucide-react";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  secret?: string;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  responseCode: number | null;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { value: "lead.created", label: "Lead Created" },
  { value: "lead.updated", label: "Lead Updated" },
  { value: "lead.qualified", label: "Lead Qualified" },
  { value: "intake.completed", label: "Intake Completed" },
  { value: "call.completed", label: "Call Completed" },
  { value: "contact.created", label: "Contact Created" },
];

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-green-500 text-white dark:bg-green-600",
  pending: "bg-yellow-500 text-white dark:bg-yellow-600",
  failed: "bg-destructive text-destructive-foreground",
};

function CreateWebhookDialog({ onCreated }: { onCreated: (endpoint: WebhookEndpoint) => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["lead.created", "lead.qualified"]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/v1/webhooks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create webhook");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/v1/webhooks"] });
      onCreated(data);
      setOpen(false);
      setUrl("");
      toast({ title: "Webhook created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" data-testid="button-create-webhook">
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Webhook Endpoint</DialogTitle>
          <DialogDescription>
            Add a URL to receive event notifications from CaseCurrent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">Endpoint URL</Label>
            <Input
              id="url"
              placeholder="https://your-server.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
          </div>
          <div className="space-y-2">
            <Label>Events to Subscribe</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <Button
                  key={event.value}
                  variant={selectedEvents.includes(event.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleEvent(event.value)}
                  className="justify-start text-xs sm:text-sm"
                  data-testid={`button-event-${event.value}`}
                >
                  {event.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
            className="w-full sm:w-auto"
            data-testid="button-save-webhook"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecretDisplay({ endpoint }: { endpoint: WebhookEndpoint }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(endpoint.secret || "");

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/webhooks/${endpoint.id}/rotate-secret`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to rotate secret");
      return res.json();
    },
    onSuccess: (data) => {
      setSecret(data.secret);
      setShowSecret(true);
      toast({ title: "Secret rotated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      toast({ title: "Secret copied to clipboard" });
    }
  };

  if (!secret) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => rotateMutation.mutate()}
        disabled={rotateMutation.isPending}
        className="w-full sm:w-auto"
        data-testid="button-rotate-secret"
      >
        {rotateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        Generate Secret
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <code className="bg-muted px-2 py-1 rounded text-[10px] sm:text-xs font-mono truncate max-w-[120px] sm:max-w-none" data-testid="text-secret">
        {showSecret ? secret : "••••••••••••"}
      </code>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSecret(!showSecret)}
        data-testid="button-toggle-secret"
      >
        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={copySecret} data-testid="button-copy-secret">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function WebhookCard({ endpoint, onDeleted }: { endpoint: WebhookEndpoint; onDeleted: () => void }) {
  const { token } = useAuth();
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active: !endpoint.active }),
      });
      if (!res.ok) throw new Error("Failed to update webhook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/webhooks"] });
      toast({ title: endpoint.active ? "Webhook disabled" : "Webhook enabled" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/webhooks/${endpoint.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/webhooks"] });
      onDeleted();
      toast({ title: "Webhook deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/webhooks/${endpoint.id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to test webhook");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/v1/webhook-deliveries"] });
      if (data.status === "delivered") {
        toast({ title: "Test webhook delivered successfully" });
      } else {
        toast({
          title: "Test webhook failed",
          description: `Status: ${data.responseCode || "No response"}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`card-webhook-${endpoint.id}`}>
      <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="font-medium text-sm truncate" data-testid="text-webhook-url">
              {endpoint.url}
            </p>
            <p className="text-xs text-muted-foreground">
              Created {new Date(endpoint.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Switch
              checked={endpoint.active}
              onCheckedChange={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              data-testid="switch-webhook-active"
            />
            <Badge
              className={`text-xs ${endpoint.active ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {endpoint.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {endpoint.events.map((event) => (
            <Badge key={event} variant="secondary" className="text-[10px] sm:text-xs">
              {event}
            </Badge>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
          <SecretDisplay endpoint={endpoint} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !endpoint.active}
              className="flex-1 sm:flex-none"
              data-testid="button-test-webhook"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Test
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-delete-webhook">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this webhook endpoint and all its delivery history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="w-full sm:w-auto bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryRow({ delivery }: { delivery: WebhookDelivery }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 border-b last:border-b-0"
      data-testid={`row-delivery-${delivery.id}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <Badge className={`${STATUS_COLORS[delivery.status] || "bg-muted"} text-[10px] sm:text-xs shrink-0`}>
          {delivery.status === "delivered" && <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />}
          {delivery.status === "failed" && <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />}
          {delivery.status === "pending" && <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />}
          {delivery.status}
        </Badge>
        <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
          {delivery.eventType}
        </Badge>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-sm text-muted-foreground">
        {delivery.responseCode && (
          <span className="font-mono">{delivery.responseCode}</span>
        )}
        <span>x{delivery.attemptCount}</span>
        <span className="whitespace-nowrap">
          {new Date(delivery.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const { token } = useAuth();
  const [newEndpoint, setNewEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deliveriesExpanded, setDeliveriesExpanded] = useState(false);

  const { data: endpoints = [], isLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ["/v1/webhooks"],
    queryFn: async () => {
      const res = await fetch("/v1/webhooks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      return res.json();
    },
  });

  const { data: deliveries = [] } = useQuery<WebhookDelivery[]>({
    queryKey: ["/v1/webhook-deliveries"],
    queryFn: async () => {
      const res = await fetch("/v1/webhook-deliveries?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      return res.json();
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
        <div className="space-y-3 sm:space-y-4">
          <Skeleton className="h-36 sm:h-40" />
          <Skeleton className="h-36 sm:h-40" />
        </div>
      </div>
    );
  }

  const allEndpoints = newEndpoint
    ? [{ ...newEndpoint }, ...endpoints.filter((e) => e.id !== newEndpoint.id)]
    : endpoints;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            Webhook Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage webhook endpoints for real-time event notifications
          </p>
        </div>
        <CreateWebhookDialog onCreated={setNewEndpoint} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Webhook className="h-4 w-4 sm:h-5 sm:w-5" />
            Endpoints ({allEndpoints.length})
          </h2>
          {allEndpoints.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <Webhook className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm sm:text-base">No webhook endpoints configured</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Add a webhook to receive real-time notifications
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {allEndpoints.map((endpoint) => (
                <WebhookCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  onDeleted={() => {
                    if (newEndpoint?.id === endpoint.id) {
                      setNewEndpoint(null);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4">
          <Collapsible open={deliveriesExpanded} onOpenChange={setDeliveriesExpanded} className="lg:!block">
            <CollapsibleTrigger asChild className="lg:pointer-events-none">
              <div className="flex items-center justify-between cursor-pointer lg:cursor-default">
                <h2 className="text-base sm:text-lg font-semibold">Recent Deliveries</h2>
                <ChevronDown className={`h-5 w-5 transition-transform lg:hidden ${deliveriesExpanded ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="lg:!block lg:!h-auto">
              <Card className="mt-3">
                <CardContent className="p-3 sm:p-4">
                  {deliveries.length === 0 ? (
                    <div className="text-center py-6 sm:py-8">
                      <Clock className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground text-sm">No delivery attempts yet</p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] sm:max-h-[500px] overflow-y-auto">
                      {deliveries.map((delivery) => (
                        <DeliveryRow key={delivery.id} delivery={delivery} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
