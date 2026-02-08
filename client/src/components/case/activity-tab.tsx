import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
} from "lucide-react";

interface Call {
  id: string;
  direction: string;
  fromE164: string;
  toE164: string;
  durationSeconds: number | null;
}

interface Message {
  id: string;
  direction: string;
  from: string;
  body: string;
  createdAt: string;
}

interface Interaction {
  id: string;
  channel: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  metadata: unknown;
  call: Call | null;
  messages: Message[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function ActivityTab({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) {
    return (
      <div className="py-6 text-center">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No interactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interactions.map((interaction) => (
        <Card key={interaction.id} data-testid={`interaction-${interaction.id}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {interaction.channel === "call" && (
                  interaction.call?.direction === "inbound"
                    ? <PhoneIncoming className="w-4 h-4 text-primary" />
                    : <PhoneOutgoing className="w-4 h-4 text-primary" />
                )}
                {interaction.channel === "sms" && <MessageSquare className="w-4 h-4 text-primary" />}
                {interaction.channel === "webchat" && <MessageSquare className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize text-sm">{interaction.channel}</span>
                  <Badge variant={interaction.status === "active" ? "default" : "secondary"} className="text-xs">
                    {interaction.status}
                  </Badge>
                  {interaction.call && (
                    <Badge variant="outline" className="text-xs">
                      {interaction.call.direction}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(interaction.startedAt).toLocaleString()}
                  </span>
                  {interaction.call?.durationSeconds && (
                    <span>{formatDuration(interaction.call.durationSeconds)}</span>
                  )}
                </div>

                {interaction.call && (
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">From: </span>
                    <span className="break-all">{interaction.call.fromE164}</span>
                    <span className="text-muted-foreground mx-1">To: </span>
                    <span className="break-all">{interaction.call.toE164}</span>
                  </div>
                )}

                {interaction.messages.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {interaction.messages.slice(0, 3).map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-lg text-xs ${
                          msg.direction === "inbound"
                            ? "bg-muted"
                            : "bg-primary/10 ml-4"
                        }`}
                      >
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {msg.direction === "inbound" ? msg.from : "You"} - {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                        <p>{msg.body}</p>
                      </div>
                    ))}
                    {interaction.messages.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{interaction.messages.length - 3} more messages
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
