import { Badge, HStack, Text } from '@chakra-ui/react';

import { Button } from '../common/Button';

type Tab = 'graph' | 'isolated';

type Props = {
  tab: Tab;
  connectedCount: number;
  isolatedCount: number;
  onTabChange: (tab: Tab) => void;
};

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant='ghost'
      onClick={onClick}
      border='1px solid'
      borderColor={active ? 'borderStrong' : 'glassBorder'}
      color={active ? 'white' : 'fgMuted'}
      bg={active ? 'rgba(99, 102, 241, 0.18)' : 'glassFill'}
      borderRadius='xl'
      backdropFilter='blur(8px)'
      boxShadow={active ? 'active' : 'none'}
      _hover={{
        bg: active ? 'rgba(99, 102, 241, 0.24)' : 'rgba(148, 163, 184, 0.12)',
        borderColor: active ? 'borderStrong' : 'rgba(99, 102, 241, 0.28)',
      }}
    >
      <HStack gap='2'>
        <Text>{label}</Text>
        <Badge
          bg={active ? 'rgba(255,255,255,0.16)' : 'rgba(15, 23, 42, 0.72)'}
          color={active ? 'white' : 'fgMuted'}
          borderRadius='full'
          px='2'
        >
          {count}
        </Badge>
      </HStack>
    </Button>
  );
}

export function GraphTabBar({
  tab,
  connectedCount,
  isolatedCount,
  onTabChange,
}: Props) {
  return (
    <HStack gap='3' wrap='wrap'>
      <TabButton
        active={tab === 'graph'}
        label='Graph'
        count={connectedCount}
        onClick={() => onTabChange('graph')}
      />
      <TabButton
        active={tab === 'isolated'}
        label='Isolated Entities'
        count={isolatedCount}
        onClick={() => onTabChange('isolated')}
      />
    </HStack>
  );
}
