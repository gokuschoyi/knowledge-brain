import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  createListCollection,
  Flex,
  Heading,
  HStack,
  Icon,
  Select,
  Stack,
  Text,
  Portal,
} from '@chakra-ui/react';
import { Brain, Check, ChevronDown } from 'lucide-react';
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
    if (!exists) setActiveBrainId('');
  }, [activeBrainId, brainsQuery.data, setActiveBrainId]);

  const activeBrain =
    brainsQuery.data?.find((brain) => brain.id === activeBrainId) ?? null;

  const brainsCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: 'All brains', value: '' },
          ...(brainsQuery.data?.map((b) => ({ label: b.name, value: b.id })) ??
            []),
        ],
      }),
    [brainsQuery.data],
  );

  const currentMatch = [...matches]
    .reverse()
    .find((m) => (m.handle as { title: string; subtitle?: string })?.title);
  const handle =
    (currentMatch?.handle as { title: string; subtitle?: string }) || {};

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
    <Flex
      as='header'
      alignItems='center'
      justifyContent='space-between'
      gap='5'
      borderBottom='1px solid'
      borderColor='glassBorder'
      bg='rgba(3, 7, 18, 0.72)'
      px={{ base: 4, md: 6 }}
      py='4'
      backdropFilter='blur(18px)'
    >
      <Stack gap='0' minW='0' flex='1.1'>
        <Heading textStyle='pageTitle' color='white' truncate>
          {displayTitle}
        </Heading>
        <Text fontSize='sm' color='fgMuted' maxW='60ch'>
          {displaySubtitle}
        </Text>
      </Stack>

      <Select.Root
        collection={brainsCollection}
        value={[activeBrainId]}
        onValueChange={(d) => setActiveBrainId(d.value[0] ?? '')}
        size='sm'
        maxW={'300px'}
        positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}
      >
        <Select.Trigger
          display='flex'
          alignItems='center'
          gap='3'
          px='4'
          py='2'
          bg='glassFill'
          border='1px solid'
          borderColor='glassBorder'
          borderRadius='xl'
          backdropFilter='blur(8px)'
          h='auto'
          cursor='pointer'
          _hover={{
            bg: 'rgba(148, 163, 184, 0.12)',
            borderColor: 'rgba(99, 102, 241, 0.28)',
          }}
          _open={{ borderColor: 'borderStrong' }}
          _focusVisible={{ outline: 'none', boxShadow: 'none' }}
        >
          <Icon as={Brain} h='4' w='4' color='brandCyan' flexShrink='0' />
          <Box flex='1' textAlign='left'>
            <Text
              fontSize='0.62rem'
              textTransform='uppercase'
              letterSpacing='0.14em'
              color='fgSubtle'
              lineHeight='1'
              mb='1'
            >
              Active Brain
            </Text>
            <Select.ValueText
              color='white'
              fontSize='sm'
              fontWeight='600'
              lineHeight='1.2'
              minW='130px'
            />
          </Box>
          <Icon
            as={ChevronDown}
            h='3.5'
            w='3.5'
            color='fgMuted'
            flexShrink='0'
          />
        </Select.Trigger>

        <Portal>
          <Select.Positioner>
            <Select.Content
              bg='rgba(12, 21, 40, 0.96)'
              border='1px solid'
              borderColor='glassBorder'
              borderRadius='xl'
              backdropFilter='blur(20px)'
              boxShadow='0 24px 60px rgba(3, 7, 18, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.12)'
              p='1.5'
              minW='300px'
              overflow='hidden'
            >
              {brainsCollection.items.map((item) => (
                <Select.Item
                  key={item.value}
                  item={item}
                  px='3'
                  py='2.5'
                  borderRadius='lg'
                  color='fgMuted'
                  cursor='pointer'
                  fontSize='sm'
                  fontWeight='500'
                  transition='all 0.15s'
                  _hover={{ bg: 'glassFill', color: 'white' }}
                  _highlighted={{ bg: 'glassFill', color: 'white' }}
                >
                  <HStack justify='space-between' w='full'>
                    <Select.ItemText>{item.label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Icon as={Check} h='3.5' w='3.5' color='brandCyan' />
                    </Select.ItemIndicator>
                  </HStack>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Flex>
  );
}
