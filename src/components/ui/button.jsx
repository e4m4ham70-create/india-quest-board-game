import React from "react";

export function Button({
  children,
  className = "",
  variant = "default",
  size = "default",
  disabled,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center font-bold transition disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent hover:bg-slate-100",
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-sm",
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.default} ${
        sizes[size] || sizes.default
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}