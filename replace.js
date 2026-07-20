const fs = require('fs');
const path = require('path');

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach((file) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const replaceInFile = (file) => {
  try {
      const exts = ['.ts', '.tsx', '.js', '.jsx', '.md', '.html', '.json'];
      if (!exts.includes(path.extname(file))) return;

      const content = fs.readFileSync(file, 'utf8');
      let newContent = content;

      newContent = newContent.replace(/Lista 2P/gi, (match) => {
        if (match === 'LISTA 2P') return 'LISTA 1';
        if (match === 'Lista 2P') return 'Lista 1';
        if (match === 'lista 2p') return 'lista 1';
        return 'Lista 1';
      });

      newContent = newContent.replace(/Opcion 2/gi, (match) => {
        if (match === 'OPCION 2') return 'OPCION 5';
        if (match === 'Opcion 2') return 'Opcion 5';
        if (match === 'opcion 2') return 'opcion 5';
        return 'Opcion 5';
      });

      newContent = newContent.replace(/Opción 2/gi, (match) => {
        if (match === 'OPCIÓN 2') return 'OPCIÓN 5';
        if (match === 'Opción 2') return 'Opción 5';
        if (match === 'opción 2') return 'opción 5';
        return 'Opción 5';
      });

      newContent = newContent.replace(/ARKI 2P/gi, (match) => {
          if (match === 'ARKI 2P') return 'ARKI 1';
          return 'ARKI 1';
      });
      
      newContent = newContent.replace(/lista-2p/gi, (match) => {
          return 'lista-1';
      });

      if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Updated: ${file}`);
      }
  } catch(e) {
      console.log(`Error in ${file}: ${e.message}`);
  }
};

walk('c:\\ARKI\\src', (err, results) => {
  if (err) throw err;
  results.forEach(replaceInFile);
});

try { replaceInFile('c:\\ARKI\\tailwind.config.ts'); } catch(e){}
try { replaceInFile('c:\\ARKI\\src\\app\\manifest.ts'); } catch(e){}
