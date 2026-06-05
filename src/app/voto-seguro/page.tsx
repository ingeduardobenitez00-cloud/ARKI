
"use client";

import { useState, useMemo } from 'react';
import { collection, doc, updateDoc, deleteDoc, query, where, limit, orderBy, increment, writeBatch } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useAuth } from '@/hooks/use-auth';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookHeart, FileDown, User as UserIcon, Trash2, Loader2, ArrowRightLeft, Lock, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { CredentialDownloadButton } from '@/components/voto-seguro/CredentialDownloadButton';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText } from 'lucide-react';

interface VotoSeguroData {
  id: string;
  CEDULA: number | string;
  NOMBRE: string;
  APELLIDO: string;
  CODIGO_SEC?: string | number;
  LOCAL?: string;
  MESA?: string | number;
  ORDEN?: string | number;
  TELEFONO?: string;
  registradoPor_id?: string;
  registradoPor_nombre?: string;
  [key: string]: any;
}

interface GroupedBySeccional {
  [seccional: string]: {
    seccional: string;
    totalVotos: number;
    dirigentes: {
      [userName: string]: {
        userId: string;
        votos: VotoSeguroData[];
      }
    };
  };
}

export default function VotoSeguroPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [votoToDelete, setVotoToDelete] = useState<VotoSeguroData | null>(null);
  const [isFilenameDialogOpen, setIsFilenameDialogOpen] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [votoToMove, setVotoToMove] = useState<VotoSeguroData | null>(null);
  const [destinationUserId, setDestinationUserId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const [isMoveAllDialogOpen, setIsMoveAllDialogOpen] = useState(false);
  const [userToMoveAll, setUserToMoveAll] = useState<{userName: string, userId: string, votos: VotoSeguroData[]} | null>(null);
  const [destinationUserAllId, setDestinationUserAllId] = useState('');
  const [isMovingAll, setIsMovingAll] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';
  const isPresidente = user?.role === 'Presidente';
  const isCoordinador = user?.role === 'Coordinador';
  const isDirigente = user?.role === 'Dirigente';
  const userSeccionales = useMemo(() => user?.seccionales || [], [user]);

  const canExportExcel = isAdmin || (user?.moduleActions?.['/voto-seguro']?.includes('excel') ?? false) || (user?.moduleActions?.['/voto-seguro']?.includes('pdf') ?? false);
  const canExportPdf = isAdmin || (user?.moduleActions?.['/voto-seguro']?.includes('pdf') ?? false) || (user?.moduleActions?.['/users']?.includes('pdf') ?? false);
  const canDelete = isAdmin || isPresidente || isCoordinador || (user?.moduleActions?.['/voto-seguro']?.includes('delete') ?? false);

  /**
   * QUERY OPTIMIZADA POR ROL:
   * - Dirigentes (~650 usuarios): filtro server-side por su propio ID → ~30-50 docs c/u
   * - Admins/Presidentes/Coordinadores (~50 usuarios): query completo
   * Esto reduce lecturas de Firestore en ~97% para la gran mayoría de usuarios.
   * ÍNDICE REQUERIDO en Firestore: votos_confirmados → registradoPor_id ASC, APELLIDO ASC
   */
  const registeredQuery = useMemoFirebase(() => {
    if (!db || !user) return null;

    // Dirigentes: solo sus propios votos (server-side, sin techo)
    // Cada Dirigente carga únicamente sus registros — pueden tener hasta 1000+
    if (isDirigente) {
      return query(
        collection(db, 'votos_confirmados'),
        where('registradoPor_id', '==', user.id),
        orderBy('APELLIDO', 'asc')
      );
    }

    // Admins, Presidentes, Coordinadores: todos los votos sin límites para que soporte 20000 o más sin errores de Firestore
    return query(
      collection(db, 'votos_confirmados'),
      orderBy('APELLIDO', 'asc')
    );
  }, [db, user, isDirigente]);

  const { data: rawList, isLoading, error } = useCollection<VotoSeguroData>(registeredQuery);

  // ESCUCHADOR EN TIEMPO REAL A LOS USUARIOS PARA JURISDICCIÓN DE OPERADORES
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'users'));
  }, [db, user]);

  const { data: allUsers } = useCollection<any>(usersQuery);

  const userSeccionalesMap = useMemo(() => {
    if (!allUsers || !userSeccionales.length) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    allUsers.forEach((u: any) => {
      const rawSecc = u.seccionales || (u.seccional ? [u.seccional] : []);
      const userSecs = rawSecc.map((s: any) => String(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(SECCIONAL|SECCION\.|SECCION|SECC\.|SECC|SEC\.|SEC)\s*/g, '').trim());
      const hasOverlap = userSecs.some((s: string) => userSeccionales.includes(s));
      if (hasOverlap) {
        map.set(u.id, userSecs);
      }
    });
    return map;
  }, [allUsers, userSeccionales]);

  // FILTRADO POR ROLES Y JURISDICCIÓN Y BÚSQUEDA
  const filteredList = useMemo(() => {
    if (!rawList || !user) return [];
    
    let allowedList: VotoSeguroData[] = [];

    const normalize = (nameStr?: string) => String(nameStr || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const myNormalizedName = normalize(user.name);
    const isGuillermoMe = myNormalizedName.includes("GUILLERMO") && myNormalizedName.includes("FERNANDEZ");

    const isMyRegistration = (item: VotoSeguroData) => {
        if (item.registradoPor_id === user.id) return true;
        const itemRegName = normalize(item.registradoPor_nombre);
        if (isGuillermoMe && itemRegName.includes("GUILLERMO") && itemRegName.includes("FERNANDEZ")) return true;
        return itemRegName === myNormalizedName;
    };

    // Admins (PC Central) ven TODO
    if (isAdmin) {
        allowedList = rawList;
    } else if (isPresidente || isCoordinador) {
        // Presidentes y Coordinadores ven sus SECCIONALES ASIGNADAS o sus propios registros
        allowedList = rawList.filter(item => {
            const itemSec = String(item.CODIGO_SEC || '');
            const isFromMySeccional = userSeccionales.includes(itemSec);
            
            if (isFromMySeccional) return true;
            if (isMyRegistration(item)) return true;

            const registrarSecs = item.registradoPor_id ? userSeccionalesMap.get(item.registradoPor_id) : null;
            if (registrarSecs) {
                // Si el usuario es exclusivo de mi seccional (no es multiseccional), veo sus votos foráneos.
                // Si es multiseccional, solo veo sus votos si cayeron en mi seccional (lo cual ya se filtró arriba con isFromMySeccional).
                if (registrarSecs.length === 1) {
                    return true;
                }
            }
            return false;
        });
    } else if (isDirigente) {
        // Dirigentes: la query ya viene filtrada server-side, devolver todo
        allowedList = rawList;
    }

    if (!searchQuery.trim()) return allowedList;

    const normalizeString = (str: string) => str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const qStr = normalizeString(searchQuery);
    const qNum = qStr.replace(/[\.\-\s]/g, '');

    return allowedList.filter(item => {
        const idStr = String(item.id || '').replace(/[\.\-\s]/g, '');
        const cedulaStr = String(item.CEDULA || '').replace(/[\.\-\s]/g, '');
        const telStr = String(item.TELEFONO || '').replace(/[\.\-\s]/g, '');
        const telMigStr = String(item.TELEFONO_MIGRADO || '').replace(/[\.\-\s]/g, '');
        
        const nombreStr = normalizeString(String(item.NOMBRE || ''));
        const apellidoStr = normalizeString(String(item.APELLIDO || ''));
        const registradoPorStr = normalizeString(String(item.registradoPor_nombre || ''));

        const matchesCedula = qNum.length > 0 && (cedulaStr.includes(qNum) || idStr.includes(qNum) || telStr.includes(qNum) || telMigStr.includes(qNum));
        const matchesNombre = qStr.length > 0 && (
                              nombreStr.includes(qStr) || 
                              apellidoStr.includes(qStr) || 
                              `${nombreStr} ${apellidoStr}`.includes(qStr)
        );
        const matchesOperador = qStr.length > 0 && registradoPorStr.includes(qStr);

        return matchesCedula || matchesNombre || matchesOperador;
    });
  }, [rawList, user, isAdmin, isPresidente, isCoordinador, isDirigente, userSeccionales, userSeccionalesMap, searchQuery]);

  // AGRUPAMIENTO POR USUARIO CON CÍRCULO DE SECCIONAL
  const groupedData = useMemo(() => {
    const groups: GroupedBySeccional = {};
    filteredList.forEach(voto => {
        let userName = voto.registradoPor_nombre || 'USUARIO DESCONOCIDO';
        const userId = voto.registradoPor_id || 'unknown';
        const itemSecc = String(voto.CODIGO_SEC || 'SIN SECCIONAL');

        // Normalizar el nombre para agrupar variaciones (removiendo acentos, espacios y convirtiendo a mayúsculas)
        const normalized = userName
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
        
        // Si el nombre contiene GUILLERMO y FERNANDEZ, usar la forma estándar "GUILLERMO FERNANDEZ"
        if (normalized.includes("GUILLERMO") && normalized.includes("FERNANDEZ")) {
            userName = "GUILLERMO FERNANDEZ";
        } else if (normalized.includes("GUILLEFER")) {
            userName = "GUILLERMO FERNANDEZ";
        }

        if (!groups[itemSecc]) {
            groups[itemSecc] = { seccional: itemSecc, totalVotos: 0, dirigentes: {} };
        }
        
        if (!groups[itemSecc].dirigentes[userName]) {
            groups[itemSecc].dirigentes[userName] = { userId, votos: [] };
        }
        
        groups[itemSecc].dirigentes[userName].votos.push(voto);
        groups[itemSecc].totalVotos += 1;
    });

    const sortedGroups: GroupedBySeccional = {};
    Object.keys(groups)
        .sort((a, b) => {
            const secA = parseInt(a.replace(/\D/g, ''), 10) || 999999;
            const secB = parseInt(b.replace(/\D/g, ''), 10) || 999999;
            if (secA !== secB) {
                return secA - secB;
            }
            return a.localeCompare(b);
        })
        .forEach(secKey => {
            const secGroup = groups[secKey];
            const sortedDirigentes: typeof secGroup.dirigentes = {};
            
            Object.keys(secGroup.dirigentes)
                .sort((a, b) => a.localeCompare(b))
                .forEach(dirKey => {
                    const dirGroup = secGroup.dirigentes[dirKey];
                    dirGroup.votos.sort((a,b) => (a.APELLIDO || '').localeCompare(b.APELLIDO || ''));
                    sortedDirigentes[dirKey] = dirGroup;
                });
                
            sortedGroups[secKey] = { ...secGroup, dirigentes: sortedDirigentes };
        });
    return sortedGroups;
  }, [filteredList]);

  const executeExportCSV = async (filename: string) => {
    if (filteredList.length === 0) return;
    setIsExporting(true);
    try {
        const headers = ['SECC', 'LOCAL', 'MESA', 'ORDEN', 'CEDULA', 'NOMBRE', 'APELLIDO', 'TELEFONO', 'TELEFONO_MIGRADO', 'USUARIO'].join(';');
        let csvContent = "\uFEFF" + headers + "\n";
        filteredList.forEach(row => {
            const userName = row.registradoPor_nombre || 'DESCONOCIDO';
            const line = [row.CODIGO_SEC, row.LOCAL, row.MESA, row.ORDEN, row.CEDULA, row.NOMBRE, row.APELLIDO, row.TELEFONO, row.TELEFONO_MIGRADO, userName]
                .map(v => `"${String(v || '').replace(/;/g, ' ').toUpperCase()}"`).join(';');
            csvContent += line + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        link.download = (filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'VOTOS_SEGUROS') + '.csv';
        link.click();
        document.body.removeChild(link);
        toast({ title: "Exportación exitosa" });
        setIsFilenameDialogOpen(false);
    } finally { setIsExporting(false); }
  };

  const executeExportUserCSV = async (userName: string, userVotos: VotoSeguroData[]) => {
    if (userVotos.length === 0) return;
    try {
        const headers = ['SECC', 'LOCAL', 'MESA', 'ORDEN', 'CEDULA', 'NOMBRE', 'APELLIDO', 'TELEFONO', 'TELEFONO_MIGRADO', 'USUARIO'].join(';');
        let csvContent = "\uFEFF" + headers + "\n";
        userVotos.forEach(row => {
            const line = [row.CODIGO_SEC, row.LOCAL, row.MESA, row.ORDEN, row.CEDULA, row.NOMBRE, row.APELLIDO, row.TELEFONO, row.TELEFONO_MIGRADO, userName]
                .map(v => `"${String(v || '').replace(/;/g, ' ').toUpperCase()}"`).join(';');
            csvContent += line + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        const filename = `VOTOS_${userName.replace(/[^a-zA-Z0-9]/g, '_').trim() || 'USUARIO'}.csv`;
        link.download = filename;
        link.click();
        document.body.removeChild(link);
        toast({ title: `Planilla de ${userName} exportada` });
    } catch (err) {
        console.error(err);
        toast({ title: "Error en la exportación", variant: "destructive" });
    }
  };

  const executeExportUserPDF = (userName: string, userVotos: VotoSeguroData[]) => {
    if (userVotos.length === 0) return;
    try {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Listado de Votos Seguros - ${userName}`, 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 30);
        doc.text(`Total de votos registrados: ${userVotos.length}`, 14, 36);

        const tableColumn = ["SECC", "Local", "Mesa", "Cédula", "Nombre", "Apellido", "Teléfono"];
        const tableRows: any[] = [];

        userVotos.forEach(row => {
            const rowData = [
                row.CODIGO_SEC || '',
                row.LOCAL || '',
                row.MESA || '',
                row.CEDULA || '',
                row.NOMBRE || '',
                row.APELLIDO || '',
                row.TELEFONO_MIGRADO || row.TELEFONO || ''
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 42,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            styles: { fontSize: 8 },
        });

        const filename = `VOTOS_${userName.replace(/[^a-zA-Z0-9]/g, '_').trim() || 'USUARIO'}.pdf`;
        doc.save(filename);
        toast({ title: `PDF de ${userName} exportado` });
    } catch (error) {
        console.error(error);
        toast({ title: "Error en la exportación", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!votoToDelete || !db || !user) return;
    setIsDeleting(true);
    const docRef = doc(db, 'votos_confirmados', votoToDelete.id);
    const padronRef = doc(db, 'sheet1', votoToDelete.id);

    const promises = [
        deleteDoc(docRef),
        updateDoc(padronRef, { observacion: null })
    ];

    if (votoToDelete.registradoPor_id) {
        promises.push(updateDoc(doc(db, 'users', votoToDelete.registradoPor_id), { votosCargados: increment(-1) }).catch(() => {}) as any);
    }

    Promise.all(promises).then(() => { 
        logAction(db, { userId: user.id, userName: user.name, module: 'VOTO SEGURO', action: 'ELIMINÓ VOTO SEGURO', targetName: `${votoToDelete.NOMBRE}` });
        toast({ title: 'Registro eliminado' }); 
    }).finally(() => { setIsDeleting(false); setIsAlertOpen(false); setVotoToDelete(null); });
  };

  const handleMoveVoto = async () => {
      if (!votoToMove || !db || !user || !destinationUserId) return;
      
      const destinationUser = allUsers?.find(u => u.id === destinationUserId);
      if (!destinationUser) {
          toast({ title: 'Usuario destino no encontrado', variant: 'destructive' });
          return;
      }

      setIsMoving(true);
      try {
          const docRef = doc(db, 'votos_confirmados', votoToMove.id);
          const padronRef = doc(db, 'sheet1', votoToMove.id);
          const newOperatorName = destinationUser.name || destinationUser.email || 'Desconocido';

          const promises = [
              updateDoc(docRef, { registradoPor_id: destinationUser.id, registradoPor_nombre: newOperatorName })
          ];

          // Opcional: actualizar en el padrón base si existe
          promises.push(updateDoc(padronRef, { registradoPor_id: destinationUser.id, registradoPor_nombre: newOperatorName }).catch(() => {}) as any);

          // Restar al operador anterior
          if (votoToMove.registradoPor_id) {
              promises.push(updateDoc(doc(db, 'users', votoToMove.registradoPor_id), { votosCargados: increment(-1) }).catch(() => {}) as any);
          }

          // Sumar al nuevo operador
          promises.push(updateDoc(doc(db, 'users', destinationUser.id), { votosCargados: increment(1) }).catch(() => {}) as any);

          await Promise.all(promises);
          
          logAction(db, { userId: user.id, userName: user.name, module: 'VOTO SEGURO', action: 'REASIGNÓ VOTO SEGURO', targetName: `${votoToMove.NOMBRE} a ${newOperatorName}` });
          toast({ title: 'Voto reasignado correctamente' });
          setIsMoveDialogOpen(false);
          setVotoToMove(null);
          setDestinationUserId('');
      } catch (err) {
          console.error(err);
          toast({ title: 'Error al reasignar', variant: 'destructive' });
      } finally {
          setIsMoving(false);
      }
  };

  const handleMoveAllVotos = async () => {
      if (!userToMoveAll || !db || !user || !destinationUserAllId) return;
      
      const destinationUser = allUsers?.find(u => u.id === destinationUserAllId);
      if (!destinationUser) {
          toast({ title: 'Usuario destino no encontrado', variant: 'destructive' });
          return;
      }

      setIsMovingAll(true);
      try {
          const newOperatorName = destinationUser.name || destinationUser.email || 'Desconocido';
          const { votos, userId: oldUserId } = userToMoveAll;
          
          if (votos.length === 0) return;

          // Dividir en bloques de 200 (para no exceder 500 escrituras por batch, ya que son 2 docs por voto)
          const chunkSize = 200;
          for (let i = 0; i < votos.length; i += chunkSize) {
              const chunk = votos.slice(i, i + chunkSize);
              const batch = writeBatch(db);

              chunk.forEach(voto => {
                  const docRef = doc(db, 'votos_confirmados', voto.id);
                  const padronRef = doc(db, 'sheet1', voto.id);

                  batch.update(docRef, { 
                      registradoPor_id: destinationUser.id, 
                      registradoPor_nombre: newOperatorName 
                  });
                  batch.set(padronRef, { 
                      registradoPor_id: destinationUser.id, 
                      registradoPor_nombre: newOperatorName 
                  }, { merge: true });
              });

              await batch.commit();
          }

          // Actualizar los contadores de los usuarios
          const promises = [];
          if (oldUserId && oldUserId !== 'unknown') {
              promises.push(updateDoc(doc(db, 'users', oldUserId), { votosCargados: increment(-votos.length) }).catch(() => {}) as any);
          }
          promises.push(updateDoc(doc(db, 'users', destinationUser.id), { votosCargados: increment(votos.length) }).catch(() => {}) as any);
          
          await Promise.all(promises);

          logAction(db, { userId: user.id, userName: user.name, module: 'VOTO SEGURO', action: 'REASIGNÓ TODOS LOS VOTOS', targetName: `De ${userToMoveAll.userName} a ${newOperatorName} (${votos.length} votos)` });
          toast({ title: 'Todos los votos reasignados correctamente' });
          setIsMoveAllDialogOpen(false);
          setUserToMoveAll(null);
          setDestinationUserAllId('');
      } catch (err) {
          console.error(err);
          toast({ title: 'Error al reasignar masivamente', variant: 'destructive' });
      } finally {
          setIsMovingAll(false);
      }
  };

  const renderTable = (items: VotoSeguroData[]) => {
    const hasAnyMigrated = items.some(p => String(p.TELEFONO_MIGRADO || '').trim().length >= 6);

    return (
      <div className="overflow-x-auto">
          <Table>
              <TableHeader>
                  <TableRow className="bg-muted/50 text-[10px] font-black uppercase">
                      <TableHead className="w-[100px] text-center">Cédula</TableHead>
                      <TableHead>Elector</TableHead>
                      <TableHead className="text-center">SECC</TableHead>
                      <TableHead>Local / Mesa</TableHead>
                      <TableHead>Registrado (Usuario)</TableHead>
                      {hasAnyMigrated && <TableHead>WhatsApp Migrado</TableHead>}
                      <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {items.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-[10px] text-center">{p.CEDULA}</TableCell>
                          <TableCell className="font-black text-[11px] uppercase">{p.NOMBRE} {p.APELLIDO}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black border-primary/10">SECC {p.CODIGO_SEC}</Badge></TableCell>
                          <TableCell className="text-[10px] uppercase">
                              <div>{p.LOCAL}</div>
                              <div className="text-primary font-bold">M: {p.MESA} / O: {p.ORDEN}</div>
                          </TableCell>
                          <TableCell>
                              {p.TELEFONO ? (
                                  <div className="text-[11px] font-black text-green-700 flex items-center gap-1.5 bg-green-50/40 border border-green-100/50 rounded-xl px-2.5 py-1.5 w-max">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                      {p.TELEFONO}
                                  </div>
                              ) : (
                                  <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider italic">Sin Registro</div>
                              )}
                          </TableCell>
                          {hasAnyMigrated && (
                              <TableCell>
                                  {p.TELEFONO_MIGRADO ? (
                                      <div className="text-[11px] font-black text-blue-700 flex items-center gap-1.5 bg-blue-50/40 border border-blue-100/50 rounded-xl px-2.5 py-1.5 w-max">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                          {p.TELEFONO_MIGRADO}
                                      </div>
                                  ) : (
                                      <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider italic">Sin Migrar</div>
                                  )}
                              </TableCell>
                          )}
                          <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                  <CredentialDownloadButton voto={p} />
                                  {isAdmin && (
                                      <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50" 
                                          onClick={() => { setVotoToMove(p); setIsMoveDialogOpen(true); }}
                                      >
                                          <ArrowRightLeft className="h-4 w-4" />
                                      </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => { if(canDelete){ setVotoToDelete(p); setIsAlertOpen(true); } else toast({title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive"}); }} disabled={!canDelete}>
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
  };

  const isAllowedRole = user?.role === 'Admin' || user?.role === 'Super-Admin' || user?.role === 'Presidente' || user?.role === 'Coordinador' || user?.role === 'Dirigente';

  if (user && !isAllowedRole) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shadow-sm">
                  <Lock className="h-10 w-10 stroke-[2]" />
              </div>
              <div className="space-y-2">
                  <h2 className="text-xl font-black uppercase text-red-600 tracking-tight">Acceso Restringido</h2>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 leading-relaxed">
                      Comunícate con El PC para la carga de votos seguro. Tu rol es de <span className="text-red-600 font-extrabold">{user.role}</span> y tu rol tiene que cambiar.
                  </p>
              </div>
              <div className="pt-2">
                  <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200 bg-slate-50 text-slate-500 py-1.5 px-3 rounded-full">
                      SOPORTE ARKI
                  </Badge>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3"><BookHeart className="h-8 w-8 text-primary" /> Listado de Voto Seguro</h1><p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Control optimizado de captación por operador.</p></div>
        <div className="flex gap-2">
            <Button onClick={() => { if(canExportExcel) setIsFilenameDialogOpen(true); else toast({title: "Función Bloqueada", description: "Solicita a la apoderación del equipo o al departamento de informática la habilitación de esta función.", variant: "destructive"}); }} disabled={filteredList.length === 0 || isExporting || !canExportExcel} variant="default" className="font-black uppercase text-[10px] h-9 shadow-lg"><FileDown className="mr-2 h-4 w-4" /> EXPORTAR VISTA</Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-[11px] font-black uppercase">Resumen de Capturas</CardTitle>
                    <Badge className="bg-primary font-black text-[10px] uppercase tracking-widest px-3 py-1">
                        {isLoading ? '...' : `${filteredList.length} REGISTROS`}
                    </Badge>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar elector, cédula u operador..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs font-bold bg-white"
                    />
                </div>
            </div>
        </CardHeader>
        {error && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 font-mono text-xs m-4">
                <strong>Error de Firestore:</strong> {error.message}
            </div>
        )}
        <CardContent className="p-0">
            {isLoading ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : 
            Object.keys(groupedData).length > 0 ? (
                <div className="p-4">
                    <Accordion type="multiple" className="w-full space-y-4">
                        {Object.entries(groupedData).map(([seccional, seccionalData]) => {
                            const numDirigentes = Object.keys(seccionalData.dirigentes).length;
                            return (
                                <AccordionItem key={`sec-${seccional}`} value={`sec-${seccional}`} className="border-2 border-primary/20 rounded-2xl px-4 bg-muted/10 shadow-sm overflow-hidden">
                                    <AccordionTrigger className="hover:no-underline py-5">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                                                <span className="font-black text-white text-xs">{seccional === 'SIN SECCIONAL' ? '-' : `S${seccional}`}</span>
                                            </div>
                                            <div className="flex flex-col flex-1 text-left">
                                                <span className="font-black text-lg uppercase text-slate-900 tracking-tight">{seccional === 'SIN SECCIONAL' ? 'SIN SECCIONAL' : `SECCIONAL ${seccional}`}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{numDirigentes} {numDirigentes === 1 ? 'Dirigente' : 'Dirigentes'}</span>
                                            </div>
                                            <Badge variant="default" className="text-sm font-black shadow-sm shrink-0 px-3 py-1.5">{seccionalData.totalVotos} VOTOS</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4">
                                        <div className="space-y-3 pl-2 pr-1 border-l-2 border-primary/10 ml-5">
                                            <Accordion type="multiple" className="w-full space-y-2">
                                                {Object.entries(seccionalData.dirigentes).map(([userName, userData]) => (
                                                    <AccordionItem key={`dir-${userName}-${seccional}`} value={`dir-${userName}-${seccional}`} className="border rounded-xl px-4 bg-white shadow-sm relative group">
                                                        <AccordionTrigger className="hover:no-underline py-4">
                                                            <div className="flex items-center gap-3 w-full pr-4">
                                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5"><UserIcon className="h-4 w-4 text-primary" /></div>
                                                                <div className="flex items-center gap-2 flex-1 text-left">
                                                                    <span className="font-black text-xs uppercase text-slate-900">{userName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="text-[10px] font-black bg-slate-100 shrink-0 border border-slate-200">{userData.votos.length} Votos</Badge>
                                                                    {canExportExcel && (
                                                                        <div 
                                                                            className="flex items-center justify-center h-7 px-3 text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer shadow-sm"
                                                                            onPointerDown={(e) => { e.stopPropagation(); executeExportUserCSV(userName, userData.votos); }}
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); executeExportUserCSV(userName, userData.votos); }}
                                                                        >
                                                                            <FileDown className="h-3.5 w-3.5 mr-1 text-emerald-600" /> EXCEL
                                                                        </div>
                                                                    )}
                                                                    {canExportPdf && (
                                                                        <div 
                                                                            className="flex items-center justify-center h-7 px-3 text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-700 border border-red-200 rounded-full hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer shadow-sm ml-1"
                                                                            onPointerDown={(e) => { e.stopPropagation(); executeExportUserPDF(userName, userData.votos); }}
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); executeExportUserPDF(userName, userData.votos); }}
                                                                        >
                                                                            <FileText className="h-3.5 w-3.5 mr-1 text-red-600" /> PDF
                                                                        </div>
                                                                    )}
                                                                    {isAdmin && userData.votos.length > 0 && (
                                                                        <div 
                                                                            className="flex items-center justify-center h-7 px-3 text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer shadow-sm ml-2"
                                                                            onPointerDown={(e) => { e.stopPropagation(); setUserToMoveAll({userName, userId: userData.userId, votos: userData.votos}); setIsMoveAllDialogOpen(true); }}
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUserToMoveAll({userName, userId: userData.userId, votos: userData.votos}); setIsMoveAllDialogOpen(true); }}
                                                                        >
                                                                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-blue-600" /> MOVER TODO
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pt-2 pb-4">
                                                            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">{renderTable(userData.votos)}</div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            ) : <div className="text-center py-24 opacity-30"><BookHeart className="w-16 h-16 mx-auto mb-2 text-primary" /><p className="font-black uppercase text-xs tracking-widest">Sin registros capturados en tu zona</p></div>}
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-3 flex justify-between items-center px-6"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2</p><Badge variant="outline" className="text-[9px] font-black border-primary/10">NÚCLEO v5.2</Badge></CardFooter>
      </Card>

      <Dialog open={isFilenameDialogOpen} onOpenChange={setIsFilenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight flex items-center gap-3"><FileDown className="h-6 w-6 text-primary" /> Exportar Planilla</DialogTitle></DialogHeader>
            <div className="py-4"><Label className="text-[10px] font-black uppercase mb-2 block">Nombre del Reporte</Label><Input value={customFilename} onChange={(e) => setCustomFilename(e.target.value.toUpperCase())} className="font-black h-12 uppercase" placeholder="VOTOS_SEGUROS" autoFocus /></div>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsFilenameDialogOpen(false)} className="font-black uppercase text-[10px] h-11 rounded-xl">CANCELAR</Button><Button onClick={() => executeExportCSV(customFilename)} disabled={!customFilename.trim() || isExporting} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg">{isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} DESCARGAR EXCEL</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase text-xl">¿ELIMINAR MARCA?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="font-black uppercase text-xs h-11 rounded-xl">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 font-black uppercase text-xs h-11 px-6 rounded-xl">{isDeleting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />} ELIMINAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={isMoveDialogOpen} onOpenChange={(open) => { setIsMoveDialogOpen(open); if(!open){ setDestinationUserId(''); setVotoToMove(null); } }}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle className="font-black uppercase text-xl text-primary">Mover Voto Seguro</DialogTitle>
                  <DialogDescription className="font-bold text-xs uppercase">
                      Reasignar el registro de <strong className="text-slate-900">{votoToMove?.NOMBRE} {votoToMove?.APELLIDO}</strong> a otro operador.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="destinationUser" className="text-xs font-black uppercase text-slate-700">Seleccionar Operador de Destino</Label>
                      <select 
                          id="destinationUser"
                          value={destinationUserId}
                          onChange={(e) => setDestinationUserId(e.target.value)}
                          className="flex h-12 w-full rounded-xl border-2 border-primary/20 bg-background px-4 py-2 text-xs font-black uppercase ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                          <option value="">-- Seleccionar Operador --</option>
                          {allUsers?.filter((u: any) => {
                              if (!votoToMove?.CODIGO_SEC) return true;
                              const userSecs = u.seccionales || (u.seccional ? [u.seccional] : []);
                              return userSecs.some((sec: any) => String(sec) === String(votoToMove.CODIGO_SEC));
                          }).map((u: any) => {
                              const uName = (u.name || u.email || 'Desconocido').toUpperCase();
                              return (
                                  <option key={u.id} value={u.id}>
                                      {uName} {u.clasificacion ? `(${u.clasificacion})` : ''}
                                  </option>
                              );
                          }).sort((a: any, b: any) => a.props.children[0].localeCompare(b.props.children[0]))}
                      </select>
                  </div>
              </div>
              <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)} className="font-black uppercase text-xs h-11 rounded-xl">Cancelar</Button>
                  <Button onClick={handleMoveVoto} disabled={!destinationUserId || isMoving} className="font-black uppercase text-xs h-11 px-8 rounded-xl shadow-lg">
                      {isMoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                      Reasignar Voto
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={isMoveAllDialogOpen} onOpenChange={(open) => { setIsMoveAllDialogOpen(open); if(!open){ setDestinationUserAllId(''); setUserToMoveAll(null); } }}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle className="font-black uppercase text-xl text-blue-600">Mover Todos Los Votos</DialogTitle>
                  <DialogDescription className="font-bold text-xs uppercase">
                      Estás a punto de reasignar <strong className="text-slate-900">{userToMoveAll?.votos?.length || 0} votos</strong> registrados por <strong className="text-slate-900">{userToMoveAll?.userName}</strong> a un nuevo operador.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="destinationUserAll" className="text-xs font-black uppercase text-slate-700">Seleccionar Operador de Destino</Label>
                      <select 
                          id="destinationUserAll"
                          value={destinationUserAllId}
                          onChange={(e) => setDestinationUserAllId(e.target.value)}
                          className="flex h-12 w-full rounded-xl border-2 border-blue-200 bg-background px-4 py-2 text-xs font-black uppercase ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                          <option value="">-- Seleccionar Operador --</option>
                          {allUsers?.map((u: any) => {
                              const uName = (u.name || u.email || 'Desconocido').toUpperCase();
                              return (
                                  <option key={u.id} value={u.id}>
                                      {uName} {u.clasificacion ? `(${u.clasificacion})` : ''}
                                  </option>
                              );
                          }).sort((a: any, b: any) => a.props.children[0].localeCompare(b.props.children[0]))}
                      </select>
                  </div>
              </div>
              <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsMoveAllDialogOpen(false)} disabled={isMovingAll} className="font-black uppercase text-xs h-11 rounded-xl">Cancelar</Button>
                  <Button onClick={handleMoveAllVotos} disabled={!destinationUserAllId || isMovingAll} className="bg-blue-600 hover:bg-blue-700 font-black uppercase text-xs h-11 px-8 rounded-xl shadow-lg">
                      {isMovingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                      {isMovingAll ? 'Procesando...' : 'Mover Todo'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
