/**
 * Shared nav / scroll / fade-up behavior (no HTML injection).
 * Safe for ZH / EN / RU pages that already have inline <nav id="navbar">.
 */
document.addEventListener('DOMContentLoaded', function () {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        navbar.classList.add('shadow-sm');
      } else {
        navbar.classList.remove('shadow-sm');
      }
    });
  }

  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');

  if (mobileBtn && mobileMenu && menuIcon) {
    let isMenuOpen = false;
    mobileBtn.addEventListener('click', () => {
      isMenuOpen = !isMenuOpen;
      if (isMenuOpen) {
        mobileMenu.classList.remove('menu-closed');
        mobileMenu.classList.add('menu-open');
        menuIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
        document.body.style.overflow = 'hidden';
      } else {
        mobileMenu.classList.remove('menu-open');
        mobileMenu.classList.add('menu-closed');
        menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
        document.body.style.overflow = 'auto';
      }
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        isMenuOpen = false;
        mobileMenu.classList.remove('menu-open');
        mobileMenu.classList.add('menu-closed');
        menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
        document.body.style.overflow = 'auto';
      });
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));
});
