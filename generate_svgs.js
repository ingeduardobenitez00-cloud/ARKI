const fs = require('fs');
const path = require('path');

const candidates = [
  { file: 'intendente-1.svg', name: 'CAMILO PEREZ' },
  { file: 'intendente-4.svg', name: 'SOLE NUÑEZ' },
  { file: 'intendente-6.svg', name: 'RODRI FRANCO' },
  { file: 'intendente-300.svg', name: 'ARLENE AQUINO' }
];

const concejales = [
    'GERARDO BENITEZ', 'MIGUEL SOSA', 'SEBA RADICE', 'NASSER ESGAIB',
    'EL ARKI SOTOMAYOR', 'JOSE PLATE', 'IVAN CHILAVERT', 'MARCE CENTURION',
    'CERES ESCOBAR', 'DANI FERNANDEZ', 'CARLOS MOREL', 'TINO AYALA',
    'PIRIKI RODRIGUEZ', 'JESUS LARA', 'HUGO RAMIREZ', 'MARIANO CACERES',
    'CYNTHIA ROMERO', 'GABRIEL CALONGA', 'AXEL MONGELOS', 'OSCAR NOLDIN',
    'KARINA ACUÑA', 'ENRIQUE WAGENER', 'JAVIER PINTOS', 'ARTURO ALMIRON'
];

for (let i = 0; i < concejales.length; i++) {
  candidates.push({
    file: `concejal-1-opt-${i + 1}.svg`,
    name: concejales[i]
  });
}

const dir = path.join('c:\\ARKI', 'public', 'candidates', 'generales');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

function getInitials(name) {
    const parts = name.replace(/['"“”]/g, '').split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const initials = getInitials(c.name);
    const color = colors[i % colors.length];
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">
        <rect width="150" height="150" fill="${color}" />
        <text x="75" y="85" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
    </svg>`;
    
    fs.writeFileSync(path.join(dir, c.file), svg);
}

console.log('SVGs generated successfully!');
