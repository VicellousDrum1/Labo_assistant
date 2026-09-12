/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#20255C', 700: '#2E3578', 500: '#4650A8' },
        canvas: { a: '#EEF2FF', b: '#F8F9FD' },
        graphite: '#1E2233',
        slate: { DEFAULT: '#8891A8', light: '#9AA0B4' },

        // Palette colorée assumée — chaque teinte a un rôle sémantique fixe,
        // pas un simple habillage : bleu = information/quantité, vert = bon état,
        // ambre = attention/en cours, rouge = danger, violet = migration/technique.
        blue:   { 50: '#E8EFFE', 500: '#2F6FED', 700: '#1D4ED8' },
        ok:     { 50: '#E7F9EE', 500: '#22C55E', 700: '#15803D' },
        amber:  { 50: '#FFF4E0', 500: '#F5A623', 700: '#9A5B0A' },
        danger: { 50: '#FDEBEB', 500: '#EF4444', 700: '#B91C1C' },
        info:   { 50: '#EFEDFE', 500: '#7C6FF0', 700: '#5B4FCF' },
        muted:  { 50: '#F1F2F7', 500: '#9AA0B4', 700: '#5B6180' },

        // Alias de compat pour les classes existantes bg-primary-*/border-primary-*
        // (pointent maintenant vers la marine, couleur des actions principales).
        primary: {
          50: '#EEF0FA', 100: '#DCE0F5', 200: '#B9C1EC', 300: '#94A1E0',
          400: '#6B76D0', 500: '#4650A8', 600: '#343A85', 700: '#2E3578',
          800: '#252B66', 900: '#20255C', 950: '#171A45',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.875rem',
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(32,37,92,0.12)',
        softer: '0 2px 10px -4px rgba(32,37,92,0.10)',
        pop: '0 8px 20px -8px rgba(32,37,92,0.5)',
      },
    },
  },
  plugins: [],
}
