/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Wanderlust 2026 palette
        teal: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a', 950: '#042f2e',
        },
        coral: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12',
        },
        sage: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a',
        },
        cream: {
          50: '#fffbf0', 100: '#fef7e0', 200: '#fdf0c7', 300: '#fbe5a3',
        },
        // Surface tones — cool turquoise-tinted layers for body/cards/borders.
        // Lower number = lighter. Body sits ABOVE 50 (lighter cards) but cards
        // are 50 because they're the lightest visible surface.
        surface: {
          50: '#fbfdfc',   // card bg (lightest)
          100: '#e8f1ee',  // body bg
          200: '#cfe1db',  // borders / dividers
          300: '#b2c4be',  // muted decorative
        },
        ink: { 900: '#1a0a0a', 800: '#2a1515', 700: '#3d2020', 600: '#5a3030' },
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        accent: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-teal': 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
        'gradient-coral': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #ccfbf1 0%, #fffbf0 50%, #fed7aa 100%)',
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
        'teal': '0 4px 20px -4px rgba(20, 184, 166, 0.4)',
        'coral': '0 4px 20px -4px rgba(249, 115, 22, 0.5)',
      },
    },
  },
  plugins: [],
};
