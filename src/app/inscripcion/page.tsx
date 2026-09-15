"use client";
import { COLLECTION_PADRON } from '@/lib/constants';


import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc, increment, updateDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, UserPlus, Smartphone, Hash, Sparkles, Search, ChevronRight, Info, Lock, Users2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SETTINGS_COLLECTION = 'system_settings';
const FLYERS_COLLECTION = 'flyer_library';


export default function PublicRegistrationPage() {
    const db = useFirestore();
    const { toast } = useToast();
    
    const [eventName, setEventName] = useState('LISTA 1 - OPCIÓN 5');
    const [eventDescription, setEventDescription] = useState('EL EQUIPO DE LA LISTA 1 SE COMUNICARÁ CONTIGO.');
    const [closedMessage, setClosedMessage] = useState('LO SENTIMOS, EL REGISTRO NO ESTÁ HABILITADO EN ESTE MOMENTO.');
    const [flyerUrl, setFlyerUrl] = useState('/logo.png');
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
    const [registrationLimit, setRegistrationLimit] = useState(0);
    const [registrationCount, setRegistrationCount] = useState(0);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);

    const [step, setStep] = useState<'lookup' | 'form'>('lookup');
    const [cedula, setCedula] = useState('');
    const [electorData, setElectorData] = useState<any>(null);
    const [telefono, setTelefono] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

    const base64ToBlobUrl = useCallback((base64: string) => {
        try {
            const parts = base64.split(';base64,');
            if (parts.length !== 2) return base64;
            const byteCharacters = atob(parts[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            return URL.createObjectURL(new Blob([new Uint8Array(byteNumbers)], { type: parts[0].split(':')[1] }));
        } catch (e) { return base64; }
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) return;
            try {
                const settingsSnap = await getDoc(doc(db, SETTINGS_COLLECTION, 'global'));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.public_event_name) setEventName(data.public_event_name);
                    if (data.public_event_description) setEventDescription(data.public_event_description);
                    if (data.public_closed_message) setClosedMessage(data.public_closed_message);
                    setIsRegistrationOpen(data.public_registration_open !== undefined ? data.public_registration_open : true);
                    setRegistrationLimit(data.public_registration_limit || 0);
                    setRegistrationCount(data.public_registration_count || 0);
                    
                    // Cargar el flyer inmediatamente para que se vea en el portal público
                    if (data.public_event_flyer_id && data.public_event_flyer_id !== 'NONE') {
                        try {
                            const flyerSnap = await getDoc(doc(db, FLYERS_COLLECTION, data.public_event_flyer_id));
                            if (flyerSnap.exists()) {
                                const fData = flyerSnap.data();
                                if (fData.isChunked) {
                                    const chunksSnap = await getDocs(query(collection(db, FLYERS_COLLECTION, data.public_event_flyer_id, 'chunks'), orderBy('__name__', 'asc')));
                                    const fullBase64 = chunksSnap.docs.sort((a,b) => parseInt(a.id)-parseInt(b.id)).map(d => d.data().data).join('');
                                    setFlyerUrl(base64ToBlobUrl(fullBase64));
                                } else {
                                    setFlyerUrl(fData.url?.startsWith('data:') ? base64ToBlobUrl(fData.url) : (fData.url || '/logo.png'));
                                }
                            }
                        } catch (errFlyer: any) {
                            console.warn("Error loading initial flyer asset", errFlyer);
                            toast({ 
                                title: "Error cargando flyer", 
                                description: errFlyer?.message || String(errFlyer), 
                                variant: "destructive" 
                            });
                        }
                    }
                }
            } catch (e: any) {
                console.error("Error loading public settings");
                toast({ title: "Error de configuración", description: e?.message || String(e), variant: "destructive" });
            } finally {
                setIsLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [db, base64ToBlobUrl]);

    const handlePhoneMask = (val: string) => {
        const clean = val.replace(/\D/g, '').slice(0, 10);
        let formatted = clean;
        if (clean.length > 4 && clean.length <= 7) {
            formatted = `${clean.slice(0, 4)}-${clean.slice(4)}`;
        } else if (clean.length > 7) {
            formatted = `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7)}`;
        }
        setTelefono(formatted);
    };

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCedula = cedula.trim();
        if (!cleanCedula || isSearching) return;
        
        setIsSearching(true);
        try {
            const docRef = doc(db!, COLLECTION_PADRON, cleanCedula);
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
                const padronData = snap.data();
                const cedulaValue = padronData.CEDULA;
                const inscRef = collection(db!, 'inscripciones');
                const qNumeric = query(inscRef, where('cedula', '==', Number(cedulaValue)), limit(1));
                const qString = query(inscRef, where('cedula', '==', String(cedulaValue)), limit(1));
                const [snapNum, snapStr] = await Promise.all([getDocs(qNumeric), getDocs(qString)]);
                
                if (!snapNum.empty || !snapStr.empty) {
                    setIsAlreadyRegistered(true);
                    return;
                }

                setElectorData({ id: snap.id, ...padronData });
                setTelefono(padronData.TELEFONO || '');
                
                // El flyer ya se cargó al inicio, así que no es necesario cargarlo de nuevo.

                setStep('form');
            } else {
                toast({ 
                    title: "No hallado en Padrón", 
                    description: "Esta cédula no figura en el padrón de Capital.", 
                    variant: "destructive" 
                });
            }
        } catch (error: any) {
            toast({ 
                title: "Error de consulta", 
                variant: "destructive" 
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmitRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!electorData || isSubmitting || !db) return;

        if (!telefono || telefono.length < 10) {
            toast({ title: "Teléfono incompleto", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const registrationData = {
            cedula: electorData.CEDULA,
            nombre: electorData.NOMBRE,
            apellido: electorData.APELLIDO,
            telefono,
            seccional: electorData.CODIGO_SEC || 'SIN SECC',
            local: electorData.LOCAL || 'SIN LOCAL',
            mesa: electorData.MESA || '0',
            orden: electorData.ORDEN || '0',
            status: 'INSCRIPCIÓN PÚBLICA',
            createdAt: serverTimestamp(),
            eventName: eventName
        };

        try {
            await addDoc(collection(db, 'inscripciones'), registrationData);
            const settingsRef = doc(db, SETTINGS_COLLECTION, 'global');
            await updateDoc(settingsRef, { 
                public_registration_count: increment(1) 
            });
            setIsSuccess(true);
            window.scrollTo(0, 0);
        } catch (error: any) {
            toast({ 
                title: "Error al enviar", 
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFull = registrationLimit > 0 && registrationCount >= registrationLimit;

    if (isLoadingSettings) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 font-medium relative overflow-hidden pb-20">
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
            
            <div className="relative z-10 w-full max-w-2xl space-y-8 mt-10">
                <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="relative h-80 sm:h-[450px] md:h-[500px] w-full max-w-lg mx-auto drop-shadow-2xl">
                        <img src={flyerUrl} alt="Flyer del evento" className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-primary">
                            <Sparkles className="h-3 w-3 fill-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">LISTA 1 - OPCIÓN 5</p>
                            <Sparkles className="h-3 w-3 fill-primary" />
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-primary leading-tight px-4 whitespace-pre-wrap">
                            {eventName}
                        </h1>
                    </div>
                </div>

                {!isRegistrationOpen || isFull ? (
                    <Card className="rounded-[2.5rem] bg-white border-primary/10 shadow-2xl overflow-hidden max-w-md mx-auto p-10 text-center space-y-6">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Lock className="h-10 w-10 text-slate-400" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                            {isFull ? 'Cupos Agotados' : 'Inscripciones Cerradas'}
                        </h2>
                        <p className="text-sm font-medium text-slate-500 uppercase leading-relaxed whitespace-pre-wrap">
                            {closedMessage}
                        </p>
                    </Card>
                ) : isAlreadyRegistered ? (
                    <Card className="rounded-[2.5rem] bg-white border-primary/10 shadow-2xl overflow-hidden max-w-md mx-auto p-10 text-center space-y-6">
                        <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Info className="h-12 w-12 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">¡Ya estás inscripto!</h2>
                        <p className="text-sm font-medium text-slate-500 uppercase leading-relaxed whitespace-pre-wrap">
                            Ya te encuentras inscripto al evento. <br/>¡Te esperamos!
                        </p>
                    </Card>
                ) : isSuccess ? (
                    <Card className="rounded-[2.5rem] bg-white border-primary/10 shadow-2xl overflow-hidden max-w-md mx-auto p-10 text-center space-y-6">
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">¡Inscripción Exitosa!</h2>
                        <p className="text-sm font-medium text-slate-500 uppercase leading-relaxed whitespace-pre-wrap">
                            Ya estás registrado para <span className="text-primary font-black">{eventName}</span>. <br/> 
                            {eventDescription}
                        </p>
                    </Card>
                ) : (
                    <Card className="rounded-[2.5rem] bg-white/90 backdrop-blur-xl border-primary/10 shadow-2xl overflow-hidden max-w-md mx-auto">
                        <CardHeader className="bg-muted/30 border-b py-6 text-center">
                            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 text-slate-600">
                                {step === 'lookup' ? <Search className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-primary" />}
                                {step === 'lookup' ? 'VALIDAR IDENTIDAD' : 'CONFIRMAR DATOS'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            {step === 'lookup' ? (
                                <form onSubmit={handleLookup} className="space-y-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="cedula" className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cédula de Identidad</Label>
                                        <Input 
                                            id="cedula"
                                            placeholder="EJ: 4567890" 
                                            value={cedula} 
                                            onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                                            className="h-16 font-black text-3xl text-center rounded-[1.5rem] shadow-inner"
                                            inputMode="numeric"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <Button type="submit" disabled={isSearching || !cedula} aria-label="Buscar mi ficha" className="w-full h-14 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-xl">
                                        {isSearching ? <Loader2 className="animate-spin mr-2 h-5 w-5" aria-hidden="true" /> : <ChevronRight className="mr-2 h-5 w-5" aria-hidden="true" />}
                                        BUSCAR MI FICHA
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleSubmitRegistration} className="space-y-6">
                                    <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 space-y-2">
                                        <p className="text-xl font-black uppercase text-slate-900 leading-tight">{electorData.NOMBRE} {electorData.APELLIDO}</p>
                                        <p className="text-xs font-bold text-primary">C.I. {electorData.CEDULA}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="telefono" className="text-[10px] font-black uppercase text-slate-400 tracking-widest">WhatsApp (XXXX-XXX-XXX)</Label>
                                        <Input 
                                            id="telefono"
                                            placeholder="09XX-XXX-XXX" 
                                            value={telefono} 
                                            onChange={(e) => handlePhoneMask(e.target.value)}
                                            className="h-14 font-black text-xl text-center rounded-2xl"
                                            inputMode="numeric"
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <Button type="button" variant="outline" onClick={() => setStep('lookup')} aria-label="Volver atrás" className="h-14 rounded-2xl px-6 font-black uppercase text-[10px]">ATRÁS</Button>
                                        <Button type="submit" disabled={isSubmitting} aria-label="Confirmar datos de inscripción" className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl">
                                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" aria-hidden="true" /> : <UserPlus className="mr-2 h-5 w-5" aria-hidden="true" />}
                                            CONFIRMAR
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="text-center opacity-40">
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-900 leading-relaxed">
                        SISTEMA DE GESTIÓN ESTRATÉGICA <br/> LISTA 1 - OPCIÓN 5
                    </p>
                    <p className="text-[7px] font-bold text-slate-500 mt-2 tracking-widest uppercase">
                        &copy; Desarrollado por el Ing. Eduardo Benítez
                    </p>
                </div>
            </div>
        </div>
    );
}
