// Penanda versi build (ditanam vite.config.js via define). Dipakai untuk cek
// versi PWA yang sedang jalan (mis. setelah deploy, pastikan cache sudah update).
// typeof-guard supaya aman bila konstanta tak ter-define (mis. lingkungan tes).
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
