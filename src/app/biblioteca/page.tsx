
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, doc, deleteDoc, query, orderBy, setDoc, getDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useAuth } from '@/hooks/use-auth';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2, Image as ImageIcon, Save, Upload, CheckCircle2, Type, Film, PlayCircle, Zap, Eye, X, ChevronLeft, ChevronRight, Info, AlignLeft, AlignCenter, AlignRight, Maximize, Droplets } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { logAction } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const SETTINGS_COLLECTION = 'system_settings';
const FLYERS_COLLECTION = 'flyer_library';
const CHUNK_SIZE = 800 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" {...props}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52s-.67-.816-.917-1.103c-.247-.287-.5-.335-.697-.34h-.597c-.254 0-.56.124-.803.371s-1.03 1.001-1.03 2.438c0 1.437 1.053 2.822 1.2 3.021.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.026.002C5.389.002 0 5.39 0 12.028c0 2.12.553 4.11 1.583 5.845L0 24l6.33-1.648c1.692.932 3.57 1.477 5.48.972h.015c6.637 0 12.025-5.39 12.025-12.026C24.05 5.39 18.664.002 12.026.002z" />
    </svg>
);

export default function BibliotecaPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [globalFlyerValue, setGlobalFlyerValue] = useState('');
  const [reportLogoLeft, setReportLogoLeft] = useState('');
  const [reportLogoCenter, setReportLogoCenter] = useState('');
  const [reportLogoRight, setReportLogoRight] = useState('');
  const [watermarkUrl, setWatermarkUrl] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(3);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [newImageName, setNewImageName] = useState('');
  
  const [reconstructedUrls, setReconstructedUrls] = useState<Record<string, string>>({});
  const [loadingItemsProgress, setLoadingItemsProgress] = useState<Record<string, number>>({});
  
  const processingRef = useRef<Set<string>>(new Set());
  const urlsRef = useRef<Record<string, string>>({});

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const flyersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, FLYERS_COLLECTION), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: flyers, isLoading } = useCollection(flyersQuery);

  const currentPreviewItem = previewIndex !== null && flyers ? flyers[previewIndex] : null;
  const currentPreviewUrl = currentPreviewItem ? reconstructedUrls[currentPreviewItem.id] : null;

  const base64ToBlobUrl = (base64: string) => {
    try {
        const parts = base64.split(';base64,');
        if (parts.length !== 2) return base64;
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        return URL.createObjectURL(new Blob([new Uint8Array(byteNumbers)], { type: parts[0].split(':')[1] }));
    } catch (e) { return base64; }
  };

  useEffect(() => {
    return () => { Object.values(urlsRef.current).forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }); };
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
        if (!db) return;
        const settingsDoc = await getDoc(doc(db, SETTINGS_COLLECTION, 'global'));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            setGlobalFlyerValue(data.flyer_url || '');
            setReportLogoLeft(data.report_logo_left || '');
            setReportLogoCenter(data.report_logo_center || '');
            setReportLogoRight(data.report_logo_right || '');
            setWatermarkUrl(data.watermark_url || '');
            setWatermarkOpacity(data.watermark_opacity !== undefined ? data.watermark_opacity : 3);
        }
    };
    fetchSettings();
  }, [db]);

  useEffect(() => {
    if (!flyers || !db) return;
    flyers.forEach(async (flyer) => {
        const flyerId = flyer.id;
        if (urlsRef.current[flyerId] || processingRef.current.has(flyerId)) return;
        if (!flyer.isChunked) {
            const url = flyer.url?.startsWith('data:') ? base64ToBlobUrl(flyer.url) : flyer.url;
            urlsRef.current[flyerId] = url;
            setReconstructedUrls(prev => ({ ...prev, [flyerId]: url }));
            return;
        }
        processingRef.current.add(flyerId);
        try {
            const total = flyer.totalChunks || 1;
            let chunks: string[] = [];
            for (let i = 0; i < total; i++) {
                const chunkRef = doc(db, FLYERS_COLLECTION, flyerId, 'chunks', i.toString().padStart(3, '0'));
                const chunkSnap = await getDoc(chunkRef);
                if (chunkSnap.exists()) {
                    chunks.push(chunkSnap.data().data);
                    setLoadingItemsProgress(prev => ({ ...prev, [flyerId]: Math.round(((i + 1) / total) * 100) }));
                }
            }
            const blobUrl = base64ToBlobUrl(chunks.join(''));
            urlsRef.current[flyerId] = blobUrl;
            setReconstructedUrls(prev => ({ ...prev, [flyerId]: blobUrl }));
        } finally {
            setLoadingItemsProgress(prev => { const n = { ...prev }; delete n[flyerId]; return n; });
            processingRef.current.delete(flyerId);
        }
    });
  }, [flyers, db]);

  const confirmUpload = async () => {
    if (!pendingFile || !db || !user || !newImageName.trim()) return;
    setIsUploading(true);
    setUploadProgress(5);
    setIsNameDialogOpen(false);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result as string;
        const fileType = pendingFile.type.startsWith('video/') ? 'video' : 'image';
        const chunks: string[] = [];
        for (let i = 0; i < base64String.length; i += CHUNK_SIZE) chunks.push(base64String.substring(i, i + CHUNK_SIZE));
        const isChunked = chunks.length > 1;
        const flyerData = {
            name: newImageName.toUpperCase(),
            type: fileType,
            createdAt: serverTimestamp(),
            createdBy: user.name,
            isChunked: isChunked,
            totalChunks: chunks.length,
            url: isChunked ? null : base64String
        };

        try {
            const docRef = await addDoc(collection(db, FLYERS_COLLECTION), flyerData);
            if (isChunked) {
                for (let i = 0; i < chunks.length; i++) {
                    await setDoc(doc(db, FLYERS_COLLECTION, docRef.id, 'chunks', i.toString().padStart(3, '0')), { data: chunks[i] });
                    setUploadProgress(Math.round(((i + 1) / chunks.length) * 100));
                }
            }
            logAction(db, { userId: user.id, userName: user.name, module: 'BIBLIOTECA', action: `SUBIÓ ${fileType.toUpperCase()}`, targetName: newImageName });
            toast({ title: "¡Éxito!" });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: FLYERS_COLLECTION, operation: 'create', requestResourceData: flyerData }));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            setPendingFile(null);
        }
    };
    reader.readAsDataURL(pendingFile);
  };

  const handleSetGlobalFlyer = (flyerId: string, name: string, type: string) => {
    if (!db || !user || !flyerId) return;
    const flyerValue = `FLYER_ID:${flyerId}`;
    const isMarking = globalFlyerValue !== flyerValue;
    const finalValue = isMarking ? flyerValue : '';
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'global');
    const data = { flyer_url: finalValue };
    setDoc(settingsRef, data, { merge: true }).then(() => {
        setGlobalFlyerValue(finalValue);
        toast({ title: "Actualizado" });
    }).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: settingsRef.path, operation: 'update', requestResourceData: data }));
    });
  };

  const handleDeleteFlyer = async (flyer: any) => {
    if (!db || !user) return;
    try {
        if (flyer.isChunked) {
            const chunksSnap = await getDocs(collection(db, FLYERS_COLLECTION, flyer.id, 'chunks'));
            const batch = writeBatch(db);
            chunksSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await deleteDoc(doc(db, FLYERS_COLLECTION, flyer.id));
        toast({ title: "Archivo eliminado" });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${FLYERS_COLLECTION}/${flyer.id}`, operation: 'delete' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-medium uppercase flex items-center gap-3"><ImageIcon className="h-8 w-8 text-primary" /> Biblioteca Multimedia</h1><p className="text-muted-foreground font-medium">Archivos pesados fragmentados en la base de datos.</p></div>
          {isUploading && <div className="flex flex-col items-end gap-1.5"><Badge className="bg-primary animate-pulse py-2 px-4 text-xs font-medium uppercase"><Zap className="mr-2 h-3.5 w-3.5 fill-white" /> Transfiriendo...</Badge><Progress value={uploadProgress} className="h-1.5 w-48" /></div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <Card className="border-primary/10 shadow-sm">
                <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="font-medium uppercase text-xs flex items-center gap-2"><Upload className="h-4 w-4" /> Cargar Recurso</CardTitle></CardHeader>
                <CardContent className="pt-6">
                    <Label htmlFor="library-upload" className="cursor-pointer group block">
                        <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-primary/5 transition-all">
                            {isUploading ? <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" /> : <Upload className="h-14 w-14 text-primary" />}
                            <p className="font-medium uppercase text-xs">{isUploading ? 'Procesando...' : 'Seleccionar Archivo'}</p>
                        </div>
                        <input id="library-upload" type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setNewImageName(f.name.split('.')[0].toUpperCase()); setIsNameDialogOpen(true); } }} disabled={isUploading} />
                    </Label>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
            <Card className="border-primary/10 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4"><CardTitle className="flex items-center gap-2 font-medium uppercase text-xs"><ImageIcon className="h-4 w-4 text-primary" /> Galería Multimedia</CardTitle></CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {isLoading ? <Skeleton className="h-40 w-full" /> : 
                        flyers && flyers.length > 0 ? flyers.map((f, index) => {
                            const url = reconstructedUrls[f.id];
                            const isItemLoading = loadingItemsProgress[f.id] !== undefined;
                            const isOfficial = globalFlyerValue === `FLYER_ID:${f.id}`;
                            return (
                                <div key={f.id} className="relative group aspect-[3/4] rounded-lg border overflow-hidden bg-muted/20 flex flex-col shadow-sm">
                                    {isItemLoading ? <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-[8px] uppercase">Ensamblando...</p></div> : 
                                    url ? (f.type === 'video' ? <div className="flex-1 bg-black flex items-center justify-center"><PlayCircle className="h-8 w-8 text-white opacity-80" /></div> : <img src={url} alt={f.name} className="flex-1 object-cover" />) : <div className="flex-1 flex items-center justify-center"><Zap className="h-8 w-8 opacity-20" /></div>}
                                    <div className="absolute top-0 left-0 right-0 bg-black/60 p-1.5 truncate text-[9px] text-white uppercase">{f.name}</div>
                                    {!isItemLoading && url && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                                            <Button size="icon" variant="secondary" onClick={() => handleSetGlobalFlyer(f.id, f.name, f.type)}><CheckCircle2 className={cn("h-5 w-5", isOfficial && "text-green-600")} /></Button>
                                            <Button size="icon" variant="destructive" onClick={() => handleDeleteFlyer(f)}><Trash2 className="h-5 w-5" /></Button>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : <p className="col-span-full py-20 text-center opacity-30">Galería vacía</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="uppercase font-medium">Identificar Recurso</DialogTitle></DialogHeader>
            <div className="py-4"><Label className="text-[10px] font-medium uppercase mb-1.5 block">Nombre para el Sistema</Label><Input value={newImageName} onChange={(e) => setNewImageName(e.target.value.toUpperCase())} className="font-medium uppercase h-11" /></div>
            <DialogFooter><Button variant="outline" onClick={() => setIsNameDialogOpen(false)}>CANCELAR</Button><Button onClick={confirmUpload} disabled={!newImageName.trim() || isUploading}>{isUploading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
