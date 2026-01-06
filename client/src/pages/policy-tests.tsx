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
  ShieldCheck,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  History,
} from "lucide-react";

interface PolicyTestSuite {
  id: string;
  name: string;
  description: string | null;
  testCases: Array<{ id: string; name: string }>;
  active: boolean;
  lastRun: {
    id: string;
    status: string;
    summary: { passedCount: number; failedCount: number; totalCount: number };
    startedAt: string;
  } | null;
  createdAt: string;
}

interface PolicyTestRun {
  id: string;
  suiteId: string;
  status: string;
  results: Array<{
    testId: string;
    name: string;
    passed: boolean;
    actualDisposition?: string;
    actualScore?: number;
    error?: string;
  }>;
  summary: { passedCount: number; failedCount: number; totalCount: number };
  startedAt: string;
  endedAt: string | null;
  suite: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  passed: "bg-green-500 text-white dark:bg-green-600",
  failed: "bg-destructive text-destructive-foreground",
  running: "bg-yellow-500 text-white dark:bg-yellow-600",
};

function CreateSuiteDialog() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const defaultTestCases = [
        { id: "tc1", name: "Complete lead with phone+email accepts", input: { contact: { phone: "+15551234567", email: "test@example.com" }, practiceArea: true, intake: { complete: true, answers: { incidentDate: "2024-01-15", incidentLocation: "Highway 101" } }, calls: 2 }, expectedDisposition: "accept", expectedMinScore: 70 },
        { id: "tc2", name: "Minimal info leads to review", input: { contact: { phone: "+15551234567" }, practiceArea: false, intake: { complete: false }, calls: 0 }, expectedDisposition: "review" },
        { id: "tc3", name: "No contact info declines", input: { contact: {}, practiceArea: false, intake: { complete: false }, calls: 0 }, expectedDisposition: "decline" },
        { id: "tc4", name: "Partial intake with practice area reviews", input: { contact: { email: "partial@test.com" }, practiceArea: true, intake: { complete: false, answers: { incidentDate: "2024-01-15" } }, calls: 1 }, expectedDisposition: "review" },
        { id: "tc5", name: "Complete intake without calls accepts", input: { contact: { phone: "+15559876543", email: "complete@test.com" }, practiceArea: true, intake: { complete: true, answers: { incidentDate: "2024-02-01", incidentLocation: "Main Street" } }, calls: 0 }, expectedDisposition: "accept" },
        { id: "tc6", name: "High engagement with partial info reviews", input: { contact: { phone: "+15551112222" }, practiceArea: true, intake: { complete: false, answers: {} }, calls: 3 }, expectedDisposition: "review" },
      ];

      const res = await fetch("/v1/policy-tests/suites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description, testCases: defaultTestCases }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create suite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/policy-tests/suites"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "Test suite created with 6 default test cases" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-suite">
          <Plus className="h-4 w-4 mr-2" />
          New Suite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Policy Test Suite</DialogTitle>
          <DialogDescription>
            Create a new test suite to validate qualification rules.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Suite Name</Label>
            <Input
              id="name"
              placeholder="Qualification Regression Tests"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-suite-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Validates core qualification logic"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-suite-description"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Suite will be created with 6 default test cases covering common scenarios.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            data-testid="button-save-suite"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuiteCard({ suite }: { suite: PolicyTestSuite }) {
  const { token } = useAuth();
  const { toast } = useToast();

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/policy-tests/suites/${suite.id}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to run tests");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/v1/policy-tests/suites"] });
      queryClient.invalidateQueries({ queryKey: ["/v1/policy-tests/runs"] });
      if (data.status === "passed") {
        toast({ title: "All tests passed" });
      } else {
        toast({
          title: "Some tests failed",
          description: `${data.summary.failedCount} of ${data.summary.totalCount} tests failed`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`card-suite-${suite.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{suite.name}</CardTitle>
          {suite.description && (
            <p className="text-sm text-muted-foreground">{suite.description}</p>
          )}
        </div>
        {suite.lastRun && (
          <Badge className={STATUS_COLORS[suite.lastRun.status]}>
            {suite.lastRun.status === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
            {suite.lastRun.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
            {suite.lastRun.status}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{suite.testCases.length} test cases</span>
          {suite.lastRun && (
            <span>
              Last run: {new Date(suite.lastRun.startedAt).toLocaleString()}
            </span>
          )}
        </div>

        {suite.lastRun && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 dark:text-green-400">
              {suite.lastRun.summary.passedCount} passed
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-600 dark:text-red-400">
              {suite.lastRun.summary.failedCount} failed
            </span>
          </div>
        )}

        <Button
          size="sm"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          data-testid="button-run-suite"
        >
          {runMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Run Tests
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PolicyTestsPage() {
  const { token } = useAuth();

  const { data: suites = [], isLoading: suitesLoading } = useQuery<PolicyTestSuite[]>({
    queryKey: ["/v1/policy-tests/suites"],
    queryFn: async () => {
      const res = await fetch("/v1/policy-tests/suites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch suites");
      return res.json();
    },
  });

  const { data: runs = [] } = useQuery<PolicyTestRun[]>({
    queryKey: ["/v1/policy-tests/runs"],
    queryFn: async () => {
      const res = await fetch("/v1/policy-tests/runs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch runs");
      return res.json();
    },
  });

  if (suitesLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
            <ShieldCheck className="h-6 w-6" />
            Policy Tests
          </h1>
          <p className="text-muted-foreground">
            Run compliance regression tests to validate qualification rules
          </p>
        </div>
        <CreateSuiteDialog />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Test Suites</h2>
          {suites.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No test suites yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a suite to start testing your qualification rules
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {suites.map((suite) => (
                <SuiteCard key={suite.id} suite={suite} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Runs
          </h2>
          <Card>
            <CardContent className="p-4">
              {runs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No test runs yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                      data-testid={`row-run-${run.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[run.status]} variant="secondary">
                          {run.status === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {run.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                          {run.status}
                        </Badge>
                        <span className="text-sm">{run.suite.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {run.summary.passedCount}/{run.summary.totalCount} passed
                        <span className="ml-2">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
