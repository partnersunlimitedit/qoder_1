/* Public member directory: filtering, result grid and the profile drawer. */
(function () {
  'use strict';

  var grid = document.getElementById('dir-grid');
  var empty = document.getElementById('dir-empty');
  var count = document.getElementById('dir-count');
  var search = document.getElementById('dir-search');
  var regionSel = document.getElementById('dir-region');
  var tierSel = document.getElementById('dir-tier');
  var countrySel = document.getElementById('dir-country');
  var serviceRow = document.getElementById('dir-services');
  var clearBtn = document.getElementById('dir-clear');
  var drawer = document.getElementById('dir-drawer');

  var filters = { q: '', region: '', tier: '', country: '', services: [] };
  var lastFocus = null;

  var ICON_ARROW = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 5l7 7-7 7"/></svg>';

  function published() {
    return PUStore.members().filter(function (m) { return m.status !== 'suspended'; });
  }

  function fillSelect(sel, label, options) {
    var html = '<option value="">' + label + '</option>';
    options.forEach(function (o) {
      html += '<option value="' + PUStore.esc(o.value) + '">' + PUStore.esc(o.label) + '</option>';
    });
    sel.innerHTML = html;
  }

  function buildControls() {
    fillSelect(regionSel, 'All regions', window.PU_DATA.regions.map(function (r) {
      return { value: r.id, label: 'Region ' + r.id + ' — ' + r.name };
    }));
    fillSelect(tierSel, 'All market tiers', window.PU_DATA.tiers.map(function (t) {
      return { value: t.id, label: t.label + ' — ' + t.basis };
    }));
    rebuildCountries();
    serviceRow.innerHTML = window.PU_DATA.services.map(function (s) {
      return '<button class="chip" type="button" data-service="' + PUStore.esc(s) + '" aria-pressed="false">' + PUStore.esc(s) + '</button>';
    }).join('');
  }

  function rebuildCountries() {
    var pool = published().filter(function (m) {
      return !filters.region || m.region === Number(filters.region);
    });
    var seen = {};
    pool.forEach(function (m) { seen[m.country] = 1; });
    fillSelect(countrySel, 'All countries', Object.keys(seen).sort().map(function (c) {
      return { value: c, label: c };
    }));
    countrySel.value = filters.country;
    if (countrySel.value !== filters.country) {
      filters.country = '';
      countrySel.value = '';
    }
  }

  function matches() {
    var q = filters.q.trim().toLowerCase();
    return published().filter(function (m) {
      if (filters.region && m.region !== Number(filters.region)) return false;
      if (filters.tier && m.tier !== Number(filters.tier)) return false;
      if (filters.country && m.country !== filters.country) return false;
      if (filters.services.length && !filters.services.every(function (s) {
        return m.services.indexOf(s) > -1;
      })) return false;
      if (q) {
        var hay = [m.name, m.city, m.country, m.about, m.services.join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function card(m) {
    var esc = PUStore.esc;
    return '<article class="dir-card">'
      + '<div class="dir-card__top">'
      + '<span class="monogram" aria-hidden="true">' + esc(PUStore.initials(m.name)) + '</span>'
      + '<div style="min-width:0">'
      + '<h3 class="dir-card__title"><a href="#member-profile" data-id="' + esc(m.id) + '">' + esc(m.name) + '</a></h3>'
      + '<p>' + esc(m.city) + ', ' + esc(m.country) + '</p>'
      + '</div></div>'
      + '<div class="dir-card__meta">'
      + '<span class="pill pill--tier' + m.tier + '">' + esc(PUStore.tierLabel(m.tier)) + '</span>'
      + '<span class="pill">' + esc(PUStore.regionName(m.region)) + '</span>'
      + '</div>'
      + '<p class="dir-card__about">' + esc(m.about) + '</p>'
      + '<span class="dir-card__more">View profile ' + ICON_ARROW + '</span>'
      + '</article>';
  }

  function render() {
    var rows = matches();
    grid.innerHTML = rows.map(card).join('');
    grid.hidden = rows.length === 0;
    empty.hidden = rows.length > 0;
    var total = published().length;
    count.textContent = rows.length === total
      ? total + ' members'
      : rows.length + ' of ' + total + ' members';
  }

  /* ---------------- drawer ---------------- */

  function row(label, value) {
    return value ? '<div><dt>' + PUStore.esc(label) + '</dt><dd>' + value + '</dd></div>' : '';
  }

  function openDrawer(id) {
    var m = PUStore.memberById(id);
    if (!m || m.status === 'suspended') return;
    var esc = PUStore.esc;

    document.getElementById('drawer-mark').textContent = PUStore.initials(m.name);
    document.getElementById('drawer-name').textContent = m.name;
    document.getElementById('drawer-place').textContent = m.city + ' — ' + m.country;

    document.getElementById('drawer-body').innerHTML =
      '<p style="margin-bottom:22px">' + esc(m.about) + '</p>'
      + '<dl class="def-list">'
      + row('Region', '<span class="pill">' + esc(PUStore.regionName(m.region)) + '</span>')
      + row('Market tier', '<span class="pill pill--tier' + m.tier + '">' + esc(PUStore.tierLabel(m.tier)) + '</span>')
      + row('Member since', esc(m.since))
      + row('Team', m.staff ? esc(PUStore.formatNumber(m.staff)) + ' people' : '')
      + row('Local contact', esc(m.contact.name) + (m.contact.title ? '<br><span class="muted" style="font-size:.88rem">' + esc(m.contact.title) + '</span>' : ''))
      + row('Telephone', '<a href="tel:' + esc(m.contact.phone.replace(/\s/g, '')) + '">' + esc(m.contact.phone) + '</a>')
      + '</dl>'
      + '<h3 style="margin:26px 0 12px;font-size:.98rem">Service lines</h3>'
      + '<div class="tag-row">' + m.services.map(function (s) {
        return '<span class="pill">' + esc(s) + '</span>';
      }).join('') + '</div>';

    var mail = document.getElementById('drawer-mail');
    mail.href = 'mailto:' + m.contact.email + '?subject=' + encodeURIComponent('Partners Unlimited referral — ' + m.country);
    var site = document.getElementById('drawer-site');
    if (m.website) {
      site.href = 'https://' + m.website;
      site.hidden = false;
    } else {
      site.hidden = true;
    }

    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.drawer__close').focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { drawer.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- events ---------------- */

  search.addEventListener('input', function () { filters.q = search.value; render(); });
  regionSel.addEventListener('change', function () {
    filters.region = regionSel.value; rebuildCountries(); render();
  });
  tierSel.addEventListener('change', function () { filters.tier = tierSel.value; render(); });
  countrySel.addEventListener('change', function () { filters.country = countrySel.value; render(); });

  serviceRow.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-service]');
    if (!chip) return;
    var name = chip.getAttribute('data-service');
    var at = filters.services.indexOf(name);
    if (at > -1) filters.services.splice(at, 1); else filters.services.push(name);
    chip.classList.toggle('is-on', at < 0);
    chip.setAttribute('aria-pressed', at < 0 ? 'true' : 'false');
    render();
  });

  clearBtn.addEventListener('click', function () {
    filters = { q: '', region: '', tier: '', country: '', services: [] };
    search.value = '';
    regionSel.value = ''; tierSel.value = ''; countrySel.value = '';
    Array.prototype.forEach.call(serviceRow.children, function (c) {
      c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false');
    });
    rebuildCountries();
    render();
  });

  grid.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-id]');
    if (!link) return;
    e.preventDefault();
    openDrawer(link.getAttribute('data-id'));
  });

  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeDrawer();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });

  PUStore.subscribe(function () { rebuildCountries(); render(); });

  buildControls();
  render();
})();
