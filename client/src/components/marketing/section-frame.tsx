import { cn } from "@/lib/utils";

export function SectionBackground({ 
  children, 
  variant = "default",
  className,
  withMesh = false,
  meshVariant,
}: { 
  children: React.ReactNode; 
  variant?: "default" | "subtle" | "muted" | "accent" | "deep" | "slate";
  className?: string;
  withMesh?: boolean;
  meshVariant?: "blue-purple" | "emerald-blue" | "warm" | "cool" | "primary" | "steel" | "ocean" | "midnight";
}) {
  const bgClasses = {
    default: "",
    subtle: "bg-slate-100/60 dark:bg-slate-900/40",
    muted: "bg-slate-200/50 dark:bg-slate-800/50",
    accent: "bg-blue-50/60 dark:bg-blue-950/30",
    deep: "bg-slate-200/70 dark:bg-slate-900/60",
    slate: "bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-900 dark:to-slate-800/80",
  };

  return (
    <div className={cn("relative", bgClasses[variant], className)}>
      {withMesh && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {meshVariant === "emerald-blue" && (
            <>
              <div className="absolute -top-1/3 -left-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-blue-400/18 via-blue-500/8 to-transparent blur-3xl" />
              <div className="absolute top-1/2 left-1/3 w-[40%] h-[40%] rounded-full bg-gradient-to-b from-cyan-400/10 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "warm" && (
            <>
              <div className="absolute -top-1/3 -left-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-orange-400/18 via-amber-400/8 to-transparent blur-3xl" />
              <div className="absolute top-1/2 right-1/3 w-[40%] h-[40%] rounded-full bg-gradient-to-b from-yellow-400/10 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "cool" && (
            <>
              <div className="absolute -top-1/4 -right-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-bl from-blue-400/22 via-blue-500/12 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/3 -left-1/4 w-[70%] h-[70%] rounded-full bg-gradient-to-tr from-cyan-400/18 via-sky-400/8 to-transparent blur-3xl" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50%] h-[50%] rounded-full bg-gradient-to-b from-indigo-400/8 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "blue-purple" && (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-blue-400/22 via-indigo-400/12 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-purple-400/18 via-violet-400/8 to-transparent blur-3xl" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50%] h-[50%] rounded-full bg-gradient-to-b from-indigo-400/10 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "steel" && (
            <>
              <div className="absolute -top-1/3 -left-1/3 w-[90%] h-[90%] rounded-full bg-gradient-to-br from-slate-400/25 via-slate-500/15 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/3 w-[80%] h-[80%] rounded-full bg-gradient-to-tl from-blue-300/15 via-slate-400/8 to-transparent blur-3xl" />
              <div className="absolute top-1/4 right-1/4 w-[50%] h-[50%] rounded-full bg-gradient-to-b from-gray-400/12 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "ocean" && (
            <>
              <div className="absolute -top-1/3 -left-1/4 w-[85%] h-[85%] rounded-full bg-gradient-to-br from-blue-500/25 via-cyan-400/15 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/3 -right-1/4 w-[75%] h-[75%] rounded-full bg-gradient-to-tl from-sky-400/20 via-blue-300/10 to-transparent blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-gradient-to-b from-indigo-400/12 to-transparent blur-3xl" />
              <div className="absolute bottom-1/4 left-1/4 w-[30%] h-[30%] rounded-full bg-gradient-to-tr from-teal-400/10 to-transparent blur-3xl" />
            </>
          )}
          {meshVariant === "midnight" && (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-[90%] h-[90%] rounded-full bg-gradient-to-br from-slate-500/30 via-blue-600/15 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/3 -right-1/3 w-[80%] h-[80%] rounded-full bg-gradient-to-tl from-indigo-500/20 via-slate-600/10 to-transparent blur-3xl" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50%] h-[50%] rounded-full bg-gradient-to-b from-blue-500/12 to-transparent blur-3xl" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-slate-300/8 to-transparent dark:from-slate-700/8" />
            </>
          )}
          {meshVariant === "primary" && (
            <>
              <div className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary/22 via-primary/10 to-transparent blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-blue-400/18 via-primary/8 to-transparent blur-3xl" />
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50%] h-[50%] rounded-full bg-gradient-to-b from-purple-400/10 to-transparent blur-3xl" />
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
