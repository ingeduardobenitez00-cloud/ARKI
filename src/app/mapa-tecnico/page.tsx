
"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { collection, query, orderBy, getDocs, doc, updateDoc, writeBatch, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map as MapIcon, Loader2, RefreshCw, Settings2, Save, Globe, PenTool, Undo2, Trash2, Layers, MapPin, ChevronRight, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const TechnicalMapDisplay = dynamic(() => import('@/components/TechnicalMapDisplay'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center flex-col gap-2">
    <Loader2 className="animate-spin h-10 w-10 text-primary" />
    <p className="text-xs font-black uppercase tracking-widest animate-pulse">Cargando Capa Geográfica...</p>
  </div>
});

const ZONAS_ESTRATEGICAS = [
    { id: 1, name: "Z1 OESTE", color: "#3b82f6" },
    { id: 2, name: "Z2 CENTRO", color: "#ef4444" },
    { id: 3, name: "Z3 NORTE", color: "#22c55e" },
    { id: 4, name: "Z4 ESTE", color: "#eab308" },
    { id: 5, name: "Z5 SUR", color: "#a855f7" }
];

export default function MapaTecnicoPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [data, setData] = useState<any[]>([]);
    const [zonasData, setZonasData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isImportingPoints, setIsImportingPoints] = useState(false);

    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';

    const fetchData = async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            const [secSnap, zonesSnap] = await Promise.all([
                getDocs(query(collection(db, 'seccionales_data'), orderBy('numero', 'asc'))),
                getDocs(collection(db, 'zonas_data'))
            ]);
            setData(secSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setZonasData(zonesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error fetching data:", e);
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [db]);

    const handleImportPointsFromGeoJSON = async () => {
        if (!db || !isAdmin) return;
        setIsImportingPoints(true);
        try {
            const response = await fetch('/mapa-asuncion.json');
            if (!response.ok) throw new Error("No se halló mapa-asuncion.json");
            const geojson = await response.json();
            const batch = writeBatch(db);
            let count = 0;
            geojson.features.forEach((feature: any) => {
                const num = feature.properties.numero;
                const coords = feature.geometry.coordinates[0];
                let sumLat = 0, sumLng = 0;
                coords.forEach((p: number[]) => { sumLng += p[0]; sumLat += p[1]; });
                const ref = doc(db, 'seccionales_data', String(num));
                batch.update(ref, { lat: sumLat / coords.length, lng: sumLng / coords.length });
                count++;
            });
            await batch.commit();
            toast({ title: "Puntos Importados", description: `Se actualizaron ${count} ubicaciones.` });
            fetchData();
        } catch (e) { toast({ title: "Error al importar", variant: "destructive" }); }
        finally { setIsImportingPoints(false); }
    };

    const handleSyncFromCaptures = async () => {
        if (!db || !isAdmin) return;
        setIsSyncing(true);
        try {
            const capturesSnap = await getDocs(collection(db, 'votos_confirmados'));
            const totalsBySec: Record<string, number> = {};
            capturesSnap.docs.forEach(d => {
                const sec = String(d.data().CODIGO_SEC || '');
                if (sec) totalsBySec[sec] = (totalsBySec[sec] || 0) + 1;
            });
            const batch = writeBatch(db);
            data.forEach(sec => {
                const ref = doc(db, 'seccionales_data', sec.id);
                batch.update(ref, { total_votos_seguros: totalsBySec[sec.id] || 0 });
            });
            await batch.commit();
            toast({ title: "Votos Sincronizados" });
            fetchData();
        } finally { setIsSyncing(false); }
    };

    const handleMapDoubleClick = (lat: number, lng: number) => {
        if (!isEditMode || !selectedSecId || isDrawing) return;
        const ref = doc(db!, 'seccionales_data', selectedSecId);
        setData(prev => prev.map(s => s.id === selectedSecId ? { ...s, lat, lng } : s));
        updateDoc(ref, { lat, lng });
        toast({ title: `Ubicación SECC ${selectedSecId} actualizada` });
    };

    const handleMapClick = (lat: number, lng: number) => {
        if (isDrawing) {
            setDrawingPoints(prev => [...prev, [lat, lng]]);
        }
    };

    const startDrawing = (zoneId: string) => {
        setSelectedZoneId(zoneId);
        setIsDrawing(true);
        setDrawingPoints([]);
        toast({ title: "Modo Dibujo Activo", description: "Haz clic en el mapa para trazar el límite." });
    };

    const saveDrawing = async () => {
        if (!selectedZoneId || drawingPoints.length < 3) {
            toast({ title: "Dibujo insuficiente", description: "Se necesitan al menos 3 puntos.", variant: "destructive" });
            return;
        }
        const zone = ZONAS_ESTRATEGICAS.find(z => String(z.id) === selectedZoneId);
        const ref = doc(db!, 'zonas_data', selectedZoneId);
        const dataToSave = { id: Number(selectedZoneId), nombre: zone?.name || `ZONA ${selectedZoneId}`, boundary: drawingPoints };
        
        await setDoc(ref, dataToSave, { merge: true });
        setZonasData(prev => {
            const exists = prev.find(z => z.id === selectedZoneId);
            if (exists) return prev.map(z => z.id === selectedZoneId ? dataToSave : z);
            return [...prev, dataToSave];
        });
        
        setIsDrawing(false);
        setDrawingPoints([]);
        toast({ title: "Límite de Zona Guardado" });
    };

    const deleteDrawing = async (zoneId: string) => {
        const ref = doc(db!, 'zonas_data', zoneId);
        await updateDoc(ref, { boundary: null });
        setZonasData(prev => prev.map(z => z.id === zoneId ? { ...z, boundary: null } : z));
        toast({ title: "Límite de zona eliminado" });
    };

    const seccionalesPorZona = useMemo(() => {
        const map: Record<number, any[]> = {};
        ZONAS_ESTRATEGICAS.forEach(z => map[z.id] = []);
        data.forEach(s => {
            if (s.zona_id) map[s.zona_id].push(s);
        });
        return map;
    }, [data]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3 text-slate-900">
                        <MapIcon className="h-8 w-8 text-primary" />
                        Gestión Técnica Territorial
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Organiza seccionales y límites por zonas estratégicas.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-primary/10 shadow-sm mr-2">
                            <Settings2 className={cn("h-4 w-4", isEditMode ? "text-primary" : "text-slate-400")} />
                            <Label className="text-[10px] font-black uppercase cursor-pointer">Modo Editor</Label>
                            <Switch checked={isEditMode} onCheckedChange={(val) => { setIsEditMode(val); if(!val) { setIsDrawing(false); setSelectedZoneId(null); } }} />
                        </div>
                    )}
                    {isAdmin && (
                        <>
                            <Button onClick={handleImportPointsFromGeoJSON} variant="outline" className="h-11 px-4 font-black uppercase border-blue-200 text-blue-600 rounded-xl shadow-sm bg-blue-50/50" disabled={isImportingPoints}>
                                {isImportingPoints ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Globe className="mr-2 h-4 w-4" />} PUNTOS GEO
                            </Button>
                            <Button onClick={handleSyncFromCaptures} variant="outline" className="h-11 px-4 font-black uppercase border-primary/20 text-primary rounded-xl shadow-sm" disabled={isSyncing}>
                                {isSyncing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />} SINCRONIZAR VOTOS
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className={cn("lg:col-span-3 border-primary/10 shadow-2xl overflow-hidden bg-white rounded-[2.5rem] h-[750px] relative transition-all", isEditMode && "ring-4 ring-primary/20")}>
                    <CardContent className="p-0 h-full">
                        <TechnicalMapDisplay 
                            data={data} 
                            zonas={zonasData}
                            onMapDoubleClick={handleMapDoubleClick} 
                            onMapClick={handleMapClick}
                            selectedId={selectedSecId}
                            selectedZoneId={selectedZoneId}
                            isDrawing={isDrawing}
                            drawingPoints={drawingPoints}
                        />
                    </CardContent>
                </Card>

                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-primary/10 shadow-xl overflow-hidden bg-white rounded-[2rem] flex flex-col h-[750px]">
                        <CardHeader className="bg-muted/30 border-b py-5 shrink-0">
                            <CardTitle className="text-[11px] font-black uppercase flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" /> Capas de Zona Estratégica
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <Accordion type="multiple" className="w-full px-2 py-4">
                                    {ZONAS_ESTRATEGICAS.map((zona) => {
                                        const zoneSeccionales = seccionalesPorZona[zona.id] || [];
                                        const hasBoundary = zonasData.find(z => Number(z.id) === zona.id)?.boundary;
                                        const isZoneActive = selectedZoneId === String(zona.id);

                                        return (
                                            <AccordionItem key={zona.id} value={`zona-${zona.id}`} className="border-none mb-3">
                                                <AccordionTrigger className={cn(
                                                    "hover:no-underline py-3 px-4 rounded-2xl transition-all border border-slate-100 shadow-sm",
                                                    isZoneActive ? "bg-primary/5 border-primary/20" : "bg-white"
                                                )}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: zona.color }} />
                                                        <span className="font-black text-[11px] uppercase tracking-wider">{zona.name}</span>
                                                        <Badge variant="outline" className="text-[8px] font-black opacity-50">{zoneSeccionales.length}</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pt-2 px-2 pb-4 space-y-4">
                                                    {/* Herramientas de Zona (Solo Modo Editor) */}
                                                    {isEditMode && (
                                                        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Mapa de Zona</p>
                                                                {hasBoundary && <Badge className="bg-green-500 text-[8px] font-black uppercase">POLÍGONO ACTIVO</Badge>}
                                                            </div>
                                                            {isDrawing && selectedZoneId === String(zona.id) ? (
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="outline" className="flex-1 h-9 font-black text-[9px] uppercase border-red-200" onClick={() => setDrawingPoints(p => p.slice(0, -1))}><Undo2 className="h-3 w-3 mr-1" /> DESHACER</Button>
                                                                    <Button size="sm" className="flex-1 h-9 font-black text-[9px] uppercase bg-primary" onClick={saveDrawing}><Save className="h-3 w-3 mr-1" /> GUARDAR</Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="outline" className="flex-1 h-9 font-black text-[9px] uppercase bg-white" onClick={() => startDrawing(String(zona.id))}><PenTool className="h-3 w-3 mr-1" /> TRAZAR</Button>
                                                                    {hasBoundary && <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50" onClick={() => deleteDrawing(String(zona.id))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Lista de Seccionales en la Zona */}
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black uppercase text-muted-foreground px-2 mb-2 tracking-[0.2em]">Seccionales Asignadas</p>
                                                        {zoneSeccionales.length > 0 ? (
                                                            <div className="grid grid-cols-1 gap-1">
                                                                {zoneSeccionales.map((sec) => (
                                                                    <div 
                                                                        key={sec.id} 
                                                                        onClick={() => {
                                                                            setSelectedSecId(sec.id);
                                                                            if (isEditMode) toast({ title: `SECC ${sec.numero} seleccionada`, description: "Haz doble clic en el mapa para moverla." });
                                                                        }}
                                                                        className={cn(
                                                                            "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                                                                            selectedSecId === sec.id 
                                                                                ? "bg-slate-900 border-slate-900 text-white shadow-md translate-x-1" 
                                                                                : "bg-white hover:bg-slate-50 border-transparent hover:border-slate-200"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={cn(
                                                                                "h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                                                                                selectedSecId === sec.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                                                                            )}>
                                                                                {sec.numero}
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black uppercase tracking-tight">Seccional {sec.numero}</span>
                                                                                <span className={cn(
                                                                                    "text-[8px] font-bold uppercase opacity-60",
                                                                                    selectedSecId === sec.id ? "text-white" : "text-slate-400"
                                                                                )}>
                                                                                    {sec.lat !== 0 ? 'Con GPS' : 'Sin GPS'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        {sec.lat !== 0 && (
                                                                            <MapPin className={cn(
                                                                                "h-3 w-3",
                                                                                selectedSecId === sec.id ? "text-primary" : "text-primary/40"
                                                                            )} />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 border-2 border-dashed rounded-2xl opacity-30">
                                                                <p className="text-[9px] font-black uppercase">Sin seccionales</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                        <div className="p-4 bg-muted/10 border-t shrink-0">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Target className="h-3 w-3" />
                                <p className="text-[8px] font-black uppercase tracking-widest">Total: {data.length} Seccionales</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
