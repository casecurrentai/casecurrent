import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  Square,
  BarChart3,
  Loader2,
  Users,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  config: { variants?: string[] };
  assignmentsCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500 text-white dark:bg-green-600",
  paused: "bg-yellow-500 text-white dark:bg-yellow-600",
  ended: "bg-muted text-muted-foreground",
};

const KIND_LABELS: Record<string, string> = {
  intake_script: "Intake Script",
  qualification_rules: "Qualification Rules",
  follow_up_timing: "Follow-up Timing",
};

function CreateExperimentDialog() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("intake_script");
  const [variants, setVariants] = useState("control,variant_a");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/v1/experiments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          kind,
          config: { variants: variants.split(",").map(v => v.trim()) },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create experiment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/experiments"] });
      setOpen(false);
      setName("");
      toast({ title: "Experiment created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-experiment">
          <Plus className="h-4 w-4 mr-2" />
          New Experiment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Experiment</DialogTitle>
          <DialogDescription>
            Set up a new A/B test to optimize your intake process.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Experiment Name</Label>
            <Input
              id="name"
              placeholder="Q1 Intake Script Test"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-experiment-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Experiment Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger data-testid="select-experiment-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intake_script">Intake Script</SelectItem>
                <SelectItem value="qualification_rules">Qualification Rules</SelectItem>
                <SelectItem value="follow_up_timing">Follow-up Timing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="variants">Variants (comma-separated)</Label>
            <Input
              id="variants"
              placeholder="control,variant_a,variant_b"
              value={variants}
              onChange={(e) => setVariants(e.target.value)}
              data-testid="input-experiment-variants"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            data-testid="button-save-experiment"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const { token } = useAuth();
  const { toast } = useToast();

  const actionMutation = useMutation({
    mutationFn: async (action: "start" | "pause" | "end") => {
      const res = await fetch(`/v1/experiments/${experiment.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} experiment`);
      }
      return res.json();
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["/v1/experiments"] });
      toast({ title: `Experiment ${action}ed` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`card-experiment-${experiment.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{experiment.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {KIND_LABELS[experiment.kind] || experiment.kind}
          </p>
        </div>
        <Badge className={STATUS_COLORS[experiment.status]}>
          {experiment.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{experiment.assignmentsCount} assignments</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>{experiment.config.variants?.length || 2} variants</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {experiment.status === "draft" && (
            <Button
              size="sm"
              onClick={() => actionMutation.mutate("start")}
              disabled={actionMutation.isPending}
              data-testid="button-start-experiment"
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          )}
          {experiment.status === "running" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => actionMutation.mutate("pause")}
                disabled={actionMutation.isPending}
                data-testid="button-pause-experiment"
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => actionMutation.mutate("end")}
                disabled={actionMutation.isPending}
                data-testid="button-end-experiment"
              >
                <Square className="h-4 w-4 mr-1" />
                End
              </Button>
            </>
          )}
          {experiment.status === "paused" && (
            <>
              <Button
                size="sm"
                onClick={() => actionMutation.mutate("start")}
                disabled={actionMutation.isPending}
                data-testid="button-resume-experiment"
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => actionMutation.mutate("end")}
                disabled={actionMutation.isPending}
                data-testid="button-end-experiment"
              >
                <Square className="h-4 w-4 mr-1" />
                End
              </Button>
            </>
          )}
          <Link href={`/experiments/${experiment.id}`}>
            <Button size="sm" variant="outline" data-testid="button-view-report">
              <BarChart3 className="h-4 w-4 mr-1" />
              Report
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExperimentsPage() {
  const { token } = useAuth();

  const { data: experiments = [], isLoading } = useQuery<Experiment[]>({
    queryKey: ["/v1/experiments"],
    queryFn: async () => {
      const res = await fetch("/v1/experiments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch experiments");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <FlaskConical className="h-6 w-6" />
            Conversion Lab
          </h1>
          <p className="text-muted-foreground">
            Run A/B experiments to optimize intake and qualification
          </p>
        </div>
        <CreateExperimentDialog />
      </div>

      {experiments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FlaskConical className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No experiments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first experiment to start optimizing
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {experiments.map((experiment) => (
            <ExperimentCard key={experiment.id} experiment={experiment} />
          ))}
        </div>
      )}
    </div>
  );
}
