import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.js";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
  ghost: "bg-transparent text-foreground hover:bg-accent",
  destructive: "bg-destructive text-destructive-foreground",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** 디자인 시스템 Button의 최소 구현. 나머지 컴포넌트는 shadcn/ui로 추가한다. */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-4 font-sans text-sm font-semibold",
        "transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
