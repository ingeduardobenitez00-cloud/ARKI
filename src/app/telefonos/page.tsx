"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Search, 
    Loader2, 
    Save, 
    Phone, 
    Smartphone, 
    UserCheck, 
    User as UserIcon, 
    SearchCheck,
    Info
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    INSTITUCION?: string;
    CODIGO_SEC?: string;
    LOCAL?: string;
    MESA?: string | number;
    ORDEN?: string | number;
}

const COLLECTION_NAME = 'sheet1';

export default function TelefonosPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PadronData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<PadronData | null>(null);
    
    const [telefono, setTelefono] = useState('');
    const [institucion, setInstitucion] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (selectedPerson) {
            setTelefono(selectedPerson.TELEFONO || '');
            setInstitucion(selectedPerson.INSTITUCION || '');
        } else {
            setTelefono('');
            setInstitucion('');
        }
    }, [selectedPerson]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim().toUpperCase();
        if (!term) {
            toast({ title: 'Búsqueda vacía', description: 'Ingresa una Cédula o Nombre.' });
            return;
        }

        setIsSearching(true);
        setSelectedPerson(null);
        setSearchResults([]);
        
        try {
            const resultsMap = new Map<string, PadronData>();
            const dataCollection = collection(db!, COLLECTION_NAME);
            const isNumericSearch = /^\d+$/.test(term);

            let searchQueries = [];

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
                    searchQueries.push(getDocs(query(dataCollection, where('NOMBRE', '>=', word), where('NOMBRE', '<=', word + '\uf8ff'), limit(200))));
                    searchQueries.push(getDocs(query(dataCollection, where('APELLIDO', '>=', word), where('APELLIDO', '<=', word + '\uf8ff'), limit(200))));
                });
            }
            
            const snapshots = await Promise.all(searchQueries);
            snapshots.forEach(snapshot => snapshot.forEach(docSnap => {
                if (!resultsMap.has(docSnap.id)) {
                    resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PadronData);
                }
            }));
            
            let foundResults = Array.from(resultsMap.values());

            if (!isNumericSearch) {
                const searchWords = term.split(' ').filter(word => word);
                foundResults = foundResults.filter(person => {
                    const fullName = `${person.NOMBRE || ''} ${person.APELLIDO || ''}`.toUpperCase();
                    return searchWords.every(word => fullName.includes(word));
                });
            }

            foundResults.sort((a, b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || '') || (a.NOMBRE || '').localeCompare(b.NOMBRE || ''));
            setSearchResults(foundResults);
            
            if (foundResults.length === 0) {
                toast({ title: 'Sin resultados', description: 'No se hallaron registros.' });
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
            TELEFONO: telefono,
            INSTITUCION: institucion,
            updatedAt: new Date().toISOString(),
            updatedBy_id: user.id,
            updatedBy_nombre: user.name
        };

        updateDoc(personRef, dataToUpdate)
            .then(() => {
                logAction(db, {
                    userId: user.id,
                    userName: user.name,
                    module: 'TELEFONOS',
                    action: 'ACTUALIZÓ DATOS DE CONTACTO',
                    targetId: selectedPerson.id,
                    targetName: `${selectedPerson.NOMBRE} ${selectedPerson.APELLIDO}`
                });
                
                const updated = { ...selectedPerson, ...dataToUpdate };
                setSelectedPerson(updated);
                setSearchResults(prev => prev.map(p => p.id === selectedPerson.id ? updated : p));
                
                toast({ title: '¡Éxito!', description: 'Datos actualizados correctamente.' });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: personRef.path,
                    operation: 'update',
                    requestResourceData: dataToUpdate
                }));
            })
            .finally(() => setIsSavingProfile(false));
    };

    const setIsSavingProfile = (val: boolean) => {
        setIsSaving(val);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Phone className="h-8 w-8 text-primary" />
                        Actualizar Contactos
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Carga de teléfonos e instituciones del padrón electoral.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase">Buscador Inteligente</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <Input 
                                    placeholder="CÉDULA O NOMBRE..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="flex-1 font-bold uppercase h-11" 
                                />
                                <Button type="submit" disabled={isSearching} className="h-11 px-4">
                                    {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-4">
                            <CardTitle className="text-xs font-black uppercase">Coincidencias</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isSearching ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-14 w-full rounded-xl" />
                                    <Skeleton className="h-14 w-full rounded-xl" />
                                </div>
                            ) : searchResults.length > 0 ? (
                                <RadioGroup 
                                    onValueChange={(id) => setSelectedPerson(searchResults.find(p => p.id === id) || null)} 
                                    value={selectedPerson?.id || ''}
                                >
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                        {searchResults.map(person => (
                                            <div 
                                                key={person.id} 
                                                className={cn(
                                                    "flex items-center space-x-3 border rounded-2xl p-4 transition-all cursor-pointer hover:bg-primary/5",
                                                    selectedPerson?.id === person.id ? "border-primary bg-primary/[0.02]" : "border-slate-100"
                                                )}
                                                onClick={() => setSelectedPerson(person)}
                                            >
                                                <RadioGroupItem value={person.id} id={person.id} className="sr-only" />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-black text-xs uppercase tracking-tight text-slate-900">
                                                            {person.NOMBRE} {person.APELLIDO}
                                                        </p>
                                                        <div className="flex gap-1">
                                                            {person.TELEFONO && <Badge variant="outline" className="text-[8px] bg-green-50 text-green-700 border-green-200 px-1">TEL</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">C.I. {person.CEDULA}</p>
                                                        <span className="text-[10px] text-slate-300">|</span>
                                                        <p className="text-[9px] text-primary font-black uppercase tracking-wider">SECC {person.CODIGO_SEC}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </RadioGroup>
                            ) : (
                                <div className="text-center py-12 opacity-20">
                                    <SearchCheck className="h-12 w-12 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Esperando Búsqueda</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-primary/10 shadow-xl overflow-hidden min-h-[500px]">
                        <CardHeader className="bg-muted/30 border-b py-5">
                            <CardTitle className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                                <UserCheck className="h-5 w-5 text-primary" />
                                Ficha de Actualización de Datos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8">
                            {selectedPerson ? (
                                <div className="space-y-8 max-w-2xl mx-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Ciudadano</Label>
                                            <p className="text-lg font-black uppercase leading-tight text-slate-900">
                                                {selectedPerson.NOMBRE} {selectedPerson.APELLIDO}
                                            </p>
                                            <p className="text-xs font-bold text-primary">C.I. {selectedPerson.CEDULA}</p>
                                        </div>
                                        <div className="space-y-1 md:text-right border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 border-slate-200">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Referencia Electoral</Label>
                                            <p className="text-[11px] font-black uppercase text-slate-700">{selectedPerson.LOCAL}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">SECC {selectedPerson.CODIGO_SEC} | MESA {selectedPerson.MESA} | ORDEN {selectedPerson.ORDEN}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <Smartphone className="h-3.5 w-3.5 text-primary" />
                                                Teléfono WhatsApp
                                            </Label>
                                            <Input 
                                                value={telefono} 
                                                onChange={(e) => setTelefono(e.target.value)} 
                                                placeholder="EJ: 0981152121 O 0981152121 | 0981152125" 
                                                className="h-12 font-black text-lg tracking-widest rounded-2xl border-slate-200"
                                            />
                                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-black uppercase bg-muted/30 p-2 rounded-lg">
                                                <Info className="h-3 w-3" />
                                                Edición libre: Puedes usar guiones o múltiples números separados por "|"
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <UserIcon className="h-3.5 w-3.5 text-primary" />
                                                Institución / Lugar Trabajo
                                            </Label>
                                            <Input 
                                                value={institucion} 
                                                onChange={(e) => setInstitucion(e.target.value.toUpperCase())} 
                                                placeholder="EJ: COLEGIO NACIONAL, IPS, ETC..." 
                                                className="h-12 font-black uppercase rounded-2xl border-slate-200" 
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleSave} 
                                            disabled={isSaving || !telefono} 
                                            className="w-full h-16 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Save className="mr-3 h-6 w-6" />}
                                            GUARDAR CAMBIOS
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground border-2 border-dashed rounded-[3rem] bg-slate-50/50 opacity-30">
                                    <Search className="h-16 w-16 mb-4" />
                                    <p className="font-black uppercase tracking-[0.2em] text-xs text-center px-8">
                                        Realiza una búsqueda para cargar<br/>datos de contacto del ciudadano.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t py-4 flex justify-between items-center px-8">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2</p>
                            <Badge variant="outline" className="text-[9px] font-black border-primary/10">NÚCLEO v5.2</Badge>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}