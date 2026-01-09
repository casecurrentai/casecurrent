import { cn } from "@/lib/utils";

interface UIFrameProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function UIFrame({ children, className, title = "CaseCurrent" }: UIFrameProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-lg overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <div className="w-3 h-3 rounded-full bg-green-400/60" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="w-12" />
      </div>
      <div className="p-4 bg-background">{children}</div>
    </div>
  );
}

interface PhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="relative mx-auto w-[280px] h-[560px] bg-card rounded-[2.5rem] border-4 border-foreground/10 shadow-xl overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground/10 rounded-b-xl" />
        <div className="absolute top-6 inset-x-0 bottom-0 overflow-hidden rounded-b-[2rem]">
          <div className="h-full overflow-y-auto">{children}</div>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-foreground/20 rounded-full" />
      </div>
    </div>
  );
}
