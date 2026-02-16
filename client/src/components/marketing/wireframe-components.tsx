import { Phone, MessageSquare, FileText, Clock, CheckCircle, AlertCircle, BarChart3 } from "lucide-react";

export function WireframeInboxCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Inbox</span>
        <div className="relative flex items-center justify-center">
          <div className="absolute w-4 h-4 bg-primary/30 rounded-full animate-ping" />
          <div className="w-2 h-2 bg-primary rounded-full" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md group hover-elevate">
          <div className="relative w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-2 bg-muted/50 rounded w-16" />
          </div>
          <div className="h-4 w-10 bg-primary/20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function WireframeCallSummaryCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call Summary</span>
        <span className="text-[10px] text-primary font-medium">AI Generated</span>
      </div>
      <div className="h-12 flex items-center gap-0.5 bg-muted/50 rounded px-3 mb-3">
        {[...Array(30)].map((_, i) => (
          <div 
            key={i} 
            className="w-1 bg-primary/50 rounded-full animate-waveform" 
            style={{ height: `${Math.random() * 24 + 8}px`, animationDelay: `${i * 0.04}s` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded w-full" />
        <div className="h-2 bg-muted rounded w-4/5" />
        <div className="h-2 bg-muted rounded w-3/5" />
      </div>
    </div>
  );
}

export function WireframeTimelineCard() {
  const steps = [
    { icon: Phone, label: "Call Received", time: "2:34 PM", status: "completed" },
    { icon: MessageSquare, label: "AI Intake", time: "2:35 PM", status: "completed" },
    { icon: FileText, label: "Lead Created", time: "2:36 PM", status: "completed" },
    { icon: Clock, label: "Follow-up", time: "Pending", status: "pending" },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intake Timeline</span>
      <div className="mt-3 space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                step.status === "completed" ? "bg-primary/20" : "bg-muted"
              }`}>
                <step.icon className={`w-3 h-3 ${
                  step.status === "completed" ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 ${step.status === "completed" ? "bg-primary/30" : "bg-border"}`} />
              )}
            </div>
            <div className="pb-4">
              <div className="text-sm font-medium text-foreground">{step.label}</div>
              <div className="text-xs text-muted-foreground">{step.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WireframeDashboardCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Stats</span>
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/30 rounded-md text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">24</div>
          <div className="text-xs text-muted-foreground">New Today</div>
        </div>
        <div className="p-3 bg-muted/30 rounded-md text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">87%</div>
          <div className="text-xs text-muted-foreground">Qualified</div>
        </div>
      </div>
    </div>
  );
}

export function WireframeAutomationCard() {
  const rules = [
    { label: "After-hours AI", active: true },
    { label: "SMS follow-up", active: true },
    { label: "Hot lead alerts", active: false },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Automations</span>
      <div className="mt-3 space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
            <span className="text-sm text-foreground">{rule.label}</span>
            <div className={`w-8 h-4 rounded-full ${
              rule.active ? "bg-primary" : "bg-muted"
            } flex items-center ${rule.active ? "justify-end" : "justify-start"} px-0.5 transition-all duration-300`}>
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WireframeQualificationCard() {
  const factors = [
    { label: "Contact Info", score: "Complete", status: "success" },
    { label: "Case Type", score: "PI - Auto", status: "success" },
    { label: "Urgency", score: "High", status: "warning" },
    { label: "Timeline", score: "< 2 years", status: "success" },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Qualification</span>
        <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">87</span>
      </div>
      <div className="space-y-2">
        {factors.map((factor, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded">
            <span className="text-xs text-muted-foreground">{factor.label}</span>
            <span className={`text-xs font-medium ${
              factor.status === "success" ? "text-emerald-600 dark:text-emerald-400" :
              factor.status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            }`}>{factor.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
