import { createSystem, defineConfig, defaultConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    tokens: {
      fonts: {
        heading: { value: "'Outfit', sans-serif" },
        body: { value: "'Inter', sans-serif" },
        mono: { value: "'IBM Plex Mono', 'SFMono-Regular', monospace" },
      },
      colors: {
        obsidian: {
          950: { value: '#030712' },
          900: { value: '#081121' },
          850: { value: '#0c1528' },
          800: { value: '#101a32' },
          700: { value: '#162443' },
        },
        indigo: {
          200: { value: '#c7d2fe' },
          300: { value: '#a5b4fc' },
          400: { value: '#818cf8' },
          500: { value: '#6366f1' },
          600: { value: '#4f46e5' },
          700: { value: '#4338ca' },
        },
        cyan: {
          200: { value: '#a5f3fc' },
          300: { value: '#67e8f9' },
          400: { value: '#22d3ee' },
          500: { value: '#06b6d4' },
          700: { value: '#0e7490' },
        },
        signal: {
          400: { value: '#7c83ff' },
          500: { value: '#6366f1' },
          600: { value: '#5548f3' },
        },
        glass: {
          100: { value: 'rgba(148, 163, 184, 0.08)' },
          200: { value: 'rgba(148, 163, 184, 0.14)' },
          300: { value: 'rgba(148, 163, 184, 0.22)' },
          400: { value: 'rgba(99, 102, 241, 0.18)' },
        },
        success: {
          400: { value: '#34d399' },
          500: { value: '#10b981' },
        },
        warning: {
          400: { value: '#fbbf24' },
          500: { value: '#f59e0b' },
        },
        danger: {
          400: { value: '#fb7185' },
          500: { value: '#f43f5e' },
        },
      },
      shadows: {
        glass: { value: '0 24px 60px rgba(3, 7, 18, 0.44)' },
        glow: {
          value:
            '0 0 0 1px rgba(99, 102, 241, 0.32), 0 22px 55px rgba(59, 130, 246, 0.18)',
        },
        active: {
          value:
            'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 42px rgba(34, 211, 238, 0.14)',
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          value: '{colors.obsidian.950}',
        },
        bgPanel: {
          value: 'rgba(8, 17, 33, 0.84)',
        },
        bgPanelElevated: {
          value: 'rgba(12, 21, 40, 0.94)',
        },
        glassBorder: {
          value: '{colors.glass.200}',
        },
        glassFill: {
          value: '{colors.glass.100}',
        },
        fg: {
          value: '#e2e8f0',
        },
        fgMuted: {
          value: '#94a3b8',
        },
        fgSubtle: {
          value: '#64748b',
        },
        brand: {
          value: '{colors.signal.500}',
        },
        brandCyan: {
          value: '{colors.cyan.400}',
        },
        borderStrong: {
          value: 'rgba(99, 102, 241, 0.32)',
        },
      },
    },
    textStyles: {
      pageTitle: {
        value: {
          fontFamily: 'heading',
          fontWeight: '700',
          fontSize: 'clamp(1.6rem, 1rem + 1.2vw, 2rem)',
          lineHeight: '1.3',
          letterSpacing: '-0.04em',
        },
      },
      sectionLabel: {
        value: {
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'fgSubtle',
          fontWeight: '700',
        },
      },
      statValue: {
        value: {
          fontFamily: 'heading',
          fontWeight: '700',
          fontSize: 'clamp(1.8rem, 1.4rem + 1vw, 3rem)',
          lineHeight: '1',
          letterSpacing: '-0.05em',
        },
      },
      monoMeta: {
        value: {
          fontFamily: 'mono',
          fontSize: '0.76rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        },
      },
    },
  },
  globalCss: {
    'html, body': {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
    },
    '#root': {
      minHeight: '100%',
      isolation: 'isolate',
    },
  },
});

const theme = createSystem(defaultConfig, config);

export default theme;
