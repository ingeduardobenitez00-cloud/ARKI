import { doc, getDoc, Firestore } from 'firebase/firestore';
import { DeptoConfig, MOLDES_ARKI } from '../lib/electoral-config';

/**
 * Servicio para cargar la configuración de moldes desde Firebase Firestore.
 * Si no existe en la nube, retorna la configuración local por defecto.
 */
export const loadElectoralConfig = async (db: Firestore): Promise<Record<string, DeptoConfig>> => {
    try {
        const configRef = doc(db, 'configuraciones', 'electoral');
        const snap = await getDoc(configRef);
        
        if (snap.exists()) {
            const remoteData = snap.data();
            console.log('Configuración electoral cargada desde Firebase');
            return remoteData.moldes || MOLDES_ARKI;
        }
        
        console.warn('Documento configuraciones/electoral no encontrado. Usando moldes locales.');
        return MOLDES_ARKI;
    } catch (error) {
        console.error('Error al cargar configuración desde Firebase:', error);
        return MOLDES_ARKI;
    }
};

/**
 * Estructura JSON sugerida para Firestore:
 * 
 * Documento: /configuraciones/electoral
 * {
 *   "version": "1.0.0",
 *   "lastUpdated": Timestamp,
 *   "moldes": {
 *     "CAPITAL": {
 *       "INTENDENTE": { "totalListas": 3, "opcionesPorLista": 1, "totalCampos": 7, "cierre": ["NUL", "BLC", "VAC", "TOT"] },
 *       "JUNTA": { "totalListas": 5, "opcionesPorLista": 24, "totalCampos": 124, "cierre": ["NUL", "BLC", "VAC", "TOT"] }
 *     },
 *     "CENTRAL": { ... }
 *   }
 * }
 */
