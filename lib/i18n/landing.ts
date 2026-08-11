export type Lang = 'en' | 'fr';

export const landingCopy = {
  en: {
    logIn: 'Log in',
    signUp: 'Sign up',
    eyebrow: 'For hotels, restaurants, bars & beach clubs',
    heroTitle: 'Turn your venue into the room everyone wants to be in.',
    heroSubtitle:
      'A QR code at your door. Verified guests connecting with each other — Dating, Business, Social — while they\u2019re with you.',
    ctaPrimary: 'Get your venue set up',
    ctaSecondary: 'See pricing',
    heroQuote: 'The people your guests want to meet might already be in the room.',
    howItWorksEyebrow: 'How it works',
    steps: [
      {
        mark: 'I.',
        title: 'Your QR, everywhere',
        body: 'One code at reception, the bar, or every table. Guests scan it — no app to download, no friction.',
      },
      {
        mark: 'II.',
        title: 'Verified presence',
        body: 'Not a check-in from six hours ago. Location and activity signals confirm who is actually still on-site.',
      },
      {
        mark: 'III.',
        title: 'Your venue, alive',
        body: 'Guests connect with each other while they are with you — Dating, Business, or Social — not after they have left.',
      },
    ],
    previewEyebrow: 'What guests see',
    previewTitle: 'Not a check-in from six hours ago.',
    previewBody:
      'Every profile is confirmed present through location and activity signals, re-verified as the evening goes on. When someone leaves, they disappear from the room — no stale ghosts, no guessing.',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Simple plans, no setup fees.',
    choosePlan: 'Choose',
    requestEyebrow: 'Get started',
    requestTitle: 'Let\u2019s set up your venue.',
    requestBody:
      'Tell us about your venue and we\u2019ll set up your account, your QR code, and your page — usually within a day.',
  },
  fr: {
    logIn: 'Connexion',
    signUp: "S'inscrire",
    eyebrow: 'Pour hôtels, restaurants, bars & beach clubs',
    heroTitle: 'Faites de votre lieu la salle où tout le monde veut être.',
    heroSubtitle:
      'Un QR code à l\u2019entrée. Des invités vérifiés qui se rencontrent — Dating, Business, Social — pendant qu\u2019ils sont chez vous.',
    ctaPrimary: 'Configurer mon établissement',
    ctaSecondary: 'Voir les tarifs',
    heroQuote: 'Les personnes que vos clients veulent rencontrer sont peut-être déjà dans la salle.',
    howItWorksEyebrow: 'Comment ça marche',
    steps: [
      {
        mark: 'I.',
        title: 'Votre QR, partout',
        body: 'Un seul code à l\u2019accueil, au bar, ou sur chaque table. Vos clients scannent — aucune application à télécharger, aucune friction.',
      },
      {
        mark: 'II.',
        title: 'Présence vérifiée',
        body: 'Pas un check-in vieux de six heures. La localisation et l\u2019activité confirment qui est vraiment encore sur place.',
      },
      {
        mark: 'III.',
        title: 'Votre lieu, vivant',
        body: 'Vos clients se connectent entre eux pendant qu\u2019ils sont chez vous — Dating, Business ou Social — pas après être partis.',
      },
    ],
    previewEyebrow: 'Ce que voient vos clients',
    previewTitle: 'Pas un check-in vieux de six heures.',
    previewBody:
      'Chaque profil est confirmé présent grâce à des signaux de localisation et d\u2019activité, revérifiés au fil de la soirée. Quand quelqu\u2019un part, il disparaît de la salle — aucun profil fantôme, aucune approximation.',
    pricingEyebrow: 'Tarifs',
    pricingTitle: 'Des formules simples, sans frais d\u2019installation.',
    choosePlan: 'Choisir',
    requestEyebrow: 'Commencer',
    requestTitle: 'Configurons votre établissement.',
    requestBody:
      'Parlez-nous de votre établissement, et nous configurons votre compte, votre QR code et votre page — généralement en moins d\u2019une journée.',
  },
} as const;
