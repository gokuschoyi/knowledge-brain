import { PropsWithChildren } from "react";

export function Badge({ children }: PropsWithChildren) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

