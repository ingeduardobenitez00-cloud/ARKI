"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export default function DebugPage() {
    const db = useFirestore();
    const [status, setStatus] = useState<string>("Iniciando diagnóstico...");
    const [results, setResults] = useState<any>(null);

    useEffect(() => {
        if (!db) return;

        async function runDiagnostics() {
            try {
                setStatus("Buscando usuarios...");
                const usersSnap = await getDocs(collection(db, 'users'));
                const users: any[] = [];
                usersSnap.forEach(doc => {
                    users.push({ id: doc.id, ...doc.data() });
                });

                const guillermoUsers = users.filter(u => 
                    String(u.name || '').toUpperCase().includes("GUILLERMO") || 
                    String(u.email || '').toLowerCase().includes("guillefer")
                );

                setStatus("Consultando votos_confirmados...");
                const capturesSnap = await getDocs(collection(db, 'votos_confirmados'));
                const allCaptures: any[] = [];
                capturesSnap.forEach(doc => {
                    allCaptures.push({ id: doc.id, ...doc.data() });
                });

                setStatus("Procesando datos...");
                
                // Conteo por registradoPor_nombre (variaciones)
                const countsByName: Record<string, number> = {};
                const countsById: Record<string, number> = {};
                const countsBySeccional: Record<string, number> = {};

                allCaptures.forEach(c => {
                    const name = c.registradoPor_nombre || 'SÍN NOMBRE';
                    countsByName[name] = (countsByName[name] || 0) + 1;

                    const id = c.registradoPor_id || 'SIN ID';
                    countsById[id] = (countsById[id] || 0) + 1;

                    const sec = String(c.CODIGO_SEC || 'SIN SECCIONAL');
                    countsBySeccional[sec] = (countsBySeccional[sec] || 0) + 1;
                });

                setResults({
                    totalUsuarios: users.length,
                    guillermoUsers,
                    totalVotosConfirmados: allCaptures.length,
                    countsByName,
                    countsById,
                    countsBySeccional,
                    allGuillermoCaptures: allCaptures.filter(c => 
                        String(c.registradoPor_nombre || '').toUpperCase().includes("GUILLERMO")
                    ).map(c => ({
                        id: c.id,
                        NOMBRE: c.NOMBRE,
                        APELLIDO: c.APELLIDO,
                        CODIGO_SEC: c.CODIGO_SEC,
                        registradoPor_nombre: c.registradoPor_nombre,
                        registradoPor_id: c.registradoPor_id
                    }))
                });
                setStatus("Diagnóstico completado.");
            } catch (err: any) {
                console.error(err);
                setStatus("Error: " + err.message);
            }
        }

        runDiagnostics();
    }, [db]);

    return (
        <div className="p-8 bg-slate-900 text-white min-h-screen font-mono">
            <h1 className="text-2xl font-bold mb-4">Soporte Técnico - Diagnóstico de Votos</h1>
            <p className="text-yellow-400 mb-6">Estado: {status}</p>

            {results && (
                <div className="space-y-6">
                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h2 className="text-xl font-bold mb-2">Resumen General</h2>
                        <p>Total Usuarios: {results.totalUsuarios}</p>
                        <p>Total Votos Confirmados en la DB: {results.totalVotosConfirmados}</p>
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h2 className="text-xl font-bold mb-2">Usuarios Guillermo Encontrados</h2>
                        <pre className="text-xs bg-slate-950 p-2 rounded overflow-auto max-h-48 text-green-400">
                            {JSON.stringify(results.guillermoUsers, null, 2)}
                        </pre>
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h2 className="text-xl font-bold mb-2">Conteo por registradoPor_nombre</h2>
                        <pre className="text-xs bg-slate-950 p-2 rounded overflow-auto max-h-48 text-green-400">
                            {JSON.stringify(results.countsByName, null, 2)}
                        </pre>
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h2 className="text-xl font-bold mb-2">Conteo por registradoPor_id</h2>
                        <pre className="text-xs bg-slate-950 p-2 rounded overflow-auto max-h-48 text-green-400">
                            {JSON.stringify(results.countsById, null, 2)}
                        </pre>
                    </div>

                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h2 className="text-xl font-bold mb-2">Votos de Guillermo (Primeros 10 de {results.allGuillermoCaptures.length})</h2>
                        <pre className="text-xs bg-slate-950 p-2 rounded overflow-auto max-h-60 text-green-400">
                            {JSON.stringify(results.allGuillermoCaptures.slice(0, 10), null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
