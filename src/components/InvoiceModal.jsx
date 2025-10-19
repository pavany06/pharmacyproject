// src/components/InvoiceModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Divider,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'; // Your app's icon

export default function InvoiceModal({ open, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to get total quantity/units
  const totalUnits = saleItems.reduce((sum, item) => sum + item.quantity, 0);

  const fetchSaleData = useCallback(async () => {
    setLoading(true);

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('*') // Selects all columns
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !saleData) {
      alert('Error loading sale data');
      onClose();
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError) {
      alert('Error loading sale items');
      onClose();
      return;
    }

    setSale(saleData);
    setSaleItems(itemsData || []);
    setLoading(false);
  }, [saleId, onClose]);

  useEffect(() => {
    if (saleId) {
      fetchSaleData();
    }
  }, [saleId, fetchSaleData]);

  const handlePrint = () => {
    window.print();
  };

  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      #invoice-content, #invoice-content * {
        visibility: visible;
      }
      #invoice-content {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 20px;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
      /* Ensure table borders print */
      table, th, td {
        border-color: #000 !important;
        color: #000 !important;
      }
      /* Hide dialog paper shadow/border */
      .MuiDialog-paper {
        box-shadow: none !important;
        border: none !important;
      }
    }
  `;

  const formatDate = (dateString, options = {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date)) return '-';
        return date.toLocaleDateString('en-IN', options);
    } catch (e) { return '-' }
  };

  const formatExpiry = (dateString) => {
     if (!dateString) return '-';
      try {
          const date = new Date(dateString);
          if (isNaN(date)) return '-';
          return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
      } catch (e) { return '-' }
  };


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <style>{printStyles}</style>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <Typography variant="h5">Invoice: {sale?.bill_number}</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ mr: 2 }}
          >
            Print
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
            <CircularProgress />
          </Box>
        ) : !sale ? (
           <Typography>Sale data not found.</Typography>
        ) : (
          <Box id="invoice-content" sx={{ p: { xs: 1, md: 3 }, fontFamily: 'monospace', color: '#000' }}>

            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <MedicalServicesIcon color="primary" sx={{ fontSize: 40, mb: 1, display: 'block', margin: 'auto' }} />
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                Srisai Pharmacy
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                123, Gandhi Road, Chennai - 600001
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                Phone: 044-2345789
              </Typography>
               <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                DL No: 86-20-AF/06/04/2017-1411A1 | GST: NOT-APPLIED
              </Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            {/* Bill Info - Removed Doctor Line */}
            <Grid container spacing={1} sx={{ fontSize: '0.9rem', mb: 1 }}>
                <Grid item xs={8}>
                    {/* Display Party/Customer info even if default */}
                    <Typography variant="body2"><strong>Party:</strong> {sale.customer_name} ({sale.customer_phone})</Typography>
                    {/* <Typography variant="body2"><strong>Doctor:</strong> {sale.doctor_name || 'N/A'}</Typography> */} {/* <-- REMOVED THIS LINE */}
                </Grid>
                 <Grid item xs={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2"><strong>Inv No:</strong> {sale.bill_number}</Typography>
                    <Typography variant="body2"><strong>Inv Date:</strong> {formatDate(sale.sale_date)}</Typography>
                    <Typography variant="body2"><strong>Bill Type:</strong> Cash</Typography>
                </Grid>
            </Grid>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />


            {/* Items Table (No changes needed here from previous version) */}
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid #000' }}>
                <TableHead sx={{ borderBottom: '1px solid #000' }}>
                  <TableRow>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold' }}>Mfg</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold' }}>Product Name</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold' }}>Sch</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold' }}>Batch</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold' }}>Exp</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold', textAlign: 'right' }}>Qty</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold', textAlign: 'right' }}>Rate</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold', textAlign: 'right' }}>Amount</TableCell>
                    <TableCell sx={{ p: 0.5, border: '1px solid #000', fontWeight: 'bold', textAlign: 'right' }}>MRP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saleItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000' }}>-</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000' }}>{item.product_name}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000' }}>-</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000' }}>{item.batch_no}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000' }}>{formatExpiry(item.expiry_date)}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000', textAlign: 'right' }}>{item.quantity}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000', textAlign: 'right' }}>{item.mrp?.toFixed(2)}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000', textAlign: 'right' }}>{item.subtotal?.toFixed(2)}</TableCell>
                      <TableCell sx={{ p: 0.5, border: '1px solid #000', textAlign: 'right' }}>{item.mrp?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />


            {/* Footer Totals (No changes needed here) */}
            <Grid container spacing={1} sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                <Grid item xs={6}>
                    <Typography variant="body2">Items: {saleItems.length}</Typography>
                    <Typography variant="body2">Units: {totalUnits}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>*PLEASE GET YOUR MEDICINES CHECKED BY YOUR DOCTOR BEFORE USE*</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2">Disc: 0.00</Typography>
                    <Typography variant="body2">Save Amt: 0.00</Typography>
                     <Typography variant="body2" sx={{ mt: 0.5 }}>GrossAmt: {sale.grand_total?.toFixed(2)}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5 }}>NetAmt: {sale.grand_total?.toFixed(2)}</Typography>
                </Grid>
            </Grid>

            <Divider sx={{ my: 1, borderColor: '#000' }} />


            {/* Footer (No changes needed here) */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    Each item Subject to V/J/Tax/Disc/Distriibution only.<br/>
                    Once Goods sold will not be taken back or exchanged.
                </Typography>
                 <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                    For Srisai Pharmacy<br/><br/>
                    (Signature)
                </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}