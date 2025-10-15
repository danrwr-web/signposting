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
        'nhs-green': '#00A499',
        'nhs-grey': '#425563',
        'nhs-light-grey': '#F0F4F5',
      },
    },
  },
  plugins: [],
}
export default config
