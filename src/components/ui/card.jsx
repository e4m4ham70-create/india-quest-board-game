import React from "react";

export function Card({ children, className = "", ...props }) {
  return (
    <div className={`rounded-xl border bg-white ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}