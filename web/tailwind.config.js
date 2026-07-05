/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Raleway', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand palette sampled from lumierepatisserie.ca (minimal white + pastel wordmark).
        brand: {
          ink: '#3d3d3d', // primary text & filled controls
          inkSoft: '#767676', // secondary text (AA on white)
          bg: '#ffffff', // app background
          surface: '#f6f6f6', // card/section surfaces
          line: '#e8e8e8', // borders/dividers
          rose: '#f2a9bb', // pastel gradient stop 1
          sky: '#aecbf2', // pastel gradient stop 2
          mint: '#a9dfc3', // pastel gradient stop 3
          butter: '#f6de96', // pastel gradient stop 4
          need: '#b34e68', // low/need accent (AA on white, 4.99:1)
          needBg: '#fdf0f3', // low-row background
        },
      },
    },
  },
  plugins: [],
};
