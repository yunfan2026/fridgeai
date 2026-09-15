/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm FridgeAI palette (carried over from v1 design requirements)
        shell: '#fff8f3',
        accent: '#f4622a',
        ink: '#2d1a0e',
        warn: '#ffb300',
        danger: '#e53935',
        safe: '#2e9e5b',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(45, 26, 14, 0.10), 0 1px 2px rgba(45, 26, 14, 0.06)',
      },
    },
  },
  plugins: [],
};
