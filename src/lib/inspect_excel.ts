
import XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(process.cwd(), 'بيانات الزبائن.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON to see headers and data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // header: 1 gives array of arrays

    console.log("Sheet Name:", sheetName);
    console.log("First 5 rows:", JSON.stringify(data.slice(0, 5), null, 2));

} catch (error) {
    console.error("Error reading Excel:", error);
}
