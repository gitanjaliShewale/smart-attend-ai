import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export interface StatBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number;
  threshold?: number;
  nearDelta?: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  suffix?: string;
}

export function StatBadge({
  percentage,
  threshold = 75,
  nearDelta = 10,
  size = "md",
  showIcon = true,
  suffix = "%",
  className,
  ...props
}: StatBadgeProps) {
  const isSatisfied = percentage >= threshold;
  const isNear = !isSatisfied && percentage >= threshold - nearDelta;
  const isBelow = !isSatisfied && !isNear;

  let colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  let icon = <CheckCircle2 className="shrink-0" />;

  if (isNear) {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200/80";
    icon = <AlertTriangle className="shrink-0" />;
  } else if (isBelow) {
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200/80";
    icon = <XCircle className="shrink-0" />;
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1 font-medium",
    md: "px-2.5 py-1 text-sm gap-1.5 font-semibold",
    lg: "px-3.5 py-1.5 text-base gap-2 font-bold",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border transition-all duration-200 shadow-xs",
        colorClasses,
        sizeClasses,
        className
      )}
      {...props}
    >
      {showIcon && React.cloneElement(icon, { className: cn(iconSizes, "shrink-0") })}
      <span>
        {percentage.toFixed(1)}
        {suffix}
      </span>
    </div>
  );
}
