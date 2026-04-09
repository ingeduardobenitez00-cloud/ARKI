
'use client';

import { getDatabase, ref, onValue, set, onDisconnect, serverTimestamp as rtdbTimestamp } from "firebase/database";
import { getFirestore, doc, serverTimestamp as firestoreTimestamp, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { initializeFirebase } from "@/firebase";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Hook de presencia que sincroniza el estado online/offline del usuario.
 * Utiliza Realtime Database para la detección de desconexión y Firestore para persistencia.
 */
export function usePresence() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user || !user.id) return;

    const { firebaseApp } = initializeFirebase();
    const db = getFirestore(firebaseApp);
    const rtdb = getDatabase(firebaseApp);
    const auth = getAuth(firebaseApp);

    const uid = user.id;
    const userStatusDatabaseRef = ref(rtdb, '/status/' + uid);
    const userStatusFirestoreRef = doc(db, 'status', uid);

    // Objetos de estado
    const isOfflineForDatabase = {
        state: 'offline',
        last_changed: rtdbTimestamp(),
    };

    const isOnlineForDatabase = {
        state: 'online',
        last_changed: rtdbTimestamp(),
    };
    
    const isOfflineForFirestore = {
        state: 'offline',
        last_changed: firestoreTimestamp(),
    };

    const isOnlineForFirestore = {
        state: 'online',
        last_changed: firestoreTimestamp(),
    };

    // Referencia de conexión de Realtime Database
    const connectedRef = ref(rtdb, '.info/connected');

    // Escuchar cambios de conexión
    const unsubscribe = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === false) {
            // Si perdemos conexión con RTDB y aún estamos autenticados, marcamos como offline preventivamente
            if (auth.currentUser) {
                setDoc(userStatusFirestoreRef, isOfflineForFirestore, { merge: true }).catch(() => {
                    // Errores de permisos ignorados silenciosamente en transiciones de conexión
                });
            }
            return;
        }

        // Si estamos conectados a RTDB, configuramos el onDisconnect
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
            // Una vez configurado el onDisconnect, nos ponemos online en ambos sitios
            if (auth.currentUser) {
                set(userStatusDatabaseRef, isOnlineForDatabase);
                setDoc(userStatusFirestoreRef, isOnlineForFirestore, { merge: true }).catch(err => {
                    if (err.code === 'permission-denied') {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: userStatusFirestoreRef.path,
                            operation: 'write',
                            requestResourceData: isOnlineForFirestore
                        }));
                    }
                });
            }
        });
    });

    // Cleanup al desmontar o cerrar sesión
    return () => {
        unsubscribe();
        // Intentamos marcar offline al salir solo si aún tenemos una sesión válida
        if (auth.currentUser) {
            setDoc(userStatusFirestoreRef, isOfflineForFirestore, { merge: true }).catch(() => {
                // Durante el logout, es normal que fallen las marcas de offline por falta de auth
                // No emitimos error aquí para evitar pantallas de error innecesarias al salir
            });
        }
    };

  }, [user]);
}
