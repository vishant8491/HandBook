/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F5F2',
        surface: '#FFFFFF',
        'surface-subtle': '#FAFAF8',
        'surface-selected': '#EDF3EE',
        border: {
          DEFAULT: '#DDE3DD',
          strong: '#C2CCC3',
          subtle: '#E8ECE8',
        },
        ink: {
          DEFAULT: '#182421',
          primary: '#182421',
          secondary: '#66716C',
          muted: '#8A9590',
          subtle: '#B0B9B3',
        },
        forest: {
          DEFAULT: '#245C46',
          hover: '#194331',
          active: '#133325',
          light: '#EAF2EC',
          border: '#BED7C4',
        },
        warning: {
          DEFAULT: '#976B25',
          light: '#FCF7ED',
          border: '#E8D4B0',
        },
        danger: {
          DEFAULT: '#B5443D',
          light: '#FDF2F1',
          border: '#ECC3C0',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
    },
  },
  plugins: [],
};
