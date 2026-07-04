/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lumière brand gold from the inventory PDF headings.
        lumiere: {
          gold: '#8a6d1f',
          dark: '#6b551a',
          cream: '#faf7ef',
        },
      },
    },
  },
  plugins: [],
};
