export function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`rounded-md px-4 py-3 text-sm ${role === "user" ? "bg-cyan-500 text-slate-950" : "border border-slate-800 bg-slate-900 text-slate-100"}`}>
      <pre className="m-0 whitespace-pre-wrap font-sans">{content}</pre>
    </div>
  );
}

