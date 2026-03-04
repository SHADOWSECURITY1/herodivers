// ═══ DYNAMIC BUBBLES ═══
function spawnBubbles(containerId, count, sizeRange) {
  const c = document.getElementById(containerId);
  if (!c) return;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const s = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    b.style.width = s + 'px';
    b.style.height = s + 'px';
    b.style.left = Math.random() * 100 + '%';
    b.style.animationDuration = (6 + Math.random() * 10) + 's';
    b.style.animationDelay = Math.random() * 8 + 's';
    c.appendChild(b);
  }
}

// ═══ DYNAMIC PLANKTON ═══
function spawnPlankton(containerId, count) {
  const c = document.getElementById(containerId);
  if (!c) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'plankton';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDuration = (4 + Math.random() * 8) + 's';
    p.style.animationDelay = Math.random() * 6 + 's';
    const s = 1 + Math.random() * 3;
    p.style.width = s + 'px';
    p.style.height = s + 'px';
    c.appendChild(p);
  }
}

// ═══ Auto-spawn for any page ═══
document.querySelectorAll('[data-bubbles]').forEach(el => {
  spawnBubbles(el.id, parseInt(el.dataset.bubbles) || 12, [3, 12]);
});
document.querySelectorAll('[data-plankton]').forEach(el => {
  spawnPlankton(el.id, parseInt(el.dataset.plankton) || 20);
});

// ═══ Scroll Reveal ═══
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ═══ Nav scroll ═══
window.addEventListener('scroll', () => {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 80);
});

// ═══ Smooth scroll ═══
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
