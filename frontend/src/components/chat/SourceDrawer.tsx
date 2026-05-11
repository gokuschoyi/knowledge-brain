import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Flex,
  HStack,
  Portal,
  Spinner,
  Text,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerPositioner,
  DrawerRoot,
  DrawerTitle,
  IconButton,
} from '@chakra-ui/react';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
// import Markdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import rehypeRaw from 'rehype-raw';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import type {
  ChatSource,
  EvidenceSpanRenderContext,
  JsonValue,
} from '../../api/types';
import { API_BASE_URL } from '../../api/client';
import { getEvidenceSpanRenderContext } from '../../api/evidence';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

function resolveBackendUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return BACKEND_ORIGIN + url;
}

function injectHighlight(
  text: string,
  start: number | null | undefined,
  end: number | null | undefined,
  fallbackSnippet: string,
  preferSnippetMatch = false,
): string {
  if (
    !preferSnippetMatch &&
    start != null &&
    end != null &&
    start >= 0 &&
    end > start &&
    end <= text.length
  ) {
    return (
      text.slice(0, start) +
      '<mark class="source-highlight">' +
      text.slice(start, end) +
      '</mark>' +
      text.slice(end)
    );
  }

  const idx = text.indexOf(fallbackSnippet);
  if (idx !== -1) {
    return (
      text.slice(0, idx) +
      '<mark class="source-highlight">' +
      text.slice(idx, idx + fallbackSnippet.length) +
      '</mark>' +
      text.slice(idx + fallbackSnippet.length)
    );
  }
  return text;
}

function asNumber(value: JsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

type SourceDrawerProps = {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
};

type PdfWordRecord = EvidenceSpanRenderContext['word_records'][number];

function PdfViewer({
  fileUrl,
  initialPage,
  fallbackSnippet,
  wordRecords,
}: {
  fileUrl: string;
  initialPage: number;
  fallbackSnippet: string;
  wordRecords: PdfWordRecord[];
}) {
  const renderWidth = Math.min(640, window.innerWidth * 0.9);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageOrigWidth, setPageOrigWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(initialPage);
  }, [initialPage]);

  const currentPageWords = useMemo(
    () => wordRecords.filter((word) => word.page_number === currentPage),
    [wordRecords, currentPage],
  );
  const scale = pageOrigWidth > 0 ? renderWidth / pageOrigWidth : 1;
  const useBboxOverlay = currentPageWords.length > 0;
  const useTextLayerFallbackHighlight =
    !useBboxOverlay && currentPage === initialPage;

  useEffect(() => {
    if (!containerRef.current) return;
    if (useBboxOverlay && currentPageWords.length > 0) {
      const firstWord = currentPageWords[0];
      const bbox = Array.isArray(firstWord.bbox) ? firstWord.bbox : [];
      const y0 = typeof bbox[1] === 'number' ? bbox[1] : 0;
      const pageWidth = typeof bbox[5] === 'number' ? bbox[5] : pageOrigWidth;
      const adjustedScale = pageWidth > 0 ? renderWidth / pageWidth : scale;
      containerRef.current.scrollTop = Math.max(0, y0 * adjustedScale - 100);
      return;
    }
    if (!useTextLayerFallbackHighlight) return;
    const el = containerRef.current.querySelector('.source-highlight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [
    currentPageWords,
    pageOrigWidth,
    renderWidth,
    scale,
    useBboxOverlay,
    useTextLayerFallbackHighlight,
  ]);

  const highlightWords = useMemo(
    () =>
      fallbackSnippet
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3),
    [fallbackSnippet],
  );

  return (
    <Box ref={containerRef} overflowY='auto' h='100%'>
      <Box position='relative' display='inline-block'>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: count }) => setNumPages(count)}
          loading={
            <Flex justify='center' pt={8}>
              <Spinner color='blue.400' />
            </Flex>
          }
          error={
            <Text color='red.400' p={4}>
              Failed to load PDF.
            </Text>
          }
        >
          <Page
            pageNumber={currentPage}
            width={renderWidth}
            renderTextLayer={!useBboxOverlay}
            renderAnnotationLayer={false}
            customTextRenderer={
              !useTextLayerFallbackHighlight
                ? undefined
                : useBboxOverlay
                  ? undefined
                  : ({ str }: { str: string }) => {
                      if (!str.trim()) return str;
                      const lower = str.toLowerCase();
                      if (highlightWords.some((word) => lower.includes(word))) {
                        return `<mark class="source-highlight" style="background:rgba(251,191,36,0.35);border-radius:2px;">${str}</mark>`;
                      }
                      return str;
                    }
            }
            onLoadSuccess={(page) => setPageOrigWidth(page.originalWidth)}
          />
        </Document>

        {useBboxOverlay ? (
          <Box position='absolute' top={0} left={0} pointerEvents='none'>
            {currentPageWords.map((word) => {
              const bbox = Array.isArray(word.bbox) ? word.bbox : [];
              const [x0, y0, x1, y1] = bbox as number[];
              if (
                typeof x0 !== 'number' ||
                typeof y0 !== 'number' ||
                typeof x1 !== 'number' ||
                typeof y1 !== 'number'
              ) {
                return null;
              }
              return (
                <Box
                  key={word.id}
                  position='absolute'
                  left={`${x0 * scale}px`}
                  top={`${y0 * scale}px`}
                  width={`${(x1 - x0) * scale}px`}
                  height={`${(y1 - y0) * scale}px`}
                  bg='rgba(251,191,36,0.4)'
                  borderRadius='1px'
                />
              );
            })}
          </Box>
        ) : null}
      </Box>

      {numPages > 1 ? (
        <HStack justify='center' py={3} gap={3}>
          <IconButton
            aria-label='Previous page'
            size='sm'
            variant='ghost'
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            ‹
          </IconButton>
          <Text fontSize='sm' color='slate.400'>
            Page {currentPage} / {numPages}
          </Text>
          <IconButton
            aria-label='Next page'
            size='sm'
            variant='ghost'
            disabled={currentPage >= numPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(numPages, page + 1))
            }
          >
            ›
          </IconButton>
        </HStack>
      ) : null}
    </Box>
  );
}

function MarkdownViewer({
  text,
  fileUrl,
  startChar,
  endChar,
  fallbackSnippet,
}: {
  text: string;
  fileUrl?: string | null;
  startChar?: number | null;
  endChar?: number | null;
  fallbackSnippet: string;
}) {
  const [content, setContent] = useState<string>(text);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMarkdown() {
      if (!fileUrl) {
        setContent(text);
        return;
      }
      try {
        const response = await fetch(resolveBackendUrl(fileUrl));
        if (!response.ok) throw new Error('Failed to load markdown file.');
        const rawContent = await response.text();
        if (!cancelled) setContent(rawContent);
      } catch {
        if (!cancelled) setContent(text);
      }
    }

    loadMarkdown();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, text]);

  useEffect(() => {
    const el = bodyRef.current?.querySelector('.source-highlight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [content, startChar, endChar, fallbackSnippet]);

  const marked = injectHighlight(
    content,
    startChar,
    endChar,
    fallbackSnippet,
    true,
  );

  return (
    <Box
      ref={bodyRef}
      overflowY='auto'
      h='100%'
      p={4}
      fontSize='sm'
      color='slate.200'
      lineHeight='1.7'
    >
      <style>{`.source-highlight { background: rgba(251, 190, 36, 0.76); border-radius: 2px; padding: 1px 0; }`}</style>
      <MarkdownRenderer content={marked} />
      {/* <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          mark: ({ children }) => (
            <mark className='source-highlight'>
              {children as React.ReactNode}
            </mark>
          ),
        }}
      >
        {marked}
      </Markdown> */}
    </Box>
  );
}

function PlainTextViewer({
  text,
  startChar,
  endChar,
  fallbackSnippet,
}: {
  text: string;
  startChar?: number | null;
  endChar?: number | null;
  fallbackSnippet: string;
}) {
  const highlightRef = useRef<HTMLElement>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [text, startChar, endChar, fallbackSnippet]);

  let before = text;
  let highlighted = '';
  let after = '';

  if (
    startChar != null &&
    endChar != null &&
    startChar >= 0 &&
    endChar > startChar &&
    endChar <= text.length
  ) {
    before = text.slice(0, startChar);
    highlighted = text.slice(startChar, endChar);
    after = text.slice(endChar);
  } else {
    const idx = text.indexOf(fallbackSnippet);
    if (idx !== -1) {
      before = text.slice(0, idx);
      highlighted = fallbackSnippet;
      after = text.slice(idx + fallbackSnippet.length);
    }
  }

  return (
    <Box overflowY='auto' h='100%'>
      <Box
        as='pre'
        p={4}
        fontSize='sm'
        color='slate.300'
        whiteSpace='pre-wrap'
        wordBreak='break-word'
        lineHeight='1.7'
        fontFamily='mono'
      >
        {before}
        {highlighted ? (
          <Box
            as='mark'
            ref={highlightRef}
            display='inline'
            bg='rgba(251,191,36,0.35)'
            borderRadius='2px'
            color='white'
          >
            {highlighted}
          </Box>
        ) : null}
        {after}
      </Box>
    </Box>
  );
}

function TableViewer({
  text,
  locatorPayload,
  startChar,
  endChar,
  fallbackSnippet,
}: {
  text: string;
  locatorPayload: { [key: string]: JsonValue };
  startChar?: number | null;
  endChar?: number | null;
  fallbackSnippet: string;
}) {
  const rowStart = asNumber(locatorPayload.row_start);
  const rowEnd = asNumber(locatorPayload.row_end);
  const sheetName = asString(locatorPayload.sheet_name);

  return (
    <Flex direction='column' h='100%'>
      <Box px={4} py={3} borderBottom='1px solid' borderColor='glassBorder'>
        <Text fontSize='xs' color='slate.400'>
          {sheetName ? `Sheet: ${sheetName}` : 'Tabular evidence'}
          {rowStart != null ? ` • rows ${rowStart}-${rowEnd ?? rowStart}` : ''}
        </Text>
      </Box>
      <PlainTextViewer
        text={text}
        startChar={startChar}
        endChar={endChar}
        fallbackSnippet={fallbackSnippet}
      />
    </Flex>
  );
}

function SlideViewer({
  text,
  locatorPayload,
  startChar,
  endChar,
  fallbackSnippet,
}: {
  text: string;
  locatorPayload: { [key: string]: JsonValue };
  startChar?: number | null;
  endChar?: number | null;
  fallbackSnippet: string;
}) {
  const slideNumber = asNumber(locatorPayload.slide_number);
  const shapeIndex = asNumber(locatorPayload.shape_index);

  return (
    <Flex direction='column' h='100%'>
      <Box px={4} py={3} borderBottom='1px solid' borderColor='glassBorder'>
        <Text fontSize='xs' color='slate.400'>
          {slideNumber != null ? `Slide ${slideNumber}` : 'Slide evidence'}
          {shapeIndex != null ? ` • shape ${shapeIndex}` : ''}
        </Text>
      </Box>
      <PlainTextViewer
        text={text}
        startChar={startChar}
        endChar={endChar}
        fallbackSnippet={fallbackSnippet}
      />
    </Flex>
  );
}

export function SourceDrawer({ source, isOpen, onClose }: SourceDrawerProps) {
  const [context, setContext] = useState<EvidenceSpanRenderContext | null>(
    null,
  );
  const [legacyDocument, setLegacyDocument] = useState<{
    text: string;
    structure_metadata: { [key: string]: JsonValue };
    raw_file_url?: string | null;
    file_extension?: string | null;
    source_type?: 'text' | 'file' | 'url';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      if (!source || !isOpen) {
        setContext(null);
        setLegacyDocument(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        if (source.evidence_span_id) {
          const nextContext = await getEvidenceSpanRenderContext(
            source.evidence_span_id,
          );
          if (!cancelled) {
            setContext(nextContext);
            setLegacyDocument(null);
          }
        } else {
          const response = await fetch(
            `${API_BASE_URL}/documents/${source.document_id}/raw-text/`,
          );
          if (!response.ok) throw new Error('Failed to load document text.');
          const data = (await response.json()) as {
            text: string;
            structure_metadata?: { [key: string]: JsonValue };
            raw_file_url?: string | null;
            file_extension?: string | null;
            source_type?: 'text' | 'file' | 'url';
          };
          if (!cancelled) {
            setContext(null);
            setLegacyDocument({
              text: data.text ?? '',
              structure_metadata: data.structure_metadata ?? {},
              raw_file_url: data.raw_file_url,
              file_extension: data.file_extension,
              source_type: data.source_type,
            });
          }
        }
      } catch {
        if (!cancelled) {
          setContext(null);
          setLegacyDocument(null);
          setError('Failed to load source context.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadContext();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, source?.evidence_span_id]);

  const effectiveFileExtension =
    context?.document.file_extension ??
    legacyDocument?.file_extension ??
    source?.file_extension ??
    null;
  const effectiveSourceType =
    context?.document.source_type ??
    legacyDocument?.source_type ??
    source?.source_type ??
    'text';
  const effectiveText = context?.document.text ?? legacyDocument?.text ?? '';
  const effectiveLocatorPayload =
    context?.locator_payload ??
    (source?.locator_payload as { [key: string]: JsonValue } | undefined) ??
    {};
  const effectiveStartChar =
    context?.evidence_span.span_start_char ?? source?.start_char ?? null;
  const effectiveEndChar =
    context?.evidence_span.span_end_char ?? source?.end_char ?? null;
  const effectiveQuote =
    context?.evidence_span.quote_text ??
    source?.quote_text ??
    source?.snippet ??
    '';
  const effectivePageNumber =
    asNumber(context?.locator_payload.page_number) ?? source?.page_number ?? 1;
  const effectiveFileUrl =
    context?.document.raw_file_url ??
    legacyDocument?.raw_file_url ??
    source?.raw_file_url ??
    null;

  const fileExtBadge =
    effectiveFileExtension?.toUpperCase() ??
    effectiveSourceType.toUpperCase() ??
    'DOC';

  function renderContent() {
    if (!source) return null;
    if (loading) {
      return (
        <Flex justify='center' align='center' h='100%'>
          <Spinner color='blue.400' />
        </Flex>
      );
    }
    if (error) {
      return (
        <Text color='red.400' p={4}>
          {error}
        </Text>
      );
    }

    if (effectiveFileExtension === 'pdf' && effectiveFileUrl) {
      return (
        <PdfViewer
          key={`pdf-${source.evidence_span_id ?? `${source.document_id}-${effectivePageNumber}`}`}
          fileUrl={resolveBackendUrl(effectiveFileUrl)}
          initialPage={effectivePageNumber}
          fallbackSnippet={effectiveQuote}
          wordRecords={context?.word_records ?? []}
        />
      );
    }

    if (effectiveFileExtension === 'md') {
      return (
        <MarkdownViewer
          text={effectiveText}
          fileUrl={effectiveFileUrl}
          startChar={effectiveStartChar}
          endChar={effectiveEndChar}
          fallbackSnippet={effectiveQuote}
        />
      );
    }

    if (effectiveFileExtension === 'pptx') {
      return (
        <SlideViewer
          text={effectiveText}
          locatorPayload={effectiveLocatorPayload}
          startChar={effectiveStartChar}
          endChar={effectiveEndChar}
          fallbackSnippet={effectiveQuote}
        />
      );
    }

    if (effectiveFileExtension === 'csv' || effectiveFileExtension === 'xlsx') {
      return (
        <TableViewer
          text={effectiveText}
          locatorPayload={effectiveLocatorPayload}
          startChar={effectiveStartChar}
          endChar={effectiveEndChar}
          fallbackSnippet={effectiveQuote}
        />
      );
    }

    return (
      <PlainTextViewer
        text={effectiveText}
        startChar={effectiveStartChar}
        endChar={effectiveEndChar}
        fallbackSnippet={effectiveQuote}
      />
    );
  }

  return (
    <DrawerRoot
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
      placement='end'
      size='lg'
    >
      <Portal>
        <DrawerBackdrop bg='rgba(3,7,18,0.6)' backdropFilter='blur(8px)' />
        <DrawerPositioner>
          <DrawerContent
            bg='rgba(12,21,40,0.97)'
            border='1px solid'
            borderColor='glassBorder'
            boxShadow='glass'
            backdropFilter='blur(24px)'
            display='flex'
            flexDirection='column'
            h='100%'
          >
            <DrawerHeader
              borderBottomWidth='1px'
              borderColor='glassBorder'
              py={3}
              px={4}
            >
              <Flex align='center' gap={3} pr={8}>
                <Box
                  px={2}
                  py={0.5}
                  borderRadius='md'
                  bg='rgba(59,130,246,0.15)'
                  border='1px solid'
                  borderColor='rgba(59,130,246,0.3)'
                  fontSize='xs'
                  fontWeight='bold'
                  color='blue.300'
                  flexShrink={0}
                >
                  {fileExtBadge}
                </Box>
                <DrawerTitle
                  fontSize='sm'
                  fontWeight='medium'
                  color='white'
                  overflow='hidden'
                  textOverflow='ellipsis'
                  whiteSpace='nowrap'
                >
                  {source?.document_title ?? ''}
                </DrawerTitle>
                {effectivePageNumber ? (
                  <Text fontSize='xs' color='slate.400' flexShrink={0}>
                    {effectiveFileExtension === 'pdf'
                      ? `p. ${effectivePageNumber}`
                      : null}
                  </Text>
                ) : null}
              </Flex>
              <DrawerCloseTrigger
                position='absolute'
                top='3'
                insetEnd='3'
                color='slate.400'
                _hover={{ color: 'white' }}
              />
            </DrawerHeader>
            <DrawerBody p={0} flex='1' minH={0} overflow='hidden'>
              {renderContent()}
            </DrawerBody>
          </DrawerContent>
        </DrawerPositioner>
      </Portal>
    </DrawerRoot>
  );
}
