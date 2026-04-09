
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, User as UserIcon, Mail, Shield, Building, Phone, UserCircle, Camera, Save, UserCog, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { logAction } from '@/lib/audit';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CameraCaptureDialog } from '@/components/CameraCaptureDialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function PerfilPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const auth = useFirebaseAuth();
    const { toast } = useToast();
    
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [telefono, setTelefono] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setUsername(user.username || '');
            setTelefono(user.telefono || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user) return;

        setIsSavingProfile(true);
        const userRef = doc(db, 'users', user.id);
        const dataToUpdate = {
            name,
            username,
            telefono
        };

        updateDoc(userRef, dataToUpdate)
            .then(() => {
                logAction(db, {
                    userId: user.id,
                    userName: user.name,
                    module: 'PERFIL',
                    action: 'ACTUALIZÓ DATOS PERSONALES',
                });
                toast({ title: "¡Perfil Actualizado!", description: "Tus datos se han guardado correctamente." });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: dataToUpdate
                }));
            })
            .finally(() => {
                setIsSavingProfile(false);
            });
    };

    const updateProfilePhoto = async (base64String: string) => {
        if (!db || !user) return;
        setIsUploadingPhoto(true);
        const userRef = doc(db, 'users', user.id);
        const data = { photoUrl: base64String };

        updateDoc(userRef, data)
            .then(() => {
                logAction(db, {
                    userId: user.id,
                    userName: user.name,
                    module: 'PERFIL',
                    action: 'CAMBIÓ FOTO DE PERFIL',
                });
                toast({ title: "Foto actualizada" });
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: data
                }));
            })
            .finally(() => {
                setIsUploadingPhoto(false);
            });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            toast({ title: "Imagen muy pesada", description: "El límite para la foto es 500KB.", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            updateProfilePhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!auth.currentUser || !user) {
            toast({ title: "Error", description: "No se ha detectado una sesión activa.", variant: "destructive" });
            return;
        }

        if (newPassword.length < 6) {
            toast({ title: "Contraseña muy corta", description: "La nueva contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({ title: "Error de coincidencia", description: "Las contraseñas no coinciden.", variant: "destructive" });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            await updatePassword(auth.currentUser, newPassword);
            
            logAction(db, {
                userId: user.id,
                userName: user.name,
                module: 'PERFIL',
                action: 'CAMBIÓ CONTRASEÑA PERSONAL',
            });

            toast({ title: "¡Éxito!", description: "Tu contraseña ha sido actualizada correctamente." });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            if (error.code === 'auth/requires-recent-login') {
                toast({ 
                    title: "Re-autenticación necesaria", 
                    description: "Por seguridad, debes cerrar sesión e iniciarla nuevamente.", 
                    variant: "destructive" 
                });
            } else {
                toast({ 
                    title: "Error", 
                    description: "No se pudo actualizar la contraseña.", 
                    variant: "destructive" 
                });
            }
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3 uppercase tracking-tighter">
                        <UserCircle className="h-8 w-8 text-primary" />
                        Configuración de Cuenta
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Gestiona tu identidad y seguridad en el sistema operativo.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-primary/10 shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 text-center pb-8 pt-12 relative">
                            <div className="relative mx-auto h-32 w-32 mb-4 group">
                                <Avatar className="h-32 w-32 border-4 border-white shadow-2xl transition-transform duration-500 group-hover:scale-105">
                                    <AvatarImage src={user?.photoUrl} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black uppercase">
                                        {user?.name?.substring(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 -right-2 flex flex-col gap-2">
                                    <Label htmlFor="photo-upload" className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors border-2 border-white z-10">
                                        {isUploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                                        <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                                    </Label>
                                    <Button 
                                        size="icon" 
                                        onClick={() => setIsCameraOpen(true)} 
                                        className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-white z-10"
                                        disabled={isUploadingPhoto}
                                    >
                                        <Smartphone className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900">{user?.name}</CardTitle>
                            <Badge variant="secondary" className="mt-2 font-black text-[9px] uppercase tracking-[0.2em] px-3 py-1 bg-primary/10 text-primary border-primary/10">
                                {user?.role}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-8 px-8 pb-10">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                                    <Mail className="h-3.5 w-3.5 text-primary" /> Correo Electrónico
                                </Label>
                                <p className="text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 truncate">{user?.email}</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                                    <Building className="h-3.5 w-3.5 text-primary" /> Jurisdicción
                                </Label>
                                <p className="text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 uppercase tracking-tight">
                                    {user?.seccional ? `SECCIONAL ${user.seccional}` : 'Sin asignar'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-5">
                            <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                                <UserCog className="h-5 w-5 text-primary" />
                                Datos Personales
                            </CardTitle>
                        </CardHeader>
                        <form onSubmit={handleUpdateProfile}>
                            <CardContent className="space-y-6 pt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="prof-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre y Apellido</Label>
                                        <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 font-bold rounded-xl border-slate-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="prof-username" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuario del Sistema</Label>
                                        <Input id="prof-username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 font-bold rounded-xl border-slate-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="prof-tel" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono de Contacto</Label>
                                        <Input id="prof-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="09xx..." className="h-11 font-bold rounded-xl border-slate-200" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t py-4 justify-end">
                                <Button type="submit" disabled={isSavingProfile} className="h-11 px-8 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 rounded-xl transition-all hover:scale-105 active:scale-95">
                                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    GUARDAR CAMBIOS
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b py-5">
                            <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                                <Lock className="h-5 w-5 text-primary" />
                                Seguridad de la Cuenta
                            </CardTitle>
                        </CardHeader>
                        <form onSubmit={handleUpdatePassword}>
                            <CardContent className="space-y-6 pt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password" title="Mínimo 6 caracteres" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nueva Contraseña</Label>
                                        <Input 
                                            id="new-password" 
                                            type="password" 
                                            placeholder="••••••••" 
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            className="h-11 font-bold rounded-xl border-slate-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confirmar Contraseña</Label>
                                        <Input 
                                            id="confirm-password" 
                                            type="password" 
                                            placeholder="••••••••" 
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="h-11 font-bold rounded-xl border-slate-200"
                                        />
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex items-start gap-4">
                                    <Shield className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-black text-blue-700 uppercase tracking-widest">Aviso de Seguridad</p>
                                        <p className="text-blue-600/80 leading-relaxed font-medium">
                                            Al cambiar tu contraseña, asegúrate de que sea única y difícil de adivinar. 
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t py-4 justify-end">
                                <Button type="submit" disabled={isUpdatingPassword} variant="outline" className="h-11 px-8 font-black uppercase tracking-widest text-xs rounded-xl border-primary/20 text-primary hover:bg-primary/5 transition-all">
                                    {isUpdatingPassword ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Lock className="mr-2 h-4 w-4" />
                                    )}
                                    ACTUALIZAR CONTRASEÑA
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>

            <CameraCaptureDialog 
                isOpen={isCameraOpen} 
                onOpenChange={setIsCameraOpen} 
                onCapture={updateProfilePhoto} 
            />
        </div>
    );
}
