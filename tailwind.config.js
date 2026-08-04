/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#25D366',
        'primary-dark': '#128C7E',
        'bg-light': '#f0f2f5',
        'bg-dark': '#111b21',
        'sidebar-light': '#ffffff',
        'sidebar-dark': '#1f2c34',
        'chat-light': '#efeae2',
        'chat-dark': '#0b141a',
        'bubble-out': '#d9fdd3',
        'bubble-out-dark': '#005c4b',
        'bubble-in': '#ffffff',
        'bubble-in-dark': '#202c33',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
