/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        clay: {
          50: '#fff8f1',
          100: '#ffe9d4',
          200: '#ffd0a6',
          300: '#ffaf75',
          400: '#f78a46',
          500: '#e06724',
          600: '#bd4d17',
          700: '#973e16',
          800: '#783418',
          900: '#612d18',
        },
        spruce: {
          50: '#effef8',
          100: '#d8f8ea',
          200: '#b5eed6',
          300: '#83ddb8',
          400: '#4cc391',
          500: '#2da878',
          600: '#1f875f',
          700: '#1c6c4e',
          800: '#1b553f',
          900: '#184635',
        },
        ink: '#171412',
        mist: '#f5efe8',
        sand: '#e9dfd2',
      },
      boxShadow: {
        float: '0 24px 60px rgba(38, 25, 14, 0.14)',
      },
      backgroundImage: {
        'mission-grid': 'linear-gradient(rgba(23, 20, 18, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23, 20, 18, 0.04) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};