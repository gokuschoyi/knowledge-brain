import { FormEvent, useMemo, useState } from 'react';
import {
  Box,
  Collapsible,
  type ListCollection,
  createListCollection,
  Field,
  FileUpload,
  Flex,
  HStack,
  Input,
  Icon,
  Portal,
  Select,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import {
  Check,
  ChevronRight,
  ChevronDown,
  FileUp,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';

import { ModelCatalog } from '../../api/models';
import type { DocumentIngestResponse } from '../../api/types';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

type SelectOption = {
  label: string;
  value: string;
};

export function IngestForm({
  onSubmit,
  loading,
  ingestionActive,
  activeBrainId,
  collapsed,
  onToggleCollapse,
  modelCatalog,
}: {
  onSubmit: (payload: FormData) => Promise<DocumentIngestResponse>;
  loading: boolean;
  ingestionActive: boolean;
  activeBrainId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  modelCatalog: ModelCatalog;
}) {
  const defaultProvider = modelCatalog.default_provider || 'google';
  const defaultModel = modelCatalog.default_model || '';
  const [sourceType, setSourceType] = useState('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState(defaultProvider);
  const [model, setModel] = useState(defaultModel);

  const handleReset = () => {
    setTitle('');
    setSourceType('file');
    setUrl('');
    setFile(null);
    setProvider(defaultProvider);
    setModel(defaultModel);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeBrainId || !provider || !model) return;

    const formData = new FormData();
    formData.append('brain', activeBrainId);
    formData.append('title', title);
    formData.append('source_type', sourceType);
    formData.append('llm_provider', provider);
    formData.append('llm_model', model);

    if (sourceType === 'file' && file) {
      formData.append('raw_file', file);
    } else if (sourceType === 'url' && url) {
      formData.append('url', url);
    } else if (sourceType === 'text' && url) {
      formData.append('raw_text', url);
    }

    await onSubmit(formData);
    handleReset();
  }

  // modelCatalog.providers is a Record<string, ProviderOption>
  const providerIds = Object.keys(modelCatalog.providers);
  const selectedProvider = provider ? modelCatalog.providers[provider] : null;
  const sourceTypeCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: 'Local File', value: 'file' },
          { label: 'Remote URL', value: 'url' },
          { label: 'Raw Text', value: 'text' },
        ],
      }),
    [],
  );
  const providerCollection = useMemo(
    () =>
      createListCollection({
        items: providerIds.map((pId) => ({
          label: modelCatalog.providers[pId].label,
          value: pId,
        })),
      }),
    [modelCatalog.providers, providerIds],
  );
  const modelCollection = useMemo(
    () =>
      createListCollection({
        items:
          selectedProvider?.models.map((m) => ({
            label: m.label,
            value: m.id,
          })) ?? [],
      }),
    [selectedProvider],
  );

  const renderSelect = ({
    collection,
    value,
    onValueChange,
    placeholder,
    disabled,
  }: {
    collection: ListCollection<SelectOption>;
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
  }) => (
    <Select.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onValueChange(details.value[0] ?? '')}
      disabled={disabled}
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
    >
      <Select.HiddenSelect />
      <Select.Trigger
        bg='slate.950'
        border='1px solid'
        borderColor='glassBorder'
        borderRadius='lg'
        px='3'
        py='2.5'
        minH='11'
        color='white'
        _hover={{ borderColor: 'borderStrong' }}
        _open={{ borderColor: 'borderStrong' }}
        _focusVisible={{ outline: 'none', boxShadow: 'none' }}
      >
        <Flex align='center' justify='space-between' w='full' gap='3'>
          <Select.ValueText
            placeholder={placeholder}
            color={value ? 'white' : 'fgMuted'}
          />
          <Icon as={ChevronDown} h='4' w='4' color='fgMuted' />
        </Flex>
      </Select.Trigger>

      <Portal>
        <Select.Positioner w='var(--reference-width)'>
          <Select.Content
            w='full'
            bg='rgba(12, 21, 40, 0.96)'
            border='1px solid'
            borderColor='glassBorder'
            borderRadius='xl'
            backdropFilter='blur(20px)'
            boxShadow='0 24px 60px rgba(3, 7, 18, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.12)'
            p='1.5'
            overflow='hidden'
            zIndex='dropdown'
          >
            {collection.items.map((item) => (
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
  );

  return (
    <Card variant='panel' flexShrink='0' px={4}>
      <Stack gap='5'>
        <Flex align='center' justify='space-between' gap='3' px={2}>
          <Stack gap='1'>
            <Text textStyle='sectionLabel'>Ingest Knowledge</Text>
            <Text fontSize='sm' color='fgMuted'>
              Upload material into the active brain.
            </Text>
          </Stack>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onToggleCollapse}
          >
            <Icon as={collapsed ? ChevronRight : ChevronDown} h='4' w='4' />
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        </Flex>

        <Collapsible.Root open={!collapsed}>
          <Collapsible.Content>
            <form onSubmit={handleSubmit}>
              <Stack gap='5' px={2}>
                <Box pt='2' borderTop='1px' borderColor='whiteAlpha.100'>
                  <Text
                    fontSize='xs'
                    fontWeight='bold'
                    color='fgSubtle'
                    textTransform='uppercase'
                    mb='4'
                    display='flex'
                    alignItems='center'
                    gap='2'
                  >
                    <Settings2 size={12} /> Extraction Settings
                  </Text>

                  <Stack direction={{ base: 'column', md: 'row' }} gap='4'>
                    <Field.Root flex='1'>
                      <Field.Label fontSize='xs' color='slate.400'>
                        LLM Provider
                      </Field.Label>
                      {renderSelect({
                        collection: providerCollection,
                        value: provider,
                        placeholder: 'Select provider',
                        onValueChange: (nextProvider) => {
                          setProvider(nextProvider);
                          setModel('');
                        },
                      })}
                    </Field.Root>

                    <Field.Root flex='1'>
                      <Field.Label fontSize='xs' color='slate.400'>
                        Intelligence Model
                      </Field.Label>
                      {renderSelect({
                        collection: modelCollection,
                        value: model,
                        placeholder: 'Select model',
                        disabled: !provider,
                        onValueChange: setModel,
                      })}
                    </Field.Root>
                  </Stack>
                </Box>

                <Field.Root invalid={!title}>
                  <Field.Label color='slate.300'>Document Title</Field.Label>
                  <Input
                    placeholder='e.g. Q4 Financial Report'
                    bg='slate.950'
                    borderColor='glassBorder'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label color='slate.300'>Source Type</Field.Label>
                  {renderSelect({
                    collection: sourceTypeCollection,
                    value: sourceType,
                    placeholder: 'Select source type',
                    onValueChange: setSourceType,
                  })}
                </Field.Root>

                {sourceType === 'url' ? (
                  <Field.Root invalid={!url}>
                    <Field.Label color='slate.300'>Document URL</Field.Label>
                    <Input
                      placeholder='https://example.com/doc.pdf'
                      bg='slate.950'
                      borderColor='glassBorder'
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </Field.Root>
                ) : sourceType === 'text' ? (
                  <Textarea
                    placeholder='Enter or paste the content to ingest...'
                    bg='slate.950'
                    borderColor='glassBorder'
                    minH='150px'
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                ) : (
                  <Field.Root invalid={!file} w='full'>
                    <Field.Label color='slate.300'>File</Field.Label>
                    <FileUpload.Root
                      maxFiles={1}
                      acceptedFiles={file ? [file] : []}
                      onFileChange={(details) =>
                        setFile(details.acceptedFiles[0] ?? null)
                      }
                      w='full'
                    >
                      <FileUpload.HiddenInput />
                      <FileUpload.Dropzone
                        className='arctic-glass ui-hover'
                        w='full'
                        borderRadius='2xl'
                        border='1px dashed'
                        borderColor='glassBorder'
                        p='5'
                        bg='transparent'
                      >
                        <FileUpload.DropzoneContent>
                          <UploadCloud
                            size={24}
                            color='var(--chakra-colors-cyan-300)'
                          />
                          <Text color='white' fontWeight='600'>
                            Drop a document or browse locally
                          </Text>
                          <Text fontSize='sm' color='fgMuted'>
                            PDF, text, and source files are supported by the
                            ingestion pipeline.
                          </Text>
                        </FileUpload.DropzoneContent>
                      </FileUpload.Dropzone>

                      <Box mt='3' w='full'>
                        <FileUpload.Context>
                          {({ acceptedFiles }) => (
                            <FileUpload.ItemGroup
                              w='full'
                              gap='3'
                              _empty={{ display: 'none' }}
                            >
                              {acceptedFiles.map((acceptedFile) => (
                                <FileUpload.Item
                                  key={`${acceptedFile.name}-${acceptedFile.lastModified}`}
                                  file={acceptedFile}
                                  w='full'
                                  bg='slate.950'
                                  border='1px solid'
                                  borderColor='glassBorder'
                                  borderRadius='xl'
                                >
                                  <Icon
                                    as={FileUp}
                                    h='4'
                                    w='4'
                                    color='brandCyan'
                                    flexShrink='0'
                                  />
                                  <FileUpload.ItemContent>
                                    <FileUpload.ItemName />
                                    <FileUpload.ItemSizeText />
                                  </FileUpload.ItemContent>
                                  <FileUpload.ItemDeleteTrigger aria-label='Remove selected file'>
                                    <Icon as={X} h='4' w='4' />
                                  </FileUpload.ItemDeleteTrigger>
                                </FileUpload.Item>
                              ))}
                            </FileUpload.ItemGroup>
                          )}
                        </FileUpload.Context>
                      </Box>

                      {/* {file ? (
                        <MetaChip label='selected' value={file.name} />
                      ) : null} */}
                    </FileUpload.Root>
                  </Field.Root>
                )}

                <Stack direction='row' gap='3' mt='2'>
                  <Button
                    type='submit'
                    flex='4'
                    loading={loading}
                    disabled={
                      !activeBrainId ||
                      !title ||
                      !provider ||
                      !model ||
                      (sourceType === 'file' && !file) ||
                      ((sourceType === 'url' || sourceType === 'text') &&
                        !url) ||
                      ingestionActive
                    }
                  >
                    <Sparkles size={16} />
                    {ingestionActive
                      ? 'Ingestion in Progress...'
                      : 'Start Ingestion'}
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    flex='1'
                    onClick={handleReset}
                    disabled={loading || ingestionActive}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </form>
          </Collapsible.Content>
        </Collapsible.Root>
      </Stack>
    </Card>
  );
}
