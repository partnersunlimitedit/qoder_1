(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav__toggle');
  var mobileNav = document.querySelector('.mobile-nav');

  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var to = form.getAttribute('action').replace('mailto:', '').split('?')[0];
      var data = new FormData(form);
      var body = data.get('enquiry') + '\n\n' + data.get('name') + '\n' + data.get('email');
      var href = 'mailto:' + to
        + '?subject=' + encodeURIComponent('Website enquiry from ' + data.get('name'))
        + '&body=' + encodeURIComponent(body);
      window.location.assign(href);
    });
  }

  var reveals = document.querySelectorAll('.reveal');
  if (!reveals.length || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, i) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var group = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.transitionDelay = Math.min(group, 5) * 70 + 'ms';
      el.classList.add('is-visible');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach(function (el) { io.observe(el); });
})();
