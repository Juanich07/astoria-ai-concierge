import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        luxury: '#C9A227',
        amber: '#D4AF37',
        background: '#FAF9F6',
        card: '#FFFFFF',
        dark: '#1D1D1D',
        accent: '#0E7B58',
        text: '#374151'
      },
      fontFamily: {
        display: ["'Playfair Display'", 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 24px 60px rgba(17, 24, 39, 0.12)',
        glow: '0 0 0 1px rgba(201, 162, 39, 0.12), 0 20px 60px rgba(0, 0, 0, 0.12)'
      }
    }
  },
  plugins: []
};

export default config;
