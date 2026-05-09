import { Pencil, Trash2 } from 'lucide-react';
import { Box, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import type { Brain } from '../../api/brains';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { MetaChip } from '../common/MetaChip';

export function BrainCard({
  brain,
  onEdit,
  onDelete,
  deleting,
}: {
  brain: Brain;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card
      variant='interactive'
      h='100%'
      position='relative'
      overflow='hidden'
      role='group'
    >
      <Box
        position='absolute'
        inset='0'
        bg='linear-gradient(160deg, rgba(99, 102, 241, 0.12), transparent 45%, rgba(34, 211, 238, 0.08))'
        pointerEvents='none'
      />
      <Stack gap='5' position='relative' h='100%'>
        <Flex justify='space-between' align='flex-start' gap='4'>
          <Box>
            <Text textStyle='sectionLabel' mb='2'>
              Brain Capsule
            </Text>
            <Heading size='md' color='white'>
              {brain.name}
            </Heading>
          </Box>
          <HStack opacity='1' transition='opacity 0.2s' flexShrink='0'>
            <Button variant='ghost' size='sm' onClick={onEdit}>
              <Pencil size={15} />
            </Button>
            <Button
              variant='danger'
              size='sm'
              onClick={onDelete}
              loading={deleting}
            >
              <Trash2 size={15} />
            </Button>
          </HStack>
        </Flex>

        <Text fontSize='sm' color='fgMuted' lineClamp={4}>
          {brain.description || 'No description provided.'}
        </Text>

        <HStack gap='2' wrap='wrap'>
          <MetaChip
            label='repair'
            value={brain.auto_repair_enabled ? 'enabled' : 'manual'}
          />
          {brain.auto_repair_enabled && (
            <MetaChip
              label='frequency'
              value={`${brain.auto_repair_frequency_minutes}m`}
            />
          )}
        </HStack>

        <Flex
          mt='auto'
          justify='space-between'
          align='center'
          pt='3'
          borderTop='1px solid'
          borderColor='whiteAlpha.100'
        >
          <Box>
            <Text textStyle='monoMeta' color='fgSubtle'>
              Created
            </Text>
            <Text fontSize='sm' color='fgMuted'>
              {new Date(brain.created_at).toLocaleDateString()}
            </Text>
          </Box>
        </Flex>
      </Stack>
    </Card>
  );
}
