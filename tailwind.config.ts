import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'nhs-blue': '#005EB8',
        'nhs-light-blue': '#E8F4FD',
        'nhs-dark-blue': '#003087',
        'nhs-red': '#DA020E',
        'nhs-red-dark': '#A0131F',
        'nhs-red-tint': '#F5E6E7',
        'nhs-green': '#00A499',
        'nhs-green-dark': '#007F3B',
        'nhs-green-tint': '#C8F2E4',
        'nhs-grey': '#425563',
        'nhs-dark-grey': '#2F3133',
        'nhs-light-grey': '#F0F4F5',
        'nhs-yellow': '#FFB81C',
        'nhs-yellow-tint': '#FFF7BF',
      },
      keyframes: {
        'dialog-overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'dialog-content-in': {
          from: { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'alert-slide-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'dialog-overlay-in': 'dialog-overlay-in 150ms ease-out',
        'dialog-content-in': 'dialog-content-in 200ms ease-out',
        'alert-slide-in': 'alert-slide-in 200ms ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
