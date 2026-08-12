const selectedPerson = {
  TALON: 0,
  ZONA: 4,
  DISTRITO: 0,
  DEPART: 0,
  DESC_LOCAL: 'COL.SANTA MARIA',
  CODIGO_SEC: ''
};

const dptoVal = selectedPerson.COD_DPTO !== undefined && selectedPerson.COD_DPTO !== '' ? selectedPerson.COD_DPTO : selectedPerson.DEPART;
const dptoStr = String(dptoVal ?? '');

const distVal = selectedPerson.COD_DIST !== undefined && selectedPerson.COD_DIST !== '' ? selectedPerson.COD_DIST : selectedPerson.DISTRITO;
const distStr = String(distVal ?? '');

const zonaStr = String(selectedPerson.ZONA ?? '');

console.log("dptoStr:", dptoStr, "distStr:", distStr, "zonaStr:", zonaStr);
