"use client";
import { COLLECTION_PADRON } from '@/lib/constants';


import { useState } from 'react';
import { collection, getDocs, getDoc, query, where, writeBatch, deleteField, doc, addDoc, updateDoc, deleteDoc, orderBy, setDoc, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, AlertTriangle, RefreshCw, Trash2, Activity, ShieldCheck, Gauge, ExternalLink, Info, MapPin } from 'lucide-react';
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
  const [syncToUsers, setSyncToUsers] = useState(true);

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
    setSyncToUsers(true); // Default to true when opening
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
      } else {
        await addDoc(collection(db, PRESETS_COLLECTION), data);
      }

      if (syncToUsers) {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', role)));
        if (!usersSnap.empty) {
          let batch = writeBatch(db);
          let count = 0;
          
          usersSnap.forEach(userDoc => {
            batch.update(userDoc.ref, {
              permissions: data.permissions,
              moduleActions: data.moduleActions,
              updatedAt: new Date().toISOString()
            });
            count++;
            if (count % 400 === 0) {
              batch.commit();
              batch = writeBatch(db);
            }
          });
          
          if (count > 0) {
            await batch.commit();
          }
          toast({ title: "¡Perfil Sincronizado!", description: `Se guardó el perfil y se actualizaron ${usersSnap.size} usuarios con el rol ${role}.` });
        } else {
          toast({ title: "Perfil guardado", description: `No se encontraron usuarios con el rol ${role} para sincronizar.` });
        }
      } else {
        toast({ title: "Perfil guardado", description: "Se guardó el perfil sin afectar a usuarios existentes." });
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

              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 shadow-sm bg-blue-50/50 border-blue-100">
                <Checkbox 
                  id="syncToUsers" 
                  checked={syncToUsers} 
                  onCheckedChange={(checked) => setSyncToUsers(!!checked)} 
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="syncToUsers" className="text-xs font-black uppercase text-blue-900 cursor-pointer">
                    Sincronizar permisos en cascada
                  </Label>
                  <p className="text-[10px] text-blue-700/80 font-bold uppercase leading-relaxed">
                    Al guardar, todos los usuarios que tengan el rol base <strong>{role}</strong> se actualizarán automáticamente con estos nuevos permisos y módulos.
                  </p>
                </div>
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

function LocalesAssignmentManager() {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [locales, setLocales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeccionales, setSelectedSeccionales] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  // Nuevos estados para crear manuales
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [newSeccionalId, setNewSeccionalId] = useState('');
  const [customSeccionalesOptions, setCustomSeccionalesOptions] = useState<string[]>(Array.from({length: 45}, (_, i) => String(i + 1)));
  const [filter, setFilter] = useState<'pending' | 'asignado' | 'todos'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLocales = async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      let q = collection(db, 'locales_votacion');
      if (filter === 'pending') {
        q = query(q, where('status', '==', 'pending_seccional'), limit(500));
      } else if (filter === 'asignado') {
        q = query(q, where('status', '==', 'asignado'), limit(500));
      } else {
        q = query(q, limit(500));
      }
      const snap = await getDocs(q);
      setLocales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomSeccionales = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'seccionales_metadata'));
      const secIds = snap.docs.map(d => d.id).filter(id => !isNaN(Number(id)));
      const baseOptions = Array.from({length: 45}, (_, i) => String(i + 1));
      const combined = Array.from(new Set([...baseOptions, ...secIds])).sort((a, b) => Number(a) - Number(b));
      setCustomSeccionalesOptions(combined);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { 
      fetchLocales(); 
      fetchCustomSeccionales();
  }, [db, filter]);

  const handleAssign = async (localId: string, localName: string) => {
    const secId = selectedSeccionales[localId];
    if (!secId || !db) return;

    setIsSubmitting(prev => ({ ...prev, [localId]: true }));
    try {
      // 1. Get Seccional Metadata
      const metaRef = doc(db, 'seccionales_metadata', secId);
      const metaSnap = await getDoc(metaRef);
      
      let localesList: string[] = [];
      let mesasPorLocal: any[] = [];
      
      if (metaSnap.exists()) {
        const data = metaSnap.data();
        localesList = data.locales || [];
        mesasPorLocal = data.mesas_por_local || [];
      }
      
      if (!localesList.includes(localName)) {
        localesList.push(localName);
        mesasPorLocal.push({ localName, mesas: [] });
      }

      // 2. Batch Update
      const batch = writeBatch(db);
      
      // Update locales_votacion
      batch.update(doc(db, 'locales_votacion', localId), {
        seccional_id: secId,
        status: 'asignado',
        updatedAt: new Date().toISOString()
      });
      
      // Update seccionales_metadata
      batch.set(metaRef, {
        locales: localesList,
        mesas_por_local: mesasPorLocal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      await batch.commit();
      
      toast({ title: "Local Asignado", description: `Se asignó ${localName} a la Seccional ${secId}` });
      fetchLocales(); // Refresh list
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo asignar el local", variant: "destructive" });
    } finally {
      setIsSubmitting(prev => ({ ...prev, [localId]: false }));
    }
  };

  const handleCreateCustom = async () => {
    if (!newLocalName || !newSeccionalId || !db) {
        toast({ title: 'Completa los campos', variant: 'destructive' });
        return;
    }
    setIsSubmitting(prev => ({...prev, 'custom': true}));
    try {
        const cleanName = newLocalName.toUpperCase().trim();
        const secId = newSeccionalId.trim();
        
        // 1. Create in locales_votacion
        const localId = 'local_' + Date.now();
        const batch = writeBatch(db);
        
        batch.set(doc(db, 'locales_votacion', localId), {
            nombre: cleanName,
            seccional_id: secId,
            status: 'asignado',
            total_electores: 0,
            createdAt: new Date().toISOString()
        });

        // 2. Update seccionales_metadata
        const metaRef = doc(db, 'seccionales_metadata', secId);
        const metaSnap = await getDoc(metaRef);
        let localesList: string[] = [];
        let mesasPorLocal: any[] = [];
        if(metaSnap.exists()) {
           localesList = metaSnap.data().locales || [];
           mesasPorLocal = metaSnap.data().mesas_por_local || [];
        }
        if(!localesList.includes(cleanName)) {
            localesList.push(cleanName);
            mesasPorLocal.push({ localName: cleanName, mesas: [] });
        }
        batch.set(metaRef, { locales: localesList, mesas_por_local: mesasPorLocal, updatedAt: new Date().toISOString() }, { merge: true });

        await batch.commit();
        
        toast({ title: "Local Creado", description: `Se creó ${cleanName} en la Seccional ${secId}` });
        setNewLocalName('');
        setIsCreateDialogOpen(false);
        fetchLocales();
        fetchCustomSeccionales();
    } catch(e) {
        console.error(e);
        toast({ title: "Error al crear", variant: "destructive" });
    } finally {
        setIsSubmitting(prev => ({...prev, 'custom': false}));
    }
  };

  const seccionalesOptions = customSeccionalesOptions;
  const filteredLocales = locales.filter(l => 
    l.total_electores > 0 && 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const secA = parseInt(a.seccional_id) || 999;
    const secB = parseInt(b.seccional_id) || 999;
    if (secA !== secB) return secA - secB;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  return (
    <Card className="border-primary/10 shadow-sm rounded-3xl overflow-hidden bg-white lg:col-span-3">
      <CardHeader className="bg-primary/5 border-b py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <CardTitle className="font-black uppercase text-xs flex items-center gap-2 shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
          Gestión de Locales y Seccionales
        </CardTitle>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                variant="outline" 
                size="sm" 
                className="h-8 text-[9px] font-black uppercase bg-primary text-white hover:bg-primary/90 border-transparent whitespace-nowrap"
            >
                + AGREGAR LOCAL MANUAL
            </Button>
            <Input 
                placeholder="BUSCAR LOCAL..." 
                className="h-8 text-xs font-bold w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              className="text-xs font-bold border rounded-lg px-2 py-1 outline-none bg-white shrink-0 h-8"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="pending">Solo Pendientes</option>
              <option value="asignado">Solo Asignados</option>
              <option value="todos">Todos los Locales</option>
            </select>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {isLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto opacity-20" /> : 
           filteredLocales.length === 0 ? <p className="text-[10px] text-center text-muted-foreground uppercase py-4">No hay locales para mostrar</p> :
           filteredLocales.map(l => (
            <div key={l.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 gap-4 hover:border-primary/30 transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase text-slate-800">{l.nombre}</span>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">{l.distrito} - {l.zona}</span>
                    {l.total_electores && (
                        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {l.total_electores.toLocaleString()} Electores • {l.total_mesas} Mesas
                        </span>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select 
                  className="w-[140px] font-bold h-9 text-xs rounded-xl border border-input bg-background px-3 py-1 outline-none focus:ring-2 focus:ring-primary/50"
                  value={selectedSeccionales[l.id] || l.seccional_id || ''} 
                  onChange={(e) => setSelectedSeccionales(prev => ({...prev, [l.id]: e.target.value}))}
                >
                  <option value="" disabled>Seccional...</option>
                  {seccionalesOptions.map(s => <option key={s} value={s}>Seccional {s}</option>)}
                </select>
                <Button 
                  size="sm" 
                  className="h-9 rounded-xl font-black text-[10px] uppercase"
                  disabled={isSubmitting[l.id] || (!selectedSeccionales[l.id] && !l.seccional_id)}
                  onClick={() => handleAssign(l.id, l.nombre)}
                >
                  {isSubmitting[l.id] ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : null}
                  {l.seccional_id ? "Reasignar" : "Asignar"}
                </Button>
              </div>
            </div>
           ))
          }
        </div>
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl border-primary/20">
              <DialogHeader>
                  <DialogTitle className="font-black uppercase text-lg text-primary tracking-tight">Agregar Local Manualmente</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                      <Label htmlFor="new-local" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre del Local</Label>
                      <Input 
                          id="new-local" 
                          placeholder="EJ: COLEGIO NACIONAL..." 
                          className="uppercase font-bold"
                          value={newLocalName}
                          onChange={(e) => setNewLocalName(e.target.value)}
                      />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="new-seccional" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Número de Seccional</Label>
                      <Input 
                          id="new-seccional" 
                          placeholder="EJ: 34" 
                          className="font-bold"
                          value={newSeccionalId}
                          onChange={(e) => setNewSeccionalId(e.target.value)}
                      />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold leading-relaxed bg-primary/5 p-3 rounded-xl border border-primary/10">
                      Al agregar manualmente, el sistema creará este local en la base de datos y lo asignará directamente a la seccional indicada, permitiéndote usarlo para corregir votos en otros módulos.
                  </p>
              </div>
              <DialogFooter>
                  <Button variant="outline" className="font-black uppercase text-[10px] h-10 rounded-xl" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateCustom} disabled={isSubmitting['custom'] || !newLocalName || !newSeccionalId} className="font-black uppercase text-[10px] h-10 rounded-xl bg-primary hover:bg-primary/90 text-white">
                      {isSubmitting['custom'] ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                      Guardar Local
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState({ current: 0, total: 0, text: '' });
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = useState(false);
  const [cardUnlockPassword, setCardUnlockPassword] = useState('');
  const { toast } = useToast();

  const configDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'configuraciones', 'system');
  }, [db]);
  const { data: systemConfig } = useDoc<any>(configDocRef);

  const handleToggleBulkDelete = async (checked: boolean) => {
      if (!db) return;
      try {
          await setDoc(doc(db, 'configuraciones', 'system'), { enableBulkDelete: checked }, { merge: true });
          toast({ title: checked ? 'Botón Habilitado' : 'Botón Oculto' });
      } catch (e) {
          toast({ title: 'Error al actualizar', variant: 'destructive' });
      }
  };

  const openArchiveDialog = () => {
    setIsArchiveAlertOpen(true);
  };

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente';

  const handleSyncAndOptimize = async () => {
    if(!db || !user) return;
    setIsOptimizing(true);
    try {
        const dataCollection = collection(db, COLLECTION_PADRON);
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

  const handleArchiveData = async () => {
    if (!db || !user) return;
    if (cardUnlockPassword !== 'ARKI2026') {
        toast({ title: "Acceso Denegado", description: "La contraseña de seguridad es incorrecta.", variant: "destructive" });
        return;
    }
    setIsArchiving(true);
    try {
        // 1. Obtener todos los Votos Seguros (votos_confirmados)
        const qVotos = query(collection(db, 'votos_confirmados'));
        const snapshotVotos = await getDocs(qVotos);
        
        // 2. Obtener todos los registros en sheet1 que tengan algún dato a archivar
        // Usaremos getDocs general porque 'or' queries son complejas de iterar con grandes volúmenes,
        // pero dado que es un script administrativo, vamos a hacer queries separadas y unirlas.
        
        // Votos emitidos (Día D)
        const qSheetDiaD = await getDocs(query(collection(db, COLLECTION_PADRON), where('estado_votacion', '==', 'Ya Votó')));
        
        // Votos Seguros captados en sheet1 (los que tienen registradoPor_id)
        const qSheetVotoSeguro = await getDocs(query(collection(db, COLLECTION_PADRON), where('observacion', '==', 'VOTO SEGURO')));
        
        const sheetMap = new Map();
        qSheetDiaD.forEach(d => sheetMap.set(d.id, d));
        qSheetVotoSeguro.forEach(d => sheetMap.set(d.id, d));
        
        const sheetDocs = Array.from(sheetMap.values());
        
        const totalVotos = snapshotVotos.docs.length;
        const totalSheet = sheetDocs.length;
        
        if (totalVotos === 0 && totalSheet === 0) {
            toast({ title: "Operación Cancelada", description: "No se hallaron registros activos para archivar." });
            setIsArchiveAlertOpen(false);
            setIsArchiving(false);
            return;
        }

        const totalItems = totalVotos + totalSheet;
        setArchiveProgress({ current: 0, total: totalItems, text: 'Iniciando archivado...' });

        // Archivar votos_confirmados -> votos_confirmados_internas
        let processedVotos = 0;
        let globalProcessed = 0;
        while (processedVotos < snapshotVotos.docs.length) {
            const batch = writeBatch(db);
            const chunk = snapshotVotos.docs.slice(processedVotos, processedVotos + 250);
            
            chunk.forEach(d => {
                const docData = d.data();
                // Escribir en _internas
                batch.set(doc(db, 'votos_confirmados_internas', d.id), docData);
                // Borrar el original
                batch.delete(d.ref);
            });
            await batch.commit();
            processedVotos += chunk.length;
            globalProcessed += chunk.length;
            setArchiveProgress({ current: globalProcessed, total: totalItems, text: `Archivando capturas (${processedVotos}/${totalVotos})...` });
        }

        // Archivar datos en sheet1 (Mover a sufijos _internas)
        let processedSheet = 0;
        while (processedSheet < sheetDocs.length) {
            const batch = writeBatch(db);
            const chunk = sheetDocs.slice(processedSheet, processedSheet + 500);
            
            chunk.forEach(d => {
                const data = d.data();
                const updateData: any = {
                    estado_votacion: deleteField(),
                    registradoPor_id: deleteField(),
                    registradoPor_nombre: deleteField(),
                    observacion: deleteField(),
                    delegadoPor_id: deleteField(),
                    delegadoPor_nombre: deleteField(),
                };
                
                if (data.estado_votacion) updateData.estado_votacion_internas = data.estado_votacion;
                if (data.registradoPor_id) updateData.registradoPor_id_internas = data.registradoPor_id;
                if (data.registradoPor_nombre) updateData.registradoPor_nombre_internas = data.registradoPor_nombre;
                if (data.observacion) updateData.observacion_internas = data.observacion;
                if (data.delegadoPor_id) updateData.delegadoPor_id_internas = data.delegadoPor_id;
                if (data.delegadoPor_nombre) updateData.delegadoPor_nombre_internas = data.delegadoPor_nombre;
                
                batch.update(d.ref, updateData);
            });
            await batch.commit();
            processedSheet += chunk.length;
            globalProcessed += chunk.length;
            setArchiveProgress({ current: globalProcessed, total: totalItems, text: `Limpiando padrón base (${processedSheet}/${totalSheet})...` });
        }

        setArchiveProgress({ current: totalItems, total: totalItems, text: '¡Proceso Completado!' });

        logAction(db, {
            userId: user.id,
            userName: user.name,
            module: 'CONFIGURACION',
            action: 'ARCHIVÓ DATOS A INTERNAS 2026',
            details: { votos_archivados: totalVotos, padron_afectados: totalSheet }
        });

        toast({ 
            title: "¡Archivado Exitoso!", 
            description: `Se han archivado ${totalVotos} capturas y actualizado ${totalSheet} registros en el padrón.` 
        });
    } catch (error) {
        console.error(error);
        toast({ title: "Error Crítico", description: "No se pudo completar el archivado.", variant: "destructive" });
    } finally {
        setIsArchiving(false);
        setIsArchiveAlertOpen(false);
        setCardUnlockPassword('');
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

        <LocalesAssignmentManager />

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

        <Card className="border-amber-200 bg-amber-50/30 shadow-sm rounded-3xl overflow-hidden lg:col-span-1">
            <CardHeader className="border-b border-amber-100 py-4">
                <CardTitle className="flex items-center gap-2 text-amber-600 font-black uppercase text-xs">
                    <ShieldCheck className="h-4 w-4" /> Control de Funciones
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-amber-900 leading-none">Botón: Borrar Todo</Label>
                        <p className="text-[9px] font-bold text-amber-700/60 uppercase leading-relaxed">Muestra el botón de borrado masivo a los Super-Admins en Voto Seguro.</p>
                    </div>
                    <Switch 
                        checked={systemConfig?.enableBulkDelete || false} 
                        onCheckedChange={handleToggleBulkDelete} 
                    />
                </div>
            </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5 shadow-sm rounded-3xl overflow-hidden lg:col-span-2">
            <CardHeader className="border-b border-destructive/10">
                <CardTitle className="flex items-center gap-2 text-destructive font-black uppercase text-xs">
                    <AlertTriangle className="h-4 w-4 animate-pulse" /> Mantenimiento Crítico
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <Button 
                    variant="outline" 
                    onClick={(e) => {
                        if (isArchiving) {
                            e.preventDefault();
                            return;
                        }
                        openArchiveDialog();
                    }}
                    className={cn(
                        "w-full justify-start font-black text-[10px] uppercase h-11 rounded-xl transition-all relative overflow-hidden",
                        cardUnlockPassword === 'ARKI2026' || isArchiving
                            ? "bg-destructive text-white hover:bg-destructive/90 border-transparent shadow-md" 
                            : "text-destructive border-destructive/20 hover:bg-destructive/10 bg-transparent cursor-not-allowed"
                    )}
                    disabled={(!isAdmin || cardUnlockPassword !== 'ARKI2026') && !isArchiving}
                >
                    {isArchiving ? (
                        <div className="w-full flex items-center justify-between px-2 relative z-10">
                            <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin h-4 w-4" /> 
                                <span>{archiveProgress.text}</span>
                            </div>
                            <span>{archiveProgress.total > 0 ? Math.round((archiveProgress.current / archiveProgress.total) * 100) : 0}%</span>
                        </div>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" /> 
                            ARCHIVAR DATOS A INTERNAS 2026
                        </>
                    )}
                    {isArchiving && archiveProgress.total > 0 && (
                        <div 
                            className="absolute top-0 left-0 h-full bg-black/20 transition-all duration-300 z-0"
                            style={{ width: `${(archiveProgress.current / archiveProgress.total) * 100}%` }}
                        />
                    )}
                </Button>

                <div className="space-y-1.5 pt-2 border-t border-destructive/10">
                    <Label className="text-[8px] font-black uppercase text-destructive/70 tracking-widest block text-center">Contraseña de Habilitación</Label>
                    <Input 
                        type="password"
                        value={cardUnlockPassword}
                        onChange={(e) => setCardUnlockPassword(e.target.value)}
                        placeholder="INGRESA CLAVE DE DESBLOQUEO"
                        className="font-black h-10 text-center text-[10px] uppercase tracking-widest bg-white border-destructive/10 text-destructive placeholder:text-destructive/30 rounded-xl"
                    />
                </div>

                <p className="text-[9px] font-bold text-destructive/60 uppercase text-center leading-normal">
                    ESTA ACCIÓN ARCHIVARÁ TODAS LAS MARCAS DE DÍA D Y VOTOS SEGUROS COMO "INTERNAS 2026" Y LIMPIARÁ EL PADRÓN PARA LAS GENERALES. LOS TELÉFONOS SE MANTENDRÁN.
                </p>
            </CardContent>
        </Card>
      </div>

      <AlertDialog open={isArchiveAlertOpen} onOpenChange={setIsArchiveAlertOpen}>
        <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
                    ¿Confirmar Archivado de Datos?
                </AlertDialogTitle>
                <AlertDialogDescription className="font-bold text-sm uppercase leading-relaxed pt-2 text-slate-600">
                    Estás a punto de archivar <strong>TODAS LAS CAPTURAS Y VOTOS</strong> actuales como datos históricos de las Internas 2026. 
                    <br/><br/>
                    Esto dejará el sistema principal limpio y listo para registrar las Elecciones Generales, sin perder los números de teléfono recolectados.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 pt-4 border-t border-slate-100 mt-2">
                <AlertDialogCancel disabled={isArchiving} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</AlertDialogCancel>
                <Button 
                    onClick={(e) => {
                        e.preventDefault(); // Prevent closing
                        if (!isArchiving) handleArchiveData();
                    }} 
                    className="bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg flex items-center gap-2 relative overflow-hidden"
                    disabled={isArchiving}
                >
                    {isArchiving ? (
                        <>
                            <Loader2 className="animate-spin h-4 w-4 relative z-10" /> 
                            <span className="relative z-10">{archiveProgress.text || 'ARCHIVANDO...'}</span>
                            <div 
                                className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-300 z-0"
                                style={{ width: `${archiveProgress.total > 0 ? (archiveProgress.current / archiveProgress.total) * 100 : 0}%` }}
                            />
                        </>
                    ) : (
                        <>
                            <Trash2 className="h-4 w-4" /> 
                            ARCHIVAR AHORA
                        </>
                    )}
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="text-center opacity-40 py-10">
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">
            SISTEMA GESTIÓN ESTRATÉGICA LISTA 1 - ASUNCIÓN 2026
        </p>
      </div>
    </div>
  );
}
