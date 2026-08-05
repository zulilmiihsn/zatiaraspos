const fs = require('fs');

const files = [
  'src/routes/pos/bayar/+page.svelte',
  'src/routes/pengaturan/riwayat/+page.svelte',
  'src/routes/pengaturan/pemilik/riwayat/+page.svelte',
  'src/routes/pengaturan/kasir/riwayat/+page.svelte'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Add width: 384px; (standard 58mm printer dot width) to the body to force full width regardless of font size
  content = content.replace(/<body style='font-family:monospace;color:#000;font-size:24px;line-height:1.5;margin:0;padding:0;'>/g, 
                            "<body style='width:384px;font-family:monospace;color:#000;font-size:24px;line-height:1.5;margin:0;padding:0;'>");
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
