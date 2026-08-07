const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve('C:/Simulador_TSJE/www');
const DEST_DIR = path.resolve('C:/ARKI/public/simulador_tsje');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

console.log(`Copiando desde ${SRC_DIR} hacia ${DEST_DIR}...`);
copyRecursiveSync(SRC_DIR, DEST_DIR);
console.log('¡Copia completada con éxito!');
