"use client";

import { useState, useMemo } from 'react';
import { collection, query, orderBy, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Archive, Calendar, User, Smartphone, Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { logAction } from '@/lib/audit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface Participant {
    id: string;
    original_doc_id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    TELEFONO?: string;
}

interface ArchivedMeeting {
    id: string;
    name: string;
    archivedAt: { seconds: number; nanoseconds: number; };
    participants: Participant[];
    archivedBy: string;
}

export default function ArchivedMeetingsPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [meetingToDelete, setMeetingToDelete] = useState<ArchivedMeeting | null>(null);

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super-Admin';

    const archivedMeetingsQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'archived_meetings'), orderBy('archivedAt', 'desc'));
    }, [db]);

    const { data: meetings, isLoading } = useCollection<ArchivedMeeting>(archivedMeetingsQuery);

    const handleSyncPhones = async (meeting: ArchivedMeeting) => {
        if (!user || !db) return;
        setIsSyncing(prev => ({ ...prev, [meeting.id]: true }));
        try {
            const batch = writeBatch(db);
            let count = 0;
            meeting.participants.forEach(p => {
                if (p.TELEFONO && p.original_doc_id) {
                    batch.update(doc(db, 'sheet1', p.original_doc_id), { TELEFONO: p.TELEFONO });
                    count++;
                }
            });
            if (count > 0) {
                await batch.commit();
                logAction(db, { userId: user.id, userName: user.name, module: 'ARCHIVADOS', action: 'SINCRONIZÓ TELÉFONOS', targetName: meeting.name });
                toast({ title: '¡Sincronizado!', description: `${count} teléfonos actualizados.` });
            }
        } catch (err) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'sheet1', operation: 'update' }));
        } finally { setIsSyncing(prev => ({ ...prev, [meeting.id]: false })); }
    };
    
    const handleDeleteMeeting = async () => {
        if (!meetingToDelete || !db) return;
        const ref = doc(db, 'archived_meetings', meetingToDelete.id);
        deleteDoc(ref).then(() => {
            toast({ title: 'Eliminado' });
            setIsAlertOpen(false);
        }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }));
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Reuniones Archivadas</h1>
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? <Skeleton className="h-20 w-full" /> : 
                    meetings?.map(meeting => (
                        <Accordion type="single" collapsible key={meeting.id} className="mb-2">
                            <AccordionItem value={meeting.id}>
                                <AccordionTrigger><div className="flex gap-4 items-center">{meeting.name} <Badge variant="secondary">{meeting.participants.length}</Badge></div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex justify-end mb-4 gap-2">
                                        <Button size="sm" onClick={() => handleSyncPhones(meeting)} disabled={isSyncing[meeting.id]}><Smartphone className="mr-2 h-4 w-4"/> Sincronizar</Button>
                                        {isAdmin && <Button size="sm" variant="destructive" onClick={() => { setMeetingToDelete(meeting); setIsAlertOpen(true); }}><Trash2 className="h-4 w-4"/></Button>}
                                    </div>
                                    <Table><TableBody>{meeting.participants.map(p => <TableRow key={p.id}><TableCell>{p.NOMBRE} {p.APELLIDO}</TableCell><TableCell>{p.TELEFONO}</TableCell></TableRow>)}</TableBody></Table>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </CardContent>
            </Card>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMeeting}>Sí, eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    );
}
