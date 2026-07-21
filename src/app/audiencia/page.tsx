"use client";

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { collection, getDocs, getDoc, query, where, doc, updateDoc, setDoc, deleteDoc, limit, orderBy, increment } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Search, 
    Loader2, 
    Save, 
    Navigation,
    UserCheck, 
    Lock, 
    History, 
    User as UserIcon, 
    Trash2, 
    Zap,
    MessageSquare,
    ClipboardList,
    AlertCircle,
    Eye,
    MapPin,
    Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';

interface PadronData {
    id: string; 
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    [key: string]: any; 
    observacion?: string;
    TELEFONO?: string;
    CODIGO_SEC?: string;
    LOCAL?: string;
    registradoPor_id?: string;
    registradoPor_nombre?: string;
}

const COLLECTION_PADRON = 'sheet1';
const COLLECTION_AUDIENCIA = 'pedidos_audiencia';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="animate-spin" /></div>
});

export default function AudienciaPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PadronData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Nuevos campos del formulario de audiencia
    const [telefono, setTelefono] = useState('');
    const [dirigenteAcompanante, setDirigenteAcompanante] = useState('');
    const [categoriaPedido, setCategoriaPedido] = useState('');
    const [descripcionPedido, setDescripcionPedido] = useState('');
    
    const [manualLat, setManualLat] = useState('');
    const [manualLon, setManualLon] = useState('');
    const [isCapturingLocation, setIsCapturingLocation] = useState(false);
    const [showGps, setShowGps] = useState(false);
    
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [pedidoToDelete, setPedidoToDelete] = useState<PadronData | null>(null);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
    const isPresidente = user?.role === 'Presidente';
    const isCoordinador = user?.role === 'Coordinador';
    const canDelete = isAdmin || isPresidente || isCoordinador || user?.moduleActions?.['/audiencia']?.includes('delete');

    const userSeccionales = useMemo(() => {
        if (!user) return [];
        return user.seccionales || (user.seccional ? [user.seccional] : []);
    }, [user]);

    const usersQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return query(collection(db, 'users'));
    }, [db, user]);
    const { data: allUsers } = useCollection<any>(usersQuery);

    // Query para obtener los pedidos registrados
    const registeredQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        
        // Limitar por jurisdicción si es necesario, o traer todo si es admin
        if (user.role === 'Dirigente') {
            return query(
                collection(db, COLLECTION_AUDIENCIA),
                where('registradoPor_id', '==', user.id),
                orderBy('createdAt', 'desc')
            );
        }

        return query(
            collection(db, COLLECTION_AUDIENCIA),
            orderBy('createdAt', 'desc')
        );
    }, [db, user]);

    const { data: rawList, isLoading: isLoadingList, error: listError } = useCollection<PadronData>(registeredQuery);

    const historicalCount = useMemo(() => {
        if (!selectedPerson || !rawList) return 0;
        return rawList.filter(p => p.CEDULA === selectedPerson.CEDULA).length;
    }, [selectedPerson, rawList]);

    const applyPhoneMask = (value: string) => {
        const cleanValue = value.replace(/\D/g, '').slice(0, 10);
        let formatted = cleanValue;
        if (cleanValue.length > 4 && cleanValue.length <= 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4)}`;
        else if (cleanValue.length > 7) formatted = `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 7)}-${cleanValue.slice(7)}`;
        return formatted;
    };

    useEffect(() => {
        if (selectedPerson) {
            setTelefono(applyPhoneMask(selectedPerson.TELEFONO || ''));
            setDirigenteAcompanante('');
            setCategoriaPedido('');
            setDescripcionPedido('');
            setManualLat(selectedPerson.LATITUD?.toString() || '');
            setManualLon(selectedPerson.LONGITUD?.toString() || '');
            setShowGps(false);
        }
    }, [selectedPerson]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim().toUpperCase();
        if (!term) return;

        setIsSearching(true);
        setSelectedPerson(null);
        setSearchResults([]);
        
        try {
            const resultsMap = new Map<string, PadronData>();
            const dataCollection = collection(db!, COLLECTION_PADRON);
            const isNumericSearch = /^\d+$/.test(term);

            let searchQueries = [];
            if (isNumericSearch) {
                searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', Number(term)), limit(20))));
                searchQueries.push(getDocs(query(dataCollection, where('CEDULA', '==', term), limit(20))));
            } else {
                const words = term.split(' ').filter(w => w.length >= 3);
                if (words.length === 0) { setIsSearching(false); return; }
                words.forEach(w => {
                    searchQueries.push(getDocs(query(dataCollection, where('NOMBRE', '>=', w), where('NOMBRE', '<=', w + '\uf8ff'), limit(100))));
                    searchQueries.push(getDocs(query(dataCollection, where('APELLIDO', '>=', w), where('APELLIDO', '<=', w + '\uf8ff'), limit(100))));
                });
            }
            
            const snapshots = await Promise.all(searchQueries);
            snapshots.forEach(snapshot => snapshot.forEach(docSnap => {
                if (!resultsMap.has(docSnap.id)) resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PadronData);
            }));
            
            let foundResults = Array.from(resultsMap.values());
            
            if (!isNumericSearch) {
                const words = term.split(' ').filter(w => w);
                foundResults = foundResults.filter(p => {
                    const full = `${p.NOMBRE || ''} ${p.APELLIDO || ''}`.toUpperCase();
                    return words.every(w => full.includes(w));
                });
            }
            foundResults.sort((a, b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
            setSearchResults(foundResults);
            if (foundResults.length === 0) toast({ title: 'Sin resultados' });
            else if (foundResults.length === 1) setSelectedPerson(foundResults[0]);
        } catch (error) { toast({ title: 'Error de conexión', variant: 'destructive' }); } finally { setIsSearching(false); }
    };

    const handleLocationPick = (lat: number, lon: number) => {
        setManualLat(lat.toFixed(6));
        setManualLon(lon.toFixed(6));
        toast({ title: "Ubicación Fijada" });
    };

    const handleCaptureLocation = () => {
        if (!navigator.geolocation) return;
        setIsCapturingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { setManualLat(pos.coords.latitude.toString()); setManualLon(pos.coords.longitude.toString()); setIsCapturingLocation(false); },
            () => setIsCapturingLocation(false),
            { enableHighAccuracy: true }
        );
    };

    const handleSave = async () => {
        if (!selectedPerson || !user || !db || !categoriaPedido || !descripcionPedido) {
            toast({ title: 'Faltan datos requeridos', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        const dataToSave: any = {
            ...selectedPerson,
            telefono_contacto: telefono,
            dirigenteAcompanante: dirigenteAcompanante,
            categoriaPedido: categoriaPedido,
            descripcionPedido: descripcionPedido,
            registradoPor_id: user.id,
            registradoPor_nombre: user.name,
            createdAt: new Date().toISOString()
        };

        if (manualLat && manualLon) {
            dataToSave.LATITUD = parseFloat(manualLat);
            dataToSave.LONGITUD = parseFloat(manualLon);
            dataToSave.ubicadoPor_id = user.id;
            dataToSave.ubicadoPor_nombre = user.name;
        }

        const capturaRef = doc(db, COLLECTION_AUDIENCIA, `${selectedPerson.id}_${Date.now()}`); // Permitir múltiples pedidos por persona

        Promise.all([
            setDoc(capturaRef, dataToSave)
        ]).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'AUDIENCIA', action: 'REGISTRÓ PEDIDO', targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO} - ${categoriaPedido}` });
            toast({ title: '¡Pedido Registrado con Éxito!' });
            
            setSearchTerm(''); 
            setSearchResults([]); 
            setSelectedPerson(null); 
            setTelefono(''); 
            setDirigenteAcompanante('');
            setCategoriaPedido('');
            setDescripcionPedido('');
            setManualLat('');
            setManualLon('');
            setShowGps(false);
        }).catch(() => {
            toast({ title: 'Error al guardar', variant: 'destructive' });
        }).finally(() => setIsSaving(false));
    };

    const handleDeletePedido = async () => {
        if (!pedidoToDelete || !db || !user) return;
        setIsDeleting(true);
        const capturaRef = doc(db, COLLECTION_AUDIENCIA, pedidoToDelete.id);

        deleteDoc(capturaRef).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'AUDIENCIA', action: 'ELIMINÓ PEDIDO', targetName: `${pedidoToDelete.NOMBRE}` });
            toast({ title: 'Pedido eliminado' });
        }).finally(() => { setIsDeleting(false); setIsDeleteAlertOpen(false); setPedidoToDelete(null); });
    };

    // Agrupación de pedidos por seccional
    const groupedCaptures = useMemo(() => {
        const groups: Record<string, { seccional: string, totalPedidos: number, pedidos: PadronData[] }> = {};
        if (!rawList) return groups;
        
        rawList.forEach(item => {
            const itemSecc = String(item.CODIGO_SEC || 'SIN SECCIONAL');
            
            if (!groups[itemSecc]) {
                groups[itemSecc] = { seccional: itemSecc, totalPedidos: 0, pedidos: [] };
            }
            
            groups[itemSecc].pedidos.push(item);
            groups[itemSecc].totalPedidos += 1;
        });

        const sortedGroups: typeof groups = {};
        Object.keys(groups)
            .sort((a, b) => {
                const secA = parseInt(a.replace(/\D/g, ''), 10) || 999999;
                const secB = parseInt(b.replace(/\D/g, ''), 10) || 999999;
                if (secA !== secB) return secA - secB;
                return a.localeCompare(b);
            })
            .forEach(secKey => {
                sortedGroups[secKey] = groups[secKey];
            });
            
        return sortedGroups;
    }, [rawList]);

    const isAllowedRole = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente' || user?.role === 'Coordinador' || user?.role === 'Dirigente';

    if (user && !isAllowedRole) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="h-20 w-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shadow-sm">
                    <Lock className="h-10 w-10 stroke-[2]" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-black uppercase text-red-600 tracking-tight">Acceso Restringido</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><ClipboardList className="h-8 w-8 text-primary" /> Audiencia / Pedidos</h1>
                    <div className="mt-2 space-y-1">
                        <p className="text-slate-900 font-black flex items-center gap-2 uppercase text-[11px] tracking-tight">
                            <UserIcon className="h-3.5 w-3.5 text-primary" /> Operador: {user?.name}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-black px-4 py-2 text-xs">
                        {rawList?.length || 0} PEDIDOS REGISTRADOS
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase">Buscar Solicitante</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <Input placeholder="CÉDULA O NOMBRE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 font-black uppercase h-11" />
                                <Button type="submit" disabled={isSearching} className="h-11 px-4">{isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase">Coincidencias</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            {isSearching ? <div className="space-y-2"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div> : 
                            searchResults.length > 0 ? <RadioGroup onValueChange={(id) => setSelectedPerson(searchResults.find(p => p.id === id) || null)} value={selectedPerson?.id || ''}><div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                {searchResults.map(p => (<div key={p.id} className={cn("flex items-center space-x-3 border rounded-2xl p-4 cursor-pointer", selectedPerson?.id === p.id ? "border-primary bg-primary/[0.02]" : "border-slate-100")} onClick={() => setSelectedPerson(p)}><RadioGroupItem value={p.id} className="sr-only" /><div className="flex-1 text-left"><p className="font-black text-xs uppercase text-slate-900">{p.NOMBRE} {p.APELLIDO}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-muted-foreground font-bold uppercase">C.I. {p.CEDULA}</span><Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-black text-[9px] h-5 px-2 rounded-full ring-1 ring-primary/20">SECC {p.CODIGO_SEC}</Badge></div></div></div>))}</div></RadioGroup> : 
                            <div className="text-center py-12 opacity-20"><Zap className="h-12 w-12 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Esperando Búsqueda</p></div>}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-primary/10 shadow-lg overflow-hidden min-h-[500px]">
                        <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="flex items-center gap-3 font-black uppercase text-xs"><ClipboardList className="h-4 w-4 text-primary" /> Formulario de Pedido</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            {selectedPerson ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-5 rounded-2xl border border-primary/10 text-xs relative">
                                    {historicalCount > 0 && (
                                        <div className="absolute -top-3 -right-3 bg-red-600 text-white font-black text-[10px] uppercase px-3 py-1.5 rounded-full shadow-lg border-2 border-white animate-bounce flex items-center gap-1 z-10">
                                            <History className="h-3 w-3" /> VINO {historicalCount} {historicalCount === 1 ? 'VEZ' : 'VECES'}
                                        </div>
                                    )}
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Cédula</Label><p className="font-black text-sm">{selectedPerson.CEDULA}</p></div>
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Solicitante</Label><p className="font-black text-sm uppercase">{selectedPerson.NOMBRE} {selectedPerson.APELLIDO}</p></div>
                                    <div className="sm:col-span-2"><Label className="text-[9px] uppercase font-black text-muted-foreground">Referencia</Label><p className="font-black uppercase">{selectedPerson.LOCAL} | M: {selectedPerson.MESA} / O: {selectedPerson.ORDEN}</p></div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="font-black text-[10px] uppercase">WhatsApp Contacto</Label>
                                                <Input value={telefono} onChange={(e) => setTelefono(applyPhoneMask(e.target.value))} placeholder="0981-123-456" className="h-11 font-black" inputMode="numeric"/>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-black text-[10px] uppercase text-primary">Con qué dirigente vino</Label>
                                                <Input 
                                                    list="dirigentes-list"
                                                    value={dirigenteAcompanante} 
                                                    onChange={(e) => setDirigenteAcompanante(e.target.value)} 
                                                    placeholder="BUSCAR O ESCRIBIR DIRIGENTE..." 
                                                    className="h-11 font-black uppercase border-primary/50" 
                                                />
                                                <datalist id="dirigentes-list">
                                                    {allUsers?.slice().sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(u => (
                                                        <option key={u.id} value={u.name || u.email || 'SIN NOMBRE'} />
                                                    ))}
                                                    <option value="NINGUNO / VINO SOLO" />
                                                </datalist>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="font-black text-[10px] uppercase text-primary">Categoría del Pedido *</Label>
                                            <Select value={categoriaPedido} onValueChange={setCategoriaPedido}>
                                                <SelectTrigger className="h-11 font-black uppercase border-primary/50">
                                                    <SelectValue placeholder="Seleccione la categoría..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Gestión en la Municipalidad">Gestión en la Municipalidad</SelectItem>
                                                    <SelectItem value="Recategorizacion">Recategorización</SelectItem>
                                                    <SelectItem value="Contrato">Contrato</SelectItem>
                                                    <SelectItem value="Nombramiento">Nombramiento</SelectItem>
                                                    <SelectItem value="Otros">Otros</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="font-black text-[10px] uppercase text-primary">Descripción del Pedido *</Label>
                                            <Textarea 
                                                value={descripcionPedido} 
                                                onChange={(e) => setDescripcionPedido(e.target.value)} 
                                                placeholder="Detalles del pedido..." 
                                                className="min-h-[120px] resize-none font-black uppercase border-primary/50"
                                            />
                                        </div>

                                        <Button 
                                            onClick={handleSave} 
                                            disabled={isSaving || !categoriaPedido || !descripcionPedido} 
                                            className="w-full h-14 font-black uppercase text-base bg-primary shadow-xl rounded-2xl"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />} GUARDAR PEDIDO
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {!showGps ? (
                                            <Button 
                                                variant="outline" 
                                                className="w-full h-full min-h-[330px] border-dashed border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 font-black uppercase rounded-3xl flex flex-col items-center justify-center gap-2 transition-all"
                                                onClick={() => setShowGps(true)}
                                            >
                                                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                    <MapPin className="h-7 w-7 text-slate-400" />
                                                </div>
                                                <span className="text-sm">TOQUE AQUÍ PARA FIJAR LA UBICACIÓN DEL VOTANTE</span>
                                                <span className="text-[10px] font-bold opacity-50 tracking-widest bg-slate-200 text-slate-600 px-3 py-1 rounded-full mt-1">OPCIONAL</span>
                                            </Button>
                                        ) : (
                                            <>
                                                <div className="h-[280px] border-2 rounded-3xl overflow-hidden shadow-inner"><MapPicker key={`picker-${selectedPerson.id}-${manualLat}-${manualLon}`} lat={manualLat ? parseFloat(manualLat) : null} lon={manualLon ? parseFloat(manualLon) : null} onLocationPick={handleLocationPick} /></div>
                                                <Button variant="secondary" className="w-full bg-red-600 text-white h-11 font-black rounded-xl text-xs uppercase" onClick={handleCaptureLocation} disabled={isCapturingLocation}><Navigation className="mr-2 h-4 w-4" /> CAPTURAR GPS</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            ) : (
                            <div className="text-center text-muted-foreground py-32 border-2 border-dashed rounded-3xl opacity-30">
                                <p className="font-black uppercase text-xs">Selecciona un ciudadano para registrar su pedido</p>
                            </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4 flex flex-row items-center justify-between gap-4">
                    <CardTitle className="text-sm font-black uppercase">Seguimiento de Pedidos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingList ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
                    Object.keys(groupedCaptures).length > 0 ? (
                        <div className="p-4">
                            <Accordion type="multiple" className="w-full space-y-4">
                                {Object.entries(groupedCaptures).map(([seccional, seccionalData]) => (
                                    <AccordionItem key={`sec-${seccional}`} value={`sec-${seccional}`} className="border-2 border-primary/20 rounded-2xl px-4 bg-muted/10 shadow-sm overflow-hidden">
                                        <AccordionTrigger className="hover:no-underline py-5">
                                            <div className="flex items-center gap-4 w-full">
                                                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                                                    <span className="font-black text-white text-xs">{seccional === 'SIN SECCIONAL' ? '-' : `S${seccional}`}</span>
                                                </div>
                                                <div className="flex flex-col flex-1 text-left">
                                                    <span className="font-black text-lg uppercase text-slate-900 tracking-tight">{seccional === 'SIN SECCIONAL' ? 'SIN SECCIONAL' : `SECCIONAL ${seccional}`}</span>
                                                </div>
                                                <Badge variant="default" className="text-sm font-black shadow-sm shrink-0 px-3 py-1.5">{seccionalData.totalPedidos} PEDIDOS</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-4">
                                            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/50 text-[10px] font-black uppercase">
                                                                <TableHead>Solicitante</TableHead>
                                                                <TableHead>Dirigente Acompañante</TableHead>
                                                                <TableHead>Categoría</TableHead>
                                                                <TableHead>Detalle</TableHead>
                                                                <TableHead className="text-right">Acción</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {seccionalData.pedidos.map((p) => (
                                                                <TableRow key={p.id} className="hover:bg-muted/20">
                                                                    <TableCell className="font-black text-[11px] uppercase">
                                                                        {p.NOMBRE} {p.APELLIDO}
                                                                        <div className="text-[9px] text-muted-foreground mt-0.5">C.I: {p.CEDULA} | TEL: {p.telefono_contacto || '-'}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-[10px] uppercase font-bold text-slate-700">
                                                                        {p.dirigenteAcompanante || <span className="text-muted-foreground italic">NINGUNO</span>}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-[9px] border-primary/20 text-primary uppercase">
                                                                            {p.categoriaPedido}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-[10px] uppercase max-w-[200px] truncate" title={p.descripcionPedido}>
                                                                        {p.descripcionPedido}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex justify-end gap-1">
                                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => { if(canDelete){ setPedidoToDelete(p); setIsDeleteAlertOpen(true); } else toast({title: "Bloqueado", variant: "destructive"}); }} disabled={!canDelete}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    ) : <div className="text-center py-20 opacity-30"><History className="h-12 w-12 mx-auto mb-2" /><p className="font-black text-xs uppercase">No hay pedidos registrados en el sistema</p></div>}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar este pedido?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDeletePedido} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-xl">ELIMINAR AHORA</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
