"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, limit, orderBy, getDoc, getCountFromServer } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Search, 
    Loader2, 
    Save, 
    PhoneCall, 
    UserCheck, 
    User as UserIcon, 
    SearchCheck,
    MessageSquare,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    PhoneOff,
    History,
    Printer,
    Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';

interface PadronData {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    TELEFONO?: string;
    CODIGO_SEC?: string;
    LOCAL?: string;
    ESTADO_LLAMADA?: string;
    COMENTARIO_LLAMADA?: string;
    ultimaLlamada_fecha?: string;
    ultimaLlamada_por?: string;
}

const COLLECTION_NAME = 'sheet1';

const CALL_STATES = [
    { id: 'CONTESTO', label: 'Contestó', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', activeBg: 'bg-green-600 text-white' },
    { id: 'NO_CONTESTO', label: 'No Contestó', icon: PhoneOff, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', activeBg: 'bg-yellow-500 text-white' },
    { id: 'EQUIVOCADO', label: 'Equivocado', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', activeBg: 'bg-red-600 text-white' },
    { id: 'NUMERO_CAIDO', label: 'Fuera de Servicio', icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', activeBg: 'bg-orange-600 text-white' },
];

export default function SeguimientoLlamadasPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [searchSeccional, setSearchSeccional] = useState('');
    const [searchLocal, setSearchLocal] = useState('');
    const [searchMesa, setSearchMesa] = useState('');
    
    const [searchResults, setSearchResults] = useState<PadronData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const [estadoLlamada, setEstadoLlamada] = useState<string>('');
    const [comentario, setComentario] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingPhone, setEditingPhone] = useState('');
    const [isSavingPhone, setIsSavingPhone] = useState(false);

    const [metadata, setMetadata] = useState<any>(null);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    
    // Historial global reciente y filtros
    const [recentCalls, setRecentCalls] = useState<PadronData[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'CALLED'>('ALL');
    const [visibleCount, setVisibleCount] = useState(100);
    const [totalCallsCount, setTotalCallsCount] = useState<number | null>(null);

    const filteredResults = useMemo(() => {
        if (filterStatus === 'PENDING') return searchResults.filter(p => !p.ESTADO_LLAMADA);
        if (filterStatus === 'CALLED') return searchResults.filter(p => p.ESTADO_LLAMADA);
        return searchResults;
    }, [searchResults, filterStatus]);

    const displayedResults = useMemo(() => {
        return filteredResults.slice(0, visibleCount);
    }, [filteredResults, visibleCount]);

    useEffect(() => {
        setVisibleCount(100);
    }, [searchResults, filterStatus]);

    useEffect(() => {
        if (selectedPerson) {
            setEstadoLlamada(selectedPerson.ESTADO_LLAMADA || '');
            setComentario(selectedPerson.COMENTARIO_LLAMADA || '');
            setEditingPhone(selectedPerson.TELEFONO || '');
        } else {
            setEstadoLlamada('');
            setComentario('');
            setEditingPhone('');
        }
    }, [selectedPerson]);

    useEffect(() => {
        const fetchMeta = async () => {
            if (!searchSeccional || !db) {
                setMetadata(null);
                setSearchLocal('');
                setSearchMesa('');
                return;
            }
            setIsLoadingMetadata(true);
            try {
                const metaDocRef = doc(db, 'seccionales_metadata', searchSeccional.trim());
                const metaDoc = await getDoc(metaDocRef);
                if (metaDoc.exists()) {
                    setMetadata(metaDoc.data());
                } else {
                    setMetadata(null);
                }
            } catch (error) {
                console.error("Error fetching metadata", error);
            } finally {
                setIsLoadingMetadata(false);
            }
        };
        
        const timer = setTimeout(() => {
            fetchMeta();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchSeccional, db]);

    const fetchRecentCalls = async () => {
        if (!db) return;
        setIsLoadingRecent(true);
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('ultimaLlamada_fecha', '>', ''),
                orderBy('ultimaLlamada_fecha', 'desc')
            );
            const snap = await getDocs(q);
            const calls: PadronData[] = [];
            snap.forEach(doc => {
                calls.push({ id: doc.id, ...doc.data() } as PadronData);
            });
            setRecentCalls(calls);

            try {
                const countQ = query(
                    collection(db, COLLECTION_NAME),
                    where('ultimaLlamada_fecha', '>', '')
                );
                const countSnap = await getCountFromServer(countQ);
                setTotalCallsCount(countSnap.data().count);
            } catch (countError) {
                console.error("Error fetching total count", countError);
            }
        } catch (error) {
            console.error("Error fetching recent calls", error);
        } finally {
            setIsLoadingRecent(false);
        }
    };

    useEffect(() => {
        fetchRecentCalls();
    }, [db]);

    const localesList = useMemo(() => metadata?.locales || [], [metadata]);
    const mesasList = useMemo(() => {
        if (!searchLocal || !metadata?.mesas_por_local) return [];
        const localData = metadata.mesas_por_local.find((item: any) => item.localName === searchLocal);
        if (!localData) return [];
        return localData.mesas;
    }, [metadata, searchLocal]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim().toUpperCase();
        const sec = searchSeccional.trim();
        const loc = searchLocal.trim().toUpperCase();
        const mes = searchMesa.trim().toUpperCase();
        
        if (!term && !sec) {
            toast({ title: 'Búsqueda vacía', description: 'Ingresa una Cédula/Nombre o una Seccional.' });
            return;
        }

        setIsSearching(true);
        setSelectedPerson(null);
        setSearchResults([]);
        
        try {
            const resultsMap = new Map<string, PadronData>();
            const dataCollection = collection(db!, COLLECTION_NAME);

            let searchQueries = [];

            if (sec) {
                // Si tenemos Local y Mesa, hacemos la query más pequeña
                if (loc && mes) {
                    searchQueries.push(getDocs(query(
                        dataCollection, 
                        where('CODIGO_SEC', '==', sec),
                        where('LOCAL', '==', loc),
                        where('MESA', 'in', [mes, Number(mes)])
                    )));
                } else if (loc) {
                    searchQueries.push(getDocs(query(
                        dataCollection, 
                        where('CODIGO_SEC', '==', sec),
                        where('LOCAL', '==', loc)
                    )));
                } else {
                    searchQueries.push(getDocs(query(dataCollection, where('CODIGO_SEC', '==', sec))));
                    if (!isNaN(Number(sec))) {
                        searchQueries.push(getDocs(query(dataCollection, where('CODIGO_SEC', '==', Number(sec)))));
                    }
                }
            } else if (term) {
                const isNumericSearch = /^\d+$/.test(term);
                if (isNumericSearch) {
                    searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', Number(term)), limit(50))));
                    searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', term), limit(50))));
                } else {
                    const searchWords = term.split(' ').filter(word => word.length >= 3);
                    if (searchWords.length === 0) {
                        toast({ title: "Búsqueda insuficiente", description: "Ingresa al menos 3 caracteres." });
                        setIsSearching(false);
                        return;
                    }
                    searchWords.forEach(word => {
                        searchQueries.push(getDocs(query(dataCollection, where('NOMBRE', '>=', word), where('NOMBRE', '<=', word + '\uf8ff'), limit(100))));
                        searchQueries.push(getDocs(query(dataCollection, where('APELLIDO', '>=', word), where('APELLIDO', '<=', word + '\uf8ff'), limit(100))));
                    });
                }
            }
            
            const snapshots = await Promise.all(searchQueries);
            snapshots.forEach(snapshot => snapshot.forEach(docSnap => {
                if (!resultsMap.has(docSnap.id)) {
                    resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PadronData);
                }
            }));
            
            let foundResults = Array.from(resultsMap.values());

            // 2. Filtros en memoria adicionales si faltaron en la query
            if (sec) {
                if (loc && !mes) {
                    // Solo si la query no fue exacta, reforzamos en memoria
                    foundResults = foundResults.filter(p => String(p.LOCAL || '').toUpperCase() === loc);
                }
                if (term) {
                    const searchWords = term.split(' ').filter(word => word);
                    foundResults = foundResults.filter(person => {
                        const fullName = `${person.NOMBRE || ''} ${person.APELLIDO || ''}`.toUpperCase();
                        return searchWords.every(word => fullName.includes(word)) || String(person.CEDULA) === term;
                    });
                }
            } else if (term && !/^\d+$/.test(term)) {
                const searchWords = term.split(' ').filter(word => word);
                foundResults = foundResults.filter(person => {
                    const fullName = `${person.NOMBRE || ''} ${person.APELLIDO || ''}`.toUpperCase();
                    return searchWords.every(word => fullName.includes(word));
                });
            }
            
            // 3. Ordenar alfabéticamente
            foundResults.sort((a, b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));

            setSearchResults(foundResults);
            
            if (foundResults.length === 0) {
                toast({ title: 'Sin contactos telefónicos', description: 'No se hallaron electores con número de celular para esta búsqueda.' });
            } else if (foundResults.length === 1) {
                setSelectedPerson(foundResults[0]);
            }
        } catch (error) {
            toast({ title: 'Error de conexión', variant: 'destructive' });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSave = async () => {
        if (!selectedPerson || !db || !user) return;
        setIsSaving(true);
        
        const personRef = doc(db, COLLECTION_NAME, selectedPerson.id);
        const dataToUpdate: any = {
            ESTADO_LLAMADA: estadoLlamada,
            COMENTARIO_LLAMADA: comentario,
            ultimaLlamada_fecha: new Date().toISOString(),
            ultimaLlamada_por: user.name,
            updatedAt: new Date().toISOString(),
            updatedBy_id: user.id,
            updatedBy_nombre: user.name
        };

        updateDoc(personRef, dataToUpdate)
            .then(() => {
                logAction(db, {
                    userId: user.id,
                    userName: user.name,
                    module: 'SEGUIMIENTO LLAMADAS',
                    action: `REGISTRÓ ESTADO: ${estadoLlamada}`,
                    targetId: selectedPerson.id,
                    targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO}`
                });
                
                const updated = { ...selectedPerson, ...dataToUpdate };
                setSelectedPerson(updated);
                setSearchResults(prev => prev.map(p => p.id === selectedPerson.id ? updated : p));
                
                // Agregar a la lista de llamadas recientes global
                setRecentCalls(prev => {
                    const alreadyExists = prev.findIndex(p => p.id === updated.id);
                    if (alreadyExists >= 0) {
                        const newArray = [...prev];
                        newArray[alreadyExists] = updated;
                        return newArray;
                    }
                    return [updated, ...prev];
                });

                if (!selectedPerson.ESTADO_LLAMADA) {
                    setTotalCallsCount(prev => prev !== null ? prev + 1 : null);
                }
                
                toast({ title: '¡Gestión Guardada!', description: 'El seguimiento de la llamada ha sido actualizado.' });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: personRef.path,
                    operation: 'update',
                    requestResourceData: dataToUpdate
                }));
            })
            .finally(() => setIsSaving(false));
    };

    const handleSavePhone = async () => {
        if (!selectedPerson || !db || !user) return;
        setIsSavingPhone(true);
        
        const personRef = doc(db, COLLECTION_NAME, selectedPerson.id);
        const dataToUpdate = { TELEFONO: editingPhone };

        updateDoc(personRef, dataToUpdate)
            .then(() => {
                const updated = { ...selectedPerson, ...dataToUpdate };
                setSelectedPerson(updated);
                setSearchResults(prev => prev.map(p => p.id === selectedPerson.id ? updated : p));
                toast({ title: 'Teléfono Guardado', description: 'El número de teléfono ha sido actualizado exitosamente.' });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: personRef.path,
                    operation: 'update',
                    requestResourceData: dataToUpdate
                }));
                toast({ title: 'Error', description: 'No se pudo guardar el teléfono.', variant: 'destructive' });
            })
            .finally(() => setIsSavingPhone(false));
    };

    const getStatusBadge = (status?: string) => {
        if (!status) return <Badge variant="outline" className="text-[9px] uppercase">Pendiente</Badge>;
        const stateObj = CALL_STATES.find(s => s.id === status);
        if (!stateObj) return <Badge variant="outline" className="text-[9px] uppercase">{status}</Badge>;
        return <Badge className={`text-[9px] uppercase ${stateObj.bg} ${stateObj.color} border-none`}>{stateObj.label}</Badge>;
    };

    const handlePrintReport = async () => {
        setIsPrinting(true);
        
        try {
            // Obtener absolutamente todos los registros que tienen fecha de llamada
            const q = query(
                collection(db!, COLLECTION_NAME),
                where('ultimaLlamada_fecha', '>', ''),
                orderBy('ultimaLlamada_fecha', 'desc')
            );
            const snap = await getDocs(q);
            const allCalls: PadronData[] = [];
            snap.forEach(docSnap => {
                allCalls.push({ id: docSnap.id, ...docSnap.data() } as PadronData);
            });

            if (allCalls.length === 0) {
                toast({ title: "Sin datos", description: "No hay registros de llamadas en la base de datos para imprimir." });
                setIsPrinting(false);
                return;
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            
            doc.setFontSize(14); doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold");
            doc.text("REPORTE DE SEGUIMIENTO DE LLAMADAS", pageWidth / 2, 15, { align: 'center' });
            
            doc.setFontSize(9); doc.setTextColor(80, 80, 80);
            doc.text(`HISTORIAL GLOBAL DE LLAMADAS (${allCalls.length} REGISTROS)`, pageWidth / 2, 22, { align: 'center' });

            const tableColumn = ["ELECTOR", "CÉDULA / SECC", "ESTADO", "COMENTARIO", "OPERADOR / HORA"];
            const tableRows = allCalls.map(p => [
                `${p.NOMBRE} ${p.APELLIDO}`,
                `C.I. ${p.CEDULA}\nSECC ${p.CODIGO_SEC || '-'}`,
                CALL_STATES.find(s => s.id === p.ESTADO_LLAMADA)?.label || 'PENDIENTE',
                (p.COMENTARIO_LLAMADA || '').substring(0, 60),
                `${p.ultimaLlamada_por || '-'}\n${p.ultimaLlamada_fecha ? new Date(p.ultimaLlamada_fecha).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'}) : ''}`
            ]);

            (doc as any).autoTable({ 
                head: [tableColumn], 
                body: tableRows, 
                startY: 28, 
                styles: { fontSize: 7, cellPadding: 2, halign: 'center' }, 
                headStyles: { fillColor: [239, 68, 68] }, 
                margin: { top: 28, left: 5, right: 5 } 
            });
            
            const today = new Date().toISOString().split('T')[0];
            doc.save(`Reporte_Global_Llamadas_${today}.pdf`);
            toast({ title: "Reporte generado", description: "El PDF se ha generado correctamente con todos los registros." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error al generar reporte", variant: "destructive" });
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <PhoneCall className="h-8 w-8 text-primary" />
                        Seguimiento de Llamadas
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Call center: escanea, contacta y registra resultados.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handlePrintReport} 
                        disabled={isPrinting}
                        className="font-black uppercase text-[10px] border-primary/20 hover:bg-primary/5 text-primary h-10"
                    >
                        {isPrinting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
                        IMPRIMIR REPORTE
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <Filter className="h-4 w-4 text-primary" /> Filtros de Padrón
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black">Búsqueda Directa</Label>
                                    <Input 
                                        placeholder="CÉDULA O NOMBRE..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="font-bold uppercase h-11" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-t pt-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-[10px] uppercase font-black text-primary">Seccional (Requerido para filtros)</Label>
                                        <Input 
                                            placeholder="N° SECC..." 
                                            value={searchSeccional} 
                                            onChange={(e) => setSearchSeccional(e.target.value)} 
                                            className="font-bold uppercase h-11 border-primary/20 bg-primary/5" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black">Local</Label>
                                        {localesList.length > 0 ? (
                                            <Select value={searchLocal} onValueChange={(val) => { setSearchLocal(val); setSearchMesa(''); }}>
                                                <SelectTrigger className="h-11 font-bold uppercase"><SelectValue placeholder="SELECCIONAR LOCAL..." /></SelectTrigger>
                                                <SelectContent>
                                                    {localesList.map((l: string) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input 
                                                placeholder={isLoadingMetadata ? "CARGANDO..." : "EJ: COLEGIO..."} 
                                                value={searchLocal} 
                                                onChange={(e) => setSearchLocal(e.target.value)} 
                                                className="font-bold uppercase h-11" 
                                                disabled={!searchSeccional || isLoadingMetadata}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black">Mesa</Label>
                                        {mesasList.length > 0 ? (
                                            <Select value={searchMesa} onValueChange={setSearchMesa}>
                                                <SelectTrigger className="h-11 font-bold uppercase"><SelectValue placeholder="N° MESA..." /></SelectTrigger>
                                                <SelectContent>
                                                    {mesasList.map((m: number) => <SelectItem key={m} value={String(m)}>Mesa {m}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input 
                                                placeholder={isLoadingMetadata ? "CARGANDO..." : "N° MESA..."} 
                                                value={searchMesa} 
                                                onChange={(e) => setSearchMesa(e.target.value)} 
                                                className="font-bold uppercase h-11" 
                                                disabled={!searchSeccional || isLoadingMetadata}
                                            />
                                        )}
                                    </div>
                                </div>
                                <Button type="submit" disabled={isSearching} className="w-full h-11 font-black uppercase tracking-widest mt-2">
                                    {isSearching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
                                    BUSCAR / FILTRAR
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase flex items-center justify-between">
                                Lista de Contactos
                                <Badge variant="secondary" className="bg-primary/10 text-primary">{filteredResults.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <div className="px-4 pt-4 pb-2 border-b bg-slate-50/50">
                            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)} className="w-full">
                                <TabsList className="w-full grid grid-cols-3 h-8">
                                    <TabsTrigger value="ALL" className="text-[9px] font-black uppercase">Todos</TabsTrigger>
                                    <TabsTrigger value="PENDING" className="text-[9px] font-black uppercase">Pend.</TabsTrigger>
                                    <TabsTrigger value="CALLED" className="text-[9px] font-black uppercase">Hechos</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <CardContent className="pt-4 p-0 sm:p-6">
                            {isSearching ? (
                                <div className="space-y-2 p-4 sm:p-0">
                                    <Skeleton className="h-16 w-full rounded-xl" />
                                    <Skeleton className="h-16 w-full rounded-xl" />
                                </div>
                            ) : filteredResults.length > 0 ? (
                                <RadioGroup 
                                    onValueChange={(id) => setSelectedPerson(filteredResults.find(p => p.id === id) || null)} 
                                    value={selectedPerson?.id || ''}
                                >
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto p-4 sm:p-0 pr-2 scrollbar-thin">
                                        {displayedResults.map(person => (
                                            <div 
                                                key={person.id} 
                                                className={cn(
                                                    "flex items-center space-x-3 border rounded-2xl p-4 transition-all cursor-pointer hover:bg-slate-50",
                                                    selectedPerson?.id === person.id ? "border-primary bg-primary/[0.02] shadow-sm" : "border-slate-200 bg-white"
                                                )}
                                                onClick={() => setSelectedPerson(person)}
                                            >
                                                <RadioGroupItem value={person.id} id={person.id} className="sr-only" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <p className="font-black text-xs uppercase tracking-tight text-slate-900 truncate">
                                                            {person.NOMBRE} {person.APELLIDO}
                                                        </p>
                                                        {getStatusBadge(person.ESTADO_LLAMADA)}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase">C.I. {person.CEDULA}</p>
                                                        <span className="text-[10px] text-slate-300">|</span>
                                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">SECC {person.CODIGO_SEC}</p>
                                                    </div>
                                                    {person.TELEFONO && (
                                                        <p className="text-[11px] font-black text-green-600 mt-1.5 truncate">
                                                            📞 {person.TELEFONO}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {visibleCount < filteredResults.length && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full mt-4 h-12 font-black uppercase tracking-widest text-[10px] border-dashed text-slate-500 hover:text-primary hover:border-primary/50"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setVisibleCount(prev => prev + 100);
                                                }}
                                            >
                                                Cargar más resultados ({filteredResults.length - visibleCount} restantes)
                                            </Button>
                                        )}
                                    </div>
                                </RadioGroup>
                            ) : (
                                <div className="text-center py-16 opacity-30">
                                    <SearchCheck className="h-12 w-12 mx-auto mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Esperando Búsqueda</p>
                                    <p className="text-[9px] mt-2 max-w-[200px] mx-auto leading-relaxed">Usa los filtros de la izquierda para buscar electores y empezar a llamar.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-primary/10 shadow-xl overflow-hidden min-h-[600px] h-full flex flex-col">
                        <CardHeader className="bg-slate-900 border-b border-slate-800 py-5">
                            <CardTitle className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white">
                                <UserCheck className="h-5 w-5 text-primary" />
                                Gestión de Llamada
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 flex-1 flex flex-col">
                            {selectedPerson ? (
                                <div className="space-y-8 w-full max-w-3xl mx-auto flex-1">
                                    <div className="flex flex-col md:flex-row gap-6 p-6 rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                                        <div className="flex-1 space-y-2">
                                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Elector a Contactar</Label>
                                            <p className="text-xl font-black uppercase leading-tight text-slate-900">
                                                {selectedPerson.NOMBRE} {selectedPerson.APELLIDO}
                                            </p>
                                            <div className="flex gap-3 text-xs font-bold text-slate-600">
                                                <span>C.I. {selectedPerson.CEDULA}</span>
                                                <span>•</span>
                                                <span>SECC {selectedPerson.CODIGO_SEC}</span>
                                            </div>
                                        </div>
                                        {selectedPerson.TELEFONO ? (
                                            <div className="md:border-l border-slate-200 md:pl-6 pt-4 md:pt-0 space-y-2 flex flex-col justify-center">
                                                <Label className="text-[9px] font-black uppercase text-green-600 tracking-widest flex items-center justify-between w-full">
                                                    <span>Teléfono Principal</span>
                                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] bg-slate-100 hover:bg-slate-200" onClick={() => setSelectedPerson({ ...selectedPerson, TELEFONO: '' })}>Editar</Button>
                                                </Label>
                                                <a href={`tel:${selectedPerson.TELEFONO.replace(/\D/g,'')}`} className="text-2xl font-black text-green-700 hover:underline">
                                                    {selectedPerson.TELEFONO}
                                                </a>
                                                <a href={`https://wa.me/${selectedPerson.TELEFONO.replace(/\D/g,'').replace(/^0/,'595')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-green-600 uppercase hover:underline inline-flex items-center gap-1">
                                                    <MessageSquare className="h-3 w-3" />
                                                    Abrir WhatsApp
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="md:border-l border-slate-200 md:pl-6 pt-4 md:pt-0 space-y-2 flex flex-col justify-center">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Agregar Teléfono</Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        value={editingPhone} 
                                                        onChange={(e) => setEditingPhone(e.target.value)} 
                                                        placeholder="09xx-xxx-xxx" 
                                                        className="h-10 text-xs font-black uppercase border-slate-300"
                                                    />
                                                    <Button 
                                                        onClick={handleSavePhone} 
                                                        disabled={isSavingPhone || !editingPhone.trim()}
                                                        className="h-10 bg-slate-800 hover:bg-slate-700 text-white shadow-sm"
                                                    >
                                                        {isSavingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                                <p className="text-[8px] font-bold text-red-500 uppercase">Sin teléfono registrado</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            1. Resultado de la Llamada (Check-in)
                                        </Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {CALL_STATES.map((state) => {
                                                const isSelected = estadoLlamada === state.id;
                                                return (
                                                    <button
                                                        key={state.id}
                                                        onClick={() => setEstadoLlamada(state.id)}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 gap-2 h-24",
                                                            isSelected 
                                                                ? `${state.activeBg} border-transparent shadow-lg scale-105` 
                                                                : `bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:bg-slate-50`
                                                        )}
                                                    >
                                                        <state.icon className={cn("h-6 w-6", isSelected ? "text-white" : state.color)} />
                                                        <span className="text-[10px] font-black uppercase text-center">{state.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-3 flex-1 flex flex-col">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                                            <span>2. Comentario de Respuesta</span>
                                            {selectedPerson.ultimaLlamada_fecha && (
                                                <span className="flex items-center gap-1 text-[8px] text-slate-400">
                                                    <History className="h-3 w-3" /> 
                                                    Última: {new Date(selectedPerson.ultimaLlamada_fecha).toLocaleDateString()} por {selectedPerson.ultimaLlamada_por}
                                                </span>
                                            )}
                                        </Label>
                                        <Textarea 
                                            value={comentario}
                                            onChange={(e) => setComentario(e.target.value)}
                                            placeholder="Escribe aquí los detalles de la conversación, solicitudes o si pidió que lo llamen más tarde..."
                                            className="min-h-[120px] resize-none text-sm font-medium border-slate-200 rounded-2xl p-4 focus-visible:ring-primary/20"
                                        />
                                    </div>

                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !estadoLlamada} 
                                        className="w-full h-16 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin mr-3 h-5 w-5" /> : <Save className="mr-3 h-5 w-5" />}
                                        GUARDAR GESTIÓN
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-[3rem] bg-slate-50/50 opacity-40 m-6">
                                    <PhoneCall className="h-16 w-16 mb-6" />
                                    <p className="font-black uppercase tracking-[0.2em] text-xs text-center px-8 leading-loose">
                                        Selecciona un elector de la lista<br/>para iniciar el check-in.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Lista de personas ya llamadas - Historial Global */}
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b py-4">
                        <CardTitle className="text-xs font-black uppercase flex items-center justify-between">
                            <span className="flex items-center gap-2 text-primary">
                                <History className="h-4 w-4" /> Historial de Seguimiento (Completo)
                            </span>
                            <div className="flex items-center gap-3">
                                {totalCallsCount !== null && (
                                    <div className="hidden sm:flex items-center gap-1.5 px-3 h-6 rounded-full bg-primary/10 text-primary border border-primary/20">
                                        <span className="text-[9px] font-black uppercase tracking-widest">Total Global:</span>
                                        <span className="text-[10px] font-black">{totalCallsCount}</span>
                                    </div>
                                )}
                                {isLoadingRecent && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                <Button variant="ghost" size="sm" onClick={fetchRecentCalls} className="h-6 px-2 text-[9px] font-black uppercase hover:bg-primary/10">Actualizar</Button>
                                <Badge variant="secondary" className="bg-white text-[10px]">{recentCalls.length}</Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentCalls.length === 0 && !isLoadingRecent ? (
                            <div className="p-8 text-center text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                                Aún no hay registros de llamadas en la base de datos.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 text-[9px] font-black uppercase border-b">
                                        <TableHead className="pl-6 py-3">Elector</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Comentario</TableHead>
                                        <TableHead className="text-right pr-6">Operador / Hora</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentCalls.map(person => (
                                        <TableRow key={person.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedPerson(person)}>
                                            <TableCell className="pl-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-[10px] uppercase text-slate-900">{person.NOMBRE} {person.APELLIDO}</span>
                                                    <span className="text-[9px] text-slate-500 font-bold mt-0.5">C.I. {person.CEDULA} | SECC {person.CODIGO_SEC}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(person.ESTADO_LLAMADA)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-[10px] font-medium text-slate-600 line-clamp-2 max-w-xs">{person.COMENTARIO_LLAMADA || '-'}</span>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-primary uppercase">{person.ultimaLlamada_por}</span>
                                                    <span className="text-[9px] text-muted-foreground font-bold mt-0.5">
                                                        {person.ultimaLlamada_fecha ? new Date(person.ultimaLlamada_fecha).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'}) : ''}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
