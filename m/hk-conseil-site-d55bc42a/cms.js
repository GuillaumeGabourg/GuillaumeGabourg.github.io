/* HK Conseil : contenu administrable.
   Charge les données depuis PocketBase (même origine) et construit : photo d'accueil, chantiers,
   coordonnées, horaires et bandeau de congés. Si l'API ne répond pas, le site s'affiche avec le
   contenu par défaut ci-dessous (identique au site d'origine). */
(function () {
  var API = window.HK_API || '';
  var DEF = window.HK_DEFAULTS;


  /* ---------- utilitaires ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function get(url, signal) { return fetch(API + url, { signal: signal, cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function fileUrl(col, rec, name) { return API + '/api/files/' + col + '/' + rec.id + '/' + encodeURIComponent(name); }
  function q(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function e164(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('00') === 0) return '+' + d.slice(2); if (d.charAt(0) === '0') return '+33' + d.slice(1); return '+' + d; }
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  function parseDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function frDate(d) { return (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MONTHS[d.getMonth()]; }
  function hm(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return ''; return (+m[1]) + 'h' + (m[2] === '00' ? '' : m[2]); }
  function range(o, c) { return hm(o) && hm(c) ? hm(o) + ' à ' + hm(c) : ''; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- données ---------- */
  function normalize(raw) {
    var S = raw.settings || {};
    var photosByView = {};
    raw.photos.forEach(function (p) { (photosByView[p.view] = photosByView[p.view] || []).push(p); });
    function viewPhotos(v) {
      return (photosByView[v.id] || []).sort(function (a, b) { return (a.position || 0) - (b.position || 0); })
        .filter(function (p) { return p.image; })
        .map(function (p) { return { src: fileUrl('photos', p, p.image), tag: p.tag || 'Réalisé', alt: p.alt || '' }; });
    }
    var heroV = raw.views.filter(function (v) { return v.slot === 'hero'; })[0];
    var hero = heroV ? { layout: heroV.layout, photos: viewPhotos(heroV) } : null;
    var projects = raw.projects.filter(function (p) { return p.visible !== false; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); })
      .map(function (p) {
        var o = { title: p.title, tag: p.tag, intro: p.intro, bullets: String(p.bullets || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
          next: p.next, credit: p.credit, kind: p.kind || 'photos', views: [] };
        if (o.kind === 'video' && p.video) o.video = { src: fileUrl('projects', p, p.video), poster: p.poster ? fileUrl('projects', p, p.poster) : '', tag: p.video_tag, duration: p.video_duration };
        o.views = raw.views.filter(function (v) { return v.project === p.id; })
          .sort(function (a, b) { return (a.position || 0) - (b.position || 0); })
          .map(function (v) { return { name: v.name, layout: v.layout, photos: viewPhotos(v) }; })
          .filter(function (v) { return v.photos.length; });
        return o;
      });
    var OPTIONAL = { vacation_from: 1, vacation_to: 1, vacation_msg: 1, address2: 1 };
    var settings = {};
    Object.keys(DEF.settings).forEach(function (k) {
      var v = S[k];
      settings[k] = (v == null || (v === '' && !OPTIONAL[k])) ? DEF.settings[k] : v;
    });
    if (!Array.isArray(settings.hours) || !settings.hours.length) settings.hours = DEF.settings.hours;
    var tx = {}; (raw.texts || []).forEach(function (r) { if (r && r.data && typeof r.data === 'object') tx[r.key] = r.data; });
    return { settings: settings, hero: hero && hero.photos.length ? hero : DEF.hero, projects: projects, texts: { about: tx.about || null, steps: tx.presta && tx.presta.steps || null } };
  }

  function load() {
    var ac = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ac) ac.abort(); }, 3000);
    var sig = ac ? ac.signal : undefined;
    return Promise.all([
      get('/api/collections/settings/records?perPage=1', sig),
      get('/api/collections/projects/records?perPage=100&sort=position', sig),
      get('/api/collections/views/records?perPage=500&sort=position', sig),
      get('/api/collections/photos/records?perPage=500&sort=position', sig),
      get('/api/collections/site_texts/records?perPage=20', sig).catch(function () { return { items: [] }; })   /* textes modifiés : s'ils sont indisponibles, le texte d'origine reste */
    ]).then(function (r) {
      clearTimeout(to);
      return normalize({ settings: r[0].items[0], projects: r[1].items, views: r[2].items, photos: r[3].items, texts: r[4].items });
    }).catch(function (e) { clearTimeout(to); throw e; });
  }

  /* ---------- rendu : coordonnées et horaires ---------- */
  function hoursRows(S) {
    return S.hours.map(function (h) {
      var label;
      if (h.to && h.to !== h.from) label = 'Du ' + h.from + ' au ' + h.to; else label = cap(h.from || '');
      var txt;
      if (h.closed) txt = 'Fermé';
      else { var a = range(h.o1, h.c1), b = range(h.o2, h.c2); txt = a && b ? a + ' et ' + b : (a || b || 'Fermé'); }
      return { label: label, text: txt, closed: h.closed || txt === 'Fermé' };
    });
  }
  function vacationInfo(S) {
    if (!S.vacation_on) return null;
    var from = parseDay(S.vacation_from), to = parseDay(S.vacation_to), now = new Date(); now.setHours(0, 0, 0, 0);
    if (to && now > to) return null;
    var msg = (S.vacation_msg || '').trim();
    var text;
    if (msg && !from && !to) text = '';
    else if (from && to) {
      var back = new Date(to.getTime()); back.setDate(back.getDate() + 1);
      text = (now < from ? 'Fermeture du ' : 'Nous sommes en congés du ') + frDate(from) + ' au ' + frDate(to) + '. Réouverture le ' + frDate(back) + '.';
    } else if (to) text = 'Nous sommes actuellement en congés jusqu’au ' + frDate(to) + '.';
    else text = 'Nous sommes actuellement en congés.';
    /* les dates et le message personnalisé sont deux blocs séparés, chacun sur sa ligne */
    return { text: text, extra: msg };
  }
  function vacHTML(vac) {
    return (vac.text ? '<span class="vac-d">' + esc(vac.text) + '</span>' : '') + (vac.extra ? '<span class="vac-m">' + esc(vac.extra) + '</span>' : '');
  }

  function addr2(S) { var l = [S.postal, S.city].filter(Boolean).join(' '); return l || S.address2 || ''; }

  function applySettings(S) {
    q('.vac').forEach(function (n) { n.parentNode.removeChild(n); });
    var tel = 'tel:' + e164(S.phone), disp = S.phone;
    q('[data-cms="tel"]').forEach(function (a) { a.setAttribute('href', tel); a.textContent = disp; });
    q('[data-cms="tel-call"]').forEach(function (a) { a.setAttribute('href', tel); a.setAttribute('aria-label', 'Appeler HK Conseil au ' + disp.replace(/[.\-]/g, ' ')); });
    q('[data-cms="phone"]').forEach(function (n) { n.textContent = disp; });
    q('[data-cms="phone_name"]').forEach(function (n) { n.textContent = S.phone_name; });
    q('[data-cms="email"]').forEach(function (n) { n.textContent = S.email; });
    q('[data-cms="mail"]').forEach(function (a) { a.setAttribute('href', 'mailto:' + S.email); a.textContent = S.email; });
    q('[data-cms="address"]').forEach(function (n) { n.innerHTML = '<span class="' + (S.address1.length <= 36 ? 'nw-d' : '') + '">' + esc(S.address1) + '</span><br>' + esc(addr2(S)); });
    q('[data-cms="foot-address"]').forEach(function (n) { n.innerHTML = '<span class="' + (S.address1.length <= 36 ? 'nw' : '') + '">' + esc(S.address1) + '</span><br>' + esc(addr2(S)); });
    q('[data-cms="foot-contact"]').forEach(function (n) { n.innerHTML = esc(S.phone_name) + '<br>' + esc(S.email) + '<br>' + esc(S.phone); });
    var rows = hoursRows(S), vac = vacationInfo(S);
    q('[data-cms="hours"]').forEach(function (n) {
      n.innerHTML = rows.map(function (r) { return '<div class="h-row"><span>' + esc(r.label) + '</span><b' + (r.closed ? ' class="is-closed"' : '') + '>' + esc(r.text) + '</b></div>'; }).join('') +
        (vac ? '<p class="h-vac">' + vacHTML(vac) + '</p>' : '');
    });
    q('[data-cms="foot-hours"]').forEach(function (n) {
      n.innerHTML = '<h3>Horaires de contact</h3>' + rows.map(function (r, i) { return '<p' + (i ? ' style="margin-top:10px"' : '') + '>' + esc(r.label) + '<br>' + esc(r.text) + '</p>'; }).join('') +
        (vac ? '<p class="f-vac" style="margin-top:10px">' + vacHTML(vac) + '</p>' : '');
    });
    var heroGrid = document.querySelector('.hero-grid');
    if (heroGrid && vac) {
      var b = document.createElement('div'); b.className = 'vac'; b.setAttribute('role', 'status');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>' + vacHTML(vac) + '</span>';
      heroGrid.insertBefore(b, heroGrid.firstChild);
    }
    var cap = document.getElementById('hero-caption-text'); if (cap) cap.textContent = S.hero_caption;
  }

  /* ---------- rendu : photos ---------- */
  var ARROWS = '<svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>';
  var ZOOM = '<span class="zoom"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg></span>';
  function baHTML(ph, extra, lazy) {
    var l = lazy ? ' loading="lazy"' : '';
    return '<div class="ba"' + extra + ' data-ba data-view>' +
      '<img class="after" src="' + esc(ph[1].src) + '" alt="' + esc(ph[1].alt) + '"' + l + '>' +
      '<img class="before" src="' + esc(ph[0].src) + '" alt="' + esc(ph[0].alt) + '"' + l + '>' +
      '<span class="tag tag-b">' + esc(ph[0].tag) + '</span><span class="tag tag-a">' + esc(ph[1].tag) + '</span>' +
      '<span class="split"></span><button class="knob" type="button" role="slider" aria-label="Comparer : ' + esc(ph[0].tag.toLowerCase()) + ' et ' + esc(ph[1].tag.toLowerCase()) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">' + ARROWS.replace('<svg ', '<svg ') + '</button></div>';
  }
  function singleHTML(p, extra, lazy) {
    return '<div class="ba ba--single"' + extra + '><img class="after" src="' + esc(p.src) + '" alt="' + esc(p.alt) + '"' + (lazy ? ' loading="lazy"' : '') + '><span class="tag ' + (p.tag === 'Avant' ? 'tag-b' : 'tag-a') + ' tag-l">' + esc(p.tag) + '</span></div>';
  }
  function galleryHTML(v) {
    var n = v.photos.length;
    function btn(p, i) {
      return '<button class="g" type="button" data-tag="' + esc(p.tag) + '" data-cap="' + esc(v.name) + '" data-alt="' + esc(p.alt) + '"><img src="' + esc(p.src) + '" alt="' + esc(p.alt) + '" loading="lazy"><span class="tag ' + (p.tag === 'Avant' ? 'tag-b' : 'tag-a') + '">' + esc(p.tag) + '</span>' + ZOOM + '</button>';
    }
    if (n > 4) return '<div class="int int--grid" data-view>' + v.photos.map(btn).join('') + '</div>';
    var h = Math.ceil(n / 2), cols = n === 1 ? [v.photos] : [v.photos.slice(0, h), v.photos.slice(h)];
    return '<div class="int' + (n === 1 ? ' int--1' : '') + '" data-view>' + cols.map(function (c) { return '<div class="int-col">' + c.map(btn).join('') + '</div>'; }).join('') + '</div>';
  }
  function viewHTML(v, first) {
    var el;
    if (v.layout === 'compare' && v.photos.length >= 2) el = baHTML(v.photos, '', true);
    else if (v.layout === 'compare') el = singleHTML(v.photos[0], ' data-view', true);
    else el = galleryHTML(v);
    if (!first) el = el.replace('data-view', 'data-view hidden');
    return el;
  }
  function viewKind(v) { return v.layout === 'gallery' || v.photos.length < 2 ? (v.layout === 'gallery' ? 'gallery' : 'single') : 'compare'; }

  function postHTML(p) {
    return '<div class="post"><span class="p-tag">' + esc(p.tag) + '</span><h3>' + esc(p.title) + '</h3>' +
      (p.intro ? '<p class="intro">' + esc(p.intro) + '</p>' : '') +
      (p.bullets.length ? '<ul>' + p.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') +
      (p.next ? '<p class="next"><b>À venir :</b> ' + esc(p.next) + '</p>' : '') +
      (p.credit ? '<p class="credit">' + esc(p.credit) + '</p>' : '') + '</div>';
  }
  function projectHTML(p) {
    if (p.kind === 'video' && p.video) {
      return '<article class="project project--video" data-reveal><div class="video"><video src="' + esc(p.video.src) + '"' + (p.video.poster ? ' poster="' + esc(p.video.poster) + '"' : '') +
        ' preload="none" playsinline muted width="1280" height="720" aria-label="' + esc(p.title) + '"></video>' +
        '<button class="play" type="button" aria-label="Lire la vidéo"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></button>' +
        (p.video.tag ? '<span class="tag tag-a">' + esc(p.video.tag) + '</span>' : '') +
        (p.video.duration ? '<span class="dur">' + esc(p.video.duration) + '</span>' : '') + '</div>' + postHTML(p) + '</article>';
    }
    var views = p.views, k0 = views.length ? viewKind(views[0]) : '';
    var switcher = '';
    if (views.length) {
      var multi = views.length > 1;
      var hintTxt = k0 === 'gallery' ? 'Touchez une photo pour l’agrandir' : (k0 === 'compare' ? 'Glissez pour comparer' : '');
      switcher = '<div class="switch-wrap">' + (multi ? '<div class="switch" role="group" aria-label="Choisir la partie du chantier">' +
        views.map(function (v, i) { return '<button type="button" aria-pressed="' + (i === 0) + '" data-kind="' + viewKind(v) + '">' + esc(v.name) + '<span class="bar"></span></button>'; }).join('') + '</div>' : '') +
        (hintTxt || multi ? '<span class="switch-hint"' + (hintTxt ? '' : ' style="display:none"') + '>' + (k0 === 'gallery' ? ARROWS.replace('<svg ', '<svg style="display:none" ') : ARROWS) + '<span>' + esc(hintTxt) + '</span></span>' : '') + '</div>';
    }
    return '<article class="project" data-reveal><div class="project-viewer">' + switcher + '<div class="stage">' +
      views.map(function (v, i) { return viewHTML(v, i === 0); }).join('') + '</div></div>' + postHTML(p) + '</article>';
  }

  function applyHero(h) {
    var root = document.getElementById('hero-media'); if (!root || !h || !h.photos || !h.photos.length) return;
    var S = window.HK_DATA.settings, p = h.photos;
    var main = h.layout === 'compare' && p.length >= 2 ? baHTML(p, ' id="ba-hero"', false) : singleHTML(p[0], ' id="ba-hero"', false);
    var hint = h.layout === 'compare' && p.length >= 2 ? '<span class="drag-hint">' + ARROWS + 'Glissez pour comparer</span>' : '';
    root.innerHTML = main + '<div class="hero-caption"><a class="see" href="#realisations" data-goto="#realisations"><b id="hero-caption-text">' + esc(S.hero_caption) + '</b><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' + hint + '</div>';
    var first = root.querySelector('.ba img'); if (first) first.setAttribute('fetchpriority', 'high');
  }
  /* un chantier sans vidéo ni photo n'est pas affiché ; sans aucun chantier affichable, la section « Réalisations » disparaît */
  function hasContent(p) { return p.kind === 'video' ? !!(p.video && p.video.src) : p.views.some(function (v) { return v.photos.length; }); }
  function applyProjects(list) {
    var root = document.getElementById('projects-root'); if (!root || root.hasAttribute('data-static')) return;   /* accueil courte : cartes fixes générées, pas de rendu ici */
    var keep = [];
    list.forEach(function (p, i) { if (hasContent(p)) keep.push(i); });
    root.innerHTML = keep.map(function (i) { return projectHTML(list[i]); }).join('');
    [].slice.call(root.children).forEach(function (el, k) { el.setAttribute('data-i', keep[k]); });
    document.documentElement.classList.toggle('no-projects', !keep.length);
  }

  /* textes : l'original est lu une fois dans la page (HTML), puis chaque rendu applique « original + modifications » */
  var ORIG = null;
  function applyTexts(t) {
    if (!window.HKTexts) return;
    if (!ORIG) { ORIG = window.HKTexts.read(document); window.HK_ORIG_TEXTS = ORIG; }
    window.HKTexts.apply(document, window.HKTexts.merge(ORIG, t));
  }
  function render(d) { window.HK_DATA = d; applyHero(d.hero); applyProjects(d.projects); applySettings(d.settings); applyTexts(d.texts); }

  window.HK_READY = load().then(render, function () { render(DEF); }).catch(function (e) { try { console.error('HK cms', e); } catch (x) {} });

  /* aperçu en direct : l'administration envoie ses modifications non enregistrées à cette page (?preview=1) */
  if (/[?&]preview=1/.test(location.search)) {
    window.HK_PREVIEW = true;

    /* repère « vous modifiez ceci » : la zone du site liée au champ en cours est mise en avant */
    var st = document.createElement('style');
    st.textContent = '@keyframes hkpulse{0%,100%{outline-color:rgba(63,107,63,.95);background-color:rgba(136,172,136,.34)}50%{outline-color:rgba(63,107,63,.25);background-color:rgba(136,172,136,.10)}}' +
      '.hk-hl{outline:3px solid #3f6b3f!important;outline-offset:6px;border-radius:6px;animation:hkpulse 1.2s ease-in-out infinite;position:relative;z-index:5}' +
      '.hk-hl.ba,.hk-hl.stage,.hk-hl.video,.hk-hl.switch-wrap{outline-offset:-3px}';
    document.head.appendChild(st);
    var HL = {
      phone: ['#contact [data-cms="tel"]', '[data-cms="tel"]', '[data-cms="phone"]', '[data-cms="tel-call"]'],
      phone_name: ['#contact [data-cms="phone_name"]', '[data-cms="phone_name"]'],
      email: ['#contact [data-cms="mail"]', '[data-cms="mail"]', '[data-cms="email"]'],
      address: ['#contact [data-cms="address"]', '[data-cms="address"]', '[data-cms="foot-address"]'],
      hours: ['#contact [data-cms="hours"]', '[data-cms="hours"]', '[data-cms="foot-hours"]'],
      vac: ['.h-vac', '.vac', '.f-vac'],
      vacmsg: ['.h-vac .vac-m', '.vac .vac-m', '.h-vac', '.vac'],
      caption: ['#hero-caption-text'],
      hero: ['#ba-hero', '#hero-media'],
      'p-title': ['.post h3'], 'p-tag': ['.p-tag'], 'p-intro': ['.post .intro', '.post h3'], 'p-bullets': ['.post ul', '.post h3'],
      'p-next': ['.post .next', '.post h3'], 'p-credit': ['.post .credit', '.post h3'],
      'p-photos': ['.stage > [data-view]:not([hidden])', '.stage'], 'p-switch': ['.switch-wrap', '.stage'],
      'p-video': ['.video'], 'p-vtag': ['.video .tag', '.video'], 'p-vdur': ['.video .dur', '.video']
    };
    HL['a-title'] = ['#apropos .about-body h2']; HL['a-p1'] = ['#apropos .about-body > p:nth-of-type(1)']; HL['a-p2'] = ['#apropos .about-body > p:nth-of-type(2)']; HL['a-p3'] = ['#apropos .about-body > p:nth-of-type(3)'];
    [1, 2, 3].forEach(function (n) {
      HL['pr' + n + '-title'] = ['#panel-' + n + ' h3', '#tab-' + n]; HL['pr' + n + '-text'] = ['#panel-' + n + ' .panel-body > p:not(.lead)'];
      HL['pr' + n + '-lead'] = ['#panel-' + n + ' .panel-body > p.lead', '#panel-' + n + ' h3']; HL['pr' + n + '-items'] = ['#panel-' + n + ' .checks'];
    });
    var cur = null;
    function shown(n) { return n && n.getClientRects().length > 0; }
    function clearHL() { q('.hk-hl').forEach(function (n) { n.classList.remove('hk-hl'); }); }
    function applyHL(first, scroll) {
      clearHL();
      if (!cur || !HL[cur.key]) return;
      var scope = document, pm = /^pr(\d)-/.exec(cur.key);
      if (pm) {   /* étape de prestation fermée : on l'ouvre (onglet sur ordinateur, accordéon sur téléphone) */
        var pn = document.getElementById('panel-' + pm[1]);
        if (pn && !shown(pn)) { var tb = document.getElementById('tab-' + pm[1]); if (shown(tb)) tb.click(); else { var ah = document.querySelector('.acc-head[aria-controls=\"panel-' + pm[1] + '\"]'); if (ah) ah.click(); } }
      }
      if (cur.key.slice(0, 2) === 'p-') {
        scope = document.querySelector('#projects-root .project[data-i="' + cur.idx + '"]');
        if (!scope) return;
        if (cur.part != null && first) { var bs = scope.querySelectorAll('.switch button'); if (bs[cur.part] && bs[cur.part].getAttribute('aria-pressed') !== 'true') bs[cur.part].click(); }
      }
      var list = HL[cur.key], el = null;
      for (var i = 0; i < list.length && !el; i++) { var c = [].slice.call(scope.querySelectorAll(list[i])).filter(shown); if (c.length) el = c[0]; }
      if (!el) return;
      el.classList.add('hk-hl');
      if (scroll) {
        var r = el.getBoundingClientRect(), vh = window.innerHeight, hdr = 90;
        if (r.top < hdr || r.bottom > vh - 80) window.scrollTo({ top: window.pageYOffset + r.top - Math.max(hdr + 20, (vh - r.height) / 2), behavior: 'smooth' });
      }
    }

    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin) return;
      var m = e.data || {};
      if (m.type === 'hk-draft' && m.data) {
        /* chaque mise à jour reconstruit la page : on mémorise la partie affichée dans chaque chantier pour la remettre ensuite */
        var sel = {};
        q('#projects-root .project').forEach(function (el) { var k = [].slice.call(el.querySelectorAll('.switch button')).findIndex(function (b) { return b.getAttribute('aria-pressed') === 'true'; }); if (k > 0) sel[el.getAttribute('data-i')] = k; });
        render(m.data); if (window.HK_REINIT) window.HK_REINIT();
        Object.keys(sel).forEach(function (i) { var el = document.querySelector('#projects-root .project[data-i="' + i + '"]'), bs = el && el.querySelectorAll('.switch button'); if (bs && bs[sel[i]]) bs[sel[i]].click(); });
        var recent = !!cur && Date.now() - cur.t < 900;
        applyHL(recent, recent);
      }
      if (m.type === 'hk-goto') { cur = null; clearHL(); var t = document.getElementById(m.id); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.pageYOffset); /* pas de scrollIntoView : il ferait aussi défiler la page d'administration qui contient l'aperçu */ }
      if (m.type === 'hk-focus') { cur = { key: m.key, idx: +m.idx || 0, part: m.part == null ? null : +m.part, t: Date.now() }; setTimeout(function () { applyHL(true, true); }, 60); }
      if (m.type === 'hk-blur') { cur = null; clearHL(); }
    });
    window.HK_READY.then(function () { setTimeout(function () { if (window.parent !== window) window.parent.postMessage({ type: 'hk-ready' }, location.origin); }, 80); });
  }
})();
