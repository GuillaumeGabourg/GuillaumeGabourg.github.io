/* HK Conseil : textes administrables (bloc « À propos » et les 3 étapes des prestations).
   Le HTML de la page reste la source de vérité : c'est le texte d'origine. Ce fichier sait
   - lire les textes d'une page (read), - les remplacer (apply), - fusionner avec l'original (merge),
   - vérifier les limites de longueur (check). Il est partagé par le site et par l'administration.
   Gras dans « À propos » : **texte**. */
(function () {
  var LIMITS = {
    about: { title: 80, p1: 400, p2: 400, p3: 120 },
    step: { title: 40, text: 450, lead: 80, items: 5, item: 60 }
  };
  var STEPS = [1, 2, 3];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function plainOf(el) {
    var s = '';
    [].forEach.call(el.childNodes, function (n) { s += n.nodeType === 3 ? n.nodeValue : (n.nodeName === 'STRONG' ? '**' + n.textContent + '**' : n.textContent); });
    return s.replace(/\s+/g, ' ').trim();
  }
  function textNodes(el) { return [].filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); }); }
  function getLabel(el) { var t = textNodes(el); return t.length ? t[t.length - 1].nodeValue.trim() : ''; }
  function setLabel(el, v) { var t = textNodes(el); if (t.length) t[t.length - 1].nodeValue = v; }
  function $(root, sel) { return root.querySelector(sel); }

  function read(root) {
    var body = $(root, '#apropos .about-body'), ps = body ? body.querySelectorAll(':scope > p') : [];
    var out = { about: { title: body ? plainOf($(body, 'h2')) : '', p1: ps[0] ? plainOf(ps[0]) : '', p2: ps[1] ? plainOf(ps[1]) : '', p3: ps[2] ? plainOf(ps[2]) : '' }, steps: [] };
    STEPS.forEach(function (n) {
      var panel = $(root, '#panel-' + n), s = { title: '', text: '', lead: '', items: [] };
      if (panel) {
        s.title = plainOf($(panel, 'h3'));
        var main = $(panel, '.panel-body > p:not(.lead)'), lead = $(panel, '.panel-body > p.lead');
        s.text = main ? plainOf(main) : '';
        s.lead = lead ? plainOf(lead) : '';
        s.items = [].map.call(panel.querySelectorAll('.checks li'), plainOf);
      }
      out.steps.push(s);
    });
    return out;
  }

  /* t : { about: {...}|null, steps: [{...}]|null } ; chaque champ manquant retombe sur l'original */
  function merge(orig, t) {
    var o = JSON.parse(JSON.stringify(orig)); t = t || {};
    if (t.about) ['title', 'p1', 'p2', 'p3'].forEach(function (k) { if (typeof t.about[k] === 'string' && t.about[k].trim()) o.about[k] = t.about[k].trim(); });
    if (Array.isArray(t.steps)) STEPS.forEach(function (n, i) {
      var s = t.steps[i]; if (!s) return;
      ['title', 'text'].forEach(function (k) { if (typeof s[k] === 'string' && s[k].trim()) o.steps[i][k] = s[k].trim(); });
      if (typeof s.lead === 'string' && (orig.steps[i].lead || s.lead.trim())) o.steps[i].lead = s.lead.trim();
      if (Array.isArray(s.items)) { var it = s.items.map(function (x) { return String(x).trim(); }).filter(Boolean); if (it.length) o.steps[i].items = it; }
    });
    return o;
  }

  function apply(root, v) {
    var body = $(root, '#apropos .about-body');
    if (body) {
      var ps = body.querySelectorAll(':scope > p'), h = $(body, 'h2');
      if (h) h.textContent = v.about.title;
      [v.about.p1, v.about.p2, v.about.p3].forEach(function (txt, i) { if (ps[i]) ps[i].innerHTML = rich(txt); });
    }
    STEPS.forEach(function (n, i) {
      var s = v.steps[i], panel = $(root, '#panel-' + n); if (!panel) return;
      var tab = $(root, '#tab-' + n), acc = $(root, '.acc-head[aria-controls="panel-' + n + '"] .t'), h3 = $(panel, 'h3');
      if (tab) setLabel(tab, s.title);
      if (acc) acc.textContent = s.title;
      if (h3) h3.textContent = s.title;
      var main = $(panel, '.panel-body > p:not(.lead)'), lead = $(panel, '.panel-body > p.lead');
      if (main) main.textContent = s.text;
      if (lead) { lead.textContent = s.lead; lead.hidden = !s.lead; }
      var ul = $(panel, '.checks');
      if (ul) { ul.innerHTML = ''; s.items.forEach(function (x) { var li = root.createElement ? root.createElement('li') : document.createElement('li'); li.textContent = x; ul.appendChild(li); }); }
      var nx = i > 0 ? $(root, '.next-step[data-step="' + i + '"] > span') : null;   /* « Étape suivante : <titre de l'étape n> » sur l'étape précédente */
      if (nx) setLabel(nx, s.title);
    });
  }

  /* problèmes de saisie : { champ: message } (vide = tout va bien). Les mêmes règles sont vérifiées par le serveur (pb_hooks/textes.pb.js). */
  function checkAbout(a) {
    var e = {}, L = LIMITS.about;
    [['title', 'Le titre', 3], ['p1', 'Le premier paragraphe', 20], ['p2', 'Le deuxième paragraphe', 20], ['p3', 'La phrase sur les zones', 5]].forEach(function (f) {
      var v = String(a[f[0]] || '').trim();
      if (!v) e[f[0]] = f[1] + ' ne peut pas être vide.';
      else if (v.length < f[2]) e[f[0]] = f[1] + ' est trop court (' + f[2] + ' caractères minimum).';
      else if (v.length > L[f[0]]) e[f[0]] = f[1] + ' dépasse ' + L[f[0]] + ' caractères.';
      else if ((v.match(/\*\*/g) || []).length % 2) e[f[0]] = 'Les ** du gras doivent aller par deux (**comme ceci**).';
    });
    return e;
  }
  function checkStep(s) {
    var e = {}, L = LIMITS.step, ti = String(s.title || '').trim(), tx = String(s.text || '').trim(), ld = String(s.lead || '').trim();
    var it = (s.items || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (ti.length < 3) e.title = 'Le titre est obligatoire (3 caractères minimum).'; else if (ti.length > L.title) e.title = 'Le titre dépasse ' + L.title + ' caractères.';
    if (tx.length < 20) e.text = 'Le texte est obligatoire (20 caractères minimum).'; else if (tx.length > L.text) e.text = 'Le texte dépasse ' + L.text + ' caractères.';
    if (ld.length > L.lead) e.lead = 'La phrase d’accroche dépasse ' + L.lead + ' caractères.';
    if (!it.length) e.items = 'Gardez au moins un point dans la liste.';
    else if (it.length > L.items) e.items = L.items + ' points maximum.';
    else if (it.some(function (x) { return x.length > L.item; })) e.items = 'Chaque point fait ' + L.item + ' caractères au maximum.';
    return e;
  }

  window.HKTexts = { LIMITS: LIMITS, STEPS: STEPS, read: read, merge: merge, apply: apply, rich: rich, checkAbout: checkAbout, checkStep: checkStep };
})();
