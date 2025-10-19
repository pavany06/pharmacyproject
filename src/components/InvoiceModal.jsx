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
  // Grid, // <-- FIX: Removed unused 'Grid' import
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

export default function InvoiceModal({ open, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSaleData = useCallback(async () => {
    setLoading(true);

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('*')
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
      }
      .no-print {
        display: none !important;
      }
    }
  `;
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-IN');
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <style>{printStyles}</style>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <Typography variant="h5">Invoice</Typography>
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
          <Box id="invoice-content" sx={{ p: { xs: 2, md: 6 } }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <MedicalServicesIcon color="primary" sx={{ fontSize: 60 }} />
              <Typography variant="h3" component="h1" color="primary" sx={{ fontWeight: 'bold' }}>
                PharmaStock
              </Typography>
              <Typography color="text.secondary">
                Professional Pharmacy Management
              </Typography>
            </Box>

            {/* Invoice Details Only */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
              <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="overline" color="text.secondary">Invoice Details</Typography>
                  <Typography><Box component="span" sx={{ fontWeight: 'bold' }}>Bill Number:</Box> {sale.bill_number}</Typography>
                  <Typography><Box component="span" sx={{ fontWeight: 'bold' }}>Date:</Box> {formatDate(sale.sale_date)}</Typography>
                  <Typography><Box component="span" sx={{ fontWeight: 'bold' }}>Time:</Box> {formatTime(sale.sale_date)}</Typography>
              </Box>
            </Box>

            {/* Items Table */}
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Batch No</TableCell>
                    <TableCell>Expiry Date</TableCell>
                    <TableCell align="right">MRP</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saleItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.batch_no}</TableCell>
                      <TableCell>{formatDate(item.expiry_date)}</TableCell>
                      <TableCell align="right">₹{item.mrp.toFixed(2)}</TableCell>
                      <TableCell align="center">{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ₹{item.subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Grand Total */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
              <Paper sx={{ p: 2, backgroundColor: 'primary.main', color: 'white', minWidth: 300 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Grand Total</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    ₹{sale.grand_total.toFixed(2)}
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {/* Footer */}
            <Box sx={{ textAlign: 'center', pt: 3, borderTop: '1px solid #eee' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                Thank you for your business!
              </Typography>
              <Typography variant="caption" color="text.secondary">
                This is a computer-generated invoice and does not require a signature.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}