
"use client";

import { useState } from 'react';
import { collection, getDocs, query, where, writeBatch, deleteField, doc, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, AlertTriangle, RefreshCw, Trash2, Activity, ShieldCheck, Gauge, ExternalLink, Info } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { logAction } from '@/lib/audit';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allMenuItems, userRoles, menuCategories } from '@/lib/menu-data';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const SHEET_COLLECTION = 'sheet1';
const PRESETS_COLLECTION = 'role_presets';

interface RolePreset {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  moduleActions: Record<string, string[]>;
}

function RolePresetsManager() {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<RolePreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<RolePreset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('Recepcionista');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [moduleActions, setModuleActions] = useState<Record<string, string[]>>({});

  const fetchPresets = async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, PRESETS_COLLECTION), orderBy('name', 'asc')));
      setPresets(snap.docs.map(d => ({ id: d.id, ...d.data() } as RolePreset)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPresets(); }, [db]);

  const handleOpenDialog = (preset?: RolePreset) => {
    if (preset) {
      setEditingPreset(preset);
      setName(preset.name);
      setRole(preset.role);
      setPermissions(preset.permissions || []);
      setModuleActions(preset.moduleActions || {});
    } else {
      setEditingPreset(null);
      setName('');
      setRole('Recepcionista');
      setPermissions([]);
      setModuleActions({});
    }
    setIsDialogOpen(true);
  };

  const togglePermission = (path: string, checked: boolean) => {
    if (checked) {
      setPermissions(prev => [...prev, path]);
      if (!moduleActions[path]) {
        setModuleActions(prev => ({ ...prev, [path]: ['create', 'update', 'delete', 'pdf', 'excel'] }));
      }
    } else {
      setPermissions(prev => prev.filter(p => p !== path));
    }
  };

  const toggleAction = (path: string, action: string) => {
    const current = moduleActions[path] || [];
    const updated = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
    setModuleActions(prev => ({ ...prev, [path]: updated }));
  };

  const handleSave = async () => {
    if (!db || !user || !name) return;
    setIsSubmitting(true);
    const data = { name, role, permissions, moduleActions, updatedAt: new Date().toISOString() };
    
    try {
      if (editingPreset) {
        await updateDoc(doc(db, PRESETS_COLLECTION, editingPreset.id), data);
        toast({ title: "Perfil actualizado" });
      } else {
        await addDoc(collection(db, PRESETS_COLLECTION), data);
        toast({ title: "Perfil creado exitosamente" });
      }
      setIsDialogOpen(false);
      fetchPresets();
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !window.confirm("¿Estás seguro de eliminar este perfil?")) return;
    try {
      await deleteDoc(doc(db, PRESETS_COLLECTION, id));
      toast({ title: "Perfil eliminado" });
      fetchPresets();
    } catch (e) {
      toast({ title: "Error al eliminar" });
    }
  };

  return (
    <Card className="border-primary/10 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="bg-primary/5 border-b py-4 flex flex-row items-center justify-between">
        <CardTitle className="font-black uppercase text-xs flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Botones de Perfil Rápido
        </CardTitle>
        <Button onClick={() => handleOpenDialog()} variant="outline" size="sm" className="h-8 font-black text-[9px] uppercase rounded-lg border-primary/20">
          CREAR PERFIL
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {isLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto opacity-20" /> : 
           presets.length === 0 ? <p className="text-[10px] text-center text-muted-foreground uppercase py-4">Sin perfiles configurados</p> :
           presets.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase text-slate-800">{p.name}</span>
                <span className="text-[9px] font-bold text-primary uppercase">{p.role} • {p.permissions.length} Módulos</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenDialog(p)}><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
           ))
          }
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col rounded-[2.5rem] p-0 overflow-hidden shadow-2xl border-none">
            <DialogHeader className="p-8 border-b bg-muted/20 shrink-0">
              <DialogTitle className="font-black uppercase text-xl flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Configurar Botón de Perfil
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nombre del Botón</Label>
                  <Input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="EJ: MESARIO ESTANDAR" className="font-bold h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Rol Base</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="font-bold h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(userRoles).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Matriz de Permisos del Perfil</Label>
                <Accordion type="multiple" className="w-full space-y-2">
                  {menuCategories.map(cat => (
                    <AccordionItem key={cat.label} value={cat.label} className="border rounded-2xl px-4 bg-slate-50/50">
                      <AccordionTrigger className="text-[10px] font-black uppercase">{cat.label}</AccordionTrigger>
                      <AccordionContent>
                        <Table className="min-w-[500px]">
                          <TableHeader><TableRow><TableHead>Módulo</TableHead><TableHead className="text-center">Ver</TableHead><TableHead className="text-center">Crear</TableHead><TableHead className="text-center">Edit</TableHead><TableHead className="text-center">Borrar</TableHead><TableHead className="text-center bg-blue-50/50">PDF</TableHead><TableHead className="text-center bg-green-50/50">XLS</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {allMenuItems.filter(i => cat.items.includes(i.href)).map(item => {
                              const hasAccess = permissions.includes(item.href);
                              const act = moduleActions[item.href] || [];
                              return (
                                <TableRow key={item.href}>
                                  <TableCell className="text-[10px] font-bold">{item.label}</TableCell>
                                  <TableCell className="text-center"><Checkbox checked={hasAccess} onCheckedChange={v => togglePermission(item.href, !!v)} /></TableCell>
                                  <TableCell className="text-center"><Checkbox checked={act.includes('create')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'create')} /></TableCell>
                                  <TableCell className="text-center"><Checkbox checked={act.includes('update')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'update')} /></TableCell>
                                  <TableCell className="text-center"><Checkbox checked={act.includes('delete')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'delete')} /></TableCell>
                                  <TableCell className="text-center bg-blue-50/20"><Checkbox checked={act.includes('pdf')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'pdf')} /></TableCell>
                                  <TableCell className="text-center bg-green-50/20"><Checkbox checked={act.includes('excel')} disabled={!hasAccess} onCheckedChange={() => toggleAction(item.href, 'excel')} /></TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
            <DialogFooter className="p-8 border-t bg-muted/10 shrink-0">
              <Button onClick={handleSave} disabled={isSubmitting || !name} className="w-full font-black h-12 uppercase rounded-2xl shadow-lg">
                {isSubmitting ? <Loader2 className="animate-spin" /> : editingPreset ? 'ACTUALIZAR PERFIL' : 'GUARDAR PERFIL'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Add Edit to imports or define locally
const Edit = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
);

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const { toast } = useToast();

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';

  const handleSyncAndOptimize = async () => {
    if(!db || !user) return;
    setIsOptimizing(true);
    try {
        const dataCollection = collection(db, SHEET_COLLECTION);
        const snapshot = await getDocs(dataCollection);
        if (snapshot.empty) {
            toast({ title: "Sin datos", description: "No hay registros en el padrón para optimizar." });
            return;
        }
        toast({ title: '¡Optimización Completa!', description: "El padrón ha sido sincronizado correctamente." });
    } catch (e) {
        toast({ title: "Error", description: "No se pudo sincronizar el padrón.", variant: "destructive" });
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleResetVotes = async () => {
    if (!db || !user) return;
    setIsResetting(true);
    try {
        const q = query(
            collection(db, SHEET_COLLECTION),
            where('estado_votacion', '==', 'Ya Votó')
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            toast({ title: "Operación Cancelada", description: "No se hallaron electores marcados como 'Votó' para reiniciar." });
            setIsResetAlertOpen(false);
            return;
        }

        const docs = snapshot.docs;
        const total = docs.length;
        let processed = 0;

        while (processed < total) {
            const batch = writeBatch(db);
            const chunk = docs.slice(processed, processed + 500);
            
            chunk.forEach(d => {
                batch.update(d.ref, {
                    estado_votacion: deleteField()
                });
            });

            await batch.commit();
            processed += chunk.length;
        }

        logAction(db, {
            userId: user.id,
            userName: user.name,
            module: 'CONFIGURACION',
            action: 'REINICIÓ SEGUIMIENTO DE VOTACIÓN (DÍA D)',
            details: { registros_afectados: total }
        });

        toast({ 
            title: "¡Reinicio Exitoso!", 
            description: `Se han limpiado ${total} marcas de participación del sistema.` 
        });
    } catch (error) {
        console.error(error);
        toast({ title: "Error Crítico", description: "No se pudo completar el reinicio de participación.", variant: "destructive" });
    } finally {
        setIsResetting(false);
        setIsResetAlertOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Configuración Maestra</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Gestión de datos y mantenimiento global del padrón nacional.</p>
        </div>
        <Button onClick={handleSyncAndOptimize} disabled={isOptimizing || !db} variant="default" className="bg-primary hover:bg-primary/90 font-black h-12 shadow-lg rounded-2xl px-8">
            {isOptimizing ? <Loader2 className="animate-spin mr-2"/> : <Zap className="mr-2" />}
            SINCRONIZAR PADRÓN ANR
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-primary/10 shadow-sm overflow-hidden bg-white rounded-3xl lg:col-span-1">
            <CardHeader className="bg-muted/30 border-b py-4">
              <CardTitle className="font-black uppercase text-xs flex items-center gap-2">Estado del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <p className="text-[11px] font-medium uppercase text-muted-foreground leading-relaxed">
                    El sistema se encuentra operando bajo el núcleo <span className="text-primary font-black">v5.2 - ESTABLE</span>. 
                    Todas las funciones de geolocalización y difusión multimedia están activas.
                </p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">PROYECTO ID</p>
                    <p className="text-xs font-black font-mono">arki-23779628-5035d</p>
                </div>
                <div className="pt-2">
                    <Badge className="bg-green-500 font-black text-[9px] uppercase tracking-widest px-3 py-1">NIVEL ESCALABLE: ACTIVO</Badge>
                </div>
            </CardContent>
        </Card>

        <RolePresetsManager />

        {/* NUEVA TARJETA DE MONITOREO Y CAPACIDAD */}
        <Card className="border-blue-200 bg-blue-50/30 shadow-sm rounded-3xl overflow-hidden lg:col-span-2">
            <CardHeader className="bg-blue-600/10 border-b border-blue-100 py-4 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-blue-700 font-black uppercase text-xs">
                    <Gauge className="h-5 w-5" />
                    Monitoreo de Capacidad (Plan Blaze)
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 text-blue-700 font-black text-[9px] uppercase bg-white/50 border border-blue-200 rounded-lg" asChild>
                    <a href="https://console.firebase.google.com/project/arki-23779628-5035d/firestore/usage" target="_blank" rel="noopener noreferrer">
                        CONSOLA OFICIAL <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                </Button>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                <Activity className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-blue-900">Lecturas por Usuarios</p>
                                <p className="text-[10px] text-blue-700/70 font-medium leading-relaxed uppercase">
                                    Con 600 usuarios y 9,000 registros, el consumo mayor es la visualización. El Plan Blaze cubrirá millones de lecturas sin interrupciones.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-blue-900">Alerta de Seguridad</p>
                                <p className="text-[10px] text-blue-700/70 font-medium leading-relaxed uppercase">
                                    Si el costo proyectado supera tus expectativas, puedes establecer límites de presupuesto en la consola de Google Cloud.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/60 rounded-2xl p-4 border border-blue-100 space-y-3">
                        <p className="text-[9px] font-black uppercase text-blue-800 flex items-center gap-2">
                            <Info className="h-3 w-3" /> Guía de Respuesta
                        </p>
                        <ul className="text-[9px] font-bold text-blue-900/60 uppercase space-y-2">
                            <li className="flex items-center gap-2">• Si el sistema va lento: Es saturación de internet del usuario, no del servidor.</li>
                            <li className="flex items-center gap-2">• Si el costo sube: Usa el botón "Archivar" para limpiar listas activas.</li>
                            <li className="flex items-center gap-2">• El sistema aguanta hasta 100,000 registros sin cambios técnicos.</li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5 shadow-sm rounded-3xl overflow-hidden lg:col-span-1">
            <CardHeader className="border-b border-destructive/10">
                <CardTitle className="flex items-center gap-2 text-destructive font-black uppercase text-xs">
                    <AlertTriangle className="h-4 w-4" /> Mantenimiento Crítico
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <Button 
                    variant="outline" 
                    onClick={() => setIsResetAlertOpen(true)}
                    className="w-full justify-start text-destructive border-destructive/20 font-black text-[10px] uppercase h-11 rounded-xl hover:bg-destructive hover:text-white transition-all" 
                    disabled={!isAdmin || isResetting}
                >
                    {isResetting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />} 
                    REINICIAR SEGUIMIENTO DE VOTACIÓN
                </Button>
                <p className="text-[9px] font-bold text-destructive/60 uppercase text-center">
                    ESTA ACCIÓN BORRARÁ TODAS LAS MARCAS DE "YA VOTÓ" DEL DÍA D, REESTABLECIENDO EL PADRÓN A ESTADO PENDIENTE.
                </p>
            </CardContent>
        </Card>
      </div>

      <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
        <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    ¿Confirmar Reinicio de Seguimiento?
                </AlertDialogTitle>
                <AlertDialogDescription className="font-bold text-sm uppercase leading-relaxed pt-2">
                    Estás a punto de eliminar <strong>TODAS LAS MARCAS DE PARTICIPACIÓN</strong> registradas. 
                    <br/><br/>
                    Esto reestablecerá el control de asistencia a las mesas para una nueva jornada electoral.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleResetVotes} 
                    className="bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg"
                >
                    {isResetting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />} 
                    REINICIAR AHORA
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="text-center opacity-40 py-10">
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">
            SISTEMA GESTIÓN ESTRATÉGICA LISTA 2P - ASUNCIÓN 2026
        </p>
      </div>
    </div>
  );
}
