'use client';
import { Box, Container, Grid, Typography, Button, IconButton, Paper, Rating, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mockProducts } from '../../../data/mockProducts';
import { useCart } from '../../../context/CartContext';

export default function ProductDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  // Find product
  const product = mockProducts.find(p => p.id === params.id) || mockProducts[0];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => router.back()}
        sx={{ mb: 3 }}
      >
        Back to Shop
      </Button>
      
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 2, 
              borderRadius: 4, 
              bgcolor: 'background.paper',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <img 
              src={product.image} 
              alt={product.title} 
              style={{ width: '100%', maxWidth: 500, borderRadius: 8, objectFit: 'cover' }} 
            />
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              {product.title}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Rating value={product.rating} precision={0.5} readOnly />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({product.reviews} reviews)
              </Typography>
            </Box>
            
            <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold', mb: 3 }}>
              ${product.price.toFixed(2)}
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', lineHeight: 1.8 }}>
              {product.description}
            </Typography>
            
            <Divider sx={{ mb: 4 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mr: 2, fontWeight: 'bold' }}>
                Quantity:
              </Typography>
              <Paper sx={{ display: 'flex', alignItems: 'center', borderRadius: 2 }}>
                <IconButton onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  <RemoveIcon />
                </IconButton>
                <Typography sx={{ px: 2, fontWeight: 'bold' }}>{quantity}</Typography>
                <IconButton onClick={() => setQuantity(quantity + 1)}>
                  <AddIcon />
                </IconButton>
              </Paper>
            </Box>
            
            <Button 
              variant="contained" 
              color="primary" 
              size="large" 
              startIcon={<ShoppingCartIcon />}
              sx={{ py: 2, fontSize: '1.1rem', borderRadius: 2 }}
              onClick={() => {
                addToCart(product, quantity);
              }}
            >
              Add to Cart - ${(product.price * quantity).toFixed(2)}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
