import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Brain as BrainIcon, Save } from 'lucide-react';
import {
  Heading,
  Text,
  Stack,
  HStack,
  Box,
  Icon,
  Input,
  Textarea,
  SimpleGrid,
  Flex,
} from '@chakra-ui/react';
import {
  getBrains,
  createBrain,
  updateBrain,
  deleteBrain,
  type Brain,
} from '../api/brains';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingState } from '../components/common/LoadingState';
import { Field } from '../components/ui/field';

export function BrainsPage() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: brains, isLoading } = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });

  const createMutation = useMutation({
    mutationFn: () => createBrain(formData.name, formData.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      setIsAdding(false);
      setFormData({ name: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateBrain(id, formData.name, formData.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      setEditingId(null);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
    },
  });

  const handleEdit = (brain: Brain) => {
    setEditingId(brain.id);
    setFormData({ name: brain.name, description: brain.description });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate(editingId);
    } else {
      createMutation.mutate();
    }
  };

  if (isLoading) return <LoadingState label='Loading knowledge brains...' />;

  return (
    <Stack gap='6' h='full' minH='0'>
      <Flex align='center' justify='space-between' p='6'>
        <Box>
          <Heading size='xl' color='white'>
            Knowledge Brains
          </Heading>
          <Text color='slate.400'>
            Manage your isolated knowledge containers
          </Text>
        </Box>
        <Button
          onClick={() => setIsAdding(true)}
          loading={createMutation.isPending}
        >
          <HStack gap='2'>
            <Plus size={16} />
            <Text>Create Brain</Text>
          </HStack>
        </Button>
      </Flex>

      {(isAdding || editingId) && (
        <Card border='1px solid' borderColor='brand.500/30' bg='brand.900/10'>
          <Stack gap='4'>
            <Heading size='md' color='white'>
              {isAdding ? 'Create New Brain' : 'Edit Brain'}
            </Heading>
            <Stack gap='4'>
              <Field label='Name'>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder='Marketing Docs, Project X...'
                  bg='slate.950'
                  borderColor='slate.700'
                />
              </Field>
              <Field label='Description'>
                <Textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder='Specify what kind of knowledge this brain handles...'
                  bg='slate.950'
                  borderColor='slate.700'
                />
              </Field>
            </Stack>
            <HStack justify='flex-end' gap='3'>
              <Button variant='outline' onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                <HStack gap='2'>
                  <Save size={16} />
                  <Text>Save Brain</Text>
                </HStack>
              </Button>
            </HStack>
          </Stack>
        </Card>
      )}

      <Flex
        flexDirection={'column'}
        gap={6}
        overflowY='auto'
        px={6}
        pb={6}
        pr={1}
        w={'100%'}
      >
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap='6' w={'full'}>
          {brains?.map((brain) => (
            <Card key={brain.id}>
              <Stack gap='4'>
                <HStack justify='space-between' align='flex-start'>
                  <HStack gap='3'>
                    <Icon as={BrainIcon} color='brand.400' h='5' w='5' />
                    <Heading size='md' color='white'>
                      {brain.name}
                    </Heading>
                  </HStack>
                  <HStack gap='1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleEdit(brain)}
                      px='2'
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      colorPalette='red'
                      onClick={() => deleteMutation.mutate(brain.id)}
                      loading={deleteMutation.isPending}
                      px='2'
                    >
                      <Trash2 size={14} />
                    </Button>
                  </HStack>
                </HStack>
                <Text fontSize='sm' color='slate.400' lineClamp={3}>
                  {brain.description || 'No description provided.'}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Flex>
    </Stack>
  );
}
