
import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

/**
 * Registra una acción en la colección de auditoría.
 */
export function logAction(db: Firestore | null, data: {
    userId: string;
    userName: string;
    action: string;
    module: string;
    targetId?: string;
    targetName?: string;
    details?: any;
}) {
    if (!db || !data.userId) return;
    
    // Ejecución "fire and forget" para no bloquear la UI principal
    const logData = {
        userId: data.userId,
        userName: data.userName || 'Usuario Desconocido',
        action: data.action.toUpperCase(),
        module: data.module.toUpperCase(),
        targetId: data.targetId || null,
        targetName: data.targetName || null,
        details: data.details || null,
        timestamp: serverTimestamp(),
    };

    addDoc(collection(db, 'audit_logs'), logData).catch(err => {
        console.error("Error crítico al registrar auditoría:", err);
    });
}
