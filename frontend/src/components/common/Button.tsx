import { Button as ChakraButton, ButtonProps } from '@chakra-ui/react';

type CustomVariantName = 'signal' | 'danger' | 'floating' | 'nav';

export function Button({
  children,
  variant,
  ...props
}: ButtonProps & { variant?: ButtonProps['variant'] | CustomVariantName }) {
  const customVariant = variant as CustomVariantName | ButtonProps['variant'];
  const variantProps: Record<CustomVariantName, ButtonProps> = {
    signal: {
      bg: 'signal.500',
      color: 'white',
      borderRadius: 'xl',
      boxShadow: '0 16px 30px rgba(99, 102, 241, 0.32)',
      _hover: { bg: 'signal.400', transform: 'translateY(-1px)' },
    },
    danger: {
      bg: 'rgba(244, 63, 94, 0.16)',
      color: 'danger.400',
      border: '1px solid',
      borderColor: 'rgba(244, 63, 94, 0.28)',
      borderRadius: 'xl',
      _hover: { bg: 'rgba(244, 63, 94, 0.22)' },
    },
    floating: {
      bg: 'signal.500',
      color: 'white',
      borderRadius: 'full',
      boxShadow: '0 20px 48px rgba(99, 102, 241, 0.38)',
      _hover: { bg: 'signal.400', transform: 'translateY(-2px) scale(1.02)' },
    },
    nav: {
      bg: 'transparent',
      color: 'fgMuted',
      borderRadius: 'xl',
      _hover: { bg: 'whiteAlpha.100', color: 'white' },
    },
  };

  const isCustomVariant =
    customVariant === 'signal' ||
    customVariant === 'danger' ||
    customVariant === 'floating' ||
    customVariant === 'nav';

  return (
    <ChakraButton
      colorPalette='indigo'
      fontWeight='600'
      transition='all 0.2s'
      _focusVisible={{
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.08), 0 0 0 3px rgba(99,102,241,0.45)',
      }}
      variant={isCustomVariant ? undefined : variant}
      {...(isCustomVariant ? variantProps[customVariant] : undefined)}
      {...props}
    >
      {children}
    </ChakraButton>
  );
}
