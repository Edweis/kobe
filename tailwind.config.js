/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.hbs"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: ["fantasy"],
  },
  plugins: [require('daisyui')],
}

