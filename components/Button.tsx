import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: Variant;
  block?: boolean;
};

export function Button({
  variant,
  block = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["btn", VARIANT_CLASS[variant], block ? "btn-block" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...props} />;
}
