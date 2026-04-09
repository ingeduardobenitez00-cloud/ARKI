"use client";

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldCheck, User as UserIcon, Calendar, Activity, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    action: string;
    module: string;
    targetId?: string;
    targetName?: string;
    timestamp: any;
    details?: any;
}

export default function AuditoriaPage() {
    const db = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const [limitCount, setLimitCount] = useState(150);
    const [totalEvents, setTotalEvents] = useState<number | null>(null);

    const auditQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    }, [db, limitCount]);

    const { data: logs, isLoading, error } = useCollection<AuditLog>(auditQuery);

    useState(() => {
        if (!db) return;
        getCountFromServer(collection(db, 'audit_logs')).then((snap: any) => {
            setTotalEvents(snap.data().count);
        });
    });

    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        if (!searchTerm) return logs;
        const search = searchTerm.toLowerCase();
        return logs.filter(log => 
            (log.userName || '').toLowerCase().includes(search) || 
            (log.action || '').toLowerCase().includes(search) || 
            (log.module || '').toLowerCase().includes(search) ||
            (log.targetName && log.targetName.toLowerCase().includes(search))
        );
    }, [logs, searchTerm]);

    const formatLogDate = (timestamp: any) => {
        if (!timestamp) return '---';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
            return format(date, "d MMM, HH:mm:ss", { locale: es });
        } catch (e) {
            return 'Formato Inválido';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-medium uppercase flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        Registro de Auditoría
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Monitoreo de seguridad y actividad de usuarios en tiempo real.</p>
                </div>
                <Badge variant="secondary" className="px-4 py-1.5 font-medium bg-primary/10 text-primary uppercase">
                    {totalEvents !== null ? `${totalEvents} Eventos Totales` : (logs?.length || 0) + ' Cargados'}
                </Badge>
            </div>

            <Card className="border-primary/10 shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-medium uppercase">Historial de Eventos</CardTitle>
                            <CardDescription className="font-medium text-xs uppercase text-muted-foreground">Últimas acciones realizadas por los operadores.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="BUSCAR POR USUARIO, ACCIÓN O MÓDULO..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-background font-medium border-primary/10 h-10 uppercase text-[11px]"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50 text-[10px] uppercase font-medium">
                                    <TableHead className="w-[160px]">Fecha y Hora</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead>Módulo</TableHead>
                                    <TableHead>Acción Ejecutada</TableHead>
                                    <TableHead>Destino / Detalle</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b">
                                            <TableCell className="text-[10px] font-mono whitespace-nowrap py-3">
                                                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatLogDate(log.timestamp)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                                        <UserIcon className="h-3.5 w-3.5 text-primary" />
                                                    </div>
                                                    <span className="font-medium text-xs uppercase tracking-tight">{log.userName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] uppercase font-medium px-2 py-0 border-primary/30 bg-primary/5 text-primary">
                                                    {log.module}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                                                    <span className="text-[11px] font-medium uppercase text-foreground">{log.action}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[11px]">
                                                {log.targetName ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Tag className="h-3.5 w-3.5 text-green-600" />
                                                        <span className="font-medium text-primary uppercase truncate max-w-[200px]">{log.targetName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px] font-medium uppercase">Sin detalles</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                                                <Search className="h-12 w-12" />
                                                <p className="font-medium uppercase text-xs">No se hallaron registros coincidentes</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">
                            Panel de Control Maestro - LISTA 2P OPCIÓN 2
                        </p>
                        {totalEvents !== null && totalEvents > limitCount && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setLimitCount((prev: number) => prev + 150)}
                                className="h-7 text-[9px] font-black uppercase text-primary border border-primary/10 bg-white"
                            >
                                Cargar más (+150)
                            </Button>
                        )}
                    </div>
                    {error && <span className="text-[10px] text-destructive font-medium uppercase">Error al sincronizar datos</span>}
                </CardFooter>
            </Card>
        </div>
    );
}
