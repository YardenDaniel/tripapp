/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lacquer: {
          50: '#fef2f2', 100: '#fde2e2', 200: '#fbc8c8', 300: '#f7a3a3',
          400: '#f07171', 500: '#e64545', 600: '#c92626', 700: '#a51d1d',
          800: '#8B0000', 900: '#6b0202', 950: '#3d0101',
        },
        gold: {
          50: '#fefce8', 100: '#fdf6c7', 200: '#fceb89', 300: '#fad94a',
          400: '#f7c41e', 500: '#D4AF37', 600: '#b8941f', 700: '#92701b',
          800: '#78591d', 900: '#664a1d',
        },
        jade: { 50: '#f0fdf4', 500: '#10b981', 700: '#047857' },
        ivory: { 50: '#fefdf8', 100: '#fdf9ec', 200: '#f9f0d3' },
        ink: { 900: '#1a0a0a', 800: '#2a1515', 700: '#3d2020' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        accent: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-lacquer': 'linear-gradient(135deg, #8B0000 0%, #6b0202 50%, #3d0101 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #b8941f 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #8B0000 0%, #c92626 50%, #D4AF37 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      boxShadow: {
        'lacquer': '0 4px 20px -4px rgba(139, 0, 0, 0.4)',
        'gold': '0 4px 20px -4px rgba(212, 175, 55, 0.5)',
      },
    },
  },
  plugins: [],
};
