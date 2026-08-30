process.stdout.write('Step 1\n');
const XLSX = require('xlsx');
process.stdout.write('Step 2: xlsx loaded\n');
const wb = XLSX.readFile('D:/AISaerang Life/Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx');
process.stdout.write('Step 3: excel read\n');
const giftRaw = XLSX.utils.sheet_to_json(wb.Sheets['GIFT TEST STATUS'], {defval:'',header:1});
process.stdout.write('Step 4: parsed ' + giftRaw.length + ' rows\n');
process.stdout.write('DONE\n');
