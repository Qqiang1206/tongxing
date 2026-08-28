/** TXAM Tailwind build config (regenerated pipeline, see DESIGN.md §v3)
 *  Output overwrites assets/css/tailwind.min.css so page heads stay unchanged.
 *  Theme EXTENDS ONLY — defaults kept intact to avoid altering untouched pages.
 */
module.exports = {
  content: [
    '*.html',
    'en/**/*.html',
    'ru/**/*.html',
    'assets/js/**/*.js',
    'data/**/*.json',
    'server/admin/index.html',
    'server/admin/**/*.js',
  ],
  theme: {
    extend: {
      // v3 光感单色 palette (mirrored in styles.css :root --tx-* tokens)
      colors: {
        ink: {
          DEFAULT: '#14161B',
          soft: '#22252E',
          mid: '#39404C',
          mute: '#667084',
          faint: '#9AA1AE',
        },
        mist: {
          50: '#F7F8FA',
          100: '#F1F3F7',
          200: '#E7EAF0',
        },
        hairline: 'rgba(20,22,27,.08)',
        accent: '#FF6B00',
      },
      // semantic radii for v3 surfaces (defaults untouched)
      borderRadius: {
        card: '20px',
        shell: '24px',
        ctl: '10px',
      },
      boxShadow: {
        'glass-xs':
          '0 1px 2px rgba(16,18,22,.05), inset 0 1px 0 rgba(255,255,255,.75)',
        'glass-sm':
          '0 1px 2px rgba(16,18,22,.04), 0 8px 24px rgba(16,18,22,.06), inset 0 1px 0 rgba(255,255,255,.8)',
        'glass-md':
          '0 2px 6px rgba(16,18,22,.04), 0 20px 48px rgba(16,18,22,.10), inset 0 1px 0 rgba(255,255,255,.85)',
        'media-xl':
          '0 8px 24px rgba(16,18,22,.06), 0 40px 96px rgba(16,18,22,.14)',
      },
      maxWidth: { shell: '1400px' },
      transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.16,1,0.3,1)' },
      keyframes: {
        'drift-a': {
          '0%,100%': { transform: 'translate3d(-4%,-2%,0) scale(1)' },
          '50%': { transform: 'translate3d(4%,3%,0) scale(1.06)' },
        },
        'drift-b': {
          '0%,100%': { transform: 'translate3d(3%,2%,0) scale(1.04)' },
          '50%': { transform: 'translate3d(-3%,-4%,0) scale(1)' },
        },
        kenburns: {
          '0%': { transform: 'scale(1.02) translateZ(0)' },
          '100%': { transform: 'scale(1.12) translateZ(0)' },
        },
      },
      animation: {
        'drift-a': 'drift-a 26s ease-in-out infinite',
        'drift-b': 'drift-b 32s ease-in-out infinite',
        kenburns: 'kenburns 22s ease-in-out infinite alternate',
      },
    },
  },
  corePlugins: { preflight: true },
  plugins: [],
};
