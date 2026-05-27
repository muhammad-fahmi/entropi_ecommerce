'use client';
import React from 'react';
import { AppBar, Toolbar, Typography, InputBase, BottomNavigation, BottomNavigationAction, Paper, Box, Badge } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

export function TopAppBar() {
  return (
    <AppBar position="sticky" sx={{ background: 'rgba(18, 18, 18, 0.8)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 'bold', color: 'primary.main' }}
        >
          Entropi
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search products…"
            inputProps={{ 'aria-label': 'search' }}
          />
        </Search>
      </Toolbar>
    </AppBar>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { cartTotalCount } = useCart();

  let value = 0;
  if (pathname.startsWith('/checkout')) value = 1;
  else if (pathname.startsWith('/ledger')) value = 2;

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        sx={{ background: 'rgba(30, 30, 30, 0.9)' }}
      >
        <BottomNavigationAction component={Link} href="/" label="Shop" icon={<StorefrontIcon />} />
        <BottomNavigationAction 
          component={Link} 
          href="/checkout" 
          label="Checkout" 
          icon={
            <Badge badgeContent={cartTotalCount} color="error">
              <ShoppingCartIcon />
            </Badge>
          } 
        />
        <BottomNavigationAction component={Link} href="/ledger" label="Ledger" icon={<AccountBalanceWalletIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
