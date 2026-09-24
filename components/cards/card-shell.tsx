import type { ReactNode } from "react";

type CardShellProps = {
  children: ReactNode;
  title?: string;
  inactive?: boolean;
};

export function CardShell({ children, title, inactive }: CardShellProps) {
  return (
    <div
      className={`w-full rounded-xl border bg-white p-4 shadow-sm ${
        inactive ? "border-gray-100 opacity-70" : "border-gray-200"
      }`}
    >
      {title && (
        <h3 className="mb-3 text-sm font-medium text-gray-500">{title}</h3>
      )}
      {children}
    </div>
  );
}
