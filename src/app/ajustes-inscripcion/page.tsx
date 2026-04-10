"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, query, orderBy, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCollection } from '@/firebase/firestore/use-collection';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Image as ImageIcon, Globe, RefreshCw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { logAction } from '@/lib/audit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const SETTINGS_COLLECTION = 'system_settings';
const FLYERS_COLLECTION = 'flyer_library';

export default function AjustesInscripcionPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [publicEventName, setPublicEventName] = useState('');
  const [publicFlyerId, setPublicFlyerId] = useState('');
  const [publicFlyerPreview, setPublicFlyerPreview] = useState('');
  const [isReconstructingPreview, setIsReconstructingPreview] = useState(false);
  const [publicEventDescription, setPublicEventDescription] = useState('');
  const [publicClosedMessage, setPublicClosedMessage] = useState('');
  const [publicRegistrationOpen, setPublicRegistrationOpen] = useState(true);
  const [publicRegistrationLimit, setPublicRegistrationLimit] = useState(0);
  const [publicRegistrationCount, setPublicRegistrationCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const flyersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, FLYERS_COLLECTION), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: availableFlyers } = useCollection(flyersQuery);

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
    if (db) {
      getDoc(doc(db, SETTINGS_COLLECTION, 'global')).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setPublicEventName(data.public_event_name || 'LISTA 2P - OPCIÓN 2');
          setPublicFlyerId(data.public_event_flyer_id || '');
          setPublicEventDescription(data.public_event_description || 'EL EQUIPO DE LA LISTA 2P SE COMUNICARÁ CONTIGO.');
          setPublicClosedMessage(data.public_closed_message || 'LO SENTIMOS, EL REGISTRO NO ESTÁ HABILITADO EN ESTE MOMENTO.');
          setPublicRegistrationOpen(data.public_registration_open !== undefined ? data.public_registration_open : true);
          setPublicRegistrationLimit(data.public_registration_limit || 0);
          setPublicRegistrationCount(data.public_registration_count || 0);
        }
      });
    }
  }, [db]);

  useEffect(() => {
    const loadPreview = async () => {
        if (!publicFlyerId || publicFlyerId === 'NONE' || !db || !availableFlyers) {
            setPublicFlyerPreview('');
            return;
        }
        
        const flyer = availableFlyers.find(f => f.id === publicFlyerId);
        if (!flyer) return;

        if (flyer.isChunked) {
            setIsReconstructingPreview(true);
            try {
                const chunksSnap = await getDocs(query(collection(db, FLYERS_COLLECTION, publicFlyerId, 'chunks'), orderBy('__name__', 'asc')));
                const fullBase64 = chunksSnap.docs.sort((a,b) => parseInt(a.id)-parseInt(b.id)).map(d => d.data().data).join('');
                setPublicFlyerPreview(base64ToBlobUrl(fullBase64));
            } catch (e) {
                console.error("Error al reconstruir preview", e);
            } finally {
                setIsReconstructingPreview(false);
            }
        } else {
            setPublicFlyerPreview(flyer.url?.startsWith('data:') ? base64ToBlobUrl(flyer.url) : flyer.url);
        }
    };
    loadPreview();
  }, [publicFlyerId, availableFlyers, db, base64ToBlobUrl]);

  const handleSaveSettings = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'global');
    const data = { 
        public_event_name: publicEventName.toUpperCase(), 
        public_event_flyer_id: publicFlyerId,
        public_event_description: publicEventDescription.toUpperCase(),
        public_closed_message: publicClosedMessage.toUpperCase(),
        public_registration_open: publicRegistrationOpen,
        public_registration_limit: Number(publicRegistrationLimit)
    };

    setDoc(settingsRef, data, { merge: true })
        .then(() => {
            logAction(db, { userId: user.id, userName: user.name, module: 'AJUSTES INSCRIPCION', action: 'ACTUALIZÓ CONFIGURACIÓN PÁGINA PÚBLICA' });
            toast({ title: "Ajustes Actualizados Exitosamente" });
        })
        .finally(() => setIsSaving(false));
  };

  const handleRecalculateCount = async () => {
    if (!db || !user) return;
    setIsRecalculating(true);
    try {
        const snap = await getCountFromServer(collection(db, 'inscripciones'));
        const actualCount = (snap as any).data().count;
        const settingsRef = doc(db, SETTINGS_COLLECTION, 'global');
        await updateDoc(settingsRef, { public_registration_count: actualCount });
        setPublicRegistrationCount(actualCount);
        toast({ title: "Contador Sincronizado", description: `Se hallaron ${actualCount} registros activos.` });
    } finally {
        setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Configuración de Inscripción Pública</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Controla lo que los ciudadanos ven al ingresar a /inscripcion.</p>
        </div>
        <Button onClick={handleRecalculateCount} disabled={isRecalculating} variant="outline" className="h-11 font-black uppercase text-xs border-primary/20 text-primary rounded-xl">
            {isRecalculating ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <RefreshCw className="mr-2 h-4 w-4" />}
            RE-CALCULAR CONTADOR
        </Button>
      </div>

      <Card className="border-primary/10 shadow-xl overflow-hidden bg-white rounded-[2.5rem]">
        <CardHeader className="bg-muted/30 border-b py-6 flex flex-row items-center justify-between px-8">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-black uppercase text-sm">Estado del Portal /inscripcion</CardTitle>
            </div>
            <Badge className={cn("font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-lg", publicRegistrationOpen ? "bg-green-500" : "bg-red-500")}>
                {publicRegistrationOpen ? 'SISTEMA ABIERTO' : 'SISTEMA CERRADO'}
            </Badge>
        </CardHeader>
        <CardContent className="pt-10 space-y-8 px-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                    <div className="space-y-1">
                        <Label className="text-[11px] font-black uppercase tracking-tight">Habilitar Registros</Label>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Define si el formulario es visible.</p>
                    </div>
                    <Switch checked={publicRegistrationOpen} onCheckedChange={setPublicRegistrationOpen} className="data-[state=checked]:bg-green-500" />
                </div>
                <div className="flex flex-col p-6 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                        <Label className="text-[11px] font-black uppercase tracking-tight">Límite de Cupos</Label>
                        <Badge variant="outline" className="font-black text-[10px] bg-white text-primary border-primary/20">{publicRegistrationCount} ACTUALES</Badge>
                    </div>
                    <Input type="number" value={publicRegistrationLimit} onChange={(e) => setPublicRegistrationLimit(Number(e.target.value))} className="font-black h-10 text-xl text-center rounded-xl bg-white border-primary/10" placeholder="0 = SIN LÍMITE" />
                    <p className="text-[8px] font-bold text-primary/60 uppercase mt-2 text-center tracking-widest">DEJAR EN 0 PARA REGISTROS ILIMITADOS</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Oficial del Evento</Label>
                    <Textarea value={publicEventName} onChange={(e) => setPublicEventName(e.target.value.toUpperCase())} className="font-black uppercase min-h-[100px] text-lg rounded-2xl border-slate-200" placeholder="EJ: GRAN LANZAMIENTO LISTA 2P" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Flyer de Cabecera (Desde Biblioteca)</Label>
                            <Select value={publicFlyerId} onValueChange={setPublicFlyerId}>
                                <SelectTrigger className="h-12 font-black rounded-2xl border-slate-200"><SelectValue placeholder="Elegir recurso..." /></SelectTrigger>
                                <SelectContent className="rounded-2xl">{availableFlyers?.map(f => <SelectItem key={f.id} value={f.id} className="font-bold uppercase">{f.name}</SelectItem>)}<SelectItem value="NONE" className="font-bold text-red-500">SIN FLYER (USA LOGO)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mensaje de Éxito</Label>
                            <Textarea value={publicEventDescription} onChange={(e) => setPublicEventDescription(e.target.value.toUpperCase())} className="font-bold uppercase min-h-[80px] rounded-xl text-xs" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mensaje de Cupo Lleno / Cerrado</Label>
                            <Textarea value={publicClosedMessage} onChange={(e) => setPublicClosedMessage(e.target.value.toUpperCase())} className="font-bold uppercase min-h-[80px] rounded-xl text-xs" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Vista Previa del Encabezado</Label>
                        <div className="aspect-square w-full rounded-[2.5rem] border-4 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner relative">
                            {isReconstructingPreview ? <Loader2 className="animate-spin h-10 w-10 text-primary" /> : 
                             publicFlyerPreview ? <img src={publicFlyerPreview} alt="Flyer" className="w-full h-full object-contain p-4 drop-shadow-2xl" /> : 
                             <div className="flex flex-col items-center gap-3 opacity-20"><ImageIcon className="h-16 w-16" /><p className="font-black text-xs uppercase">Sin imagen</p></div>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full font-black uppercase tracking-widest h-16 shadow-2xl rounded-[2rem] text-lg active:scale-[0.98] transition-all">
                    {isSaving ? <Loader2 className="animate-spin mr-3 h-6 w-6"/> : <Save className="mr-3 h-6 w-6" />} 
                    GUARDAR CONFIGURACIÓN DEL PORTAL
                </Button>
            </div>
        </CardContent>
      </Card>

      <div className="text-center opacity-40 py-10">
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900 leading-relaxed">
            SISTEMA DE GESTIÓN ESTRATÉGICA <br/> LISTA 2P - ASUNCIÓN 2026
        </p>
      </div>
    </div>
  );
}
