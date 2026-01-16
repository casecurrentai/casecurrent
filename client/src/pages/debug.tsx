import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Phone, MessageSquare } from "lucide-react";

interface DiagnosticData {
  orgId: string;
  leadId: string | null;
  callId: string | null;
  callSid: string | null;
  callCreatedAt: string | null;
  message?: string;
  transcriptStats?: {
    msgCount: number;
    userCount: number;
    assistantCount: number;
    fullTextLen: number;
  };
  transcript: {
    exists: boolean;
    messageCount: number;
    hasUser: boolean;
    hasAssistant: boolean;
    first200: string | null;
  };
  extraction: {
    ran: boolean;
    extractedFields: string[];
    callerName: string | null;
    incidentDate: string | null;
    practiceAreaGuess: string | null;
  };
  lead: {
    currentDisplayName: string | null;
    contactName: string | null;
    phone: string | null;
    intakeExists: boolean;
  };
  scoring: {
    exists: boolean;
    score: number | null;
    tier: string | null;
  };
  pipeline: {
    finalizeCalled: boolean;
    finalizeAt: string | null;
    lastError: string | null;
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1">
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

function DiagSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function DiagRow({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-mono ${good === true ? 'text-green-600 dark:text-green-400' : good === false ? 'text-red-600 dark:text-red-400' : ''}`}>
        {value === null || value === undefined ? <span className="text-muted-foreground italic">null</span> : value}
      </span>
    </div>
  );
}

export default function DebugPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery<DiagnosticData>({
    queryKey: ["/api/diag/last-call", refreshKey],
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-debug-title">Enrichment Debug</h1>
          <p className="text-muted-foreground text-sm">Last call diagnostic for your organization</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isFetching}
          size="default"
          data-testid="button-load-recent-call"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Load Most Recent Call
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading diagnostic data...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>Error loading diagnostic: {(error as Error).message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <>
          {data.message && !data.callId && (
            <Card>
              <CardContent className="py-6 text-center">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">{data.message}</p>
                <p className="text-xs text-muted-foreground mt-2">Make a test call to see diagnostic data here.</p>
              </CardContent>
            </Card>
          )}

          {data.callId && (
            <div className="space-y-4">
              {/* Quick Status Overview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Quick Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge ok={data.transcript.exists} label="Transcript" />
                    <StatusBadge ok={data.transcript.hasUser} label="User Messages" />
                    <StatusBadge ok={data.transcript.hasAssistant} label="AI Messages" />
                    <StatusBadge ok={data.extraction.ran} label="Extraction" />
                    <StatusBadge ok={!!data.lead.currentDisplayName && data.lead.currentDisplayName !== 'Unknown Caller'} label="Name Resolved" />
                    <StatusBadge ok={data.lead.intakeExists} label="Intake" />
                    <StatusBadge ok={data.scoring.exists} label="Scoring" />
                  </div>
                  
                  {data.pipeline.lastError && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                        <span className="text-sm text-destructive">{data.pipeline.lastError}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Call Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Call Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <DiagRow label="Call ID" value={data.callId} />
                  <DiagRow label="Call SID" value={data.callSid} />
                  <DiagRow label="Lead ID" value={data.leadId} />
                  <DiagRow label="Created" value={formatTime(data.callCreatedAt)} />
                </CardContent>
              </Card>

              {/* Transcript Stats */}
              {data.transcriptStats && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Transcript Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <DiagRow label="Total Messages" value={data.transcriptStats.msgCount} good={data.transcriptStats.msgCount > 4} />
                    <DiagRow label="User Count" value={data.transcriptStats.userCount} good={data.transcriptStats.userCount > 0} />
                    <DiagRow label="Assistant Count" value={data.transcriptStats.assistantCount} good={data.transcriptStats.assistantCount > 0} />
                    <DiagRow label="Full Text Length" value={data.transcriptStats.fullTextLen} good={data.transcriptStats.fullTextLen > 100} />
                  </CardContent>
                </Card>
              )}

              {/* Transcript */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <DiagRow label="Exists" value={data.transcript.exists ? 'true' : 'false'} good={data.transcript.exists} />
                    <DiagRow label="Message Count" value={data.transcript.messageCount} good={data.transcript.messageCount > 4} />
                    <DiagRow label="Has User" value={data.transcript.hasUser ? 'true' : 'false'} good={data.transcript.hasUser} />
                    <DiagRow label="Has Assistant" value={data.transcript.hasAssistant ? 'true' : 'false'} good={data.transcript.hasAssistant} />
                  </div>
                  {data.transcript.first200 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Preview (first 200 chars):</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">{data.transcript.first200}</pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Extraction */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Extraction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <DiagRow label="Ran" value={data.extraction.ran ? 'true' : 'false'} good={data.extraction.ran} />
                  <DiagRow label="Caller Name" value={data.extraction.callerName} good={!!data.extraction.callerName && data.extraction.callerName !== 'Unknown'} />
                  <DiagRow label="Practice Area" value={data.extraction.practiceAreaGuess} />
                  <DiagRow label="Incident Date" value={data.extraction.incidentDate} />
                  <DiagRow label="Extracted Fields" value={data.extraction.extractedFields.length > 0 ? data.extraction.extractedFields.join(', ') : 'none'} />
                </CardContent>
              </Card>

              {/* Lead */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Lead</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <DiagRow label="Display Name" value={data.lead.currentDisplayName} good={!!data.lead.currentDisplayName && data.lead.currentDisplayName !== 'Unknown Caller'} />
                  <DiagRow label="Contact Name" value={data.lead.contactName} />
                  <DiagRow label="Phone" value={data.lead.phone} />
                  <DiagRow label="Intake Exists" value={data.lead.intakeExists ? 'true' : 'false'} good={data.lead.intakeExists} />
                </CardContent>
              </Card>

              {/* Scoring */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Scoring</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <DiagRow label="Exists" value={data.scoring.exists ? 'true' : 'false'} good={data.scoring.exists} />
                  <DiagRow label="Score" value={data.scoring.score} />
                  <DiagRow label="Tier" value={data.scoring.tier} />
                </CardContent>
              </Card>

              {/* Pipeline */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <DiagRow label="Finalize Called" value={data.pipeline.finalizeCalled ? 'true' : 'false'} />
                  <DiagRow label="Finalize At" value={formatTime(data.pipeline.finalizeAt)} />
                  {data.pipeline.lastError && (
                    <DiagRow label="Last Error" value={data.pipeline.lastError} good={false} />
                  )}
                </CardContent>
              </Card>

              {/* Raw JSON */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Raw JSON</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre 
                    className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto"
                    data-testid="text-debug-json"
                  >
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
