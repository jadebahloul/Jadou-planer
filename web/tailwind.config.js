/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  darkMode: ['class', '[data-theme="nuit"]'],
  theme: {
    extend: {
      colors: {
        canvas: c('canvas'),
        surface: c('surface'),
        sunken: c('sunken'),
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
        wine: c('wine'),
        'wine-soft': c('wine-soft'),
        blush: c('blush'),
        petal: c('petal'),
        sand: c('sand'),
        good: c('good'),
        warn: c('warn'),
        bad: c('bad'),
        onwine: c('onwine'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        card: '0 1px 2px rgb(41 37 39 / 0.04), 0 12px 32px -18px rgb(113 63 75 / 0.22)',
        lift: '0 2px 4px rgb(41 37 39 / 0.05), 0 22px 48px -20px rgb(113 63 75 / 0.32)',
        ring: '0 0 0 4px rgb(var(--blush) / 0.45)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, scale: '0.97' }, to: { opacity: 1, scale: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: { pop: 'pop .22s cubic-bezier(.2,.7,.2,1) both', 'fade-up': 'fade-up .45s cubic-bezier(.2,.7,.2,1) both', shimmer: 'shimmer 1.6s linear infinite' },
    },
  },
  plugins: [],
};
