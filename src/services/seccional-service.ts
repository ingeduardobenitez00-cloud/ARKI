
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Firestore } from 'firebase/firestore';

/**
 * @fileOverview Servicio para la gestión técnica de seccionales.
 */

export interface SeccionalData {
    numero: number;
    zona_id: number;
    distrito_oficial: number;
    total_votos_seguros: number;
    meta_objetivo: number;
}

/**
 * Obtiene los datos de una seccional por su ID único (1-45).
 */
export async function getSeccionalById(db: Firestore, id: string): Promise<SeccionalData | null> {
    const docRef = doc(db, 'seccionales_data', id);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as SeccionalData) : null;
}

/**
 * Actualiza el contador de votos seguros de una seccional.
 */
export async function updateVotos(db: Firestore, id: string, cantidad: number) {
    const docRef = doc(db, 'seccionales_data', id);
    await updateDoc(docRef, {
        total_votos_seguros: cantidad
    });
}

/**
 * Obtiene el resumen de progreso acumulado por zona territorial.
 */
export async function getProgresoPorZona(db: Firestore, zonaId: number) {
    const q = query(collection(db, 'seccionales_data'), where('zona_id', '==', zonaId));
    const snap = await getDocs(q);
    
    let totalVotos = 0;
    let totalMeta = 0;
    
    snap.forEach(doc => {
        const data = doc.data() as SeccionalData;
        totalVotos += data.total_votos_seguros || 0;
        totalMeta += data.meta_objetivo || 0;
    });

    return {
        zonaId,
        votos: totalVotos,
        meta: totalMeta,
        porcentaje: totalMeta > 0 ? (totalVotos / totalMeta) * 100 : 0
    };
}
