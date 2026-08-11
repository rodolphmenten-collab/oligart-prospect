import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0A08', // near-black, warm undertone
          900: '#0B0A08',
          800: '#131210',
          700: '#1C1A17',
          600: '#292620',
        },
        bone: {
          DEFAULT: '#F4EFE6',
          dim: '#C9C2B4',
          faint: '#8A8478',
        },
        brass: {
          DEFAULT: '#C9A46A',
          bright: '#E3C58C',
          dim: '#8A6E42',
        },
        signal: {
          live: '#5E9C76', // verified / here now
          fading: '#B08D57', // recently here
          off: '#5A5650', // expired
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        pulse_ring: {
          '0%': { transform: 'scale(0.9)', opacity: '0.55' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        fade_up: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse_ring: 'pulse_ring 2.6s cubic-bezier(0.4,0,0.6,1) infinite',
        fade_up: 'fade_up 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
