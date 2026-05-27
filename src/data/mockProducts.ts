export interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  rating: number;
  reviews: number;
}

export const mockProducts: Product[] = [
  { 
    id: '1', 
    title: 'Premium Wireless Headphones', 
    price: 299.99, 
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    description: 'Experience pure sound with these premium wireless headphones. Features active noise cancellation, 30-hour battery life, and plush memory foam ear cushions for all-day comfort. Perfect for audiophiles and commuters alike.',
    rating: 4.5,
    reviews: 128
  },
  { 
    id: '2', 
    title: 'Mechanical Keyboard', 
    price: 149.50, 
    image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80',
    description: 'Enhance your typing speed and accuracy with this mechanical keyboard. Features customizable RGB backlighting and tactile switches for an optimal typing experience.',
    rating: 4.8,
    reviews: 245
  },
  { 
    id: '3', 
    title: 'Ergonomic Mouse', 
    price: 79.99, 
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    description: 'Reduce wrist strain with this state-of-the-art ergonomic mouse. Features precision tracking and programmable buttons to boost productivity.',
    rating: 4.3,
    reviews: 94
  },
  { 
    id: '4', 
    title: '4K Monitor', 
    price: 499.00, 
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
    description: 'Immerse yourself in stunning details with this 4K UHD monitor. Exceptional color accuracy and wide viewing angles make it perfect for creative professionals.',
    rating: 4.9,
    reviews: 312
  },
];
