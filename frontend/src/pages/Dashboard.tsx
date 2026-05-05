import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "../api/dashboard";
import { Card } from "../components/common/Card";
import { LoadingState } from "../components/common/LoadingState";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });

  if (isLoading || !data) return <LoadingState label="Loading dashboard..." />;

  const stats = [
    ["Documents", data.documents],
    ["Chunks", data.chunks],
    ["Entities", data.entities],
    ["Relationships", data.relationships],
    ["Open repair tasks", data.open_self_healing_tasks],
    ["Avg quality", data.average_quality_score],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stats.map(([label, value]) => (
        <Card key={label}>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </Card>
      ))}
    </div>
  );
}

