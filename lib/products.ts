export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  allowsCustomText: boolean;
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'table-stand',
    name: 'Chevalet de table',
    description: 'Une petite carte autoportante avec votre QR code, pour chaque table ou le bar.',
    price: '4€',
    unit: 'par unité',
    allowsCustomText: true,
  },
  {
    id: 'window-sticker',
    name: 'Sticker vitrine',
    description: 'Un sticker résistant aux intempéries pour votre entrée ou votre vitrine.',
    price: '12€',
    unit: 'par unité',
    allowsCustomText: false,
  },
  {
    id: 'poster-a4',
    name: 'Affiche (A4)',
    description: 'Une affiche imprimée pour votre hall, vos toilettes, ou le mur de la réception.',
    price: '9€',
    unit: 'par unité',
    allowsCustomText: true,
  },
  {
    id: 'room-card',
    name: 'Insert carte de chambre',
    description: 'Une carte fine à glisser dans les porte-clés de chambre d\u2019hôtel.',
    price: '3€',
    unit: 'par unité',
    allowsCustomText: true,
  },
];
