import { cn } from "@/lib/utils";
import { Check, Shield } from "lucide-react";

interface TrustItem {
  title: string;
  description?: string;
}

interface TrustListProps {
  items: TrustItem[];
  className?: string;
}

export function TrustList({ items, className }: TrustListProps) {
  return (
    <ul className={cn("space-y-4", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <span className="font-medium text-foreground">{item.title}</span>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface SecurityCardProps {
  title: string;
  items: string[];
  className?: string;
}

export function SecurityCard({ title, items, className }: SecurityCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-5", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
