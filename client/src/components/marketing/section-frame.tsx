import { cn } from "@/lib/utils";

export function SectionBackground({ 
  children, 
  variant = "default",
  className,
  withMesh = false,
  meshVariant,
}: { 
  children: React.ReactNode; 
  variant?: "default" | "subtle" | "muted" | "accent";
  className?: string;
  withMesh?: boolean;
  meshVariant?: "blue-purple" | "emerald-blue" | "warm" | "cool" | "primary";
}) {
  const bgClasses = {
    default: "",
    subtle: "bg-muted/30",
    muted: "bg-muted/50",
    accent: "bg-primary/5",
  };

  return (
    <div className={cn("relative", bgClasses[variant], className)}>
      {withMesh && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {meshVariant === "emerald-blue" ? (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-tl from-blue-500/6 via-transparent to-transparent blur-3xl" />
            </>
          ) : meshVariant === "warm" ? (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-br from-amber-500/8 via-transparent to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-tl from-orange-500/6 via-transparent to-transparent blur-3xl" />
            </>
          ) : meshVariant === "cool" ? (
            <>
              <div className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-bl from-blue-500/8 via-transparent to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-tr from-cyan-500/6 via-transparent to-transparent blur-3xl" />
            </>
          ) : (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-tl from-blue-500/8 via-transparent to-transparent blur-3xl" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-1/2 h-1/2 rounded-full bg-gradient-to-b from-purple-500/5 to-transparent blur-3xl" />
            </>
          )}
        </div>
      )}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
