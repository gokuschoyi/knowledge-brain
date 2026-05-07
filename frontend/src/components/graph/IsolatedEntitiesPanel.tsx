import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';

import type { Entity, GraphNode } from '../../api/types';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';

function toEntity(node: GraphNode): Entity {
  return node.data as Entity;
}

export function IsolatedEntitiesPanel({ entities }: { entities: GraphNode[] }) {
  const [search, setSearch] = useState('');

  const filteredEntities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entities;

    return entities.filter((node) => {
      const entity = toEntity(node);
      const haystack = [
        entity.name,
        entity.canonical_name,
        entity.entity_type,
        entity.description,
        ...entity.aliases,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [entities, search]);

  if (entities.length === 0) {
    return (
      <EmptyState
        title='No isolated entities'
        body='Every extracted entity in this brain is part of at least one relationship.'
      />
    );
  }

  return (
    <Stack gap='6' flex='1' minH='0'>
      <Card py={3}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          gap='4'
          align={{ base: 'stretch', md: 'center' }}
          justify='space-between'
        >
          <Box>
            <Heading size='sm' color='white'>
              Isolated Entities
            </Heading>
            <Text mt='1' fontSize='sm' color='slate.400'>
              These entities are extracted, but they are not part of any
              relationship yet.
            </Text>
          </Box>
          <HStack gap='3'>
            <Badge colorPalette='orange' px='2.5' py='1' borderRadius='full'>
              {filteredEntities.length} shown
            </Badge>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search isolated entities...'
              bg='slate.950'
              borderColor='slate.700'
              maxW={{ base: 'full', md: '320px' }}
            />
          </HStack>
        </Flex>
      </Card>

      {filteredEntities.length === 0 ? (
        <EmptyState
          title='No matching isolated entities'
          body='Try a different search term or clear the current filter.'
        />
      ) : (
        <Box flex='1' minH='0' overflowY='auto' pr='1'>
          <Grid
            templateColumns={{ base: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }}
            gap='4'
          >
            {filteredEntities.map((node) => {
              const entity = toEntity(node);
              return (
                <Card key={node.id}>
                  <Stack gap='3'>
                    <Flex align='flex-start' justify='space-between' gap='3'>
                      <Box minW='0'>
                        <Heading size='sm' color='white' truncate>
                          {entity.name}
                        </Heading>
                        <Text mt='1' fontSize='xs' color='slate.500'>
                          {entity.canonical_name || 'No canonical name'}
                        </Text>
                      </Box>
                      <Badge colorPalette='purple' borderRadius='full' px='2.5'>
                        {entity.entity_type}
                      </Badge>
                    </Flex>

                    <Text fontSize='sm' color='slate.300' lineClamp={3}>
                      {entity.description || 'No description available yet.'}
                    </Text>

                    <HStack gap='3' wrap='wrap' fontSize='xs' color='slate.400'>
                      <Text>Confidence: {entity.confidence.toFixed(2)}</Text>
                      <Text>Aliases: {entity.aliases.length}</Text>
                    </HStack>
                  </Stack>
                </Card>
              );
            })}
          </Grid>
        </Box>
      )}
    </Stack>
  );
}
