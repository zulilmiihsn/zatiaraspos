const fs = require('fs');
const path = require('path');

const nodesDir = path.join(__dirname, '.svelte-kit', 'generated', 'client', 'nodes');
const manifestPath = path.join(nodesDir, 'manifest.json');

fs.readdir(nodesDir, (err, files) => {
  if (err) {
    console.error('Gagal membaca folder nodes:', err);
    process.exit(1);
  }
  // Filter hanya file .js
  const jsFiles = files.filter(f => f.endsWith('.js')).map(f => '/.svelte-kit/generated/client/nodes/' + f);
  fs.writeFileSync(manifestPath, JSON.stringify(jsFiles, null, 2));
  console.log('manifest.json berhasil dibuat di', manifestPath);
});