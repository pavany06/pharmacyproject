// src/components/InvoiceModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton as MuiIconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';

// --- Calculation Helper ---
const calculateItemAmounts = (mrp, gst, discount, quantity) => {
  const mrpNum = parseFloat(mrp) || 0;
  const gstNum = parseFloat(gst) || 0;
  const discountNum = parseFloat(discount) || 0;
  const qtyNum = parseInt(quantity, 10) || 0;

  if (mrpNum <= 0 || qtyNum <= 0) {
    return { subtotal: 0, gstAmount: 0, discountAmount: 0 };
  }

  const gstAmountTotal = (mrpNum * gstNum / 100) * qtyNum;
  const discountAmountTotal = (mrpNum * discountNum / 100) * qtyNum;

  const priceBeforeDiscount = mrpNum + (mrpNum * gstNum / 100);
  const finalPricePerItem = priceBeforeDiscount - (mrpNum * discountNum / 100);
  const subtotal = Math.max(0, finalPricePerItem * qtyNum);

  return {
    subtotal,
    gstAmount: gstAmountTotal,
    discountAmount: discountAmountTotal,
  };
};
// -----------------------

export default function InvoiceModal({ open, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medicineDetails, setMedicineDetails] = useState({});

  const fetchSaleData = useCallback(async () => {
    setLoading(true);
    setMedicineDetails({});

    // Fetch Sale Info
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !saleData) {
      alert('Error loading sale data');
      onClose?.();
      setLoading(false);
      return;
    }

    // Fetch Sale Items
    const { data: itemsData, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError || !itemsData) {
      alert('Error loading sale items');
      onClose?.();
      setLoading(false);
      return;
    }

    setSale(saleData);
    setSaleItems(itemsData);

    // Fetch medicine details for those items
    const medicineIds = [...new Set(itemsData.map(item => item.medicine_id).filter(Boolean))];
    if (medicineIds.length > 0) {
      const { data: medDetails, error: medError } = await supabase
        .from('medicines')
        .select('id, gst, discount')
        .in('id', medicineIds);

      if (medError) console.error('Error fetching medicine details:', medError);
      else {
        const detailsMap = medDetails.reduce((acc, med) => {
          acc[med.id] = { gst: med.gst ?? 0, discount: med.discount ?? 0 };
          return acc;
        }, {});
        setMedicineDetails(detailsMap);
      }
    }

    setLoading(false);
  }, [saleId, onClose]);

  useEffect(() => {
    if (saleId) fetchSaleData();
  }, [saleId, fetchSaleData]);

  const handlePrint = () => window.print();

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #invoice-content, #invoice-content * { visibility: visible; }
      #invoice-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; margin: 0; }
      .no-print { display: none !important; }
      table, th, td { border-color: #000 !important; color: #000 !important; }
      .MuiDialog-paper { box-shadow: none !important; border: none !important; }
    }
  `;

  const formatDate = (dateString, options = { year: '2-digit', month: '2-digit', day: '2-digit' }) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return '-';
      return date.toLocaleDateString('en-IN', options);
    } catch {
      return '-';
    }
  };

  const formatExpiry = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return '-';
      return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    } catch {
      return '-';
    }
  };

  // Calculate total discount
  const totalDiscount = saleItems.reduce((sum, item) => {
    const details = medicineDetails[item.medicine_id];
    if (!details) return sum;
    const discountAmt = (parseFloat(item.mrp || 0) * parseFloat(details.discount || 0) / 100) * parseInt(item.quantity || 0, 10);
    return sum + discountAmt;
  }, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <style>{printStyles}</style>

      {/* Header */}
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        className="no-print"
      >
        <Typography variant="h5">Invoice: {sale?.bill_number}</Typography>
        <Box>
          <MuiButton variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ mr: 2 }}>
            Print
          </MuiButton>
          <MuiIconButton onClick={onClose}>
            <CloseIcon />
          </MuiIconButton>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
            <CircularProgress />
          </Box>
        ) : !sale ? (
          <Typography>Sale data not found.</Typography>
        ) : (
          <Box id="invoice-content" sx={{ p: { xs: 1, md: 3 }, fontFamily: 'monospace', color: '#000' }}>
            
            {/* Pharmacy Header */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>Sri Sai Pharmacy</Typography>
              <Typography variant="body2">High School Road bus stop, Patamata</Typography>
              <Typography variant="body2">Vijayawada-10</Typography>
              <Typography variant="body2">Phone: +91 99634 03097</Typography>
              <Typography variant="body2">D.L. No: 141268, 141269 | GST: APPLIED</Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            {/* Bill Info - Only Phone */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', mb: 1 }}>
              <Box>
                <Typography variant="body2">
                  <strong>Customer Phone:</strong>{' '}
                  {sale.customer_phone && sale.customer_phone !== '-' ? sale.customer_phone : 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2"><strong>Inv No:</strong> {sale.bill_number}</Typography>
                <Typography variant="body2"><strong>Inv Date:</strong> {formatDate(sale.sale_date)}</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />

            {/* Items Table */}
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid #000' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000' }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000' }}>Batch</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000' }}>Exp</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', textAlign: 'right' }}>Qty</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', textAlign: 'right' }}>MRP</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', textAlign: 'right' }}>GST</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', textAlign: 'right' }}>Disc</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #000', textAlign: 'right' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saleItems.map((item, i) => {
                    const details = medicineDetails[item.medicine_id] || { gst: 0, discount: 0 };
                    const amounts = calculateItemAmounts(item.mrp, details.gst, details.discount, item.quantity);
                    return (
                      <TableRow key={i}>
                        <TableCell sx={{ border: '1px solid #000' }}>{item.product_name}</TableCell>
                        <TableCell sx={{ border: '1px solid #000' }}>{item.batch_no}</TableCell>
                        <TableCell sx={{ border: '1px solid #000' }}>{formatExpiry(item.expiry_date)}</TableCell>
                        <TableCell sx={{ border: '1px solid #000', textAlign: 'right' }}>{item.quantity}</TableCell>
                        <TableCell sx={{ border: '1px solid #000', textAlign: 'right' }}>{item.mrp?.toFixed(2)}</TableCell>
                        <TableCell sx={{ border: '1px solid #000', textAlign: 'right' }}>{amounts.gstAmount.toFixed(2)}</TableCell>
                        <TableCell sx={{ border: '1px solid #000', textAlign: 'right' }}>{amounts.discountAmount.toFixed(2)}</TableCell>
                        <TableCell sx={{ border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>{amounts.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />

            {/* Totals */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <Box>
                <Typography variant="body2">Items: {saleItems.length}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>*PLEASE CHECK YOUR MEDICINES BEFORE USE*</Typography>
              </Box>
              <Box sx={{ textAlign: 'right', p: 2, backgroundColor: 'primary.main', color: 'white', minWidth: 300 }}>
                <Typography variant="body2">Amount Saved: ₹{totalDiscount.toFixed(2)}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                  Total Amount: ₹{sale.grand_total?.toFixed(2)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            {/* Footer */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                Each item subject to V/J/Tax/Disc/Distribution only.
                <br />
                Once goods sold will not be taken back or exchanged.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                For Sri Sai Pharmacy<br /><br />
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
