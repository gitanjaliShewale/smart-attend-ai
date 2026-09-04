import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "success"
    | "primary";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:scale-[0.98]",
  primary:
    "bg-[#0f2b48] text-white hover:bg-[#163c64] shadow-sm active:scale-[0.98]",
  destructive:
    "bg-rose-600 text-white hover:bg-rose-700 shadow-sm active:scale-[0.98]",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-[0.98]",
  outline:
    "border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm active:scale-[0.98]",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-[0.98]",
  ghost:
    "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
  link:
    "text-[#0f2b48] underline-offset-4 hover:underline p-0 h-auto",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-11 rounded-lg px-6 text-base font-semibold",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f2b48] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
