import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

export type NeuralBarDatum = {
  label: string;
  value: number;
  tone?: 'indigo' | 'cyan' | 'warning';
};

const barPalettes = [
  {
    fill: 'linear-gradient(180deg, rgba(99, 102, 241, 0.96), rgba(99, 102, 241, 0.26))',
    shadow: '0 12px 24px rgba(99, 102, 241, 0.18)',
  },
  {
    fill: 'linear-gradient(180deg, rgba(34, 211, 238, 0.96), rgba(34, 211, 238, 0.26))',
    shadow: '0 12px 24px rgba(34, 211, 238, 0.18)',
  },
  {
    fill: 'linear-gradient(180deg, rgba(251, 191, 36, 0.96), rgba(251, 191, 36, 0.26))',
    shadow: '0 12px 24px rgba(251, 191, 36, 0.18)',
  },
  {
    fill: 'linear-gradient(180deg, rgba(52, 211, 153, 0.96), rgba(52, 211, 153, 0.24))',
    shadow: '0 12px 24px rgba(52, 211, 153, 0.16)',
  },
  {
    fill: 'linear-gradient(180deg, rgba(244, 114, 182, 0.96), rgba(244, 114, 182, 0.24))',
    shadow: '0 12px 24px rgba(244, 114, 182, 0.16)',
  },
] as const;

export function NeuralBarChart({ data }: { data: NeuralBarDatum[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const targetHeights = useMemo(
    () => data.map((item) => `${Math.max((item.value / maxValue) * 100, 12)}%`),
    [data, maxValue],
  );

  return (
    <HStack align='end' justify='space-between' gap='3' h='220px'>
      {data.map((item, index) => {
        const palette = barPalettes[index % barPalettes.length];
        return (
          <Stack key={item.label} gap='3' flex='1' h='full' justify='end'>
            <Text
              fontSize='xs'
              color='fgMuted'
              textAlign='center'
              fontFamily='mono'
            >
              {item.value.toFixed(1)}%
            </Text>
            <Box
              flex='1'
              display='flex'
              alignItems='end'
              justifyContent='center'
              borderRadius='2xl'
              bg='rgba(8, 17, 33, 0.52)'
              p='2'
            >
              <Box
                w='100%'
                h={targetHeights[index] ?? '12%'}
                borderRadius='xl'
                overflow='hidden'
              >
                <motion.div
                  key={`${item.label}-${item.value}-${maxValue}`}
                  initial={{ scaleY: 0.12, opacity: 0.72 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                    delay: index * 0.06,
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.75rem',
                    background: palette.fill,
                    boxShadow: palette.shadow,
                    transformOrigin: 'bottom',
                  }}
                />
              </Box>
            </Box>
            <Text fontSize='xs' color='fgMuted' textAlign='center'>
              {item.label}
            </Text>
          </Stack>
        );
      })}
    </HStack>
  );
}
