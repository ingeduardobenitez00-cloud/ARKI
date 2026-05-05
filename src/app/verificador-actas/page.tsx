"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, Image as ImageIcon, FileText, CheckCircle2, AlertCircle, Search, ZoomIn } from 'lucide-react';

export default function VerificadorActasPage() {
    const { user } = useAuth();
    const db = useFirestore();
    
    const [selectedSeccional, setSelectedSeccional] = useState<string | null>(null);
    const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
    const [allMetadata, setAllMetadata] = useState<Record<string, any>>({});
    const [mesasStatus, setMesasStatus] = useState<any[]>([]);
    const [selectedMesaData, setSelectedMesaData] = useState<any>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'intendencia' | 'junta'>('intendencia');

    // Fetch Metadata (Simplified for Admin)
    useEffect(() => {
        if (!db) return;
        onSnapshot(collection(db, 'seccionales_metadata'), (snap) => {
            const data: any = {};
            snap.docs.forEach(d => data[d.id] = d.data());
            setAllMetadata(data);
        });
    }, [db]);

    // Fetch Mesas Progress
    useEffect(() => {
        if (!db || !selectedLocal) return;
        const q = query(collection(db, 'seguimiento_resultados'), where('local', '==', selectedLocal));
        const unsubscribe = onSnapshot(q, (snap) => {
            setMesasStatus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, [db, selectedLocal]);

    const locales = useMemo(() => {
        if (!selectedSeccional) return [];
        return allMetadata[selectedSeccional]?.locales || [];
    }, [allMetadata, selectedSeccional]);

    const handleViewDetails = async (mesaId: string, mode: 'intendencia' | 'junta') => {
        if (!db) return;
        setViewMode(mode);
        const docRef = doc(db, `actas_${mode}`, mesaId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setSelectedMesaData(snap.data());
            setIsViewerOpen(true);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Verificador de Actas</h1>
                    <p className="text-sm text-muted-foreground">Auditoría visual de fotos vs resultados cargados</p>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Seccional</label>
                        <Select onValueChange={setSelectedSeccional} value={selectedSeccional || ''}>
                            <SelectTrigger><SelectValue placeholder="Selecciona Seccional" /></SelectTrigger>
                            <SelectContent>
                                {Object.keys(allMetadata).sort().map(s => (
                                    <SelectItem key={s} value={s}>SECCIONAL {s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Local de Votación</label>
                        <Select onValueChange={setSelectedLocal} value={selectedLocal || ''}>
                            <SelectTrigger><SelectValue placeholder="Selecciona Local" /></SelectTrigger>
                            <SelectContent>
                                {locales.map((l: string) => (
                                    <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                {mesasStatus.length === 0 ? (
                    <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed">
                        <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Selecciona un local para auditar las actas</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mesasStatus.sort((a,b) => a.mesa - b.mesa).map((m) => (
                            <Card key={m.id} className="overflow-hidden border-l-4 border-l-blue-500">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-lg">Mesa {m.mesa}</h3>
                                            <p className="text-[10px] text-slate-400 uppercase">{m.local}</p>
                                        </div>
                                        <Badge className={m.intendencia_cargado && m.junta_cargado ? 'bg-green-600' : 'bg-amber-500'}>
                                            {m.intendencia_cargado && m.junta_cargado ? 'COMPLETA' : 'PARCIAL'}
                                        </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                            variant={m.intendencia_cargado ? "default" : "outline"} 
                                            size="sm" 
                                            className="text-[10px] h-8 font-bold"
                                            disabled={!m.intendencia_cargado}
                                            onClick={() => handleViewDetails(m.id, 'intendencia')}
                                        >
                                            <ImageIcon className="w-3 h-3 mr-1" /> AUDITAR INT
                                        </Button>
                                        <Button 
                                            variant={m.junta_cargado ? "default" : "outline"} 
                                            size="sm" 
                                            className="text-[10px] h-8 font-bold"
                                            disabled={!m.junta_cargado}
                                            onClick={() => handleViewDetails(m.id, 'junta')}
                                        >
                                            <ImageIcon className="w-3 h-3 mr-1" /> AUDITAR JUN
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* VIEWER DIALOG */}
            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b bg-slate-50">
                        <DialogTitle className="flex justify-between items-center text-sm md:text-lg">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="text-blue-600 w-5 h-5" />
                                Auditoría: Mesa {selectedMesaData?.mesa} - {viewMode.toUpperCase()}
                            </div>
                            <div className="text-[10px] md:text-xs font-normal text-slate-500">
                                Cargado por: {selectedMesaData?.cargadoPor}
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* PHOTO SIDE */}
                        <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center relative border-r overflow-hidden group">
                            {selectedMesaData?.actaImageUrl ? (
                                <>
                                    <img 
                                        src={selectedMesaData.actaImageUrl} 
                                        alt="Acta Original" 
                                        className="max-h-full max-w-full object-contain shadow-2xl transition-transform duration-300 hover:scale-150 cursor-zoom-in"
                                    />
                                    <div className="absolute bottom-4 left-4 bg-black/50 text-white text-[10px] p-2 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        Pasa el mouse para hacer zoom
                                    </div>
                                </>
                            ) : (
                                <div className="text-slate-500 flex flex-col items-center">
                                    <ImageIcon className="w-16 h-16 mb-2 opacity-20" />
                                    <p>No hay foto disponible</p>
                                </div>
                            )}
                        </div>

                        {/* DATA SIDE */}
                        <div className="w-full md:w-80 bg-white flex flex-col border-l shadow-xl">
                            <div className="p-4 border-b bg-blue-50">
                                <h4 className="font-black text-xs uppercase text-blue-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Datos Cargados
                                </h4>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Resultados por Lista</p>
                                        <div className="divide-y border rounded-lg">
                                            {viewMode === 'intendencia' ? (
                                                Object.entries(selectedMesaData?.votes || {}).map(([id, val]: any) => (
                                                    <div key={id} className="flex justify-between p-2 text-sm bg-slate-50/50">
                                                        <span className="font-semibold text-slate-600">Lista {id}</span>
                                                        <span className="font-black text-blue-700">{val}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                Object.entries(selectedMesaData?.votes || {}).map(([listId, options]: any) => (
                                                    <div key={listId} className="p-2 space-y-1">
                                                        <p className="font-black text-xs bg-slate-100 p-1 rounded">Lista {listId}</p>
                                                        {Object.entries(options).map(([opt, val]: any) => (
                                                            <div key={opt} className="flex justify-between text-xs pl-2">
                                                                <span>Opción {opt}</span>
                                                                <span className="font-bold">{val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cierre</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-slate-50 p-2 rounded border">
                                                <p className="text-slate-500">Nulos</p>
                                                <p className="font-bold">{selectedMesaData?.nulos || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded border">
                                                <p className="text-slate-500">Blancos</p>
                                                <p className="font-bold">{selectedMesaData?.blancos || 0}</p>
                                            </div>
                                            <div className="bg-blue-600 text-white p-2 rounded border col-span-2 text-center">
                                                <p className="text-[10px] opacity-80 uppercase font-bold">Total Acta</p>
                                                <p className="text-lg font-black">{selectedMesaData?.total_general || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-6">
                                        <Button className="w-full bg-green-600 hover:bg-green-700 text-xs font-black">
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> MARCAR COMO VERIFICADA
                                        </Button>
                                        <p className="text-[9px] text-slate-400 mt-2 text-center italic">
                                            * Al verificar, confirmas que la foto coincide con los datos.
                                        </p>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
