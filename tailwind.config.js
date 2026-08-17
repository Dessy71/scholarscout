/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Sora"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5dae2', 300: '#b1bac9',
          400: '#8694ab', 500: '#677791', 600: '#525f78', 700: '#434d62',
          800: '#3a4253', 900: '#343a47', 950: '#15181f',
        },
        brand: {
          50: '#eefbf5', 100: '#d6f5e6', 200: '#b0e9d1', 300: '#7cd7b6',
          400: '#46bd96', 500: '#23a27d', 600: '#168265', 700: '#116853',
          800: '#105343', 900: '#0e4438', 950: '#072620',
        },
        gold: {
          50: '#fdfaed', 100: '#f9f0cc', 200: '#f3e095', 300: '#eccb5e',
          400: '#e6b638', 500: '#dd9a21', 600: '#c47819', 700: '#a35718',
          800: '#85451a', 900: '#6e3a19', 950: '#3f1d0b',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,24,31,0.06), 0 4px 16px -4px rgba(21,24,31,0.08)',
        'card-dark': '0 1px 2px rgba(0,0,0,0.4), 0 6px 20px -6px rgba(0,0,0,0.5)',
        pop: '0 8px 30px -6px rgba(21,24,31,0.18)',
      },
      animation: {
        'fade-up': 'fadeUp .35s cubic-bezier(.21,1.02,.73,1) both',
        'fade-in': 'fadeIn .25s ease both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
    },
  },
  plugins: [],
};
