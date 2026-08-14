"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { Button, ButtonProps } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export interface LogoutButtonProps extends Omit<ButtonProps, "onClick"> {
  callbackUrl?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  callbackUrl = "/login",
  showIcon = true,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: LogoutButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut({ callbackUrl });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={loading}
      className="gap-1.5 cursor-pointer"
      {...props}
    >
      {showIcon && <LogOut className="w-3.5 h-3.5" />}
      <span>{children || (loading ? "Signing out..." : "Sign Out")}</span>
    </Button>
  );
}
