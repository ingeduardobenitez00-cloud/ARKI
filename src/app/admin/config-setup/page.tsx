'use client';

import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { MOLDES_ARKI } from '@/lib/electoral-config';
import Link from 'next/link';

export default function ConfigSetupPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSetup = async () => {
        if (!db) return;
        setStatus('loading');
        setError(null);

        try {
            const configRef = doc(db, 'configuraciones', 'electoral');
            await setDoc(configRef, {
                version: '1.0.8',
                lastUpdated: serverTimestamp(),
                moldes: MOLDES_ARKI,
                updatedBy: user?.name || 'Sistema ARKI'
            });
            setStatus('success');
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setError(e.message);
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="w-full max-w-md border-red-200">
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5"/> Acceso Denegado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600">Debes estar logueado para acceder a esta herramienta administrativa.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-8 space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-2xl text-white shadow-xl">
                    <Database className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Setup de Configuración</h1>
                    <p className="text-slate-500 font-medium">Módulo de Activación de Arquitectura Dinámica</p>
                </div>
            </div>

            <Card className="border-2 border-slate-200 shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-lg">Inyector de Moldes Electorales</CardTitle>
                    <CardDescription>
                        Esta acción creará la colección <code className="bg-slate-200 px-1 rounded text-slate-800">configuraciones</code> 
                        y el documento <code className="bg-slate-200 px-1 rounded text-slate-800">electoral</code> en tu Firestore.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest">Contenido a Inyectar:</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">CAPITAL</p>
                                <p className="text-xs font-black text-slate-700">Intendente + Junta (124 campos)</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">CENTRAL</p>
                                <p className="text-xs font-black text-slate-700">Intendente + Junta (508 campos)</p>
                            </div>
                        </div>
                    </div>

                    {status === 'idle' && (
                        <Button 
                            onClick={handleSetup} 
                            className="w-full h-16 text-lg font-black bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20 group transition-all"
                        >
                            ACTIVAR CONFIGURACIÓN DINÁMICA
                            <ShieldCheck className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
                        </Button>
                    )}

                    {status === 'loading' && (
                        <Button disabled className="w-full h-16 bg-slate-100 text-slate-400 border-2">
                            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                            CONECTANDO CON FIRESTORE...
                        </Button>
                    )}

                    {status === 'success' && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-500">
                            <div className="p-6 bg-green-50 border-2 border-green-500 rounded-2xl flex flex-col items-center text-center">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                                <h3 className="text-xl font-black text-green-800">¡Activación Exitosa!</h3>
                                <p className="text-sm text-green-700 mt-1">Los moldes ya están en la nube y ARKI es ahora 100% dinámico.</p>
                            </div>
                            <Link href="/laboratorio-qr">
                                <Button className="w-full h-12 bg-slate-800 text-white font-bold">
                                    IR AL LABORATORIO QR
                                </Button>
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-800">Error de Escritura</p>
                                <p className="text-xs text-red-600">{error}</p>
                                <Button onClick={() => setStatus('idle')} variant="link" className="p-0 h-auto text-xs text-red-800 underline mt-2">
                                    Reintentar
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-center text-slate-400 gap-6 text-[10px] font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Firestore v2</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3"/> Moldes 1.0.8</span>
                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Solo Admin</span>
            </div>
        </div>
    );
}
