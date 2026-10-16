/* Member portal: demo sign-in and the company profile the member controls. */
(function () {
  'use strict';

  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var memberSel = document.getElementById('login-member');
  var view = document.getElementById('profile-view');
  var edit = document.getElementById('profile-edit');
  var editToggle = document.getElementById('edit-toggle');
  var saveBtn = document.getElementById('save-profile');
  var cancelBtn = document.getElementById('cancel-edit');
  var servicesRow = document.getElementById('f-services');

  var DEMO_PASSWORD = 'demo';
  var selected = null;

  function options(list, current) {
    return list.map(function (o) {
      return '<option value="' + PUStore.esc(o.value) + '"' + (String(o.value) === String(current) ? ' selected' : '') + '>'
        + PUStore.esc(o.label) + '</option>';
    }).join('');
  }

  function buildSelects() {
    memberSel.innerHTML = options(PUStore.members().map(function (m) {
      return { value: m.id, label: m.name + ' — ' + m.country };
    }), PUStore.members()[0].id);

    document.getElementById('f-region').innerHTML = options(
      window.PU_DATA.regions.map(function (r) { return { value: r.id, label: 'Region ' + r.id + ' — ' + r.name }; }), 2);
    document.getElementById('f-tier').innerHTML = options(
      window.PU_DATA.tiers.map(function (t) { return { value: t.id, label: t.label + ' — ' + t.basis }; }), 3);

    servicesRow.innerHTML = window.PU_DATA.services.map(function (s) {
      return '<button class="chip" type="button" data-service="' + PUStore.esc(s) + '" aria-pressed="false">' + PUStore.esc(s) + '</button>';
    }).join('');
  }

  /* ---------------- gate ---------------- */

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return fail('Enter a valid work e-mail address.');
    }
    if (password !== DEMO_PASSWORD) {
      return fail('This is a demo environment — use the password “demo”.');
    }
    selected = memberSel.value;
    PUStore.signIn(email, selected);
    showShell();
  });

  function fail(message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }

  document.getElementById('sign-out').addEventListener('click', function () {
    PUStore.signOut();
    loginForm.reset();
    loginError.hidden = true;
    gate.hidden = false;
    shell.hidden = true;
  });

  /* ---------------- profile view ---------------- */

  function row(label, value) {
    return value ? '<div><dt>' + PUStore.esc(label) + '</dt><dd>' + value + '</dd></div>' : '';
  }

  function renderView() {
    var m = PUStore.memberById(selected);
    if (!m) { gate.hidden = false; shell.hidden = true; return; }
    var esc = PUStore.esc;

    document.getElementById('who-mark').textContent = PUStore.initials(m.name);
    document.getElementById('who-name').textContent = m.name;
    document.getElementById('who-email').textContent = PUStore.session('member').email;

    view.innerHTML =
      '<div class="app__panel-head">'
      + '<div style="display:flex;align-items:center;gap:14px;min-width:0">'
      + '<span class="monogram" aria-hidden="true">' + esc(PUStore.initials(m.name)) + '</span>'
      + '<div><h2>' + esc(m.name) + '</h2>'
      + '<p>' + esc(m.city) + ', ' + esc(m.country) + ' · member since ' + esc(m.since) + '</p></div>'
      + '</div>'
      + '<span class="pill pill--' + esc(m.status) + '">' + esc(m.status === 'active' ? 'Published' : 'Suspended') + '</span>'
      + '</div>'
      + '<div class="app__panel-body">'
      + '<dl class="def-list">'
      + row('Region', '<span class="pill">' + esc(PUStore.regionName(m.region)) + '</span>')
      + row('Market tier', '<span class="pill pill--tier' + m.tier + '">' + esc(PUStore.tierLabel(m.tier)) + '</span>')
      + row('Team', m.staff ? esc(PUStore.formatNumber(m.staff)) + ' people' : '')
      + row('Website', m.website ? '<a href="https://' + esc(m.website) + '" target="_blank" rel="noopener">' + esc(m.website) + '</a>' : '')
      + row('Contact', esc(m.contact.name) + (m.contact.title ? ' <span class="muted">— ' + esc(m.contact.title) + '</span>' : ''))
      + row('E-mail', m.contact.email ? '<a href="mailto:' + esc(m.contact.email) + '">' + esc(m.contact.email) + '</a>' : '')
      + row('Telephone', esc(m.contact.phone))
      + '</dl>'
      + '<h3 style="margin:26px 0 12px;font-size:.98rem">Service lines</h3>'
      + '<div class="tag-row">' + m.services.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('') + '</div>'
      + '<h3 style="margin:26px 0 12px;font-size:.98rem">Directory summary</h3>'
      + '<p style="max-width:70ch;margin:0">' + esc(m.about) + '</p>'
      + '</div>';
  }

  /* ---------------- edit ---------------- */

  function setMode(isEditing) {
    view.hidden = isEditing;
    edit.hidden = !isEditing;
    editToggle.hidden = isEditing;
    saveBtn.hidden = !isEditing;
    cancelBtn.hidden = !isEditing;
    if (isEditing) {
      fillForm();
      document.getElementById('f-name').focus();
    }
  }

  function fillForm() {
    var m = PUStore.memberById(selected);
    var set = function (id, value) { document.getElementById(id).value = value == null ? '' : value; };
    set('f-name', m.name);
    set('f-city', m.city);
    set('f-country', m.country);
    set('f-region', m.region);
    set('f-tier', m.tier);
    set('f-since', m.since);
    set('f-staff', m.staff);
    set('f-website', m.website);
    set('f-about', m.about);
    set('f-contact-name', m.contact.name);
    set('f-contact-title', m.contact.title);
    set('f-contact-email', m.contact.email);
    set('f-contact-phone', m.contact.phone);
    Array.prototype.forEach.call(servicesRow.children, function (chip) {
      var on = m.services.indexOf(chip.getAttribute('data-service')) > -1;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function collectForm() {
    var get = function (id) { return document.getElementById(id).value.trim(); };
    var services = Array.prototype.filter.call(servicesRow.children, function (c) {
      return c.classList.contains('is-on');
    }).map(function (c) { return c.getAttribute('data-service'); });

    return {
      id: selected,
      name: get('f-name'),
      city: get('f-city'),
      country: get('f-country'),
      region: Number(get('f-region')),
      tier: Number(get('f-tier')),
      since: Number(get('f-since')) || new Date().getFullYear(),
      staff: Number(get('f-staff')) || 0,
      website: get('f-website').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      about: get('f-about'),
      services: services,
      contact: {
        name: get('f-contact-name'),
        title: get('f-contact-title'),
        email: get('f-contact-email'),
        phone: get('f-contact-phone'),
      },
    };
  }

  servicesRow.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-service]');
    if (!chip) return;
    var on = !chip.classList.contains('is-on');
    chip.classList.toggle('is-on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  editToggle.addEventListener('click', function () { setMode(true); });
  cancelBtn.addEventListener('click', function () { setMode(false); });

  saveBtn.addEventListener('click', function () {
    var draft = collectForm();
    if (!draft.name || !draft.city || !draft.country) {
      PUStore.toast('Company name, city and country are required.');
      return;
    }
    if (!draft.services.length) {
      PUStore.toast('Select at least one service line.');
      return;
    }
    PUStore.upsertMember(draft);
    setMode(false);
    PUStore.toast('Profile saved to this browser.');
  });

  /* ---------------- boot ---------------- */

  function showShell() {
    gate.hidden = true;
    shell.hidden = false;
    selected = PUStore.selectedMemberId();
    setMode(false);
    renderView();
  }

  buildSelects();
  if (PUStore.session('member')) showShell();
})();
