import { Box, Flex, Text } from '@chakra-ui/react';
import { Filter, X } from 'lucide-react';

import { Button } from '../common/Button';
import { Tooltip } from '../ui/tooltip';

type Props = {
  taskTypes: string[];
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
};

export function TaskTypeFilterBar({
  taskTypes,
  activeFilter,
  onFilterChange,
}: Props) {
  if (!taskTypes.length) return null;

  return (
    <Flex gap='2' wrap='wrap' align='center'>
      <Flex align='center' gap='2' mr='2'>
        <Filter size={14} color='#64748b' />
        <Text
          fontSize='xs'
          fontWeight='bold'
          color='slate.500'
          textTransform='uppercase'
          letterSpacing='wider'
        >
          Filter by type
        </Text>
      </Flex>

      <Button
        size='xs'
        variant={activeFilter === null ? 'solid' : 'ghost'}
        onClick={() => onFilterChange(null)}
        rounded='full'
        px='3'
      >
        All
      </Button>

      {taskTypes.map((type) => (
        <Button
          key={type}
          size='xs'
          variant={activeFilter === type ? 'solid' : 'ghost'}
          onClick={() => onFilterChange(type)}
          rounded='full'
          px='3'
          textTransform='capitalize'
        >
          {type.split('_').join(' ')}
        </Button>
      ))}

      {activeFilter && (
        <Tooltip content='Clear filter'>
          <Box
            as='button'
            onClick={() => onFilterChange(null)}
            p='1'
            rounded='full'
            _hover={{ bg: 'whiteAlpha.100' }}
            color='slate.400'
          >
            <X size={14} />
          </Box>
        </Tooltip>
      )}
    </Flex>
  );
}
