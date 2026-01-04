/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Inter"', 'sans-serif'], // Clean modern font
        'mono': ['"JetBrains Mono"', 'monospace'], // For code/numbers
      },
      colors: {
        // The new "EduApp" palette
        pro: {
          bg: '#0B0E14',       // Deepest background
          card: '#151B28',     // Card background
          border: '#2A3441',   // Subtle borders
          primary: '#6366f1',  // Indigo/Purple accent
          secondary: '#3b82f6',// Blue accent
          text: '#94a3b8',     // Muted text
          white: '#f8fafc'     // Bright text
        }
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', // The purple card gradient
      }
    },
  },
  plugins: [],
}