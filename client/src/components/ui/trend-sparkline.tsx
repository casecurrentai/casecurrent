import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line } from "recharts";

export interface TrendSparklineProps {
  /** Array of numeric values to plot (most recent last) */
  data: number[];
  /** Line color — defaults to primary */
  color?: string;
  /** Chart height in pixels */
  height?: number;
  /** Additional class names */
  className?: string;
}

export function TrendSparkline({
  data,
  color = "hsl(var(--primary))",
  height = 32,
  className,
}: TrendSparklineProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
