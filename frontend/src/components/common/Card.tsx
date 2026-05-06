import { ReactNode } from 'react';
import { Box, BoxProps } from '@chakra-ui/react';

interface CardProps extends BoxProps {
  children: ReactNode;
}

export function Card({ children, ...props }: CardProps) {
  return (
    <Box
      className='card'
      bg='slate.900'
      border='1px'
      borderColor='slate.800'
      borderRadius='xl'
      p={6}
      shadow='md'
      {...props}
    >
      {children}
    </Box>
  );
}
