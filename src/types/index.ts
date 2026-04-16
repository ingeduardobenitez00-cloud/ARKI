
export interface User {
  id: string; // This will be the Firebase Auth UID
  name: string;
  email: string;
  username: string;
  telefono?: string;
  photoUrl?: string; // URL o Base64 de la foto de perfil
  role: 'Super-Admin' | 'Admin' | 'Presidente' | 'Coordinador' | 'Dirigente' | 'Mesario' | 'Recepcionista' | 'Comunicaciones'; // Role of the user
  seccional?: string; // Assigned seccional (Legacy)
  seccionales?: string[]; // Multiple assigned seccionales
  local?: string; // Assigned voting location
  mesas?: number[]; // Assigned voting tables
  permissions: string[]; // Array of hrefs for allowed modules
  moduleActions?: Record<string, ('create' | 'update' | 'delete' | 'pdf' | 'excel')[]>; // Granular actions per module path
  actions: ('create' | 'update' | 'delete' | 'pdf' | 'excel')[]; // Global actions (legacy support)
  active?: boolean; // Whether the account is active or suspended
}

export interface Seccional {
  id: string;
  nombre: string;
  departamento: string;
}

export interface Elector {
  id: string;
  [key: string]: any;
}


export type FormFieldType = 'text' | 'email' | 'password' | 'number' | 'textarea' | 'date';

export interface FormField {
  id: string;
  label: string;
  name: string;
  type: FormFieldType;
  placeholder?: string;
}

export interface FormSchema {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

export interface DataRecord {
  id: string;
  formId: string;
  createdAt: string;
  [key: string]: any;
}

export interface ArchivedMeeting {
    id: string;
    name: string;
    archivedAt: any; // Firestore Timestamp
    participants: Elector[];
    archivedBy: string;
}
