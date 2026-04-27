import { doc, updateDoc, setDoc, getDoc, increment, Firestore } from 'firebase/firestore';

export const updateElectoralTotals = async (db: Firestore, actaData: any, type: 'Intendente' | 'Junta') => {
    const totalsRef = doc(db, 'electoral_stats', 'totals');
    
    try {
        const snap = await getDoc(totalsRef);
        if (!snap.exists()) {
            // Initialize the structure if it doesn't exist
            await setDoc(totalsRef, {
                lastUpdate: new Date(),
                processedMesas: 0,
                intendente: {
                    votos_nulos: 0,
                    votos_blancos: 0
                },
                junta: {}
            });
        }

        const updates: any = {
            lastUpdate: new Date(),
            processedMesas: increment(1)
        };

        if (type === 'Intendente') {
            // Update individual candidate totals
            Object.keys(actaData.votos || {}).forEach(candidateId => {
                const votes = parseInt(actaData.votos[candidateId]) || 0;
                if (votes > 0) {
                    updates[`intendente.${candidateId}`] = increment(votes);
                }
            });
            updates[`intendente.votos_nulos`] = increment(parseInt(actaData.votos_nulos) || 0);
            updates[`intendente.votos_blancos`] = increment(parseInt(actaData.votos_blancos) || 0);
        } else {
            // Update Junta totals (List and individual options)
            Object.keys(actaData.listas || {}).forEach(listId => {
                const listData = actaData.listas[listId];
                const listTotal = parseInt(listData.total) || 0;
                
                if (listTotal > 0) {
                    updates[`junta.${listId}.total`] = increment(listTotal);
                    
                    // Update specific options within the list
                    Object.keys(listData.opciones || {}).forEach(optNum => {
                        const optVotes = parseInt(listData.opciones[optNum]) || 0;
                        if (optVotes > 0) {
                            updates[`junta.${listId}.opciones.${optNum}`] = increment(optVotes);
                        }
                    });
                }
            });
        }

        await updateDoc(totalsRef, updates);
    } catch (error) {
        console.error('Error updating electoral totals:', error);
    }
};
