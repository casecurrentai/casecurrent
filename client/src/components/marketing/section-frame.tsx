import { cn } from "@/lib/utils";

interface SectionFrameProps {
  children: React.ReactNode;
  className?: string;
  showCorners?: boolean;
  showConnectors?: boolean;
}

export function SectionFrame({
  children,
  className,
  showCorners = true,
  showConnectors = false,
}: SectionFrameProps) {
  return (
    <div className={cn("relative", className)}>
      {showCorners && (
        <>
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-muted-foreground/20" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-muted-foreground/20" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-muted-foreground/20" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-muted-foreground/20" />
        </>
      )}
      {showConnectors && (
        <>
          <div className="absolute top-1/2 left-0 w-3 h-px bg-muted-foreground/20 -translate-y-1/2" />
          <div className="absolute top-1/2 right-0 w-3 h-px bg-muted-foreground/20 -translate-y-1/2" />
          <div className="absolute top-0 left-1/2 w-px h-3 bg-muted-foreground/20 -translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-px h-3 bg-muted-foreground/20 -translate-x-1/2" />
        </>
      )}
      {children}
    </div>
  );
}
