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
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
