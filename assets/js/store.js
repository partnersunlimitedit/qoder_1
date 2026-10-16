/* Shared state for the directory, portal and admin panel.

   The seed data in assets/data/members.js is the source of truth; localStorage holds
   the demo edits layered on top of it. There is no server, so nothing here is private —
   see the note in admin.html. */
(function () {
  'use strict';

  var SEED_VERSION = '2026-10-01';
  var STORE_KEY = 'pu.network.v1';
  var SESSION_KEY = 'pu.session.v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function freshState() {
    var seed = window.PU_DATA;
    return {
      version: SEED_VERSION,
      members: clone(seed.members),
      applications: clone(seed.applications),
      rules: clone(seed.rules),
    };
  }

  var state = null;
  var listeners = [];

  function read() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var stored = raw && JSON.parse(raw);
      state = stored && stored.version === SEED_VERSION ? stored : freshState();
    } catch (err) {
      state = freshState();
    }
    return state;
  }

  function write() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(read()));
    } catch (err) {
      /* Private-mode browsers can refuse writes; the demo still works in memory. */
    }
    listeners.forEach(function (fn) { fn(); });
  }

  /* ---------------- lookups ---------------- */

  function regionName(id) {
    var found = window.PU_DATA.regions.filter(function (r) { return r.id === Number(id); })[0];
    return found ? found.name : 'Unassigned';
  }

  function tierLabel(id) {
    var found = window.PU_DATA.tiers.filter(function (t) { return t.id === Number(id); })[0];
    return found ? found.label : 'Ungraded';
  }

  function slotsAllowed(country) {
    var rules = read().rules;
    return rules.slotsOverride && rules.slotsOverride[country]
      ? rules.slotsOverride[country]
      : rules.slotsPerCountry;
  }

  function membersInCountry(country) {
    return read().members.filter(function (m) {
      return m.country === country && m.status !== 'suspended';
    });
  }

  /* ---------------- mutations ---------------- */

  function upsertMember(input) {
    var s = read();
    var id = input.id || slug(input.name);
    var existing = s.members.filter(function (m) { return m.id === id; })[0];
    var record = Object.assign({
      id: id, name: '', country: '', city: '', region: 2, tier: 3,
      since: new Date().getFullYear(), staff: 0, status: 'active',
      services: [], contact: { name: '', title: '', email: '', phone: '' },
      website: '', about: '',
    }, existing || {}, clone(input), { id: id });
    if (existing) {
      s.members[s.members.indexOf(existing)] = record;
    } else {
      s.members.unshift(record);
    }
    write();
    return record;
  }

  function setMemberStatus(id, status) {
    var member = memberById(id);
    if (!member) return null;
    member.status = status;
    write();
    return member;
  }

  function removeMember(id) {
    var s = read();
    s.members = s.members.filter(function (m) { return m.id !== id; });
    write();
  }

  function approveApplication(id) {
    var s = read();
    var index = -1;
    s.applications.forEach(function (a, i) { if (a.id === id) index = i; });
    if (index < 0) return null;
    var application = s.applications.splice(index, 1)[0];
    var record = upsertMember({
      id: application.id.replace(/^app-/, ''),
      name: application.name, country: application.country, city: application.city,
      region: application.region, tier: application.tier,
      since: new Date().getFullYear(), staff: application.staff || 0,
      status: 'active', services: application.services,
      contact: application.contact, website: application.website, about: application.about,
      approvedFrom: application.id,
    });
    return record;
  }

  function rejectApplication(id) {
    var s = read();
    s.applications = s.applications.filter(function (a) { return a.id !== id; });
    write();
  }

  function setRules(patch) {
    Object.assign(read().rules, clone(patch));
    write();
  }

  function resetAll() {
    state = freshState();
    try { localStorage.removeItem(STORE_KEY); } catch (err) {}
    listeners.forEach(function (fn) { fn(); });
  }

  function slug(name) {
    return String(name).toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'member-' + Date.now();
  }

  /* ---------------- session ---------------- */

  /* The portal and the admin panel are separate demo logins sharing one record. */
  function session(scope) {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var record = JSON.parse(raw);
      return scope && record.scope !== scope ? null : record;
    } catch (err) { return null; }
  }

  function signIn(email, memberId, scope) {
    var record = { email: email, at: Date.now(), scope: scope || 'member' };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(record)); } catch (err) {}
    if (memberId) selectMember(memberId);
    listeners.forEach(function (fn) { fn(); });
    return record;
  }

  function signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch (err) {}
    listeners.forEach(function (fn) { fn(); });
  }

  /* The portal edits one member at a time; remember which for the demo. */
  function selectedMemberId() {
    var s = session();
    return s && s.memberId ? s.memberId : read().members[0].id;
  }

  function selectMember(id) {
    var s = session();
    if (!s) return;
    s.memberId = id;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (err) {}
  }

  function memberById(id) {
    return read().members.filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ---------------- formatting ---------------- */

  function initials(name) {
    var words = String(name).replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
    var skip = ['pte', 'ltd', 'llp', 'inc', 'corp', 'co', 'gmbh', 'bv', 'bvs', 'spa', 'sas', 'sa', 'as', 'ab', 'oo', 'llc', 'ae', 'nvc'];
    var kept = words.filter(function (w) { return skip.indexOf(w.toLowerCase()) < 0; });
    var source = kept.length >= 2 ? kept : words;
    var first = (source[0] || '').charAt(0);
    var second = (source[1] || source[0] || '').charAt(0);
    return (first + second).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- feedback ---------------- */

  var toastTimer = null;
  function toast(message) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(function () { el.classList.add('is-on'); });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('is-on'); }, 3200);
  }

  window.PUStore = {
    /* lookups */
    members: function () { return read().members; },
    applications: function () { return read().applications; },
    rules: function () { return read().rules; },
    memberById: memberById,
    regionName: regionName,
    tierLabel: tierLabel,
    slotsAllowed: slotsAllowed,
    membersInCountry: membersInCountry,
    /* mutations */
    upsertMember: upsertMember,
    setMemberStatus: setMemberStatus,
    removeMember: removeMember,
    approveApplication: approveApplication,
    rejectApplication: rejectApplication,
    setRules: setRules,
    resetAll: resetAll,
    /* session */
    session: session,
    signIn: signIn,
    signOut: signOut,
    selectedMemberId: selectedMemberId,
    selectMember: selectMember,
    /* plumbing */
    subscribe: function (fn) { listeners.push(fn); },
    toast: toast,
    formatNumber: function (n) { return Number(n || 0).toLocaleString('en-GB'); },
    initials: initials,
    esc: escapeHtml,
    slug: slug,
  };
})();
