"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, doc, getDoc, getDocs, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { IntendenteForm } from '@/components/electoral/IntendenteForm';
import { JuntaForm } from '@/components/electoral/JuntaForm';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardCheck, History, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updateElectoralTotals } from '@/services/electoral-service';

export default function EscanerActasPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    // Selection State
    const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
    const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
    const [activeModule, setActiveModule] = useState<'intendencia' | 'junta' | null>(null);
    const [pendingQRData, setPendingQRData] = useState<any>(null);

    // Data State
    const [selectedSeccional, setSelectedSeccional] = useState<string | null>(null);
    const [allMetadata, setAllMetadata] = useState<Record<string, any>>({});
    const [mesasStatus, setMesasStatus] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    // Fetch Metadata
    useEffect(() => {
        if (!db) return;

        if (isAdmin) {
            getDocs(collection(db, 'seccionales_metadata')).then(snap => {
                const combinedData: Record<string, any> = {};
                snap.docs.forEach(docSnap => {
                    combinedData[docSnap.id] = docSnap.data();
                });
                setAllMetadata(combinedData);
            });
        } else {
            const seccionalToQuery = user?.seccional;
            if (!seccionalToQuery) return;

            const metaDocRef = doc(db, 'seccionales_metadata', seccionalToQuery);
            getDoc(metaDocRef).then(snap => {
                if (snap.exists()) {
                    setAllMetadata({ [seccionalToQuery]: snap.data() });
                    setSelectedSeccional(seccionalToQuery);
                }
            });
        }
    }, [isAdmin, user, db]);

    // Fetch Mesas Progress Status real-time
    useEffect(() => {
        if (!db || !selectedLocal) return;

        const q = query(
            collection(db, 'seguimiento_resultados'),
            where('local', '==', selectedLocal)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const status: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                status[doc.id.split('_').pop()!] = doc.data(); // docId is localId_mesaNo
            });
            setMesasStatus(status);
        });

        return () => unsubscribe();
    }, [db, selectedLocal]);

    const allSeccionalesList = useMemo(() => Object.keys(allMetadata).sort((a,b)=>a.localeCompare(b, undefined, {numeric: true})), [allMetadata]);
    const locales = useMemo(() => {
        if (!selectedSeccional) return [];
        return allMetadata[selectedSeccional]?.locales || [];
    }, [allMetadata, selectedSeccional]);

    const currentLocalMesas = useMemo(() => {
        if (!selectedLocal || !selectedSeccional) return [];
        const localData = allMetadata[selectedSeccional]?.mesas_por_local?.find((l: any) => l.localName === selectedLocal);
        return localData?.mesas || [];
    }, [allMetadata, selectedSeccional, selectedLocal]);

    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSaveResult = async (data: any, imageFile?: File) => {
        if (!db || !storage || !selectedLocal || !selectedMesa || !activeModule) return;
        setIsSaving(true);
        try {
            const docId = `${selectedLocal.replace(/\s+/g, '_')}_${selectedMesa}`;
            
            // Subir imagen a Firebase Storage si existe
            let actaImageUrl = null;
            if (imageFile) {
                const imageRef = ref(storage, `actas_imagenes/${activeModule}/${docId}.jpg`);
                await uploadBytes(imageRef, imageFile);
                actaImageUrl = await getDownloadURL(imageRef);
            }

            const resultRef = doc(db, `actas_${activeModule}`, docId);
            const statusRef = doc(db, 'seguimiento_resultados', docId);

            await setDoc(resultRef, {
                ...data,
                actaImageUrl, // Guardar la URL de la foto
                mesa: selectedMesa,
                local: selectedLocal,
                cargadoPor: user?.name,
                cargadoAt: serverTimestamp()
            });

            await setDoc(statusRef, {
                local: selectedLocal,
                mesa: selectedMesa,
                [`${activeModule}_cargado`]: true,
                last_updated: serverTimestamp()
            }, { merge: true });

            await updateElectoralTotals(db, data, activeModule === 'intendencia' ? 'Intendente' : 'Junta');

            setSaveSuccess(true);
            toast({ title: "Éxito", description: "Resultado guardado correctamente" });
            
            // Smooth transition: Wait 1.5s before clearing to allow user to see success
            setTimeout(() => {
                setSaveSuccess(false);
                setActiveModule(null);
            }, 1500);

        } catch (e) {
            toast({ title: "Error", description: "No se pudo guardar el resultado", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Carga de Resultados Electorales</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Selection & Progress List */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4" />
                                Configuración de Mesa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isAdmin && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">Seccional</label>
                                    <Select onValueChange={(v) => { setSelectedSeccional(v); setSelectedLocal(null); setSelectedMesa(null); }} value={selectedSeccional || ''}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona SECC" /></SelectTrigger>
                                        <SelectContent>
                                            {allSeccionalesList.map((s) => (
                                                <SelectItem key={s} value={s}>SECC {s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Local de Votación</label>
                                <Select onValueChange={(v) => { setSelectedLocal(v); setSelectedMesa(null); }} value={selectedLocal || ''}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona Local" /></SelectTrigger>
                                    <SelectContent>
                                        {locales.map((l: string) => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* ACTION BUTTONS PANEL */}
                            <div className="pt-6 flex flex-col items-center justify-center border-t space-y-3">
                                <Button 
                                    size="lg"
                                    disabled={!selectedMesa}
                                    className={`w-full h-14 text-sm font-black shadow-md transition-all ${selectedMesa && activeModule !== 'intendencia' ? 'bg-blue-700 hover:bg-blue-800 scale-100' : 'bg-slate-200 text-slate-500'}`}
                                    onClick={() => setActiveModule('intendencia')}
                                >
                                    CARGAR INTENDENCIA
                                </Button>
                                <Button 
                                    size="lg"
                                    disabled={!selectedMesa}
                                    className={`w-full h-14 text-sm font-black shadow-md transition-all ${selectedMesa && activeModule !== 'junta' ? 'bg-blue-700 hover:bg-blue-800 scale-100' : 'bg-slate-200 text-slate-500'}`}
                                    onClick={() => setActiveModule('junta')}
                                >
                                    CARGAR JUNTA
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-[500px] flex flex-col">
                        <CardHeader className="bg-muted/50 border-b">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    TABLA DE CONTROL DE MESAS
                                </div>
                                <Badge variant="outline">{currentLocalMesas.length} Mesas</Badge>
                            </CardTitle>
                        </CardHeader>
                        <ScrollArea className="flex-1 p-0">
                            <div className="divide-y">
                                {currentLocalMesas.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        Selecciona un local para ver el progreso
                                    </div>
                                ) : (
                                    currentLocalMesas.map((m: number) => {
                                        const status = mesasStatus[m];
                                        return (
                                            <div key={m} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${selectedMesa === m ? 'bg-primary/5 border-l-4 border-primary' : ''}`}>
                                                <div className="font-bold">Mesa {m}</div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        size="sm"
                                                        variant={(selectedMesa === m && activeModule === 'intendencia') ? 'default' : 'outline'}
                                                        className={`h-8 px-4 text-[10px] font-black transition-all ${(selectedMesa === m && activeModule === 'intendencia') ? 'bg-blue-700 shadow-md' : 'text-slate-400'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedMesa(m);
                                                            setActiveModule('intendencia');
                                                        }}
                                                    >
                                                        INT {status?.intendencia_cargada && "✓"}
                                                    </Button>
                                                    <Button 
                                                        size="sm"
                                                        variant={(selectedMesa === m && activeModule === 'junta') ? 'default' : 'outline'}
                                                        className={`h-8 px-4 text-[10px] font-black transition-all ${(selectedMesa === m && activeModule === 'junta') ? 'bg-blue-700 shadow-md' : 'text-slate-400'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedMesa(m);
                                                            setActiveModule('junta');
                                                        }}
                                                    >
                                                        JUN {status?.junta_cargada && "✓"}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Main Form Area */}
                <div className="lg:col-span-2 relative">
                    {saveSuccess && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl animate-in fade-in duration-300">
                            <div className="bg-green-100 p-4 rounded-full mb-4">
                                <CheckCircle className="w-12 h-12 text-green-600 animate-bounce" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800">Resultado Guardado</h3>
                            <p className="text-sm text-slate-500">Actualizando totales en tiempo real...</p>
                        </div>
                    )}
                    
                    {!activeModule ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
                            <ClipboardCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground">Esperando Selección</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
                                Utiliza el panel lateral para seleccionar manualmente el local, la mesa, y el módulo a cargar.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center bg-background p-2 rounded-lg border shadow-sm">
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    Cargando Mesa {selectedMesa}
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => setActiveModule(null)}>
                                    Cancelar Carga
                                </Button>
                            </div>
                            
                            {activeModule === 'intendencia' ? (
                                <IntendenteForm 
                                    mesa={selectedMesa!} 
                                    local={selectedLocal!} 
                                    onSave={handleSaveResult}
                                    isSaving={isSaving}
                                />
                            ) : (
                                <JuntaForm 
                                    mesa={selectedMesa!} 
                                    local={selectedLocal!} 
                                    onSave={handleSaveResult}
                                    isSaving={isSaving}
                                />
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
