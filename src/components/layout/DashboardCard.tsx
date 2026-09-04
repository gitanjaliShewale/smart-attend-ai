import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  statBadge?: React.ReactNode;
  trend?: {
    value: string | number;
    label: string;
    positive?: boolean;
  };
  progress?: {
    value: number;
    max?: number;
    threshold?: number;
  };
}

export function DashboardCard({
  title,
  value,
  description,
  icon,
  statBadge,
  trend,
  progress,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden hover:shadow-md transition-all duration-200 border-slate-200/90",
        className
      )}
      {...props}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {value}
              </span>
              {statBadge}
            </div>
            {description && (
              <p className="text-xs text-slate-500 pt-1">{description}</p>
            )}
          </div>
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-[#0f2b48] shadow-xs">
              {icon}
            </div>
          )}
        </div>

        {progress && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{Math.round((progress.value / (progress.max || 100)) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress.value >= (progress.threshold || 75)
                    ? "bg-emerald-500"
                    : progress.value >= (progress.threshold || 75) - 10
                    ? "bg-amber-500"
                    : "bg-rose-500"
                )}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (progress.value / (progress.max || 100)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {trend && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={cn(
                "font-semibold",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.value}
            </span>
            <span>{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
