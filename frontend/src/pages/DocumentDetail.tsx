import {
  Box,
  Flex,
  Heading,
  Text,
  HStack,
  Stack,
  SimpleGrid,
  Badge,
  Separator,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import {
  deleteDocument,
  getDocument,
  getDocumentChunks,
  getDocumentEntities,
  getDocumentRelationships,
  retryDocument,
} from '../api/documents';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoadingState } from '../components/common/LoadingState';

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const docQuery = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
  });
  const chunksQuery = useQuery({
    queryKey: ['document-chunks', id],
    queryFn: () => getDocumentChunks(id),
  });
  const entitiesQuery = useQuery({
    queryKey: ['document-entities', id],
    queryFn: () => getDocumentEntities(id),
  });
  const relationshipsQuery = useQuery({
    queryKey: ['document-relationships', id],
    queryFn: () => getDocumentRelationships(id),
  });

  const retryMutation = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      navigate('/documents');
    },
  });

  if (docQuery.isLoading || !docQuery.data) {
    return <LoadingState label='Loading document...' />;
  }

  const doc = docQuery.data;

  return (
    <Stack gap='6' align='stretch'>
      <Card>
        <Flex align='flex-start' justify='space-between' gap='4'>
          <Box>
            <Heading size='lg' color='white'>
              {doc.title}
            </Heading>
            <HStack mt='2' gap='3' color='slate.500' fontSize='sm'>
              <Text>{doc.llm_provider}</Text>
              <Separator orientation='vertical' h='3' borderColor='slate.700' />
              <Text>{doc.llm_model}</Text>
              <Badge
                size='sm'
                colorPalette={
                  doc.status === 'completed'
                    ? 'green'
                    : doc.status === 'failed'
                      ? 'red'
                      : 'blue'
                }
              >
                {doc.status}
              </Badge>
            </HStack>
          </Box>
          <HStack gap='2'>
            {doc.status === 'failed' && (
              <Button
                disabled={retryMutation.isPending}
                onClick={() => void retryMutation.mutateAsync(id)}
              >
                {retryMutation.isPending ? 'Retrying...' : 'Retry'}
              </Button>
            )}
            <Button
              variant='outline'
              colorPalette='red'
              disabled={deleteMutation.isPending}
              onClick={() => void deleteMutation.mutateAsync(id)}
            >
              Delete
            </Button>
          </HStack>
        </Flex>

        <Box mt='4'>
          <Heading size='xs' color='slate.500' textTransform='uppercase' mb='2'>
            Summary
          </Heading>
          <Text color='slate.300' fontSize='md' lineHeight='tall'>
            {doc.summary || 'No summary available.'}
          </Text>
        </Box>

        {doc.error_message && (
          <Box
            mt='4'
            p='3'
            bg='red.900/20'
            borderRadius='md'
            borderWidth='1px'
            borderColor='red.900/30'
          >
            <Text color='red.300' fontSize='sm'>
              {doc.error_message}
            </Text>
          </Box>
        )}
      </Card>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap='6'>
        <Card>
          <Heading size='sm' color='white' mb='4'>
            Chunks
          </Heading>
          <Stack gap='3' align='stretch'>
            {chunksQuery.data?.map((chunk) => (
              <Box
                key={chunk.id}
                borderRadius='md'
                borderWidth='1px'
                borderColor='slate.800'
                p='3'
                fontSize='sm'
                color='slate.300'
                _hover={{ bg: 'slate.900' }}
              >
                {chunk.summary}
              </Box>
            ))}
          </Stack>
        </Card>

        <Card>
          <Heading size='sm' color='white' mb='4'>
            Entities
          </Heading>
          <Stack gap='2' align='stretch'>
            {entitiesQuery.data?.map((entity) => (
              <Flex
                key={entity.id}
                p='2'
                bg='slate.900/50'
                borderRadius='md'
                align='center'
                fontSize='sm'
                color='slate.300'
              >
                <Box w='2' h='2' borderRadius='full' bg='brand.400' mr='3' />
                {entity.name}
              </Flex>
            ))}
          </Stack>
        </Card>

        <Card>
          <Heading size='sm' color='white' mb='4'>
            Relationships
          </Heading>
          <Stack gap='2' align='stretch'>
            {relationshipsQuery.data?.map((relationship) => (
              <Box
                key={relationship.id}
                p='2'
                bg='slate.900/50'
                borderRadius='md'
                fontSize='sm'
                color='slate.300'
              >
                <HStack wrap='wrap'>
                  <Text fontWeight='bold' color='white'>
                    {relationship.source_name}
                  </Text>
                  <Badge size='sm' variant='outline' colorPalette='orange'>
                    {relationship.relationship_type}
                  </Badge>
                  <Text fontWeight='bold' color='white'>
                    {relationship.target_name}
                  </Text>
                </HStack>
              </Box>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
