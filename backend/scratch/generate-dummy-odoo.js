import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generateDummy() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Odoo Inventory');

  // Define Columns
  worksheet.columns = [
    { header: 'Location', key: 'location', width: 25 },
    { header: 'Product', key: 'product', width: 40 },
    { header: 'Lot/Serial Number', key: 'lot', width: 20 },
    { header: 'Inventoried Qty', key: 'invQty', width: 15 },
    { header: 'Reserved Qty', key: 'resQty', width: 15 },
    { header: 'Unit of Measure', key: 'uom', width: 10 }
  ];

  // Add Dummy Data
  const data = [
    { location: 'WH/STOCK/ROW-A1', product: '[SKU-1001] Baut Baja M10 x 30', lot: 'LOT-2024-001', invQty: 500, resQty: 50, uom: 'pcs' },
    { location: 'WH/STOCK/ROW-A1', product: '[SKU-1002] Mur Baja M10', lot: 'LOT-2024-002', invQty: 1000, resQty: 0, uom: 'pcs' },
    { location: 'WH/STOCK/ROW-B2', product: '[SKU-2005] Pipa PVC 2 inch White', lot: null, invQty: 45, resQty: 5, uom: 'm' },
    { location: 'WH/STOCK/ROW-C3', product: '[SKU-5099] Kabel NYM 3x2.5mm', lot: 'SN-X990021', invQty: 10, resQty: 2, uom: 'roll' },
    { location: 'WH/STOCK/D-OFFICE', product: '[TISSUE-01] Tissue Paseo 250s', lot: null, invQty: 100, resQty: 0, uom: 'pack' },
  ];

  data.forEach(item => worksheet.addRow(item));

  // Style Header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const filePath = path.join(process.cwd(), 'odoo_test_import.xlsx');
  await workbook.xlsx.writeFile(filePath);

  console.log(`\n✅ Dummy Excel file created: ${filePath}`);
  console.log(`🚀 Ready to use for testing import on the Inventory page.\n`);
}

generateDummy().catch(err => console.error('❌ Error generating dummy file:', err));
