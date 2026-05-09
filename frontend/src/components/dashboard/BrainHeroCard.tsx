import { Heading, HStack, Stack, Text } from '@chakra-ui/react';

import type { DashboardMetrics } from '../../api/dashboard';
import { Card } from '../common/Card';
import { MetaChip } from '../common/MetaChip';

type Props = {
  hero: DashboardMetrics['hero'];
  brainSummary: DashboardMetrics['brain_summary'];
};

export function BrainHeroCard({ hero, brainSummary }: Props) {
  return (
    <Card variant='hero'>
      <Stack gap='6'>
        <Stack gap='3'>
          <Text textStyle='sectionLabel' color='cyan.300'>
            {hero.status}
          </Text>
          <Heading size='2xl' color='white' maxW='18ch'>
            {hero.title}
          </Heading>
          <Text fontSize='sm' color='fgMuted' maxW='60ch'>
            {hero.description}
          </Text>
        </Stack>
        <HStack gap='2' wrap='wrap'>
          <MetaChip
            label='completed'
            value={String(hero.documents_completed)}
          />
          <MetaChip
            label='processing'
            value={String(hero.documents_processing)}
          />
          <MetaChip label='failed' value={String(hero.documents_failed)} />
        </HStack>
        {brainSummary ? (
          <HStack gap='2' wrap='wrap'>
            <MetaChip
              label='auto-repair'
              value={brainSummary.auto_repair_enabled ? 'enabled' : 'off'}
            />
            {brainSummary.auto_repair_enabled ? (
              <>
                <MetaChip
                  label='mode'
                  value={
                    brainSummary.auto_repair_safe_only
                      ? 'safe only'
                      : 'all types'
                  }
                />
                <MetaChip
                  label='frequency'
                  value={`${brainSummary.auto_repair_frequency_minutes}m`}
                />
                <MetaChip
                  label='last run'
                  value={
                    brainSummary.last_auto_repair_at
                      ? new Date(
                          brainSummary.last_auto_repair_at,
                        ).toLocaleString()
                      : 'never'
                  }
                />
              </>
            ) : null}
          </HStack>
        ) : null}
      </Stack>
    </Card>
  );
}
