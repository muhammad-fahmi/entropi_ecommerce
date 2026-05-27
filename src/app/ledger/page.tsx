'use client';
import { Container, Typography, Paper, Chip, Box, Button, TextField, MenuItem, Select, FormControl, InputLabel, Grid, Card, Divider } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

import React, { useEffect, useState } from 'react';

interface LedgerRow {
  id: string;
  orderId: string;
  account: string;
  debit: string | number | null;
  credit: string | number | null;
  timestamp: string;
}

interface GroupedTransaction {
  orderId: string;
  timestamp: string;
  entries: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
}

export default function LedgerView() {
  const [ledgerData, setLedgerData] = useState<LedgerRow[]>([]);
  
  useEffect(() => {
    fetch('http://localhost:3001/api/ledger')
      .then(r => r.json())
      .then(data => {
        if (data.ledgers) setLedgerData(data.ledgers);
      })
      .catch(console.error);
  }, []);

  const groupedTransactions = ledgerData.reduce<Record<string, GroupedTransaction>>((acc, row) => {
    const key = `${row.orderId}_${row.timestamp}`;
    if (!acc[key]) {
      acc[key] = {
        orderId: row.orderId,
        timestamp: row.timestamp,
        entries: [],
        totalDebit: 0,
        totalCredit: 0
      };
    }
    acc[key].entries.push(row);
    if (row.debit) acc[key].totalDebit += Number(row.debit);
    if (row.credit) acc[key].totalCredit += Number(row.credit);
    return acc;
  }, {});

  const transactions = Object.values(groupedTransactions).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleExport = () => {
    const headers = ['Transaction ID', 'Timestamp', 'Type', 'Amount (USD)', 'Status'];
    const rows = ledgerData.map(row => {
      const amount = row.debit ? `-${Number(row.debit).toFixed(2)}` : `+${Number(row.credit).toFixed(2)}`;
      return [
        row.orderId,
        `"${new Date(row.timestamp).toLocaleString()}"`, // Wrap in quotes to handle commas in dates
        row.account,
        amount,
        'Success'
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ledger_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Ledger Audit Trail
        </Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
          Export to Excel
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <TextField label="Search Transaction ID" variant="outlined" size="small" sx={{ minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select label="Type" defaultValue="">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Payment">Payment</MenuItem>
              <MenuItem value="Fee">Fee</MenuItem>
              <MenuItem value="Refund">Refund</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" defaultValue="">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Success">Success</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
            </Select>
          </FormControl>
          <TextField type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} size="small" />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {transactions.map((tx: GroupedTransaction) => (
            <Card key={`${tx.orderId}_${tx.timestamp}`} variant="outlined" sx={{ borderRadius: 3, overflow: 'visible' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Transaction ID</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{tx.orderId}</Typography>
                </Box>
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">{new Date(tx.timestamp).toLocaleString()}</Typography>
                </Box>
              </Box>
              
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Account</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Debit (DR)</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Credit (CR)</Typography>
                  </Grid>
                </Grid>
                
                <Divider sx={{ mb: 1, display: { xs: 'none', sm: 'block' } }} />
                
                {tx.entries.map((entry: LedgerRow) => (
                  <Grid container spacing={2} key={entry.id} sx={{ py: 1, borderBottom: { xs: '1px solid', sm: 'none' }, borderColor: 'divider', alignItems: 'center' }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                       <Chip label={entry.account} size="small" variant="outlined" />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>Debit (DR)</Typography>
                      <Typography sx={{ fontWeight: entry.debit ? 'bold' : 'normal' }}>
                        {entry.debit ? `$${Number(entry.debit).toFixed(2)}` : '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>Credit (CR)</Typography>
                      <Typography sx={{ fontWeight: entry.credit ? 'bold' : 'normal' }}>
                        {entry.credit ? `$${Number(entry.credit).toFixed(2)}` : '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                ))}
              </Box>
              
              <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Totals</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 'bold' }}>${tx.totalDebit.toFixed(2)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }} sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 'bold' }}>${tx.totalCredit.toFixed(2)}</Typography>
                  </Grid>
                </Grid>
                {Math.abs(tx.totalDebit - tx.totalCredit) < 0.01 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 1 }}>
                    <Chip label="Balanced" size="small" color="success" />
                  </Box>
                )}
              </Box>
            </Card>
          ))}
        </Box>
      </Paper>
    </Container>
  );
}
