import { ChangeEvent, FormEvent, useState } from 'react';
import {
  Box,
  Button,
  Field,
  Input,
  Stack,
  Heading,
  Text,
  NativeSelect,
  Textarea,
  // Badge,
} from '@chakra-ui/react';
import { FileUp, Settings2 } from 'lucide-react';

import { ModelCatalog } from '../../api/models';
import type { DocumentIngestResponse } from '../../api/types';
import { Card } from '../common/Card';

export function IngestForm({
  onSubmit,
  loading,
  ingestionActive,
  activeBrainId,
  // activeBrainName,
  modelCatalog,
}: {
  onSubmit: (payload: FormData) => Promise<DocumentIngestResponse>;
  loading: boolean;
  ingestionActive: boolean;
  activeBrainId: string;
  activeBrainName: string;
  modelCatalog: ModelCatalog;
}) {
  const [sourceType, setSourceType] = useState('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState('google');
  const [model, setModel] = useState('gemini-3-flash-preview');

  const handleReset = () => {
    setTitle('');
    setSourceType('file');
    setUrl('');
    setFile(null);
    setProvider('google');
    setModel('gemini-3-flash-preview');
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
  const handleSourceTypeChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSourceType(e.target.value);
  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setProvider(e.target.value);
    setModel('');
  };
  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setModel(e.target.value);

  return (
    <Card>
      <Heading
        size='md'
        color='white'
        mb='6'
        display='flex'
        alignItems='center'
        gap='2'
      >
        <FileUp size={20} /> Ingest Knowledge
      </Heading>

      <form onSubmit={handleSubmit}>
        <Stack gap='5'>
          <Box pt='2' borderTop='1px' borderColor='slate.800'>
            <Text
              fontSize='xs'
              fontWeight='bold'
              color='slate.500'
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
                <NativeSelect.Root>
                  <NativeSelect.Field
                    bg='slate.950'
                    borderColor='slate.800'
                    value={provider}
                    onChange={handleProviderChange}
                  >
                    <option value=''>Select provider</option>
                    {providerIds.map((pId) => (
                      <option key={pId} value={pId}>
                        {modelCatalog.providers[pId].label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>

              <Field.Root flex='1'>
                <Field.Label fontSize='xs' color='slate.400'>
                  Intelligence Model
                </Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    bg='slate.950'
                    borderColor='slate.800'
                    value={model}
                    // disabled={!provider}
                    onChange={handleModelChange}
                  >
                    <option value=''>Select model</option>
                    {selectedProvider?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>
            </Stack>
          </Box>

          <Field.Root invalid={!title}>
            <Field.Label color='slate.300'>Document Title</Field.Label>
            <Input
              placeholder='e.g. Q4 Financial Report'
              bg='slate.950'
              borderColor='slate.800'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field.Root>

          {/* <Field.Root>
            <Field.Label color='slate.300'>Knowledge Brain</Field.Label>
            <Badge
              colorPalette='cyan'
              variant='subtle'
              px='3'
              py='2'
              borderRadius='md'
            >
              {activeBrainName}
            </Badge>
          </Field.Root> */}

          <Field.Root>
            <Field.Label color='slate.300'>Source Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                bg='slate.950'
                borderColor='slate.800'
                value={sourceType}
                onChange={handleSourceTypeChange}
              >
                <option value='file'>Local File</option>
                <option value='url'>Remote URL</option>
                <option value='text'>Raw Text</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>

          {sourceType === 'url' ? (
            <Field.Root invalid={!url}>
              <Field.Label color='slate.300'>Document URL</Field.Label>
              <Input
                placeholder='https://example.com/doc.pdf'
                bg='slate.950'
                borderColor='slate.800'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field.Root>
          ) : sourceType === 'text' ? (
            <Textarea
              placeholder='Enter or paste the content to ingest...'
              bg='slate.950'
              borderColor='slate.800'
              minH='150px'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          ) : (
            <Field.Root invalid={!file}>
              <Field.Label color='slate.300'>File</Field.Label>
              <Input
                type='file'
                bg='slate.950'
                borderColor='slate.800'
                pt='1.5'
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field.Root>
          )}

          <Stack direction='row' gap='3' mt='2'>
            <Button
              type='submit'
              colorPalette='brand'
              flex='4'
              loading={loading}
              disabled={
                !activeBrainId ||
                !provider ||
                !model ||
                (sourceType === 'file' ? !file : !url) ||
                ingestionActive
              }
            >
              {ingestionActive ? 'Ingestion in Progress...' : 'Start Ingestion'}
            </Button>
            <Button
              type='button'
              variant='outline'
              colorPalette='slate'
              flex='1'
              onClick={handleReset}
              disabled={loading || ingestionActive}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </form>
    </Card>
  );
}
