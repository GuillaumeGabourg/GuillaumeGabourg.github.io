/* Contenu d'origine du site (avant le mode administration). Sert de repli si l'API ne répond pas, et de point de départ du bouton « Rétablir » de l'administration. */
window.HK_DEFAULTS = {
    settings: {
      phone: '06.72.25.56.39', phone_name: 'Jordan Peltier', email: 'contact@hk-conseil.com',
      address1: '17 boulevard du Général de Gaulle', address2: '', postal: '53700', city: 'Villaines-la-Juhel',
      hours: [
        { from: 'lundi', to: 'vendredi', closed: false, o1: '08:30', c1: '18:30', o2: '', c2: '' },
        { from: 'samedi', to: '', closed: false, o1: '09:00', c1: '12:30', o2: '', c2: '' }
      ],
      vacation_on: false, vacation_from: '', vacation_to: '', vacation_msg: '', hero_caption: 'Rénovation d’une longère'
    },
    hero: { layout: 'compare', photos: [
      { src: 'img/facade-avant.webp', tag: 'Avant', alt: 'Façade de la longère avant les travaux' },
      { src: 'img/facade-encours.webp', tag: 'En cours', alt: 'Façade de la longère en cours de rénovation, ouvertures en granit' }
    ] },
    projects: [
      { title: 'Rénovation d’une longère', tag: 'Chantier en cours · Longère', kind: 'photos',
        intro: 'Un beau chantier qui avance pour la rénovation de cette longère !',
        bullets: ['Démolition des planchers', 'Modification et création d’ouvertures extérieures en pierre de granit local', 'Création d’une ouverture intérieure', 'Construction de murs en parpaing pour la séparation du bâtiment principal'],
        next: 'création des réseaux enterrés et réalisation des dalles de plancher.',
        credit: 'On avance bien, maçonnerie réalisé ici par l’entreprise Berson Batiment',
        views: [
          { name: 'Pignon', layout: 'compare', photos: [
            { src: 'img/pignon-avant.webp', tag: 'Avant', alt: 'Pignon de la longère avant les travaux' },
            { src: 'img/pignon-encours.webp', tag: 'En cours', alt: 'Pignon en cours de rénovation, sous échafaudage' }] },
          { name: 'Grange', layout: 'compare', photos: [
            { src: 'img/grange-avant.webp', tag: 'Avant', alt: 'Intérieur de la grange avant les travaux' },
            { src: 'img/grange-encours.webp', tag: 'En cours', alt: 'Grange en cours, murs en parpaing de séparation' }] },
          { name: 'Intérieur', layout: 'gallery', photos: [
            { src: 'img/interieur-avant-1.webp', tag: 'Avant', alt: 'Ancienne pièce de vie encombrée, avant les travaux' },
            { src: 'img/interieur-avant-2.webp', tag: 'Avant', alt: 'Pièce au plafond abîmé, avant les travaux' },
            { src: 'img/interieur-encours.webp', tag: 'En cours', alt: 'Volume ouvert jusqu’à la charpente après la démolition des planchers' }] }
        ] },
      { title: 'Rénovation complète d’une maison de bourg', tag: 'Projet · Trans', kind: 'video',
        intro: 'La conception 3D pour visualiser, représenter les volumes et s’immerger au coeur du projet fini. Simple et efficace elle est un vrai atout pour tout les acteurs du projet.',
        bullets: [], next: '', credit: '', views: [],
        video: { src: 'img/trans-3d.mp4', poster: 'img/trans-poster.webp', tag: 'Conception 3D', duration: '2 min 26' } }
    ]
  };
