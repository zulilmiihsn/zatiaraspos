const fs = require('fs');

const files = [
  'src/routes/pos/bayar/+page.svelte',
  'src/routes/pengaturan/riwayat/+page.svelte',
  'src/routes/pengaturan/pemilik/riwayat/+page.svelte',
  'src/routes/pengaturan/kasir/riwayat/+page.svelte'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Update font sizes in the HTML template string
  content = content.replace(/font-size:14px;line-height:1.5;margin:0;padding:8px;/g, "font-size:24px;line-height:1.5;margin:0;padding:0;");
  content = content.replace(/font-size:20px;/g, "font-size:28px;");
  content = content.replace(/font-size:13px;/g, "font-size:22px;");
  content = content.replace(/font-size:14px;/g, "font-size:24px;");
  content = content.replace(/font-size:12px;/g, "font-size:20px;");
  content = content.replace(/font-size:16px;/g, "font-size:28px;");
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
