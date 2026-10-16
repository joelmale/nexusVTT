/** @type {import('tailwindcss').Config} */
export default {
  // The admin panel is light-only. Tailwind's default ('media') turns every dark:
  // variant on whenever the OS is in dark mode, which made the Live Proof frame dark
  // while the rest of the panel stayed light. 'class' only applies them under a
  // .dark ancestor, which nothing sets.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}