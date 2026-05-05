import { Badge } from '@chakra-ui/react';

export function ConfidenceBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const colorPalette = score > 0.8 ? 'green' : score > 0.5 ? 'orange' : 'red';

  return (
    <Badge size='sm' colorPalette={colorPalette}>
      Confidence {percentage}%
    </Badge>
  );
}
