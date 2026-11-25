import { CategoryItem, Product } from '../types';

export const CORE_CATEGORIES: CategoryItem[] = [
  {
    id: 'sg-deras',
    name: 'SG Deras',
    description: 'Flowing coastal silk, chiffon, and embroidered Swahili deras for everyday grace and special occasions.',
    image: '/src/assets/images/product_dera_crimson_1795635218722.jpg',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'sg-kids-coset',
    name: 'SG Kids Coset',
    description: 'Tailored two-piece cotton and linen co-ord sets designed for comfort, play, and weekend style.',
    image: '/src/assets/images/product_kids_coset_boys_1795635220002.jpg',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'mutumba-bales',
    name: 'Mutumba Bales',
    description: 'Grade-A sorted wholesale mitumba bales packed for Kenyan boutiques and resellers.',
    image: '/src/assets/images/product_mutumba_bale_sealed_1795635221998.jpg',
    sortOrder: 3,
    active: true,
  },
];

export const STARTER_PRODUCTS: Product[] = [
  {
    id: 'sg-dera-royal-crimson',
    name: 'Mombasa Royal Crimson Silk Dera',
    category: 'SG Deras',
    description:
      'Breathable heavyweight coastal silk dera finished with warm gold geometric neckline embroidery and matching headwrap. Drapes effortlessly for weddings, Eid, and warm Nairobi afternoons.',
    price: 2400,
    salePrice: 1850,
    stock: 18,
    images: [
      '/src/assets/images/product_dera_crimson_1795635218722.jpg',
      '/src/assets/images/hero_sg_collections_1795635219118.jpg',
    ],
    variants: ['Free Size', 'Tall Length', 'Petite Length'],
    isNewArrival: true,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'sg-dera-emerald-chiffon',
    name: 'Zanzibar Emerald Floral Chiffon Dera',
    category: 'SG Deras',
    description:
      'Airy tiered chiffon dera featuring botanical amber motifs, soft elastic cuffs, and a flattering waist tie. Cool, lightweight, and opaque enough for effortless all-day wear.',
    price: 2800,
    salePrice: 2200,
    stock: 14,
    images: [
      '/src/assets/images/product_dera_emerald_1795635219395.jpg',
    ],
    variants: ['Free Size', 'Plus Fit'],
    isNewArrival: true,
    isBestSeller: false,
    active: true,
  },
  {
    id: 'sg-dera-lamu-gold',
    name: 'Lamu Heritage Gold Occasion Dera',
    category: 'SG Deras',
    description:
      'Rich crimson jacquard-weave occasion dera woven with metallic gold medallions along the bodice and hem. Tailored for standout family celebrations and formal gatherings.',
    price: 3400,
    salePrice: 0,
    stock: 9,
    images: [
      '/src/assets/images/hero_sg_collections_1795635219118.jpg',
      '/src/assets/images/product_dera_crimson_1795635218722.jpg',
    ],
    variants: ['Free Size', 'Custom Hem'],
    isNewArrival: false,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'sg-kids-safari-coset',
    name: 'Junior Safari Mustard & Charcoal Coset',
    category: 'SG Kids Coset',
    description:
      'Two-piece combed cotton shirt and chino shorts set built for active kids. Pre-washed for softness with reinforced stitching and breathable warm-weather tailoring.',
    price: 1950,
    salePrice: 1550,
    stock: 22,
    images: [
      '/src/assets/images/product_kids_coset_boys_1795635220002.jpg',
    ],
    variants: ['2-3 Yrs', '4-5 Yrs', '6-7 Yrs', '8-9 Yrs'],
    isNewArrival: true,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'sg-kids-coral-coset',
    name: 'Nairobi Chic Coral Pleated Girls Coset',
    category: 'SG Kids Coset',
    description:
      'Soft linen-cotton pleated flutter top paired with belted wide-leg trousers. Easy to dress up for birthdays, church, or weekend family outings.',
    price: 2150,
    salePrice: 1680,
    stock: 16,
    images: [
      '/src/assets/images/product_kids_coset_girls_1795635220786.jpg',
    ],
    variants: ['3-4 Yrs', '5-6 Yrs', '7-8 Yrs', '9-10 Yrs'],
    isNewArrival: true,
    isBestSeller: false,
    active: true,
  },
  {
    id: 'sg-kids-everyday-duo',
    name: 'SG Kids Cotton Play & Weekend Duo',
    category: 'SG Kids Coset',
    description:
      'Crisp everyday cotton two-piece set with easy button closures and durable wash-friendly fabric. Ideal for school breaks and travel.',
    price: 1750,
    salePrice: 0,
    stock: 11,
    images: [
      '/src/assets/images/product_kids_coset_boys_1795635220002.jpg',
      '/src/assets/images/product_kids_coset_girls_1795635220786.jpg',
    ],
    variants: ['2-3 Yrs', '4-5 Yrs', '6-7 Yrs'],
    isNewArrival: false,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'mutumba-bale-ladies-grade-a',
    name: 'Grade-A Ladies Boutique Mixed Bale (100kg)',
    category: 'Mutumba Bales',
    description:
      'Factory-sealed Grade-A UK & European export bale containing assorted ladies chiffon dresses, blouses, and light jackets. High camera-ready piece yield for boutique resellers.',
    price: 36500,
    salePrice: 32900,
    stock: 6,
    images: [
      '/src/assets/images/product_mutumba_bale_sealed_1795635221998.jpg',
      '/src/assets/images/product_mutumba_sorted_open_1795635222020.jpg',
    ],
    variants: ['100kg Full Bale', '50kg Half Bale'],
    isNewArrival: false,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'mutumba-bale-sorted-dresses',
    name: 'Sorted Chiffon & Denim Boutique Bale',
    category: 'Mutumba Bales',
    description:
      'Curated Grade-A wholesale bale mixing floral summer dresses, structured denim jackets, and crisp cotton tops. Ideal for Gikomba, Toi Market, and online Instagram boutiques.',
    price: 29500,
    salePrice: 26500,
    stock: 8,
    images: [
      '/src/assets/images/product_mutumba_sorted_open_1795635222020.jpg',
      '/src/assets/images/product_mutumba_bale_sealed_1795635221998.jpg',
    ],
    variants: ['45kg Bale', '90kg Bale'],
    isNewArrival: true,
    isBestSeller: true,
    active: true,
  },
  {
    id: 'mutumba-bale-kids-sorted',
    name: 'Grade-A Kids Mixed Tops & Sets Bale (45kg)',
    category: 'Mutumba Bales',
    description:
      'Cleanly graded children wear bale packed with everyday cotton tees, shorts, and light sweaters across toddler to pre-teen sizes.',
    price: 21500,
    salePrice: 0,
    stock: 5,
    images: [
      '/src/assets/images/product_mutumba_bale_sealed_1795635221998.jpg',
    ],
    variants: ['45kg Bale', '80kg Bale'],
    isNewArrival: true,
    isBestSeller: false,
    active: true,
  },
];
