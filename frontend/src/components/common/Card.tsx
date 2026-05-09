import { ReactNode } from 'react';
import { Box, BoxProps } from '@chakra-ui/react';

interface CardProps extends BoxProps {
  children: ReactNode;
  variant?: 'glass' | 'metric' | 'hero' | 'panel' | 'interactive';
}

const variantStyles: Record<NonNullable<CardProps['variant']>, BoxProps> = {
  glass: {
    className: 'arctic-glass',
    bg: 'bgPanel',
  },
  metric: {
    className: 'arctic-glass ui-hover',
    bg: 'bgPanel',
  },
  hero: {
    className: 'arctic-glass hero-sweep',
    bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(8, 17, 33, 0.92) 52%, rgba(34, 211, 238, 0.16))',
  },
  panel: {
    className: 'arctic-glass',
    bg: 'bgPanelElevated',
  },
  interactive: {
    className: 'arctic-glass ui-hover',
    bg: 'bgPanel',
  },
};

export function Card({ children, variant = 'glass', ...props }: CardProps) {
  return (
    <Box
      {...variantStyles[variant]}
      border='1px solid'
      borderColor='glassBorder'
      borderRadius='2xl'
      p={6}
      shadow='glass'
      {...props}
    >
      {children}
    </Box>
  );
}
