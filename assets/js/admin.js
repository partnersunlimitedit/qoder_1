/* Board administration: the member register, the application queue and the network rules.
   Everything here writes through PUStore, so the public directory reflects it immediately. */
(function () {
  'use strict';

  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var drawer = document.getElementById('member-drawer');
  var form = document.getElementById('member-form');
  var servicesRow = document.getElementById('a-services');

  var DEMO_PASSWORD = 'demo';
  var view = 'members';
  var filters = { q: '', region: '', tier: '', status: '' };
  /* Which row is asking "are you sure" — deleting is the one irreversible action here. */
  var confirming = null;
  var editingId = null;
  var lastFocus = null;

  function el(id) { return document.getElementById(id); }
  function esc(v) { return PUStore.esc(v); }

  function options(list, current) {
    return list.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(current) ? ' selected' : '') + '>'
        + esc(o.label) + '</option>';
    }).join('');
  }

  function formatDate(iso) {
    var parts = String(iso).split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return parts.length === 3 ? parts[2] + ' ' + months[Number(parts[1]) - 1] + ' ' + parts[0] : iso;
  }

  /* ---------------- gate ---------------- */

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = el('login-email').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter a valid e-mail address.');
    if (el('login-password').value !== DEMO_PASSWORD) return fail('This is a demo environment — use the password “demo”.');
    PUStore.signIn(email, null, 'admin');
    showShell(email);
  });

  function fail(message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }

  el('sign-out').addEventListener('click', function () {
    PUStore.signOut();
    el('who-email').textContent = '';
    loginForm.reset();
    loginError.hidden = true;
    gate.hidden = false;
    shell.hidden = true;
  });

  function showShell(email) {
    gate.hidden = true;
    shell.hidden = false;
    el('who-email').textContent = email;
    render();
  }

  /* ---------------- view switching ---------------- */

  var VIEWS = {
    members: ['Member register', 'Every company in the network and the country slots they occupy.'],
    queue: ['Applications', 'Companies waiting for the board to decide on them.'],
    settings: ['Network rules', 'The representation limits and due tiers the network is run to.'],
  };

  el('shell').addEventListener('click', function (e) {
    var link = e.target.closest('[data-view]');
    if (!link) return;
    view = link.getAttribute('data-view');
    confirming = null;
    render();
  });

  function paintNav() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (link) {
      var on = link.getAttribute('data-view') === view;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    ['members', 'queue', 'settings'].forEach(function (key) {
      el('view-' + key).hidden = key !== view;
    });
  }

  /* ---------------- members ---------------- */

  function buildFilterControls() {
    el('m-region').innerHTML = options(
      [{ value: '', label: 'All regions' }].concat(window.PU_DATA.regions.map(function (r) {
        return { value: r.id, label: r.name };
      })), filters.region);
    el('m-tier').innerHTML = options(
      [{ value: '', label: 'All tiers' }].concat(window.PU_DATA.tiers.map(function (t) {
        return { value: t.id, label: t.label };
      })), filters.tier);
    el('m-status').innerHTML = options([
      { value: '', label: 'All statuses' },
      { value: 'active', label: 'Published' },
      { value: 'suspended', label: 'Suspended' },
    ], filters.status);
  }

  function visibleMembers() {
    var q = filters.q.toLowerCase();
    return PUStore.members().filter(function (m) {
      if (filters.region && String(m.region) !== filters.region) return false;
      if (filters.tier && String(m.tier) !== filters.tier) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (!q) return true;
      return (m.name + ' ' + m.city + ' ' + m.country + ' ' + m.services.join(' ')).toLowerCase().indexOf(q) > -1;
    });
  }

  function meter(country) {
    var used = PUStore.membersInCountry(country).length;
    var allowed = PUStore.slotsAllowed(country);
    var pct = Math.min(100, used / allowed * 100);
    var cls = used > allowed ? ' is-over' : used === allowed ? ' is-full' : '';
    return '<span class="meter' + cls + '">'
      + '<span class="meter__track"><span class="meter__bar" style="width:' + pct + '%"></span></span>'
      + '<span class="meter__label"><strong>' + used + '</strong> of ' + allowed + '</span></span>';
  }

  function renderMembers() {
    var list = visibleMembers();
    el('m-count').textContent = list.length + ' of ' + PUStore.members().length + ' members';
    el('m-empty').hidden = list.length > 0;

    el('m-rows').innerHTML = list.map(function (m) {
      var actions = confirming === 'm:' + m.id
        ? '<button class="link-btn link-btn--danger" type="button" data-act="delete" data-id="' + esc(m.id) + '">Confirm delete</button>'
          + '<button class="link-btn" type="button" data-act="cancel">Cancel</button>'
        : '<button class="link-btn" type="button" data-act="edit" data-id="' + esc(m.id) + '">Edit</button>'
          + '<button class="link-btn" type="button" data-act="status" data-id="' + esc(m.id) + '">'
          + (m.status === 'active' ? 'Suspend' : 'Publish') + '</button>'
          + '<button class="link-btn link-btn--danger" type="button" data-act="ask-delete" data-id="' + esc(m.id) + '">Delete</button>';

      return '<tr>'
        + '<td><div class="cell-name"><span class="monogram monogram--sm" aria-hidden="true">'
          + esc(PUStore.initials(m.name)) + '</span><span><strong>' + esc(m.name) + '</strong>'
          + '<span>' + esc(m.city) + ', ' + esc(m.country) + '</span></span></div></td>'
        + '<td>' + esc(PUStore.regionName(m.region)) + '</td>'
        + '<td><span class="pill pill--tier' + m.tier + '">' + esc(PUStore.tierLabel(m.tier)) + '</span></td>'
        + '<td>' + esc(m.since) + '</td>'
        + '<td>' + esc(PUStore.formatNumber(m.staff)) + '</td>'
        + '<td>' + meter(m.country) + '</td>'
        + '<td><span class="pill pill--' + esc(m.status) + '">'
          + (m.status === 'active' ? 'Published' : 'Suspended') + '</span></td>'
        + '<td class="cell-actions">' + actions + '</td>'
        + '</tr>';
    }).join('');
  }

  el('m-search').addEventListener('input', function () { filters.q = this.value.trim(); renderMembers(); });
  ['region', 'tier', 'status'].forEach(function (key) {
    el('m-' + key).addEventListener('change', function () { filters[key] = this.value; renderMembers(); });
  });

  el('m-rows').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    confirming = null;

    if (act === 'ask-delete') { confirming = 'm:' + id; renderMembers(); return; }
    if (act === 'cancel') { renderMembers(); return; }
    if (act === 'edit') { openDrawer(id); return; }
    if (act === 'status') {
      var member = PUStore.memberById(id);
      var next = member.status === 'active' ? 'suspended' : 'active';
      PUStore.setMemberStatus(id, next);
      PUStore.toast(next === 'active' ? member.name + ' is published again.' : member.name + ' is hidden from the directory.');
      return;
    }
    if (act === 'delete') {
      var gone = PUStore.memberById(id);
      PUStore.removeMember(id);
      PUStore.toast((gone ? gone.name : 'Member') + ' was removed from the register.');
    }
  });

  /* ---------------- member drawer ---------------- */

  function buildFormControls() {
    el('a-region').innerHTML = options(
      [{ value: '', label: 'Choose a region' }].concat(window.PU_DATA.regions.map(function (r) {
        return { value: r.id, label: r.name };
      })), '');
    el('a-tier').innerHTML = options(
      [{ value: '', label: 'Choose a tier' }].concat(window.PU_DATA.tiers.map(function (t) {
        return { value: t.id, label: t.label + ' — ' + t.basis };
      })), '');
    servicesRow.innerHTML = window.PU_DATA.services.map(function (s) {
      return '<button class="chip" type="button" data-service="' + esc(s) + '" aria-pressed="false">' + esc(s) + '</button>';
    }).join('');
  }

  function slotHelp() {
    var country = el('a-country').value.trim();
    var node = el('a-slot-help');
    if (!country) { node.textContent = ''; return; }
    var used = PUStore.membersInCountry(country).length;
    var allowed = PUStore.slotsAllowed(country);
    var record = PUStore.memberById(editingId);
    /* Editing a published member in the same market does not consume an extra slot. */
    var holdsSlot = !!record && record.country === country && record.status === 'active';
    var after = holdsSlot ? used : used + 1;
    node.textContent = after > allowed
      ? country + ' would hold ' + after + ' of ' + allowed + ' members — that breaks the network rule.'
      : country + ' has ' + used + ' of ' + allowed + ' member slots used.';
  }

  function openDrawer(id) {
    editingId = id || null;
    var m = id ? PUStore.memberById(id) : null;
    var set = function (field, value) { el('a-' + field).value = value == null ? '' : value; };

    el('drawer-title').textContent = m ? 'Edit member' : 'Add member';
    el('drawer-sub').textContent = m ? m.name : 'Publishes a new company to the directory.';
    set('name', m ? m.name : '');
    set('city', m ? m.city : '');
    set('country', m ? m.country : '');
    set('since', m ? m.since : new Date().getFullYear());
    set('staff', m ? m.staff : '');
    set('region', m ? m.region : '');
    set('tier', m ? m.tier : '');
    set('website', m ? m.website : '');
    set('about', m ? m.about : '');
    set('contact-name', m ? m.contact.name : '');
    set('contact-title', m ? m.contact.title : '');
    set('contact-email', m ? m.contact.email : '');
    set('contact-phone', m ? m.contact.phone : '');
    el('a-status').value = m ? m.status : 'active';
    Array.prototype.forEach.call(servicesRow.children, function (chip) {
      var on = !!m && m.services.indexOf(chip.getAttribute('data-service')) > -1;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    el('a-error').hidden = true;
    slotHelp();

    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';
    el('a-name').focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    drawer.hidden = true;
    editingId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeDrawer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  });
  el('a-country').addEventListener('input', slotHelp);

  servicesRow.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-service]');
    if (!chip) return;
    var on = !chip.classList.contains('is-on');
    chip.classList.toggle('is-on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var get = function (id) { return el('a-' + id).value.trim(); };
    var draft = {
      id: editingId || undefined,
      name: get('name'),
      city: get('city'),
      country: get('country'),
      region: Number(get('region')),
      tier: Number(get('tier')),
      since: Number(get('since')) || new Date().getFullYear(),
      staff: Number(get('staff')) || 0,
      website: get('website').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      about: get('about'),
      status: el('a-status').value,
      services: Array.prototype.filter.call(servicesRow.children, function (c) {
        return c.classList.contains('is-on');
      }).map(function (c) { return c.getAttribute('data-service'); }),
      contact: {
        name: get('contact-name'),
        title: get('contact-title'),
        email: get('contact-email'),
        phone: get('contact-phone'),
      },
    };

    /* Name, city, country and summary are enforced by the browser's own required fields. */
    if (!draft.services.length) {
      el('a-error').textContent = 'Select at least one service line.';
      el('a-error').hidden = false;
      return;
    }

    PUStore.upsertMember(draft);
    var over = PUStore.membersInCountry(draft.country).length > PUStore.slotsAllowed(draft.country);
    PUStore.toast(over
      ? draft.name + ' saved — ' + draft.country + ' is now over its member limit.'
      : (editingId ? 'Member updated.' : 'Member added to the register.'));
    closeDrawer();
  });

  /* ---------------- application queue ---------------- */

  function renderQueue() {
    var list = PUStore.applications();
    el('q-empty').hidden = list.length > 0;
    el('q-list').innerHTML = list.map(function (a) {
      var used = PUStore.membersInCountry(a.country).length;
      var allowed = PUStore.slotsAllowed(a.country);
      var full = used >= allowed;

      var buttons = confirming === 'a:' + a.id
        ? '<button class="btn btn--danger btn--sm" type="button" data-act="reject" data-id="' + esc(a.id) + '">Confirm rejection</button>'
          + '<button class="btn btn--ghost btn--sm" type="button" data-act="cancel">Keep in queue</button>'
        : '<button class="btn btn--primary btn--sm" type="button" data-act="approve" data-id="' + esc(a.id) + '">Approve</button>'
          + '<button class="btn btn--ghost btn--sm" type="button" data-act="ask-reject" data-id="' + esc(a.id) + '">Reject</button>';

      return '<article class="queue__item">'
        + '<span class="monogram" aria-hidden="true">' + esc(PUStore.initials(a.name)) + '</span>'
        + '<div class="queue__body">'
        + '<h3>' + esc(a.name) + '</h3>'
        + '<div class="queue__meta">'
        + '<span class="pill">' + esc(a.city) + ', ' + esc(a.country) + '</span>'
        + '<span class="pill">' + esc(PUStore.regionName(a.region)) + '</span>'
        + '<span class="pill pill--tier' + a.tier + '">' + esc(PUStore.tierLabel(a.tier)) + '</span>'
        + '<span class="pill pill--pending">Applied ' + esc(formatDate(a.appliedOn)) + '</span>'
        + '</div>'
        + '<p class="queue__about">' + esc(a.about) + '</p>'
        + '<div class="tag-row">' + a.services.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('') + '</div>'
        + (full ? '<div class="notice" style="margin-top:14px">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2 21.4 20H2.6z"/><path d="M12 10v4M12 17.2v.1"/></svg>'
            + '<div><strong>' + esc(a.country) + ' is at its limit.</strong> ' + esc(a.country) + ' already holds '
            + used + ' of ' + allowed + ' member slots. Approving publishes the company and puts the market over the rule.</div></div>' : '')
        + '<div class="queue__foot">'
        + '<span class="queue__contact">' + esc(a.contact.name) + ' · '
          + (a.contact.email ? '<a href="mailto:' + esc(a.contact.email) + '">' + esc(a.contact.email) + '</a>' : 'no e-mail')
          + '<span class="muted"> — ' + esc(a.submittedBy) + '</span></span>'
        + '<span class="queue__actions">' + buttons + '</span>'
        + '</div>'
        + '</div>'
        + '</article>';
    }).join('');
  }

  el('q-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    var application = PUStore.applications().filter(function (a) { return a.id === id; })[0];
    confirming = null;

    if (act === 'ask-reject') { confirming = 'a:' + id; renderQueue(); return; }
    if (act === 'cancel') { renderQueue(); return; }
    if (act === 'approve' && application) {
      var record = PUStore.approveApplication(id);
      var over = PUStore.membersInCountry(record.country).length > PUStore.slotsAllowed(record.country);
      PUStore.toast(over
        ? record.name + ' published — ' + record.country + ' is now over its member limit.'
        : record.name + ' is now a member and appears in the directory.');
      return;
    }
    if (act === 'reject' && application) {
      PUStore.rejectApplication(id);
      PUStore.toast(application.name + ' was removed from the queue.');
    }
  });

  /* ---------------- network rules ---------------- */

  function renderSettings() {
    var rules = PUStore.rules();
    var members = PUStore.members();
    var overridden = Object.keys(rules.slotsOverride || {});

    el('s-slots').value = rules.slotsPerCountry;
    el('s-slots-help').textContent = 'Applied to every market without an override. '
      + members.filter(function (m) { return overridden.indexOf(m.country) < 0; }).length
      + ' members currently sit under this rule.';

    el('s-override').innerHTML = overridden.map(function (country, index) {
      var choices = [country].concat(countries().filter(function (c) { return c !== country; }));
      return '<div class="override__row" data-index="' + index + '">'
        + '<select data-field="country" aria-label="Country ' + (index + 1) + '">'
        + options(choices.map(function (c) { return { value: c, label: c }; }), country) + '</select>'
        + '<input class="override__slots" data-field="slots" type="number" min="1" max="20" step="1" value="'
        + rules.slotsOverride[country] + '" aria-label="Members allowed in ' + esc(country) + '">'
        + '<button class="link-btn link-btn--danger" type="button" data-act="remove-override">Remove</button>'
        + '</div>';
    }).join('') || '<p class="muted" style="margin:0;font-size:.9rem">No overrides — every market uses the standard limit.</p>';

    var spare = countries().filter(function (c) { return overridden.indexOf(c) < 0; });
    el('s-add-country').innerHTML = options(spare.map(function (c) { return { value: c, label: c }; }), spare[0]);
    el('s-add-country').disabled = !spare.length;

    el('s-tiers').innerHTML = window.PU_DATA.tiers.map(function (t) {
      var count = members.filter(function (m) { return String(m.tier) === String(t.id); }).length;
      return '<tr>'
        + '<td><span class="pill pill--tier' + t.id + '">' + esc(t.label) + '</span></td>'
        + '<td>' + esc(t.basis) + '</td>'
        + '<td>' + esc(t.note) + '</td>'
        + '<td>' + count + '</td>'
        + '</tr>';
    }).join('');
  }

  /* Countries present in the register and the queue, in display order. */
  function countries() {
    var seen = {};
    PUStore.members().concat(PUStore.applications()).forEach(function (m) { seen[m.country] = 1; });
    return Object.keys(seen).sort();
  }

  function saveRules(patch) {
    PUStore.setRules(patch);
    PUStore.toast('Network rule updated.');
  }

  el('s-slots').addEventListener('change', function () {
    var n = Number(this.value);
    if (!(n > 0)) { renderSettings(); return; }
    saveRules({ slotsPerCountry: n });
  });

  el('s-override').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act="remove-override"]');
    if (!btn) return;
    var row = btn.closest('.override__row');
    var country = row.querySelector('select').value;
    var next = Object.assign({}, PUStore.rules().slotsOverride);
    delete next[country];
    PUStore.setRules({ slotsOverride: next });
    PUStore.toast('Override removed — ' + country + ' uses the standard limit.');
  });

  el('s-override').addEventListener('change', function (e) {
    var input = e.target.closest('[data-field]');
    if (!input) return;
    var row = input.closest('.override__row');
    var current = PUStore.rules().slotsOverride;
    var from = row.querySelector('[data-field="country"]').value;
    var next = Object.assign({}, current);
    if (input.getAttribute('data-field') === 'slots') {
      next[from] = Math.max(1, Number(input.value) || 1);
    } else {
      var to = input.value;
      next[to] = Number(row.querySelector('[data-field="slots"]').value) || current[from];
      delete next[from];
    }
    PUStore.setRules({ slotsOverride: next });
    PUStore.toast('Network rule updated.');
  });

  el('s-add-override').addEventListener('click', function () {
    var country = el('s-add-country').value;
    if (!country) return;
    var next = Object.assign({}, PUStore.rules().slotsOverride);
    next[country] = PUStore.rules().slotsPerCountry + 2;
    PUStore.setRules({ slotsOverride: next });
    PUStore.toast(country + ' can now hold ' + next[country] + ' members.');
  });

  el('s-reset').addEventListener('click', function () {
    if (confirming !== 'reset') { confirming = 'reset'; this.textContent = 'Confirm reset'; return; }
    confirming = null;
    PUStore.resetAll();
    PUStore.toast('Demo data restored.');
  });

  /* ---------------- render ---------------- */

  function render() {
    paintNav();
    el('view-title').textContent = VIEWS[view][0];
    el('view-sub').textContent = VIEWS[view][1];
    el('view-actions').innerHTML = view === 'members'
      ? '<button class="btn btn--primary btn--sm" type="button" data-act="add">Add member</button>' : '';
    el('count-members').textContent = PUStore.members().length;
    el('count-queue').textContent = PUStore.applications().length;
    el('s-reset').textContent = confirming === 'reset' ? 'Confirm reset' : 'Reset demo data';
    renderMembers();
    renderQueue();
    renderSettings();
  }

  el('view-actions').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="add"]')) openDrawer(null);
  });

  PUStore.subscribe(function () {
    confirming = null;
    render();
  });

  buildFilterControls();
  buildFormControls();

  var sess = PUStore.session('admin');
  if (sess) showShell(sess.email);
})();
