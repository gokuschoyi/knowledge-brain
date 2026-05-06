import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Heading, NativeSelect, Stack, Text } from '@chakra-ui/react';
import { useMatches } from 'react-router-dom';

import { getBrains } from '../../api/brains';
import { useActiveBrain } from '../../context/useActiveBrain';

export function Topbar() {
  const { activeBrainId, setActiveBrainId } = useActiveBrain();
  const matches = useMatches();

  const brainsQuery = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });

  useEffect(() => {
    if (!activeBrainId || !brainsQuery.data) return;
    const exists = brainsQuery.data.some((brain) => brain.id === activeBrainId);
    if (!exists) {
      setActiveBrainId('');
    }
  }, [activeBrainId, brainsQuery.data, setActiveBrainId]);

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  // Find the last match with a handle that has title/subtitle
  const currentMatch = [...matches]
    .reverse()
    .find((m) => (m.handle as { title: string; subtitle?: string })?.title);
  const handle =
    (currentMatch?.handle as { title: string; subtitle?: string }) || {};

  // For Dashboard, we prioritize the brain name
  const lastMatch = matches[matches.length - 1];
  const isDashboard = lastMatch?.pathname === '/' || lastMatch?.pathname === '';
  const isSelfHealing = lastMatch?.pathname?.endsWith('/self-healing');

  let displayTitle = handle.title || 'Knowledge Brain';
  let displaySubtitle =
    handle.subtitle || 'Ingest, structure, retrieve, repair.';

  if (isDashboard) {
    displayTitle = activeBrain ? activeBrain.name : 'All brains';
    displaySubtitle = activeBrain
      ? activeBrain.description || 'Showing metrics for the selected brain.'
      : 'Showing rolled-up metrics across every brain in the workspace.';
  } else if (isSelfHealing && activeBrain) {
    displaySubtitle = `Review repair work for ${activeBrain.name} and run only the fixes you trust.`;
  }

  return (
    <Box
      as='header'
      display='flex'
      alignItems='center'
      justifyContent='space-between'
      borderBottom='1px'
      borderColor='slate.800'
      bg='slate.950'
      px={6}
      py={4}
      backdropFilter='blur(8px)'
    >
      <Box>
        <Heading size='md' color='white' fontWeight='semibold'>
          {displayTitle}
        </Heading>
        <Text fontSize='sm' color='slate.400'>
          {displaySubtitle}
        </Text>
      </Box>

      <Stack gap='1' minW='260px'>
        {/* <Text fontSize='xs' color='slate.500' textTransform='uppercase'>
          Active brain
        </Text> */}
        <NativeSelect.Root size='sm'>
          <NativeSelect.Field
            bg='slate.900'
            borderColor='slate.800'
            value={activeBrainId}
            onChange={(event) => setActiveBrainId(event.target.value)}
          >
            <option value=''>All brains</option>
            {brainsQuery.data?.map((brain) => (
              <option key={brain.id} value={brain.id}>
                {brain.name}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        <Text fontSize='xs' color='slate.500'>
          {activeBrain
            ? activeBrain.description || 'Scoped across the entire app.'
            : 'No brain selected. Global views will show all data.'}
        </Text>
      </Stack>
    </Box>
  );
}
