
import { 
    Users, 
    LayoutGrid, 
    FileSearch, 
    BookHeart, 
    Settings, 
    BookCheck, 
    ClipboardCheck, 
    Archive, 
    Wifi, 
    Phone, 
    MessageSquare, 
    Map as LucideMapIcon, 
    ShieldCheck, 
    Database, 
    Share2, 
    ClipboardList, 
    UserCircle, 
    Film, 
    LayoutDashboard, 
    HelpCircle,
    FileDown,
    Cpu,
    UserPlus,
    History,
    AppWindow,
    MapIcon,
    QrCode,
    BarChart3,
    Image as ImageIcon
} from 'lucide-react';

export const allMenuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, tooltip: 'PANEL DE CONTROL PRINCIPAL Y VISTA GENERAL.' },
  { href: '/mapa-tecnico', label: 'Mapa Técnico', icon: MapIcon, tooltip: 'GESTIÓN TERRITORIAL TÉCNICA Y POLÍTICA POR DISTRITOS.' },
  { href: '/padron', label: 'Consulta Padrón', icon: LayoutGrid, tooltip: 'EXPLORA Y BUSCA EN EL PADRÓN ELECTORAL COMPLETO.' },
  { href: '/padron-export', label: 'Padrón Exportar', icon: FileDown, tooltip: 'GENERA REPORTES EN EXCEL Y PDF POR SECCIONAL.' },
  { href: '/consulta', label: 'Registra Votos', icon: FileSearch, tooltip: 'BUSCA ELECTORES Y MARCA SU VOTO COMO SEGURO.' },
  { href: '/telefonos', label: 'Actualizar Teléfonos', icon: Phone, tooltip: 'AGREGA O ACTUALIZA LOS NÚMEROS DE TELÉFONO DE LOS EMPADRONADOS.' },
  { href: '/biblioteca', label: 'Biblioteca Multimedia', icon: Film, tooltip: 'GESTIONA LA BIBLIOTECA DE IMÁGENES Y VIDEOS DEL SISTEMA.' },
  { href: '/difusion', label: 'Difusión WhatsApp', icon: MessageSquare, tooltip: 'ENVÍA INVITACIONES, VIDEOS Y FLYERS PERSONALIZADOS POR WHATSAPP.' },
  { href: '/inscripciones-eventos', label: 'Inscripciones Públicas', icon: UserPlus, tooltip: 'GESTIONA LAS PERSONAS QUE SE INSCRIBIERON DESDE EL LINK PÚBLICO.' },
  { href: '/inscripciones-archivadas', label: 'Historial Inscripciones', icon: History, tooltip: 'CONSULTA LAS LISTAS DE INSCRIPCIONES PÚBLICAS ARCHIVADAS.' },
  { href: '/ajustes-inscripcion', label: 'Ajustes Portal Público', icon: AppWindow, tooltip: 'CONFIGURA EL NOMBRE, FLYER Y ESTADO DEL PORTAL DE INSCRIPCIÓN.' },
  { href: '/reuniones', label: 'Reuniones', icon: Users, tooltip: 'GESTIONA LA LISTA DE PARTICIPANTES PARA LA REUNIÓN ACTUAL.' },
  { href: '/reuniones-archivadas', label: 'Reuniones Archivadas', icon: Archive, tooltip: 'CONSULTA EL HISTORIAL DE REUNIONES PASADAS.' },
  { href: '/control-votacion', label: 'Control Votación', icon: ClipboardCheck, tooltip: 'CONTROLA EL ESTADO DE VOTACIÓN POR MESA.' },
  { href: '/escaner-actas', label: 'Escaner de Actas', icon: QrCode, tooltip: 'ESCANEO DE ACTAS TREP Y CARGA DE RESULTADOS.' },
  { href: '/resultados-electorales', label: 'Resultados en Vivo', icon: BarChart3, tooltip: 'VISUALIZA LOS RESULTADOS ELECTORALES EN TIEMPO REAL.' },
  { href: '/configuracion-electoral', label: 'Metadata Electoral', icon: ImageIcon, tooltip: 'GESTIONA FOTOS Y NOMBRES DE CANDIDATOS.' },
  { href: '/voto-seguro', label: 'Lista Voto Seguro', icon: BookHeart, tooltip: 'VISUALIZA LA LISTA DE VOTOS SEGUROS (PERSONAL O DE TU SECC).' },
  { href: '/mapa-global', label: 'Mapa Territorial', icon: LucideMapIcon, tooltip: 'VISUALIZA EN EL MAPA A LOS ELECTORES (PERSONAL O DE TU SECC).' },
  { href: '/reportes', label: 'Reportes', icon: BookCheck, tooltip: 'GENERA REPORTES DE VOTOS SEGUROS POR SECCIONAL.' },
  { href: '/auditoria', label: 'Auditoría', icon: ShieldCheck, tooltip: 'MONITOREA LAS ACCIONES REALIZADAS POR LOS USUARIOS EN EL SISTEMA.' },
  { href: '/conexiones', label: 'Conexiones', icon: Wifi, tooltip: 'MONITOREA LOS USUARIOS CONECTADOS AL SISTEMA.' },
  { href: '/users', label: 'Usuarios', icon: Users, tooltip: 'GESTIONA LOS USUARIOS Y SUS PERMISOS.' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, tooltip: 'CONFIGURA PARÁMETROS TÉCNICOS E IDENTIDAD PWA.' },
  { href: '/perfil', label: 'Mi Perfil', icon: UserCircle, tooltip: 'GESTIONA TU INFORMACIÓN PERSONAL Y CAMBIA TU CONTRASEÑA.' },
];

export const menuCategories = [
  {
    label: 'Principal',
    icon: LayoutDashboard,
    items: ['/'],
    href: '/'
  },
  {
    label: 'Inteligencia Electoral',
    icon: MapIcon,
    items: ['/mapa-tecnico', '/mapa-global']
  },
  {
    label: 'Padrón Electoral',
    icon: Database,
    items: ['/padron', '/padron-export']
  },
  {
    label: 'Carga de Votos Seguros',
    icon: Database,
    items: ['/consulta', '/voto-seguro']
  },
  {
    label: 'Comunicación',
    icon: Share2,
    items: ['/telefonos', '/biblioteca', '/difusion']
  },
  {
    label: 'Operación Día D',
    icon: ClipboardCheck,
    items: ['/control-votacion', '/escaner-actas', '/resultados-electorales', '/configuracion-electoral', '/reportes']
  },
  {
    label: 'Asistencia y Eventos',
    icon: ClipboardList,
    items: ['/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/reuniones', '/reuniones-archivadas']
  },
  {
    label: 'Panel Maestro',
    icon: ShieldCheck,
    items: ['/auditoria', '/conexiones', '/users', '/configuracion']
  }
];

export const userRoles: { [key: string]: { permissions: string[] } } = {
  'Super-Admin': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Admin': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Presidente': {
    permissions: allMenuItems.map(item => item.href)
  },
  'Coordinador': {
    permissions: ['/', '/mapa-tecnico', '/padron', '/padron-export', '/consulta', '/telefonos', '/biblioteca', '/difusion', '/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/voto-seguro', '/mapa-global', '/reportes', '/reuniones', '/reuniones-archivadas', '/control-votacion', '/perfil']
  },
  'Dirigente': {
    permissions: ['/', '/mapa-tecnico', '/padron', '/consulta', '/telefonos', '/biblioteca', '/difusion', '/voto-seguro', '/mapa-global', '/reportes', '/perfil']
  },
  'Mesario': {
    permissions: ['/', '/control-votacion', '/escaner-actas', '/perfil']
  },
  'Recepcionista': {
    permissions: ['/', '/inscripciones-eventos', '/inscripciones-archivadas', '/ajustes-inscripcion', '/reuniones', '/reuniones-archivadas', '/perfil']
  },
  'Comunicaciones': {
    permissions: ['/', '/telefonos', '/biblioteca', '/difusion', '/perfil']
  }
};
