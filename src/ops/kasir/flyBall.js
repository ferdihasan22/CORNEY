// Animasi bola kecil yang "terlempar" dari titik sumber ke elemen target
// (mis. card pesanan → tombol Antrean Masak). Pure-DOM + Web Animations API
// (transform GPU) → ringan, tidak memicu re-render React.
export function flyBall(fromX, fromY, toEl, opts = {}) {
  if (!toEl || typeof document === 'undefined') return
  const to = toEl.getBoundingClientRect()
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2
  const dx = tx - fromX
  const dy = ty - fromY
  const ball = document.createElement('div')
  const size = opts.size || 18
  ball.style.cssText = `position:fixed;left:${fromX - size / 2}px;top:${fromY - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${opts.color || '#b50303'};z-index:9999;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.35)`
  document.body.appendChild(ball)
  const anim = ball.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(1.25)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.5, offset: 1 },
    ],
    { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' },
  )
  const cleanup = () => { ball.remove(); if (opts.onDone) opts.onDone() }
  anim.onfinish = cleanup
  anim.oncancel = cleanup
  // jaring pengaman bila WAAPI tak jalan
  setTimeout(cleanup, 900)
}

// Beri "denyut" singkat pada elemen target (tombol) saat bola tiba.
export function pulse(el) {
  if (!el) return
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 300, delay: 520, easing: 'ease-out' },
  )
}
