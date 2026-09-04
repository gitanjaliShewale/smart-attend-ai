import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: "default" | "full" | "narrow";
}

export function PageContainer({
  title,
  description,
  badge,
  actions,
  maxWidth = "default",
  className,
  children,
  ...props
}: PageContainerProps) {
  const maxWidthClasses = {
    default: "max-w-7xl",
    narrow: "max-w-5xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6",
        maxWidthClasses,
        className
      )}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {title}
                </h1>
              )}
              {badge}
            </div>
            {description && (
              <p className="text-sm text-slate-500 max-w-2xl">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
