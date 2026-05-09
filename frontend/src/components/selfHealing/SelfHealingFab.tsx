import { Box, Portal } from '@chakra-ui/react';
import { Play, RefreshCw } from 'lucide-react';

import { Button } from '../common/Button';
import { Tooltip } from '../ui/tooltip';

type Props = {
  autoRepairEnabled: boolean;
  pendingCount: number;
  onOpenSettings: () => void;
  onRunAll: () => void;
};

export function SelfHealingFab({
  autoRepairEnabled,
  pendingCount,
  onOpenSettings,
  onRunAll,
}: Props) {
  return (
    <Portal>
      <Box
        position='fixed'
        bottom='8'
        right='8'
        zIndex='1000'
        display='flex'
        flexDirection='column'
        gap='3'
      >
        <Tooltip content='Configure auto repair' showArrow>
          <Button
            size='lg'
            variant='floating'
            height='14'
            width='14'
            onClick={onOpenSettings}
            bg={
              autoRepairEnabled ? 'rgba(20, 184, 166, 0.2)' : 'bgPanelElevated'
            }
            color={autoRepairEnabled ? 'white' : 'fgMuted'}
            border='1px solid'
            borderColor={
              autoRepairEnabled ? 'rgba(20, 184, 166, 0.34)' : 'glassBorder'
            }
            boxShadow='glass'
            backdropFilter='blur(18px)'
            _hover={{
              bg: autoRepairEnabled
                ? 'rgba(20, 184, 166, 0.28)'
                : 'rgba(148, 163, 184, 0.12)',
              borderColor: autoRepairEnabled
                ? 'rgba(45, 212, 191, 0.44)'
                : 'rgba(99, 102, 241, 0.28)',
              transform: 'translateY(-2px) scale(1.02)',
            }}
            transition='all 0.2s'
          >
            <RefreshCw size={22} />
          </Button>
        </Tooltip>

        <Tooltip content='Run all pending repair tasks' showArrow>
          <Button
            size='lg'
            variant='floating'
            height='14'
            width='14'
            onClick={onRunAll}
            bg='rgba(99, 102, 241, 0.22)'
            color='white'
            border='1px solid'
            borderColor='borderStrong'
            boxShadow='glass'
            backdropFilter='blur(18px)'
            disabled={!pendingCount}
            _hover={{
              bg: 'rgba(99, 102, 241, 0.3)',
              borderColor: 'rgba(129, 140, 248, 0.5)',
              transform: 'translateY(-2px) scale(1.02)',
            }}
            _disabled={{
              bg: 'bgPanelElevated',
              color: 'fgSubtle',
              borderColor: 'glassBorder',
              boxShadow: 'none',
            }}
            transition='all 0.2s'
          >
            <Play size={24} />
          </Button>
        </Tooltip>
      </Box>
    </Portal>
  );
}
