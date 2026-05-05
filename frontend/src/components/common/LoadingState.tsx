export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-md border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">{label}</div>;
}

