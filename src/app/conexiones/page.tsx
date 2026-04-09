"use client";

import { useState, useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Wifi, WifiOff, Star, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserStatus {
  id: string; // UID del usuario
  state: 'online' | 'offline';
  last_changed: {
      seconds: number;
      nanoseconds: number;
  } | null;
}

const formatExactTime = (timestamp: { seconds: number; nanoseconds: number; } | null) => {
    if (!timestamp) return 'Sin actividad';
    const date = new Date(timestamp.seconds * 1000);
    return format(date, "d MMM, HH:mm", { locale: es });
};

export default function ConnectionsPage() {
    const db = useFirestore();
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // SEGURIDAD: Limitamos la consulta a los 100 más recientes para evitar costos masivos de lectura
    const usersQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'users'), orderBy('name', 'asc'), limit(100));
    }, [db]);

    const statusQuery = useMemoFirebase(() => {
        if (!db) return null;
        return collection(db, 'status');
    }, [db]);

    const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);
    const { data: statuses, isLoading: isLoadingStatuses } = useCollection<UserStatus>(statusQuery);

    const mergedData = useMemo(() => {
        if (!users || !statuses) return [];
        
        const statusMap = new Map(statuses.map(s => [s.id, { state: s.state, last_changed: s.last_changed }]));

        const combined = users.map(user => {
            const statusInfo = statusMap.get(user.id);
            const isMe = user.id === currentUser?.id;
            
            return {
                ...user,
                status: isMe ? 'online' : (statusInfo?.state || 'offline'),
                last_changed: statusInfo?.last_changed || null,
                isMe
            };
        });

        return combined.sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            
            if (a.status !== b.status) {
                return a.status === 'online' ? -1 : 1;
            }

            const timeA = a.last_changed?.seconds || 0;
            const timeB = b.last_changed?.seconds || 0;
            
            if (timeA !== timeB) {
                return timeB - timeA;
            }
            
            return (a.name || '').localeCompare(b.name || '');
        });

    }, [users, statuses, currentUser]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return mergedData;
        const search = searchTerm.toLowerCase();
        return mergedData.filter(u => 
            (u.name || '').toLowerCase().includes(search) || 
            (u.role || '').toLowerCase().includes(search) || 
            (u.seccional || '').toLowerCase().includes(search) ||
            (u.username || '').toLowerCase().includes(search)
        );
    }, [mergedData, searchTerm]);

    const onlineCount = useMemo(() => {
        return mergedData.filter(u => u.status === 'online').length;
    }, [mergedData]);
    
    const isLoading = isLoadingUsers || isLoadingStatuses;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-medium uppercase tracking-tight flex items-center gap-3">
                        <Wifi className="h-8 w-8 text-primary" />
                        Monitoreo de Equipo
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Actividad de los operadores en tiempo real por orden de conexión.</p>
                </div>
                <Badge variant="secondary" className="px-4 py-1.5 font-medium bg-green-500/10 text-green-600 border-green-500/20 uppercase">
                    <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    {onlineCount} Operadores en Línea
                </Badge>
            </div>

            <Card className="border-primary/10 shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-xs font-medium uppercase">Panel de Conexiones</CardTitle>
                            <CardDescription className="text-[10px] font-medium uppercase text-muted-foreground">Estado actual de la red ordenado por última actividad.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="BUSCAR OPERADOR, CARGO O SECC..." 
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
                                    <TableHead className="w-[140px]">Estado</TableHead>
                                    <TableHead>Operador</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Seccional</TableHead>
                                    <TableHead>Última Conexión</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((user) => (
                                        <TableRow key={user.id} className={cn(
                                            "hover:bg-muted/20 transition-colors border-b", 
                                            user.status === 'online' ? "bg-green-50/20" : "",
                                            user.isMe ? "bg-primary/[0.03]" : ""
                                        )}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-2.5 w-2.5 rounded-full shadow-sm",
                                                        user.status === 'online' ? 'bg-green-500 animate-pulse ring-4 ring-green-500/20' : 'bg-slate-300'
                                                    )}></div>
                                                    <span className={cn(
                                                        "uppercase text-[10px] font-black tracking-tighter",
                                                        user.status === 'online' ? 'text-green-600' : 'text-slate-400'
                                                    )}>
                                                        {user.status === 'online' ? 'En línea' : 'Desconectado'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "font-medium text-xs uppercase tracking-tight",
                                                        user.isMe ? "text-primary font-bold" : ""
                                                    )}>
                                                        {user.name}
                                                    </span>
                                                    {user.isMe && (
                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-primary/20 gap-1">
                                                            <Star className="h-2 w-2 fill-primary" /> TU SESIÓN
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] uppercase font-medium border-primary/10 bg-white">
                                                    {user.role || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-medium uppercase text-muted-foreground">
                                                {user.seccional ? `SECCIONAL ${user.seccional}` : 'SIN ASIGNAR'}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-medium uppercase">
                                                {user.status === 'online' 
                                                    ? <span className="text-green-600 flex items-center gap-1.5 font-bold"><Wifi className="h-3 w-3" /> Activo ahora</span>
                                                    : <span className="text-muted-foreground/60 flex items-center gap-1.5"><WifiOff className="h-3 w-3" /> {formatExactTime(user.last_changed)}</span>
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                                                <Users className="w-12 h-12" />
                                                <p className="font-medium uppercase text-xs">No hay registros que coincidan</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter className="bg-muted/10 border-t py-3 flex justify-between items-center px-6">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">
                        SISTEMA DE GESTIÓN ESTRATÉGICA - LISTA 2P OPCION 2
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}