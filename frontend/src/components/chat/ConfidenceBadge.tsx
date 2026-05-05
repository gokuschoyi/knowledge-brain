import { Badge } from "../common/Badge";

export function ConfidenceBadge({ score }: { score: number }) {
  return <Badge>Confidence {Math.round(score * 100)}%</Badge>;
}

