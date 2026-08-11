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
    name: 'Table stand',
    description: 'A small freestanding card with your QR code, for every table or the bar top.',
    price: '4€',
    unit: 'per unit',
    allowsCustomText: true,
  },
  {
    id: 'window-sticker',
    name: 'Window sticker',
    description: 'A weatherproof sticker for your entrance or front window.',
    price: '12€',
    unit: 'per unit',
    allowsCustomText: false,
  },
  {
    id: 'poster-a4',
    name: 'Poster (A4)',
    description: 'A printed poster for your lobby, restroom, or reception wall.',
    price: '9€',
    unit: 'per unit',
    allowsCustomText: true,
  },
  {
    id: 'room-card',
    name: 'Room key card insert',
    description: 'A slim card sized to slip into hotel room key card holders.',
    price: '3€',
    unit: 'per unit',
    allowsCustomText: true,
  },
];
