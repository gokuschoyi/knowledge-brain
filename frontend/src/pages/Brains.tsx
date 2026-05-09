import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Stack, Box, SimpleGrid, Flex, Portal } from '@chakra-ui/react';
import {
  getBrains,
  createBrain,
  updateBrain,
  deleteBrain,
  type Brain,
} from '../api/brains';
import { Button } from '../components/common/Button';
import { BrainEditorDialog } from '../components/common/BrainEditorDialog';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingState } from '../components/common/LoadingState';
import { BrainCard } from '../components/brains/BrainCard';
import { Tooltip } from '../components/ui/tooltip';

export function BrainsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteBrain, setPendingDeleteBrain] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: brains, isLoading } = useQuery({
    queryKey: ['brains'],
    queryFn: getBrains,
  });

  const createMutation = useMutation({
    mutationFn: () => createBrain(formData.name, formData.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      setIsDialogOpen(false);
      setFormData({ name: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateBrain(id, {
        name: formData.name,
        description: formData.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      setEditingId(null);
      setIsDialogOpen(false);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brains'] });
      setPendingDeleteBrain(null);
    },
  });

  const handleEdit = (brain: Brain) => {
    setEditingId(brain.id);
    setFormData({ name: brain.name, description: brain.description });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData({ name: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

  const handleDeleteRequest = (brain: Brain) => {
    setPendingDeleteBrain({ id: brain.id, name: brain.name });
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
    <Stack gap='6' h='full' minH='0' position='relative'>
      <Flex
        flexDirection={'column'}
        gap={6}
        overflowY='auto'
        px={2}
        pb={6}
        pr={1}
        w={'100%'}
      >
        <SimpleGrid
          columns={{ base: 1, md: 2, xl: 3 }}
          p='6'
          gap='6'
          w={'full'}
        >
          {brains?.map((brain) => (
            <BrainCard
              key={brain.id}
              brain={brain}
              onEdit={() => handleEdit(brain)}
              onDelete={() => handleDeleteRequest(brain)}
              deleting={
                deleteMutation.isPending && pendingDeleteBrain?.id === brain.id
              }
            />
          ))}
        </SimpleGrid>
      </Flex>

      {/* Floating Action Button */}
      <Portal>
        <Box position='fixed' bottom='8' right='8' zIndex='1000'>
          <Tooltip content='Create a new knowledge brain' showArrow>
            <Button
              variant='floating'
              size='lg'
              height='14'
              width='14'
              onClick={handleAdd}
            >
              <Plus size={24} color='white' />
            </Button>
          </Tooltip>
        </Box>
      </Portal>

      <ConfirmDialog
        title='Delete Brain'
        description={
          <>
            Are you sure you want to delete{' '}
            <strong>{pendingDeleteBrain?.name ?? 'this brain'}</strong>? This
            action cannot be undone.
          </>
        }
        confirmLabel='Delete brain'
        isOpen={!!pendingDeleteBrain}
        isDeleting={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteBrain(null);
          }
        }}
        onConfirm={() => {
          if (!pendingDeleteBrain) return;
          deleteMutation.mutate(pendingDeleteBrain.id);
        }}
      />

      <BrainEditorDialog
        isOpen={isDialogOpen}
        editing={!!editingId}
        formData={formData}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onNameChange={(value) => setFormData({ ...formData, name: value })}
        onDescriptionChange={(value) =>
          setFormData({ ...formData, description: value })
        }
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </Stack>
  );
}
