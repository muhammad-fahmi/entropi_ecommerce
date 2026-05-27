'use client';
import React, { useState } from 'react';
import { Container, Typography, Box, Paper, Grid, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useCart } from '../../context/CartContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://entropiecommerce-production.up.railway.app';

export default function Checkout() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { cart, clearCart } = useCart();

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const fee = subtotal * 0.03;
  const total = subtotal + fee;

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    if (!loading) setOpen(false);
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const orderId = 'ord_' + Math.random().toString(36).substring(2, 10);
      const idempotencyKeyCreate = crypto.randomUUID();
      const idempotencyKeyPay = crypto.randomUUID();

      const createRes = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, amount: total.toFixed(2), idempotencyKey: idempotencyKeyCreate })
      });
      if (!createRes.ok) throw new Error('Order creation failed');

      const payRes = await fetch(`${API_BASE_URL}/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total.toFixed(2), idempotencyKey: idempotencyKeyPay, stripeId: 'mock' })
      });
      
      if (!payRes.ok) {
        const errData = await payRes.json();
        throw new Error(errData.error || 'Payment failed');
      }

      setSuccess(true);
      clearCart();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(e);
      alert('Payment Error: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
        Checkout
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>Billing Information</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="First Name" variant="outlined" margin="normal" defaultValue="John" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Last Name" variant="outlined" margin="normal" defaultValue="Doe" />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="Email Address" variant="outlined" margin="normal" defaultValue="john.doe@example.com" />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="Shipping Address" variant="outlined" margin="normal" defaultValue="123 Main St, Springfield" />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom>Order Summary</Typography>
            <Box sx={{ my: 2 }}>
              {cart.length === 0 ? (
                <Typography color="text.secondary">Your cart is empty.</Typography>
              ) : (
                cart.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>{item.product.title} (x{item.quantity})</Typography>
                    <Typography>${(item.product.price * item.quantity).toFixed(2)}</Typography>
                  </Box>
                ))
              )}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Subtotal</Typography>
              <Typography>${subtotal.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Platform Fee (3%)</Typography>
              <Typography>${fee.toFixed(2)}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Total</Typography>
              <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>${total.toFixed(2)}</Typography>
            </Box>
            <Button 
              variant="contained" 
              color="primary" 
              fullWidth 
              size="large"
              onClick={handleOpen}
              disabled={cart.length === 0}
              sx={{ py: 1.5, borderRadius: 2 }}
            >
              Proceed to Payment
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Stripe Mock Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
          {success ? 'Payment Successful' : 'Complete Payment'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          {success ? (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h6">Your order has been placed!</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>Transaction ID: tx_{Math.random().toString(36).substring(2, 10)}</Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                This is a simulated payment environment.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2">Amount to pay</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>${total.toFixed(2)}</Typography>
              </Paper>
              <TextField fullWidth label="Card Number" defaultValue="4242 4242 4242 4242" margin="normal" />
              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField fullWidth label="MM/YY" defaultValue="12/26" margin="normal" />
                </Grid>
                <Grid size={6}>
                  <TextField fullWidth label="CVC" defaultValue="123" margin="normal" />
                </Grid>
              </Grid>
              <TextField fullWidth label="Name on Card" defaultValue="John Doe" margin="normal" />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center' }}>
          {!success ? (
            <>
              <Button onClick={handleClose} disabled={loading} color="inherit">Cancel</Button>
              <Button 
                onClick={handlePayment} 
                variant="contained" 
                disabled={loading}
                sx={{ minWidth: 150 }}
              >
                {loading ? <CircularProgress size={24} /> : `Pay $${total.toFixed(2)}`}
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpen(false)} variant="contained" fullWidth>
              Return to Store
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
