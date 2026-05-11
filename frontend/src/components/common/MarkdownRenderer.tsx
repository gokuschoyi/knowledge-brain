import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Text, Box, Heading, Code, Link, Stack } from '@chakra-ui/react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  const normalized = content.replace(/\\n/g, '\n');
  return (
    <Box maxW='100%' overflowX='hidden' display='block'>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <Heading
              as='h1'
              size='md'
              mb={2}
              mt={4}
              maxW='100%'
              wordBreak='break-word'
              display='block'
            >
              {props.children as React.ReactNode}
            </Heading>
          ),
          h2: ({ node: _node, ...props }) => (
            <Heading
              as='h2'
              size='sm'
              mb={2}
              mt={3}
              maxW='100%'
              wordBreak='break-word'
              display='block'
            >
              {props.children as React.ReactNode}
            </Heading>
          ),
          h3: ({ node: _node, ...props }) => (
            <Heading
              as='h3'
              size='xs'
              mb={2}
              mt={2}
              maxW='100%'
              wordBreak='break-word'
              display='block'
            >
              {props.children as React.ReactNode}
            </Heading>
          ),
          p: ({ node: _node, ...props }) => (
            <Text mb={0} maxW='100%' wordBreak='break-word' display='block'>
              {props.children as React.ReactNode}
            </Text>
          ),
          a: ({ node: _node, href, ...props }) => (
            <Link
              color='blue.400'
              href={href}
              target='_blank'
              wordBreak='break-all'
              display='inline'
            >
              {props.children as React.ReactNode}
            </Link>
          ),
          pre: ({ node: _node, ...props }) => (
            <Box
              as='pre'
              p={3}
              bg='slate.800'
              borderRadius='md'
              overflowX='auto'
              maxW='100%'
              width='100%'
              my={3}
              display='block'
            >
              {props.children as React.ReactNode}
            </Box>
          ),
          code: ({ node: _node, className, children }) => {
            const isCodeBlock =
              className?.startsWith('language-') ||
              (typeof children === 'string' && children.includes('\n'));

            return isCodeBlock ? (
              <Code
                display='block'
                bg='transparent'
                fontSize='xs'
                whiteSpace='pre'
                className={className}
              >
                {children as React.ReactNode}
              </Code>
            ) : (
              <Code
                px={1}
                borderRadius='sm'
                whiteSpace='nowrap'
                wordBreak='normal'
                display='inline'
              >
                {children as React.ReactNode}
              </Code>
            );
          },
          ul: ({ node: _node, ...props }) => (
            <Box as='ul' mb={3} pl={5} maxW='100%' listStyleType='disc'>
              {props.children as React.ReactNode}
            </Box>
          ),
          ol: ({ node: _node, ...props }) => (
            <Box as='ol' mb={3} pl={5} maxW='100%' listStyleType='decimal'>
              {props.children as React.ReactNode}
            </Box>
          ),
          li: ({ node: _node, ...props }) => (
            <Box as='li' mb={1} maxW='100%' wordBreak='break-word'>
              {props.children as React.ReactNode}
            </Box>
          ),
          blockquote: ({ node: _node, ...props }) => (
            <Box
              pl={4}
              borderLeftWidth={4}
              borderLeftColor='slate.600'
              fontStyle='italic'
              mb={3}
              maxW='100%'
              wordBreak='break-word'
            >
              {props.children as React.ReactNode}
            </Box>
          ),
          mark: ({ node: _node, className, ...props }) => (
            <Box
              as='mark'
              className={className}
              bg='rgba(251, 190, 36, 0.76)'
              color='inherit'
              borderRadius='2px'
              px='0.5'
            >
              {props.children as React.ReactNode}
            </Box>
          ),
          hr: () => (
            <Stack
              separator={<Box borderTopWidth='1px' borderColor='slate.700' />}
              my={4}
              maxW='100%'
            >
              <Box />
            </Stack>
          ),
        }}
      >
        {normalized}
      </Markdown>
    </Box>
  );
};
