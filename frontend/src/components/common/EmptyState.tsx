export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-8 text-center">
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-slate-400">{body}</p>
    </div>
  );
}

