
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Seccional } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { allMenuItems, userRoles, menuCategories } from '@/lib/menu-data';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc, query, limit, where, orderBy } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getAuthSecondary } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Users, Loader2, Search, Camera, Smartphone, ShieldCheck, CheckSquare, Square, CheckCircle2, ChevronDown, MapPin, Hash, UserPlus, FileText, FileSpreadsheet, Layers, UserCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logAction } from '@/lib/audit';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CameraCaptureDialog } from '@/components/CameraCaptureDialog';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

const userSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Dirección de correo electrónico inválida'),
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  telefono: z.string().optional(),
  photoUrl: z.string().optional(),
  role: z.enum(['Super-Admin', 'Admin', 'Presidente', 'Coordinador', 'Dirigente', 'Mesario', 'Recepcionista', 'Comunicaciones']),
  seccionales: z.array(z.string()).optional(),
  local: z.string().optional(),
  mesas: z.array(z.coerce.number()).optional(),
  permissions: z.array(z.string()).min(1, 'Debes seleccionar al menos un permiso.'),
  moduleActions: z.record(z.array(z.enum(['create', 'update', 'delete', 'pdf', 'excel']))).optional(),
});

const editUserSchema = userSchema.omit({ password: true });

type UserFormData = z.infer<typeof userSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

const USERS_COLLECTION_NAME = 'users';
const PADRON_COLLECTION = 'sheet1';

const ROLE_HIERARCHY: Record<string, number> = {
  'Super-Admin': 0,
  'Admin': 0,
  'Presidente': 1,
  'Coordinador': 2,
  'Dirigente': 3,
  'Recepcionista': 4,
  'Mesario': 5,
  'Comunicaciones': 6,
};

function UserFormContent({ control, register, errors, editingUser, watch, setValue, seccionales }: {
    control: any;
    register: any;
    errors: any;
    editingUser: User | null;
    watch: any;
    setValue: any;
    seccionales: Seccional[];
}) {
    const db = useFirestore();
    const { toast } = useToast();
    const selectedRole = watch('role');
    const assignedSeccionales = watch('seccionales') || [];
    const selectedLocal = watch('local');
    const photoUrl = watch('photoUrl');
    const permissions = watch('permissions') || [];
    const moduleActions = watch('moduleActions') || {};

    const [metadata, setMetadata] = useState<any>(null);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    const [cedulaSearch, setCedulaSearch] = useState('');
    const [isSearchingPadron, setIsSearchingPadron] = useState(false);
    const [seccionalSearch, setSeccionalSearch] = useState('');

    useEffect(() => {
        if (selectedRole && userRoles[selectedRole] && !editingUser) {
            setValue('permissions', userRoles[selectedRole].permissions);
            const initialActions: Record<string, string[]> = {};
            userRoles[selectedRole].permissions.forEach(p => {
                initialActions[p] = ['create', 'update', 'delete', 'pdf', 'excel'];
            });
            setValue('moduleActions', initialActions);
        }
    }, [selectedRole, setValue, editingUser]);
    
    useEffect(() => {
        const firstSec = assignedSeccionales[0];
        const fetchMetadata = async () => {
            if (!firstSec) {
                setMetadata(null);
                return;
            }
            setIsLoadingMetadata(true);
            try {
                const metaDocRef = doc(db, 'seccionales_metadata', firstSec);
                const metaDoc = await getDoc(metaDocRef);
                if (metaDoc.exists()) setMetadata(metaDoc.data());
                else setMetadata(null);
            } catch (error) { setMetadata(null); }
            finally { setIsLoadingMetadata(false); }
        };
        fetchMetadata();
    }, [assignedSeccionales, db]);

    const [rolePresets, setRolePresets] = useState<any[]>([]);
    useEffect(() => {
        if (!db) return;
        getDocs(query(collection(db, 'role_presets'), orderBy('name', 'asc'))).then(snap => {
            setRolePresets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [db]);

    const applyPreset = (preset: any) => {
        setValue('role', preset.role);
        setValue('permissions', preset.permissions || []);
        setValue('moduleActions', preset.moduleActions || {});
        toast({ title: "Perfil Aplicado", description: `Se cargaron los permisos de: ${preset.name}` });
    };

    const locales = useMemo(() => metadata?.locales || [], [metadata]);
    const mesas = useMemo(() => {
        if (!selectedLocal || !metadata?.mesas_por_local) return [];
        const localData = metadata.mesas_por_local.find((item: any) => item.localName === selectedLocal);
        return localData ? localData.mesas : [];
    }, [metadata, selectedLocal]);

    const filteredSeccionales = useMemo(() => {
        if (!seccionalSearch) return seccionales;
        const s = seccionalSearch.toLowerCase();
        return seccionales.filter(sec => 
            String(sec.nombre).toLowerCase().includes(s) || 
            String(sec.departamento || '').toLowerCase().includes(s)
        );
    }, [seccionales, seccionalSearch]);

    const toggleAction = (modulePath: string, action: 'create' | 'update' | 'delete' | 'pdf' | 'excel') => {
        const currentActions = moduleActions[modulePath] || [];
        const newActions = currentActions.includes(action)
            ? currentActions.filter((a: string) => a !== action)
            : [...currentActions, action];
        
        setValue('moduleActions', {
            ...moduleActions,
            [modulePath]: newActions
        });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            toast({ title: "Imagen muy pesada", description: "Límite máximo de 500KB.", variant: "destructive" });
            return;
        }
        setIsProcessingPhoto(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setValue('photoUrl', reader.result as string);
            setIsProcessingPhoto(false);
        };
        reader.readAsDataURL(file);
    };

    const toggleSeccional = (nombre: string) => {
        const current = [...assignedSeccionales];
        if (current.includes(nombre)) {
            setValue('seccionales', current.filter(s => s !== nombre));
        } else {
            setValue('seccionales', [...current, nombre]);
        }
    };

    const handleLookupPadron = async () => {
        const term = cedulaSearch.trim();
        if (!term || !db) return;

        setIsSearchingPadron(true);
        try {
            const padronRef = collection(db, PADRON_COLLECTION);
            const q1 = query(padronRef, where('CEDULA', '==', Number(term)));
            const q2 = query(padronRef, where('CEDULA', '==', term));
            
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const found = [...snap1.docs, ...snap2.docs].map(d => d.data());

            if (found.length > 0) {
                const data = found[0];
                const fullName = `${data.NOMBRE} ${data.APELLIDO}`.toUpperCase();
                setValue('name', fullName);
                if (data.TELEFONO) setValue('telefono', data.TELEFONO);
                
                if (data.CODIGO_SEC) {
                    const secVal = String(data.CODIGO_SEC);
                    const currentSecs = assignedSeccionales;
                    if (!currentSecs.includes(secVal)) {
                        setValue('seccionales', [...currentSecs, secVal]);
                    }
                }

                toast({ title: "Datos Importados", description: `Se cargó la ficha de ${fullName}` });
            } else {
                toast({ title: "No encontrado", description: "La cédula no figura en el padrón.", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error de búsqueda", variant: "destructive" });
        } finally {
            setIsSearchingPadron(false);
        }
    };

    return (
        <div className="space-y-6">
            {rolePresets.length > 0 && (
                <div className="space-y-3 p-5 border-2 border-dashed border-primary/20 rounded-3xl bg-primary/[0.02]">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Botones de Perfil Rápido
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {rolePresets.map(p => (
                            <Button 
                                key={p.id} 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => applyPreset(p)}
                                className="h-9 px-4 font-black uppercase text-[9px] rounded-xl border-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm"
                            >
                                {p.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <UserPlus className="h-3.5 w-3.5" />
                    Auto-completar desde Padrón
                </Label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="INGRESAR CÉDULA..." 
                            value={cedulaSearch}
                            onChange={(e) => setCedulaSearch(e.target.value.replace(/\D/g, ''))}
                            className="pl-10 h-12 font-black text-lg border-primary/20 bg-white"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupPadron())}
                        />
                    </div>
                    <Button 
                        type="button" 
                        onClick={handleLookupPadron} 
                        disabled={isSearchingPadron || !cedulaSearch}
                        className="h-12 px-6 font-black uppercase"
                    >
                        {isSearchingPadron ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4 mr-2" />}
                        BUSCAR
                    </Button>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-3 pb-4">
                <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                        <AvatarImage src={photoUrl} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black uppercase">
                            {watch('name')?.substring(0, 2) || '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 flex flex-col gap-1.5">
                        <Label htmlFor="form-photo-upload" className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors border-2 border-white z-10">
                            {isProcessingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                            <input id="form-photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        </Label>
                        <Button type="button" size="icon" onClick={() => setIsCameraOpen(true)} className="h-7 w-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-white z-10">
                            <Smartphone className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Foto de Identidad</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="name">Nombre Completo</Label><Input id="name" {...register('name')} autoComplete="off" className="font-bold h-11" /></div>
                    <div><Label htmlFor="username">Nombre de Usuario</Label><Input id="username" {...register('username')} autoComplete="off" className="font-bold h-11" /></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="email">Correo Electrónico</Label><Input id="email" type="email" {...register('email')} disabled={!!editingUser} autoComplete="off" className="font-bold h-11" /></div>
                    <div><Label htmlFor="telefono">Teléfono</Label><Input id="telefono" {...register('telefono')} autoComplete="off" className="font-bold h-11" /></div>
                </div>

                {!editingUser && (
                    <div><Label htmlFor="password">Contraseña Inicial</Label><Input id="password" type="password" {...register('password')} autoComplete="new-password" /></div>
                )}

                <div>
                    <Label htmlFor="role">Rol del Sistema</Label>
                    <Controller name="role" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="font-bold h-11"><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                            <SelectContent>{Object.keys(userRoles).map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                        </Select>
                    )} />
                </div>
                
                <div className="space-y-4 p-5 border rounded-3xl bg-muted/5">
                    <div>
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                            <MapPin className="h-3 w-3 text-primary" />
                            Jurisdicciones Asignadas (Multi-Selección)
                        </Label>
                        
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input 
                                placeholder="BUSCAR SECCIONAL..." 
                                value={seccionalSearch}
                                onChange={(e) => setSeccionalSearch(e.target.value)}
                                className="pl-8 h-9 text-[10px] font-bold uppercase border-primary/10 rounded-xl"
                            />
                        </div>

                        <ScrollArea className="h-32 border rounded-xl bg-white p-3 shadow-inner">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {filteredSeccionales.map(s => (
                                    <div key={s.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`sec-${s.nombre}`} 
                                            checked={assignedSeccionales.includes(s.nombre)} 
                                            onCheckedChange={() => toggleSeccional(s.nombre)}
                                        />
                                        <Label htmlFor={`sec-${s.nombre}`} className="text-[10px] font-bold uppercase cursor-pointer">SECC {s.nombre}</Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Matriz de Permisos y Acciones
                    </Label>
                    
                    <Accordion type="multiple" className="w-full space-y-2">
                        {menuCategories.map(category => {
                            const categoryItems = allMenuItems.filter(item => category.items.includes(item.href));
                            if (categoryItems.length === 0) return null;

                            return (
                                <AccordionItem key={category.label} value={category.label} className="border rounded-2xl overflow-hidden bg-white px-4 shadow-sm border-primary/5">
                                    <AccordionTrigger className="hover:no-underline py-4 group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/5 transition-colors group-data-[state=open]:bg-primary/10">
                                                <category.icon className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{category.label}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4 pt-0">
                                        <div className="border rounded-xl overflow-hidden shadow-inner bg-slate-50/30 overflow-x-auto">
                                            <Table className="min-w-[600px]">
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-none text-[8px] font-black uppercase text-muted-foreground">
                                                        <TableHead className="h-8">Módulo del Sistema</TableHead>
                                                        <TableHead className="text-center h-8">Ver</TableHead>
                                                        <TableHead className="text-center h-8">CREAR</TableHead>
                                                        <TableHead className="text-center h-8">EDITAR</TableHead>
                                                        <TableHead className="text-center h-8">BORRAR</TableHead>
                                                        <TableHead className="text-center h-8 bg-blue-50/50 text-blue-600">PDF</TableHead>
                                                        <TableHead className="text-center h-8 bg-green-50/50 text-green-600">EXCEL</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {categoryItems.map(item => {
                                                        const hasAccess = permissions.includes(item.href);
                                                        const actions = moduleActions[item.href] || [];
                                                        return (
                                                            <TableRow key={item.href} className={cn("transition-colors border-slate-100", hasAccess ? "bg-white" : "opacity-40")}>
                                                                <TableCell className="py-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <item.icon className={cn("h-3.5 w-3.5", hasAccess ? "text-primary" : "text-muted-foreground")} />
                                                                        <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">{item.label}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center py-2">
                                                                    <Checkbox checked={hasAccess} onCheckedChange={(checked) => {
                                                                        const newPerms = checked ? [...permissions, item.href] : permissions.filter((p: string) => p !== item.href);
                                                                        setValue('permissions', newPerms);
                                                                        if (checked && !moduleActions[item.href]) {
                                                                            setValue('moduleActions', { ...moduleActions, [item.href]: ['create', 'update', 'delete', 'pdf', 'excel'] });
                                                                        }
                                                                    }} />
                                                                </TableCell>
                                                                <TableCell className="text-center py-2">
                                                                    <Checkbox checked={actions.includes('create')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'create')} />
                                                                </TableCell>
                                                                <TableCell className="text-center py-2">
                                                                    <Checkbox checked={actions.includes('update')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'update')} />
                                                                </TableCell>
                                                                <TableCell className="text-center py-2">
                                                                    <Checkbox checked={actions.includes('delete')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'delete')} />
                                                                </TableCell>
                                                                <TableCell className="text-center py-2 bg-blue-50/20">
                                                                    <Checkbox checked={actions.includes('pdf')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'pdf')} />
                                                                </TableCell>
                                                                <TableCell className="text-center py-2 bg-green-50/20">
                                                                    <Checkbox checked={actions.includes('excel')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'excel')} />
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            </div>

            <CameraCaptureDialog isOpen={isCameraOpen} onOpenChange={setIsCameraOpen} onCapture={(base64) => setValue('photoUrl', base64)} />
        </div>
    );
}

function UserDialog({ isOpen, onOpenChange, editingUser, onSuccess, seccionales }: { isOpen: boolean; onOpenChange: (open: boolean) => void; editingUser: User | null; onSuccess: () => void; seccionales: Seccional[]; }) {
    const db = useFirestore();
    const storage = useStorage();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultValues = useMemo(() => {
        const base = editingUser 
            ? { ...editingUser, photoUrl: editingUser.photoUrl || '', telefono: editingUser.telefono || '', permissions: editingUser.permissions || [], moduleActions: editingUser.moduleActions || {}, role: editingUser.role as any || 'Recepcionista', seccionales: editingUser.seccionales || (editingUser.seccional ? [editingUser.seccional] : []), local: editingUser.local || '', mesas: editingUser.mesas || [] } 
            : { name: '', email: '', username: '', password: '', telefono: '', photoUrl: '', role: 'Recepcionista' as any, seccionales: [], local: '', mesas: [], permissions: [], moduleActions: {} };
        return base;
    }, [editingUser]);

    const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<UserFormData | EditUserFormData>({
        resolver: zodResolver(editingUser ? editUserSchema : userSchema),
        defaultValues: defaultValues as any,
    });
    
    useEffect(() => { if (isOpen) reset(defaultValues as any); }, [isOpen, editingUser, reset, defaultValues]);

    const onSubmit = async (data: UserFormData | EditUserFormData) => {
        if (!currentUser || !db || !storage) return;
        setIsSubmitting(true);
        const dataToSave = { ...data };

        // OFF-LOAD MEDIA: SUBIR IMAGEN A FIREBASE STORAGE SI ES BASE64
        if (dataToSave.photoUrl && dataToSave.photoUrl.startsWith('data:image')) {
            try {
                const storageRef = ref(storage, `users/${dataToSave.email || (dataToSave as any).username}/profile_${Date.now()}.jpg`);
                const uploadTask = await uploadString(storageRef, dataToSave.photoUrl, 'data_url');
                const downloadUrl = await getDownloadURL(uploadTask.ref);
                dataToSave.photoUrl = downloadUrl;
            } catch (error) {
                console.error("Error uploading image:", error);
                toast({ title: "Error de Imagen", description: "No se pudo subir la foto, se usará el respaldo local.", variant: "destructive" });
            }
        }
        
        if (editingUser) {
            const userRef = doc(db, USERS_COLLECTION_NAME, editingUser.id);
            updateDoc(userRef, dataToSave as any)
                .then(() => {
                    logAction(db, { userId: currentUser.id, userName: currentUser.name, module: 'USUARIOS', action: 'EDITÓ USUARIO Y PERMISOS', targetId: editingUser.id, targetName: data.name });
                    toast({ title: '¡Usuario actualizado!' });
                    onSuccess();
                    onOpenChange(false);
                })
                .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: dataToSave })); })
                .finally(() => setIsSubmitting(false));
        } else {
            const { password, ...userData } = data as UserFormData;
            const secondaryApp = initializeApp(firebaseConfig, `create-${Date.now()}`);
            const secondaryAuth = getAuthSecondary(secondaryApp);
            try {
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
                await setDoc(doc(db, USERS_COLLECTION_NAME, userCredential.user.uid), userData);
                logAction(db, { userId: currentUser.id, userName: currentUser.name, module: 'USUARIOS', action: 'CREÓ USUARIO CON PERMISOS', targetId: userCredential.user.uid, targetName: userData.name });
                toast({ title: '¡Usuario creado!' });
                onSuccess();
                onOpenChange(false);
            } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
            finally { await deleteApp(secondaryApp); setIsSubmitting(false); }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem]">
                <DialogHeader className="p-8 pb-4 border-b shrink-0 bg-muted/20">
                    <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3 text-2xl">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                        {editingUser ? 'Ficha de Control Operativo' : 'Alta de Nuevo Operador'}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                    <UserFormContent control={control} register={register} errors={errors} editingUser={editingUser} watch={watch} setValue={setValue} seccionales={seccionales} />
                </div>
                <DialogFooter className="p-8 pt-4 border-t bg-muted/10 shrink-0 gap-3">
                    <DialogClose asChild><Button type="button" variant="outline" className="font-black uppercase text-xs h-12 px-8 rounded-2xl">CANCELAR</Button></DialogClose>
                    <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="font-black uppercase text-xs h-12 px-10 rounded-2xl shadow-xl">
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                        {editingUser ? 'GUARDAR CAMBIOS' : 'CREAR USUARIO'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UsersPage() {
  const db = useFirestore();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [seccionales, setSeccionales] = useState<Seccional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsersAndSeccionales = useCallback(async () => {
    setIsLoading(true);
    try {
        const usersQuery = query(collection(db, USERS_COLLECTION_NAME), limit(150));
        const usersSnap = await getDocs(usersQuery);
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        const seccSnap = await getDocs(collection(db, 'seccionales'));
        const seccList = seccSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Seccional));
        setSeccionales(seccList.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })));
    } catch (error) { toast({ title: 'Error al cargar datos', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  }, [toast, db]);

  useEffect(() => { fetchUsersAndSeccionales(); }, [fetchUsersAndSeccionales]);

  const filteredUsers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.username.toLowerCase().includes(s));
  }, [users, searchTerm]);

  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {};
    
    filteredUsers.forEach(u => {
        let key = '';
        if (u.role === 'Admin' || u.role === 'Super-Admin') {
            key = 'PC';
        } else {
            const secs = u.seccionales || (u.seccional ? [u.seccional] : []);
            if (secs.length > 1) {
                key = 'MULTI';
            } else if (secs.length === 1) {
                key = String(secs[0]);
            } else {
                key = 'GLOBAL';
            }
        }
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(u);
    });
    
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (a === 'PC') return -1;
        if (b === 'PC') return 1;
        if (a === 'GLOBAL') return 1;
        if (b === 'GLOBAL') return -1;
        if (a === 'MULTI') return b === 'GLOBAL' ? -1 : 1;
        if (b === 'MULTI') return a === 'GLOBAL' ? 1 : -1;
        return a.localeCompare(b, undefined, { numeric: true });
    });
    
    sortedKeys.forEach(k => {
        groups[k].sort((a, b) => (ROLE_HIERARCHY[a.role] || 99) - (ROLE_HIERARCHY[b.role] || 99));
    });
    
    return { groups, sortedKeys };
  }, [filteredUsers]);

  const toggleActive = async (user: User) => {
    if (!db) return;
    const newState = user.active === false; // If undefined or true, it becomes false. If false, becomes true.
    try {
        await updateDoc(doc(db, USERS_COLLECTION_NAME, user.id), {
            active: newState
        });
        toast({ 
            title: newState ? "Operador Activado" : "Operador Suspendido", 
            description: `El acceso para ${user.name} ha sido ${newState ? 'reestablecido' : 'revocado'}.` 
        });
    } catch (e) {
        toast({ title: "Error", description: "No se pudo cambiar el estado del usuario.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (userToDelete && currentUser) {
        const userRef = doc(db, USERS_COLLECTION_NAME, userToDelete.id);
        deleteDoc(userRef).then(() => {
            logAction(db, { userId: currentUser.id, userName: currentUser.name, module: 'USUARIOS', action: 'ELIMINÓ USUARIO', targetId: userToDelete.id, targetName: userToDelete.name });
            toast({ title: 'Usuario eliminado' });
            fetchUsersAndSeccionales();
            setIsAlertOpen(false);
        }).catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'delete' })); });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><Users className="h-8 w-8 text-primary" /> Gestión de Operadores</h1><p className="text-muted-foreground font-medium">Control jerárquico de perfiles, roles y permisos de la LISTA 2P.</p></div>
        <Button onClick={() => { setEditingUser(null); setIsDialogOpen(true); }} className="font-black h-12 px-8 shadow-xl rounded-2xl active:scale-95 transition-all"><PlusCircle className="w-5 h-5 mr-2" /> CREAR OPERADOR</Button>
      </div>

      <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar por nombre o usuario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-12 font-bold rounded-2xl border-primary/10" autoComplete="off" /></div>

      <div className="space-y-4">
        {isLoading ? (
            <div className="border rounded-[2.5rem] bg-card p-8 shadow-2xl border-primary/5">
                <Skeleton className="h-20 w-full rounded-2xl mb-4" />
                <Skeleton className="h-20 w-full rounded-2xl mb-4" />
                <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
        ) : groupedUsers.sortedKeys.length > 0 ? (
            <Accordion type="multiple" defaultValue={['PC']} className="space-y-4">
                {groupedUsers.sortedKeys.map(key => {
                    const usersInGroup = groupedUsers.groups[key];
                    let label = '';
                    let icon = <Users className="h-5 w-5 text-primary" />;
                    
                    if (key === 'PC') {
                      label = 'PC (Puesto de Comando)';
                      icon = <ShieldCheck className="h-5 w-5 text-primary" />;
                    } else if (key === 'MULTI') {
                      label = 'Dirigentes Múltiples Seccionales';
                      icon = <Layers className="h-5 w-5 text-primary" />;
                    } else if (key === 'GLOBAL') {
                      label = 'Operadores Globales';
                      icon = <UserCircle className="h-5 w-5 text-primary" />;
                    } else {
                      label = `Seccional ${key}`;
                      icon = <MapPin className="h-5 w-5 text-primary" />;
                    }

                    return (
                        <AccordionItem key={key} value={key} className="border rounded-[2.5rem] bg-card shadow-xl overflow-hidden border-primary/5 px-0">
                            <AccordionTrigger className="hover:no-underline py-6 px-8 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-2xl bg-primary/5 group-data-[state=open]:bg-primary/10 transition-colors">
                                        {icon}
                                    </div>
                                    <div className="flex flex-col items-start translate-y-0.5 text-left">
                                        <span className="font-black uppercase tracking-tight text-lg text-slate-800">{label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{usersInGroup.length} Operadores</span>
                                            {usersInGroup.some(u => u.active === false) && (
                                                <Badge variant="destructive" className="h-3 px-1.5 text-[7px] font-black animate-pulse">ALERTA SUSPENSIÓN</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t bg-slate-50/10">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 text-[9px] font-black uppercase border-b">
                                            <TableHead className="pl-8 py-4">Operador / Identidad</TableHead>
                                            <TableHead>Rol del Sistema</TableHead>
                                            <TableHead>Jurisdicción (SECC)</TableHead>
                                            <TableHead>Acciones Habilitadas</TableHead>
                                            <TableHead className="text-right pr-8">Opciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {usersInGroup.map(user => (
                                            <TableRow key={user.id} className="hover:bg-primary/[0.01] transition-colors border-b last:border-0 bg-white/50">
                                                <TableCell className="py-4 pl-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn("relative", user.active === false && "grayscale opacity-50")}>
                                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm font-black uppercase">
                                                                <AvatarImage src={user.photoUrl} className="object-cover" />
                                                                <AvatarFallback className="bg-primary/5 text-primary text-[10px]">{user.name.substring(0,2)}</AvatarFallback>
                                                            </Avatar>
                                                            {user.active === false && <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5 border border-white shadow-sm"><X className="h-2 w-2 text-white" /></div>}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("font-black text-xs uppercase tracking-tight leading-none", user.active === false ? "text-slate-400 line-through" : "text-slate-900")}>{user.name}</span>
                                                                {user.active === false && <Badge variant="destructive" className="h-3 px-1 text-[6px] font-black uppercase">SUSPENDIDO</Badge>}
                                                            </div>
                                                            <span className="text-[9px] text-muted-foreground font-bold">{user.email}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-black text-[8px] uppercase tracking-widest px-2 py-0.5 bg-primary/5 text-primary border-primary/5">
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                                                        {(() => {
                                                            const raw = (user.seccionales || (user.seccional ? [user.seccional] : []));
                                                            if (raw.length === 0) return <span className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Global</span>;
                                                            return raw.map(s => {
                                                                const clean = String(s).toUpperCase().replace('SECCIONAL', '').trim();
                                                                return <Badge key={clean} variant="outline" className="text-[7px] font-black uppercase border-slate-100 bg-white shadow-sm">SECC {clean}</Badge>;
                                                            });
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap max-w-[150px]">
                                                        {user.permissions?.slice(0, 2).map(p => (
                                                            <Badge key={p} variant="outline" className="text-[7px] font-black uppercase border-slate-100 bg-slate-50">
                                                                {p.replace('/', '') || 'DASHBOARD'}
                                                            </Badge>
                                                        ))}
                                                        {user.permissions?.length > 2 && <span className="text-[8px] font-black text-muted-foreground opacity-50">+ {user.permissions.length - 2}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary/5"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 font-black uppercase text-[10px] rounded-2xl shadow-2xl border-primary/10 p-2">
                                                            <DropdownMenuItem onClick={() => { setEditingUser(user); setIsDialogOpen(true); }} className="cursor-pointer rounded-xl"><Edit className="w-3.5 h-3.5 mr-3 text-primary" /> EDITAR FICHA</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => toggleActive(user)} className={cn("cursor-pointer rounded-xl", user.active === false ? "text-green-600" : "text-amber-600")}>
                                                                {user.active === false ? <CheckCircle2 className="w-3.5 h-3.5 mr-3" /> : <ShieldCheck className="w-3.5 h-3.5 mr-3" />}
                                                                {user.active === false ? 'ACTIVAR CUENTA' : 'INACTIVAR CUENTA'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-500 cursor-pointer rounded-xl" onClick={() => { setUserToDelete(user); setIsAlertOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-3" /> ELIMINAR CUENTA</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        ) : (
            <div className="border rounded-[2.5rem] bg-card p-20 text-center opacity-30 shadow-xl border-primary/5">
                <Users className="w-16 h-16 mx-auto mb-4 text-primary" />
                <p className="font-black uppercase text-sm tracking-widest">Sin operadores registrados bajo este criterio</p>
            </div>
        )}
      </div>
      
      <UserDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} editingUser={editingUser} onSuccess={fetchUsersAndSeccionales} seccionales={seccionales} />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="rounded-[2.5rem]"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tight text-2xl">¿Eliminar Operador?</AlertDialogTitle><AlertDialogDescription className="font-medium text-base">Esta acción es irreversible. Se revocará todo acceso de <strong>{userToDelete?.name}</strong> al sistema estratégico de la Lista 2P.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3"><AlertDialogCancel className="font-black uppercase text-xs rounded-2xl h-12">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs rounded-2xl h-12 px-8">ELIMINAR DEFINITIVAMENTE</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
