/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'coral-orange': '#FF6B4A',
        'dark-slate': '#2A2E34',
        'blue-grey-muted': '#A0AAB5',
        'dark-grey': '#555961',
        'lighter-slate': '#464A52',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
