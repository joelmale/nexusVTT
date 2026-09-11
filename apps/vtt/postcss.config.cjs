// postcss.config.cjs
// Tailwind v4 is handled by @tailwindcss/vite directly.
// PostCSS still runs for autoprefixer on non-Tailwind CSS files.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};