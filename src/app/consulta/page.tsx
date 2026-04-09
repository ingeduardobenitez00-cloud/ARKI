
"use client";

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { collection, getDocs, query, where, doc, updateDoc, setDoc, deleteDoc, limit, orderBy } from 'firebase/firestore';
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
    FileSearch,
    UserCheck, 
    Lock, 
    History, 
    User as UserIcon, 
    Trash2, 
    Zap,
    Smartphone,
    MapPin,
    AlertCircle,
    Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { logAction } from '@/lib/audit';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="animate-spin" /></div>
});

interface PadronData {
    id: string; 
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    [key: string]: any; 
    observacion?: string;
    TELEFONO?: string;
    INSTITUCION?: string;
    CODIGO_SEC?: string;
    DIRECCION?: string;
    LOCAL?: string;
    registradoPor_id?: string;
    registradoPor_nombre?: string;
    LATITUD?: number;
    LONGITUD?: number;
}

const COLLECTION_PADRON = 'sheet1';
const COLLECTION_CAPTURAS = 'votos_confirmados';

export default function ConsultaPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PadronData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const userSeccionales = useMemo(() => {
        if (!user) return [];
        return user.seccionales || (user.seccional ? [user.seccional] : []);
    }, [user]);

    const [telefono, setTelefono] = useState('');
    const [institucion, setInstitucion] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLon, setManualLon] = useState('');
    const [isCapturingLocation, setIsCapturingLocation] = useState(false);
    
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [votoToDelete, setVotoToDelete] = useState<PadronData | null>(null);

    // ESCUCHADOR EN TIEMPO REAL A LA COLECCIÓN DE CAPTURAS CON LÍMITE (OPTIMIZACIÓN DE COSTOS)
    const registeredQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return query(collection(db, COLLECTION_CAPTURAS), limit(300));
    }, [db, user]);

    const { data: rawList, isLoading: isLoadingList, error: listError } = useCollection<PadronData>(registeredQuery);

    const registeredList = useMemo(() => {
        if (!rawList || !user) return [];
        
        const role = user.role;
        const isAdmin = role === 'Super-Admin' || role === 'Presidente' || role === 'Admin';
        
        if (isAdmin) return rawList;

        if (role === 'Coordinador') {
            return rawList.filter(item => {
                const itemSec = String(item.CODIGO_SEC || '');
                return userSeccionales.includes(itemSec);
            });
        }

        if (role === 'Dirigente') {
            return rawList.filter(item => item.registradoPor_id === user.id);
        }

        return [];
    }, [rawList, user, userSeccionales]);

    const groupedCaptures = useMemo(() => {
        const groups: Record<string, { seccional: string, votos: PadronData[] }> = {};
        if (!registeredList) return groups;
        
        registeredList.forEach(item => {
            const userName = item.registradoPor_nombre || 'USUARIO DESCONOCIDO';
            if (!groups[userName]) {
                groups[userName] = {
                    seccional: String(item.CODIGO_SEC || ''),
                    votos: []
                };
            }
            groups[userName].votos.push(item);
        });
        return groups;
    }, [registeredList]);

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
            setInstitucion(selectedPerson.INSTITUCION || '');
            setManualLat(selectedPerson.LATITUD?.toString() || '');
            setManualLon(selectedPerson.LONGITUD?.toString() || '');
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
            
            const role = user?.role;
            const isAdmin = role === 'Super-Admin' || role === 'Admin' || role === 'Presidente';

            if (!isAdmin && userSeccionales.length > 0) {
                foundResults = foundResults.filter(p => userSeccionales.includes(String(p.CODIGO_SEC)));
            }

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
        if (!selectedPerson || !user || !db) return;
        setIsSaving(true);
        const dataToSave: any = {
            ...selectedPerson,
            observacion: "VOTO SEGURO",
            TELEFONO: telefono,
            INSTITUCION: institucion,
            registradoPor_id: user.id,
            registradoPor_nombre: user.name,
            updatedAt: new Date().toISOString()
        };

        if (manualLat && manualLon) {
            dataToSave.LATITUD = parseFloat(manualLat);
            dataToSave.LONGITUD = parseFloat(manualLon);
            dataToSave.ubicadoPor_id = user.id;
            dataToSave.ubicadoPor_nombre = user.name;
        }

        const capturaRef = doc(db, COLLECTION_CAPTURAS, selectedPerson.id);
        const padronRef = doc(db, COLLECTION_PADRON, selectedPerson.id);

        Promise.all([
            setDoc(capturaRef, dataToSave),
            updateDoc(padronRef, { observacion: "VOTO SEGURO", TELEFONO: telefono, INSTITUCION: institucion })
        ]).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'REGISTRO VOTOS', action: 'REGISTRÓ VOTO SEGURO', targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO}` });
            toast({ title: '¡Registro Exitoso!' });
            // LIMPIAR CAMPOS PARA OTRA BUSQUEDA
            setSearchTerm(''); 
            setSearchResults([]); 
            setSelectedPerson(null); 
            setTelefono(''); 
            setInstitucion(''); 
            setManualLat(''); 
            setManualLon('');
        }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: capturaRef.path, operation: 'create', requestResourceData: dataToSave }));
        }).finally(() => setIsSaving(false));
    };

    const handleDeleteVoto = async () => {
        if (!votoToDelete || !db || !user) return;
        setIsDeleting(true);
        const capturaRef = doc(db, COLLECTION_CAPTURAS, votoToDelete.id);
        const padronRef = doc(db, COLLECTION_PADRON, votoToDelete.id);

        Promise.all([
            deleteDoc(capturaRef),
            updateDoc(padronRef, { observacion: null })
        ]).then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'REGISTRO VOTOS', action: 'ELIMINÓ VOTO SEGURO', targetName: `${votoToDelete.NOMBRE}` });
            toast({ title: 'Marca eliminada' });
        }).finally(() => { setIsDeleting(false); setIsDeleteAlertOpen(false); setVotoToDelete(null); });
    };

    const renderCapturesTable = (items: PadronData[]) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader><TableRow className="bg-muted/50 text-[10px] font-black uppercase"><TableHead className="w-[100px] text-center">Cédula</TableHead><TableHead>Elector</TableHead><TableHead className="text-center">SECC</TableHead><TableHead>Local / Mesa</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                    {items.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-[10px] text-center">{p.CEDULA}</TableCell>
                            <TableCell className="font-black text-[11px] uppercase">{p.NOMBRE} {p.APELLIDO}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[9px]">SECC {p.CODIGO_SEC}</Badge></TableCell>
                            <TableCell className="text-[10px] uppercase">
                                <div>{p.LOCAL}</div>
                                <div className="text-primary font-bold">M: {p.MESA} / O: {p.ORDEN}</div>
                            </TableCell>
                            <TableCell className="text-[11px] font-bold text-green-700">{p.TELEFONO || '---'}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-primary" 
                                        onClick={() => { 
                                            setSelectedPerson(p); 
                                            window.scrollTo({ top: 0, behavior: 'smooth' }); 
                                        }}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => { setVotoToDelete(p); setIsDeleteAlertOpen(true); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><FileSearch className="h-8 w-8 text-primary" /> Registro de Votos Seguros</h1>
                    <div className="mt-2 space-y-1">
                        <p className="text-slate-900 font-black flex items-center gap-2 uppercase text-[11px] tracking-tight">
                            <UserIcon className="h-3.5 w-3.5 text-primary" /> Operador: {user?.name}
                        </p>
                        <p className="text-muted-foreground font-medium flex items-center gap-2 uppercase text-[10px] tracking-widest">
                            <Lock className="h-3 w-3" /> {user?.role} 
                            {userSeccionales.length > 0 && (
                                <>
                                    <span className="mx-1 opacity-30">|</span>
                                    <MapPin className="h-3 w-3 text-primary" /> Jurisdicción: SECC {userSeccionales.join(', ')}
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-black px-4 py-2 text-xs">{registeredList.length} CAPTURAS ACTIVAS</Badge>
            </div>

            {listError && (
                <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20 flex items-center gap-3 text-destructive font-bold uppercase text-[10px]">
                    <AlertCircle className="h-5 w-5" />
                    Error técnico al cargar la lista. Puede faltar un índice en la base de datos.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase">Buscador Padrón Nacional</CardTitle></CardHeader>
                        <CardContent className="pt-6"><form onSubmit={handleSearch} className="flex gap-2"><Input placeholder="CÉDULA O NOMBRE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 font-black uppercase h-11" /><Button type="submit" disabled={isSearching} className="h-11 px-4">{isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button></form></CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-xs font-black uppercase">Coincidencias</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            {isSearching ? <div className="space-y-2"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div> : 
                            searchResults.length > 0 ? <RadioGroup onValueChange={(id) => setSelectedPerson(searchResults.find(p => p.id === id) || null)} value={selectedPerson?.id || ''}><div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                {searchResults.map(p => (<div key={p.id} className={cn("flex items-center space-x-3 border rounded-2xl p-4 cursor-pointer", selectedPerson?.id === p.id ? "border-primary bg-primary/[0.02]" : "border-slate-100")} onClick={() => setSelectedPerson(p)}><RadioGroupItem value={p.id} className="sr-only" /><div className="flex-1"><p className="font-black text-xs uppercase">{p.NOMBRE} {p.APELLIDO}</p><p className="text-[10px] text-muted-foreground font-bold">C.I. {p.CEDULA} | SECC {p.CODIGO_SEC}</p></div></div>))}</div></RadioGroup> : 
                            <div className="text-center py-12 opacity-20"><Zap className="h-12 w-12 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Esperando Búsqueda</p></div>}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-primary/10 shadow-lg overflow-hidden min-h-[500px]"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="flex items-center gap-3 font-black uppercase text-xs"><UserCheck className="h-4 w-4 text-primary" /> Ficha de Captura</CardTitle></CardHeader>
                        <CardContent className="pt-6">{selectedPerson ? (<div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-5 rounded-2xl border border-primary/10 text-xs">
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Cédula</Label><p className="font-black text-sm">{selectedPerson.CEDULA}</p></div>
                                    <div><Label className="text-[9px] uppercase font-black text-muted-foreground">Elector</Label><p className="font-black text-sm uppercase">{selectedPerson.NOMBRE} {selectedPerson.APELLIDO}</p></div>
                                    <div className="sm:col-span-2"><Label className="text-[9px] uppercase font-black text-muted-foreground">Referencia</Label><p className="font-black uppercase">{selectedPerson.LOCAL} | M: {selectedPerson.MESA} / O: {selectedPerson.ORDEN}</p></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-5">
                                        <div className="space-y-2"><Label className="font-black text-[10px] uppercase">WhatsApp</Label><Input value={telefono} onChange={(e) => setTelefono(applyPhoneMask(e.target.value))} placeholder="0981-123-456" className="h-11 font-black text-lg" inputMode="numeric"/></div>
                                        <div className="space-y-2"><Label className="font-black text-[10px] uppercase">Institución</Label><Input value={institucion} onChange={(e) => setInstitucion(e.target.value.toUpperCase())} placeholder="COLEGIO, IPS..." className="h-11 font-black uppercase"/></div>
                                        <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase text-base bg-primary shadow-xl rounded-2xl">{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />} GUARDAR VOTO SEGURO</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-[280px] border-2 rounded-3xl overflow-hidden shadow-inner"><MapPicker key={`picker-${selectedPerson.id}-${manualLat}-${manualLon}`} lat={manualLat ? parseFloat(manualLat) : null} lon={manualLon ? parseFloat(manualLon) : null} onLocationPick={handleLocationPick} /></div>
                                        <Button variant="secondary" className="w-full bg-red-600 text-white h-11 font-black rounded-xl text-xs uppercase" onClick={handleCaptureLocation} disabled={isCapturingLocation}><Navigation className="mr-2 h-4 w-4" /> CAPTURAR GPS</Button>
                                    </div>
                                </div></div>) : <div className="text-center text-muted-foreground py-32 border-2 border-dashed rounded-3xl opacity-30"><p className="font-black uppercase text-xs">Selecciona un ciudadano para iniciar captura</p></div>}</CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-primary/10 shadow-sm overflow-hidden"><CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="text-sm font-black uppercase">Registros en Jurisdicción</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {isLoadingList ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
                    Object.keys(groupedCaptures).length > 0 ? <div className="p-4"><Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(groupedCaptures).sort(([a],[b]) => a.localeCompare(b)).map(([userName, data]) => (
                            <AccordionItem key={userName} value={userName} className="border rounded-xl px-4 bg-muted/5">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 text-left">
                                            <span className="font-black text-xs uppercase">{userName}</span>
                                            {data.seccional && (
                                                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-2 ring-white">
                                                    {data.seccional}
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-black bg-white shrink-0">{data.votos.length} Votos</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4"><div className="border rounded-lg bg-white overflow-hidden shadow-sm">{renderCapturesTable(data.votos)}</div></AccordionContent>
                            </AccordionItem>))}
                    </Accordion></div> : <div className="text-center py-20 opacity-30"><History className="h-12 w-12 mx-auto mb-2" /><p className="font-black text-xs uppercase">No hay capturas registradas en esta zona</p></div>}
                </CardContent>
            </Card>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar Marca de Voto Seguro?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDeleteVoto} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-xl">ELIMINAR AHORA</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
