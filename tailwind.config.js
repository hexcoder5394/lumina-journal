/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['"Orbitron"', 'sans-serif'], // For Headings
        'body': ['"Exo 2"', 'sans-serif'],       // For Text
      },
      colors: {
        cyber: {
          dark: '#050511',
          slate: '#0f172a',
          cyan: '#00f0ff',
          pink: '#ff003c',
          yellow: '#fcee0a',
          purple: '#bc13fe'
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 5px #00f0ff, 0 0 20px rgba(0, 240, 255, 0.3)',
        'neon-pink': '0 0 5px #ff003c, 0 0 20px rgba(255, 0, 60, 0.3)',
      }
    },
  },
  plugins: [],
}