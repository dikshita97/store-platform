/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
          700: '#065F46',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          700: '#92400E',
        },
        error: {
          50: '#FFF1F2',
          500: '#F43F5E',
          700: '#9F1239',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
