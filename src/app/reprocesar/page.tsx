"use client";

import { useState } from 'react';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';

export default function ReprocesarPage() {
    const db = useFirestore();
    const [status, setStatus] = useState<string>('Esperando...');
    const [isLoading, setIsLoading] = useState(false);
    const [diagnosticData, setDiagnosticData] = useState<string | null>(null);

    const checkSchema = async () => {
        if (!db) {
            setDiagnosticData('Esperando conexión a base de datos...');
            return;
        }
        try {
            const snap = await getDocs(query(collection(db, 'transmisiones_recibidas')));
            if (!snap.empty) {
                // Tomamos las últimas 5 transmisiones
                const records = snap.docs.slice(-5).map(d => ({ id: d.id, ...d.data() }));
                setDiagnosticData(JSON.stringify(records, null, 2));
            } else {
                setDiagnosticData('No hay transmisiones recibidas aún.');
            }
        } catch (e: any) {
            setDiagnosticData(`Error: ${e.message}`);
        }
    };

    const handleReprocess = async () => {
        if (!db) {
            setStatus('Esperando conexión a base de datos...');
            return;
        }
        setIsLoading(true);
        setStatus('Iniciando reprocesamiento...');
        try {
            const transmisionesSnap = await getDocs(query(collection(db, 'transmisiones_recibidas'), where('estado', '==', 'v')));
            setStatus(`Se encontraron ${transmisionesSnap.size} transmisiones. Verificando votos...`);
            
            let updatedCount = 0;
            
            for (const docSnap of transmisionesSnap.docs) {
                const data = docSnap.data();
                
                const locNum = Number(data.local);
                const locStr = String(data.local);
                
                // Lookup real name in locales_votacion
                const localNamesToSearch: any[] = [locNum, locStr];
                const localesQuery = await getDocs(query(collection(db, 'locales_votacion'), where('codigo_local', '==', locStr)));
                localesQuery.forEach(doc => {
                    const lData = doc.data();
                    if (lData.nombre) {
                        localNamesToSearch.push(lData.nombre);
                    }
                });

                const mesaNum = Number(data.mesa);
                const mesaStr = String(data.mesa);
                const ordNum = Number(data.orden);
                const ordStr = String(data.orden);

                const seccNum = Number(data.seccional);
                const seccStr = String(data.seccional);

                const queries = [];
                // Search by Local exact match first, if any
                for (const loc of localNamesToSearch) {
                    for (const mes of [mesaNum, mesaStr]) {
                        for (const ord of [ordNum, ordStr]) {
                            queries.push(
                                getDocs(query(
                                    collection(db, 'votos_confirmados'),
                                    where('LOCAL', '==', loc),
                                    where('MESA', '==', mes),
                                    where('ORDEN', '==', ord)
                                ))
                            );
                        }
                    }
                }

                // Also search by Seccional + Mesa + Orden as a fallback
                for (const sec of [seccNum, seccStr]) {
                    for (const mes of [mesaNum, mesaStr]) {
                        for (const ord of [ordNum, ordStr]) {
                            queries.push(
                                getDocs(query(
                                    collection(db, 'votos_confirmados'),
                                    where('SECCIONAL', '==', sec),
                                    where('MESA', '==', mes),
                                    where('ORDEN', '==', ord)
                                ))
                            );
                            queries.push(
                                getDocs(query(
                                    collection(db, 'votos_confirmados'),
                                    where('CODIGO_SEC', '==', sec),
                                    where('MESA', '==', mes),
                                    where('ORDEN', '==', ord)
                                ))
                            );
                        }
                    }
                }

                const snaps = await Promise.all(queries);
                const matchedDocs: any[] = [];
                snaps.forEach(querySnap => {
                    if (!querySnap.empty) {
                        querySnap.forEach(d => {
                            if (!matchedDocs.some(md => md.id === d.id)) {
                                matchedDocs.push(d);
                            }
                        });
                    }
                });

                if (matchedDocs.length > 0) {
                    const batch = writeBatch(db);
                    let needsUpdate = false;
                    
                    matchedDocs.forEach((votoDoc) => {
                        if (votoDoc.data().estado_votacion !== 'Ya Votó') {
                            batch.update(votoDoc.ref, {
                                estado_votacion: 'Ya Votó',
                                updatedAt: new Date().toISOString()
                            });
                            needsUpdate = true;
                        }
                    });
                    
                    if (needsUpdate) {
                        await batch.commit();
                        updatedCount++;
                    }
                }
            }
            
            setStatus(`¡Proceso finalizado! (Total transmisiones encontradas: ${transmisionesSnap.size}). Se actualizaron retroactivamente ${updatedCount} registros a "Ya Votó".`);
        } catch (error: any) {
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-10 flex flex-col items-center justify-center space-y-4">
            <h1 className="text-2xl font-bold">Reprocesador de Transmisiones</h1>
            <p className="text-sm text-gray-500">Ejecuta este script para actualizar todos los votos atrasados.</p>
            <Button onClick={handleReprocess} disabled={isLoading}>
                {isLoading ? 'Procesando...' : 'Iniciar Reprocesamiento'}
            </Button>
            <Button variant="secondary" onClick={checkSchema}>Ver Campos Internos</Button>
            <div className="mt-4 p-4 bg-gray-100 rounded text-center min-w-[300px]">
                {status}
            </div>
            {diagnosticData && (
                <pre className="mt-4 p-4 bg-black text-green-400 text-xs text-left max-w-2xl overflow-auto rounded">
                    {diagnosticData}
                </pre>
            )}
        </div>
    );
}
