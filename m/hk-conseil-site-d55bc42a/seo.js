/* HK Conseil : titre et description Google d'un chantier. Si Jordan ne les remplit pas, ils sont calculés à partir du titre et de l'introduction.
   Fichier partagé par l'administration (aperçu) et le générateur de pages : les deux donnent exactement le même résultat. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.HKSeo = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  var LIMITS = { title: 60, description: 155 };
  var TITLE_SUFFIX = ' | HK Conseil';
  var DESC_SUFFIX = ' HK Conseil, maître d’œuvre.';
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function cut(s, max) {
    if (s.length <= max) return s;
    var c = s.slice(0, max - 1).replace(/\s+\S*$/, '');
    return (c || s.slice(0, max - 1)).replace(/[\s,;:.]+$/, '') + '…';
  }
  function defaults(p) {
    var t = clean(p.title) || 'Chantier';
    var intro = clean(p.intro) || t;
    return {
      title: cut(t, LIMITS.title - TITLE_SUFFIX.length) + TITLE_SUFFIX,
      description: cut(intro, LIMITS.description - DESC_SUFFIX.length) + DESC_SUFFIX
    };
  }
  /* valeurs à utiliser : celles de Jordan si elles existent, sinon les valeurs calculées */
  function effective(p) {
    var d = defaults(p), t = clean(p.seo_title), s = clean(p.seo_description);
    return { title: t || d.title, description: s || d.description, titleIsDefault: !t, descriptionIsDefault: !s };
  }
  return { LIMITS: LIMITS, defaults: defaults, effective: effective };
});
