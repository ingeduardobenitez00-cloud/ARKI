export interface Candidate {
  id: string;
  name: string;
  list: string;
  option?: number;
  photo: string;
  type: 'Intendente' | 'Concejal';
}

export const INTENDENTE_CANDIDATES: Candidate[] = [
  { id: 'lista-2', name: '2 - CAMILO PEREZ', list: '2', photo: '/candidates/intendente/camilo-perez.jpg', type: 'Intendente' },
  { id: 'lista-7', name: '7 - ARNALDO SAMANIEGO', list: '7', photo: '/candidates/intendente/arnaldo-samaniego.jpg', type: 'Intendente' },
  { id: 'lista-300', name: '300 - DANILO GOMEZ', list: '300', photo: '/candidates/intendente/danilo-gomez.jpg', type: 'Intendente' },
];

export const GENERALES_INTENDENTE_CANDIDATES: Candidate[] = [
  { id: 'lista-1', name: 'CAMILO PEREZ', list: '1', photo: '/candidates/generales/intendente-1.webp', type: 'Intendente' },
  { id: 'lista-4', name: 'SOLE NUÑEZ', list: '4', photo: '/candidates/generales/intendente-4.webp', type: 'Intendente' },
  { id: 'lista-6', name: 'RODRI FRANCO', list: '6', photo: '/candidates/generales/intendente-6.webp', type: 'Intendente' },
  { id: 'lista-300', name: 'ARLENE AQUINO', list: '300', photo: '/candidates/generales/intendente-300.webp', type: 'Intendente' }
];

export const JUNTA_LISTS = [
    { id: 'lista-2c', name: '2C', listNumber: '2C' },
    { id: 'lista-2p', name: '2P', listNumber: '2P' },
    { id: 'lista-6', name: '6', listNumber: '6' },
    { id: 'lista-7', name: '7', listNumber: '7' },
    { id: 'lista-20', name: '20', listNumber: '20' },
];

export const GENERALES_JUNTA_LISTS = [
  { id: 'lista-1', name: 'PARTIDO COLORADO (ANR)', listNumber: '1' },
  { id: 'lista-2', name: 'PARTIDO LIBERAL RADICAL AUTENTICO (PLRA)', listNumber: '2' },
  { id: 'lista-4', name: 'ENCUENTRO NACIONAL', listNumber: '4' },
  { id: 'lista-8', name: 'PATRIA QUERIDA', listNumber: '8' },
  { id: 'lista-9', name: 'HAGAMOS', listNumber: '9' },
  { id: 'lista-42', name: 'FRENTE GUASU', listNumber: '42' }
];

// Real names mapping for Junta Municipal
const JUNTA_CANDIDATE_NAMES: Record<string, Record<number, string>> = {
    'lista-2c': {
        1: 'Miguel Sosa',
        2: 'Nasser Esgaib',
        3: 'Mariano Caceres',
        4: 'Gabriel Calonga',
        5: 'Karina Acuña',
        6: 'Carlos Morel',
        7: 'Ceres Escobar',
        8: 'El Princi De La Chaca',
        9: 'Romy Medina',
        10: 'Francisco Franco',
        11: 'Violeta Forneron',
        12: 'Derlis Bogado',
        13: 'Prof. Mirtha Reyes',
        14: 'Matilde Aquino',
        15: 'Dra. Cristi Balmori',
        16: 'Dario Alonso',
        17: 'Fabian Chamorro',
        18: 'La Inge. Rosario Godoy',
        19: 'Carlos Morel Martinez',
        20: 'Giselle Manzoni',
        21: 'Francisco Britez',
        22: 'Paz Mendez',
        23: 'Guillermo Lesme',
        24: 'Carlos Coronel Solis',
    },
    'lista-2p': {
        1: 'Dani Fernandez',
        2: 'El Arki Sotomayor',
        3: 'Tino Ayala',
        4: 'Marce Centurion',
        5: 'Cynthia Romero',
        6: 'Piriki Rodriguez',
        7: 'Gerardo "Gringo" Benitez',
        8: 'Seba Radice',
        9: 'Tania Araujo',
        10: 'Sama Cristhian Samaniego',
        11: 'Richard Reichardt',
        12: 'Guido Benitez',
        13: 'Axel Mongelos',
        14: 'Javier Pintos',
        15: 'Bertha Hahn',
        16: 'Paulo Da Silva',
        17: 'Lucho Guillen',
        18: 'Giovanna Pozzolo',
        19: 'Omar "Safuan"',
        20: 'Emilio Diaz De Vivar',
        21: 'Oscar Bernal',
        22: 'Profe Lucho Campos Cervera',
        23: 'Vicky Gonzalez',
        24: 'Oscar Noldin',
    },
    'lista-6': {
        1: 'Hugo Ramirez',
        2: 'Fernando Servin',
        3: 'Arturo Tuki Almiron',
        4: 'Nico Zarate',
        5: 'Maga Navarro',
        6: 'Ivan Chilavert',
        7: 'Dany Sanchez',
        8: 'Pedro Halley',
        9: 'Arqui Masi',
        10: 'Anita Oviedo',
        11: 'Coyote Martniez Seifart',
        12: 'Hugo Montiel',
        13: 'Braulio Machuca',
        14: 'Pianito Gonzalez',
        15: 'Sofi Cubas',
        16: 'Jorge Andriotti',
        17: 'Amado Adriz',
        18: 'Ever Piloto Escalante',
        19: 'Maria Stefani',
        20: 'Diego Benitez',
        21: 'Florencia Garcia',
        22: 'Maria Sol Rivarola Quiñonez',
        23: 'Braian Rey',
        24: 'Tincho Scura',
    },
    'lista-7': {
        1: 'Jesus Lara',
        2: 'Enrique Wagener',
        3: 'Andres Guerreño',
        4: 'Heriberto Campuzano',
        5: 'Guillermina Coronel',
        6: 'Carlos Viveros',
        7: 'Jose Plate',
        8: 'Julio Rolon',
        9: 'Ella Duarte',
        10: 'Rodrigo Paredes "El Capitan"',
        11: 'Melissa Lacasa',
        12: 'Elias Fleitas',
        13: 'Julio Fernandez',
        14: 'Lilian Benitez',
        15: 'Victor Chamorro',
        16: 'Miguel Angel Avalos',
        17: 'Oscar Acevedo',
        18: 'Roberto Ojeda',
        19: 'Sarita Patiño',
        20: 'Lorenzo Lezcano',
        21: 'Alexandra Cañiza',
        22: 'Araceli Fouz',
        23: 'Sol Perez',
        24: 'Moncho Aguero',
    },
    'lista-20': {
        1: 'Oscar "Nenecho" Rodriguez',
        2: 'Gaby Go',
        3: 'Omar "Pollo" Cubas Fanego',
        4: 'Beto Caceres',
        5: 'Fabri Rodriguez',
        6: 'Javiercito Quintana',
        7: 'Paco Yugovich',
        8: 'Adolfo "Nene" Arrua',
        9: 'Giuliano Berdejo',
        10: 'Miriam Dominguez',
        11: 'Ruben Villanueva',
        12: 'Valentin Ramon Nuñez V.',
        13: 'Huguito Cespedes',
        14: 'Dr. Diego Ayala Oviedo',
        15: 'Prof. Elizabeth Vinader',
        16: 'Claudia Arce',
        17: 'Antonio Fleitas',
        18: 'Ever Quiñonez',
        19: 'Milder Ariel Miltos',
        20: 'Luis Nayar',
        21: 'Gustavo Fleitas',
        22: 'Pablo Oliva',
        23: 'Lore Britez',
        24: 'Marcelo Estigarribia',
    }
};

// Helper to generate options for Junta
export const getJuntaOptions = (listId: string): Candidate[] => {
    return Array.from({ length: 24 }, (_, i) => {
        const optionNumber = i + 1;
        const name = JUNTA_CANDIDATE_NAMES[listId]?.[optionNumber] || `Opción ${optionNumber}`;
        
        return {
            id: `${listId}-opt-${optionNumber}`,
            name: name,
            list: listId,
            option: optionNumber,
            photo: `/candidates/junta/${listId}/${optionNumber}.jpg`,
            type: 'Concejal'
        };
    });
};

export const getGeneralesJuntaOptions = (listId: string): Candidate[] => {
  const namesByList: Record<string, string[]> = {
    '1': [
      'GERARDO "GRINGO" BENITEZ', 'MIGUEL SOSA', 'SEBA RADICE', 'NASSER ESGAIB',
      '“EL ARKI” SOTOMAYOR', 'JOSE PLATE', 'IVAN CHILAVERT', 'MARCE CENTURION',
      'CERES ESCOBAR', 'DANI FERNANDEZ', 'CARLOS MOREL', 'TINO AYALA',
      '“PIRIKI” RODRIGUEZ', 'JESUS LARA', 'HUGO RAMIREZ', 'MARIANO CACERES',
      'CYNTHIA ROMERO', 'GABRIEL CALONGA', 'AXEL MONGELOS', 'OSCAR NOLDIN',
      'KARINA ACUÑA', 'ENRIQUE WAGENER', 'JAVIER PINTOS', 'ARTURO TUKI ALMIRON'
    ],
    '2': [
      "AUGUSTO WAGNER", "RAMON ORTIZ", "CHRISTIAN BAREIRO", "FIORELLA FORESTIERI “YO CONFIO”",
      "HUMBERTO BLASCO", "ARIEL ANDINO", "TANCREDO LUIS CENTURION", "CARINA BENITEZ YEGROS",
      "SEBA JAEGGLI", "COCO GONZALEZ", "MARIA JOSE MIRANDA", "ARQ. CARLOS E. RUIZ SCHAERER",
      "CECILIA VARGAS PEÑA", "MAITO VARGAS", "NERY VELAZQUEZ", "FATIMA GOMEZ",
      "MARIA CRISTINA BENITEZ", "ROGELIO BARROS", "YESICA SAGUIER", "NITO SANTA CRUZ",
      "LUIS FRETES", "HENRY NELSON CAÑETE FERNANDEZ", "JUAN FRANCISCO BENITEZ RIVAS", "JUAN JARA"
    ],
    '4': [
      "SEBAS GARAY PQ", "NOELIA DIAZ", "MAURI MALUFF", "GUSTAVO RODRIGUEZ",
      "ROSA VACCHETTA", "DR. CELINO FERREIRA S.", "ALVARO GRAU PQ", "GLADIS FISCHER",
      "JORGE RAMOS “DOCTOR FRANCIA”", "JOSEFINA DUARTE", "OTI SANCHEZ", "JULIO VILLALBA CAVE",
      "PABLO CALLIZO", "FABI MONTIEL KLEINER", "MAXI SEIFERHELD “LEVANTA ESCUELAS”", "CORA ARBO",
      "“TU BUEN AMIGO” BRUNO", "ING AGR CARMEN “TATE” CUBAS", "JAZMIN GALEANO SAPENA PQ", "INGRID NOGUERA",
      "DANI RODRIGUEZ", "ING GLADYS CANESE", "PEDRO MAYOR", "MAGIN LOPEZ “GESTION Y CONTROL”"
    ],
    '8': [
      "HUGO LOPEZ", "TADEO ZARRATEA DAVALOS", "MARIA LUISA BELLO", "RODRIGO SEBASTIAN ARELLANO MOREIRA",
      "JOSE “PUMA” RODRIGUEZ", "FERNANDO “FERGO” GAMARRA", "CAP R LETIZIA RAMIREZ PAREDES", "LIC. AMI LOMBARDO",
      "CLAUDIO “MORSA” GONZALEZ", "DIXON BUTTERWORTH KENNEDY", "JORGE ANTONIO PRADO ESQUIVEL", "CARLOS ENRIQUE BAREIRO DUARTE",
      "ALFREDO RAUL NOGUERA VARGAS", "TOMAS FABIAN PLATE FRANCO", "ANDRES MIGUEL RUIZ DIAZ ARECO", "ADA LISSI ARRIOLA ALCARAZ",
      "JOSE LUIS FONTCLARA FERNANDEZ", "VICTORIA JARA HEYN", "NELSON CASTRO", "NORMA REINA ISABEL RIOS",
      "JORGE DANIEL CHAVEZ QUIÑONEZ", "LINO ANDRES AVILA ORTEGA", "CARLOS FERREIRA", "CRISTIAN DAVID SAMANIEGO NUÑEZ"
    ],
    '9': [
      "ALBERTO NUÑEZ ISASI", "ALFREDO EFRAIN ESQUIVEL", "FERNANDO CENTURION", "MIRTHA ARACELI ORTIZ BENITEZ",
      "SAMU ALVAREZ", "RAFAELA BEATRIZ VELAZQUEZ", "GUSTAVO ADOLFO CLOSA BENITEZ", "JOSE DEL ROSARIO ORTELLADO FRANCO",
      "VICTOR HUGO SANCHEZ ACOSTA", "MIGUEL GUSTAVO PORTILLO ORUE", "LEONARDO OJEDA", "EDITH FRANCO DE SARDI",
      "ALBERTO DA SILVA", "ALBERTO GEREMIAS BORDON", "HUGO ENRIQUE STANLEY PERSON", "MIRNA CONCEPCION PAREDES",
      "THAMARA GISEL MATTO", "OSCAR FABIAN RODRIGUEZ", "ANA MARIA QUINTANA", "ABRAHAN GARCIA INSAURRALDE",
      "GLADIS PAOLA ESPINOLA OTAZU", "HUGO DANIEL LONCHARICH BASUALDO", "JOSE ANTONIO CABRERA MIÑARRO", "LUCIANO ANTONIO BENITEZ GONZALEZ"
    ],
    '42': [
      "MARIA DENIS", "JESSI ARIAS", "MANU GERDING", "PACHIN CENTURION",
      "HAIDEE ROMERO", "IVAN ISASI", "MALU VAZQUEZ", "LIZ OSORIO",
      "JUANI CASURIAGA", "HECTOR OTAZU", "SUSANA BARRETO", "ROSA MIRANDA",
      "CESAR GONZALEZ PARINI", "OSCAR HERREROS USHER", "JORGE ENRIQUE AYALA", "NATHALIA CORREA",
      "SAMUEL VERA", "ALHELI GONZALEZ CACERES", "BETO DUNJO", "MARIA CONCEPCION CANDIA",
      "CARLOS PORTILLO", "YOLANDA MUJICA", "PAOLA ACOSTA DENIS", "ORLANDO MAIDANA"
    ]
  };

  const listNumber = listId.replace('lista-', '');
  return Array.from({ length: 24 }, (_, i) => {
      const optionNumber = i + 1;
      return {
          id: `${listId}-opt-${optionNumber}`,
          name: namesByList[listNumber]?.[i] || `CANDIDATO ${optionNumber}`,
          list: listNumber,
          option: optionNumber,
          photo: `/candidates/generales/concejal-${listNumber}-opt-${optionNumber}.webp`,
          type: 'Concejal'
      };
  });
};
