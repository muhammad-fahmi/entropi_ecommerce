'use client';
import { Grid, Card, CardMedia, CardContent, Typography, Button, Container } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useRouter } from 'next/navigation';
import { mockProducts } from '../data/mockProducts';
import { useCart } from '../context/CartContext';

export default function ProductList() {
  const router = useRouter();
  const { addToCart } = useCart();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
        Featured Products
      </Typography>
      <Grid container spacing={3}>
        {mockProducts.map((product) => (
          <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
            >
              <CardMedia
                component="img"
                height="200"
                image={product.image}
                alt={product.title}
                sx={{ cursor: 'pointer' }}
                onClick={() => router.push(`/products/${product.id}`)}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="h2" noWrap title={product.title}>
                  {product.title}
                </Typography>
                <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold', mb: 2 }}>
                  ${product.price.toFixed(2)}
                </Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth 
                  startIcon={<ShoppingCartIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
                >
                  Add to Cart
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
