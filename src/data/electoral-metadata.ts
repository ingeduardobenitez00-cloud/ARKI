export interface Candidate {
  id: string;
  name: string;
  list: string;
  option?: number;
  photo: string;
  type: 'Intendente' | 'Concejal';
}

export const INTENDENTE_CANDIDATES: Candidate[] = [
  { id: 'camilo-perez', name: 'Camilo Perez', list: '2 MHC', photo: '/candidates/intendente/camilo-perez.jpg', type: 'Intendente' },
  { id: 'arnaldo-samaniego', name: 'Arnaldo Samaniego', list: '7 MFCRA', photo: '/candidates/intendente/arnaldo-samaniego.jpg', type: 'Intendente' },
  { id: 'danilo-gomez', name: 'Danilo Gomez', list: '300 MUE', photo: '/candidates/intendente/danilo-gomez.jpg', type: 'Intendente' },
];

export const JUNTA_LISTS = [
    { id: 'lista-2c', name: 'HONOR COLORADO C', listNumber: '2C' },
    { id: 'lista-2p', name: 'HONOR COLORADO P', listNumber: '2P' },
    { id: 'lista-6', name: 'COLORADO AÑETETE', listNumber: '6' },
    { id: 'lista-7', name: 'FUERZA Y CAUSA', listNumber: '7' },
    { id: 'lista-20', name: 'ORDEN REPUBLICANO', listNumber: '20' },
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
