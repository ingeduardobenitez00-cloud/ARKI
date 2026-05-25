"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Seccional } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Users, Loader2, Search, MapPin, ShieldCheck, CheckCircle2, AlertTriangle, BarChart3, Layers, UserCircle, X, Award, TrendingUp, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const USERS_COLLECTION = 'users';
const VOTOS_COLLECTION = 'votos_confirmados';

interface UserPerformance extends User {
    votosCargados: number;
}

export default function RendimientoOperadoresPage() {
    const db = useFirestore();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [users, setUsers] = useState<UserPerformance[]>([]);
    const [seccionales, setSeccionales] = useState<Seccional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalVotosGlobal, setTotalVotosGlobal] = useState(0);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch users
            const usersSnap = await getDocs(query(collection(db, USERS_COLLECTION), limit(300)));
            const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), votosCargados: 0 } as UserPerformance));
            
            // Fetch seccionales
            const seccSnap = await getDocs(collection(db, 'seccionales'));
            const seccList = seccSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Seccional));
            setSeccionales(seccList.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })));

            // Fetch votos confirmados
            const votosSnap = await getDocs(query(collection(db, VOTOS_COLLECTION)));
            
            let globalVotosCount = 0;
            const operatorVotosCount: Record<string, number> = {};

            votosSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                globalVotosCount++;
                if (data.registradoPor_id) {
                    operatorVotosCount[data.registradoPor_id] = (operatorVotosCount[data.registradoPor_id] || 0) + 1;
                }
            });

            setTotalVotosGlobal(globalVotosCount);

            // Merge counts
            const usersWithStats = usersList.map(u => ({
                ...u,
                votosCargados: operatorVotosCount[u.id] || 0
            }));

            // Sort generally by votes descending
            usersWithStats.sort((a, b) => b.votosCargados - a.votosCargados);
            setUsers(usersWithStats);

        } catch (error) {
            toast({ title: 'Error al cargar datos de rendimiento', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [toast, db]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredUsers = useMemo(() => {
        const s = searchTerm.toLowerCase();
        return users.filter(u => {
            const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const searchTerms = normalize(s).split(' ').filter(Boolean);
            const userIdentity = normalize(`${u.name || ''} ${u.email || ''} ${u.clasificacion || ''} ${u.role || ''}`);
            return searchTerms.every(term => userIdentity.includes(term));
        });
    }, [users, searchTerm]);

    const groupedUsers = useMemo(() => {
        const groups: Record<string, UserPerformance[]> = {};
        
        if (!searchTerm) {
            seccionales.forEach(s => { groups[String(s.id)] = []; });
        }
        groups['PC'] = [];
        groups['MULTI'] = [];
        groups['GLOBAL'] = [];

        filteredUsers.forEach(u => {
            const uSecs = u.seccionales || (u.seccional ? [u.seccional] : []);
            
            let groupKey = u.clasificacion;
            const isAutomatic = !groupKey || groupKey === 'SIN CLASIFICAR';

            if (isAutomatic) {
                if (uSecs.length > 1) {
                    groupKey = 'MULTI';
                } else if (uSecs.length === 1) {
                    groupKey = String(uSecs[0]);
                } else {
                    groupKey = (u.role === 'Admin' || u.role === 'Super-Admin' || u.role === 'Presidente') ? 'PC' : 'GLOBAL';
                }
            }
            
            const finalKey = groupKey || 'GLOBAL';
            if (!groups[finalKey]) groups[finalKey] = [];
            groups[finalKey].push(u);
        });

        if (groups['GLOBAL'] && groups['GLOBAL'].length === 0) delete groups['GLOBAL'];
        if (groups['PC'] && groups['PC'].length === 0) delete groups['PC'];
        if (groups['MULTI'] && groups['MULTI'].length === 0) delete groups['MULTI'];
        
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'PC') return -1;
            if (b === 'PC') return 1;
            if (a === 'MULTI') return -1;
            if (b === 'MULTI') return 1;
            if (a === 'GLOBAL') return 1;
            if (b === 'GLOBAL') return -1;
            return a.localeCompare(b, undefined, { numeric: true });
        });
        
        // Sort inside groups by votes descending
        sortedKeys.forEach(k => {
            groups[k].sort((a, b) => b.votosCargados - a.votosCargados);
        });
        
        return { groups, sortedKeys };
    }, [filteredUsers, seccionales, searchTerm]);

    const stats = useMemo(() => {
        const activeOperators = users.filter(u => u.votosCargados > 0).length;
        const totalOps = users.length;
        const inactiveOps = totalOps - activeOperators;

        // Top 3 best operators
        const topOperators = [...users].sort((a, b) => b.votosCargados - a.votosCargados).slice(0, 3).filter(u => u.votosCargados > 0);

        return { activeOperators, totalOps, inactiveOps, topOperators };
    }, [users]);

    const handlePrintReport = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('Reporte de Rendimiento de Operadores', 14, 22);
            
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 30);
            doc.text(`Total de votos seguros en sistema: ${totalVotosGlobal}`, 14, 36);

            const tableColumn = ["Operador", "Seccional", "Votos Cargados"];
            const tableRows: any[] = [];

            const usersForReport = [...users].sort((a, b) => {
                const secA = (a.seccionales && a.seccionales[0]) || a.seccional || 'Global';
                const secB = (b.seccionales && b.seccionales[0]) || b.seccional || 'Global';
                if (secA !== secB) return String(secA).localeCompare(String(secB), undefined, { numeric: true });
                return b.votosCargados - a.votosCargados;
            });

            usersForReport.forEach(u => {
                let sec = 'Global';
                if (u.seccionales && u.seccionales.length > 0) {
                    sec = u.seccionales.join(', ');
                } else if (u.seccional) {
                    sec = String(u.seccional);
                }
                const rowData = [
                    (u.name || u.email || 'Desconocido').toUpperCase(),
                    sec.toUpperCase(),
                    u.votosCargados.toString()
                ];
                tableRows.push(rowData);
            });

            tableRows.push([
                { content: 'TOTAL CARGADO', styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: '-', styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: totalVotosGlobal.toString(), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                theme: 'grid',
                headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                styles: { fontSize: 10 },
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const votes = Number(data.row.raw[2]);
                        if (votes > 0) {
                            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
                            data.cell.styles.textColor = [6, 95, 70]; // emerald-800
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });

            doc.save(`Rendimiento_Operadores_${new Date().getTime()}.pdf`);
            toast({ title: 'Reporte Generado', description: 'El PDF se ha descargado exitosamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo generar el PDF', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" /> 
                        Rendimiento de Operadores
                    </h1>
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest mt-1">
                        Control de carga y efectividad de votos seguros por usuario.
                    </p>
                </div>
                <Button onClick={handlePrintReport} className="font-black h-12 px-8 shadow-xl rounded-2xl active:scale-95 transition-all">
                    <Download className="w-5 h-5 mr-2" /> DESCARGAR REPORTE PDF
                </Button>
            </div>

            {/* Panel de Estadísticas y Top Rendimiento */}
            {!isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[1.5rem] p-4 flex flex-col justify-center shadow-sm relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10"><BarChart3 className="w-24 h-24 text-emerald-600" /></div>
                            <div className="flex items-center gap-3 mb-2 z-10">
                                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
                                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Votos Totales</p>
                            </div>
                            <p className="text-3xl font-black text-emerald-900 leading-none z-10">{totalVotosGlobal}</p>
                            <p className="text-[9px] font-bold text-emerald-700/60 uppercase mt-1 z-10">Asegurados en sistema</p>
                        </div>
                        
                        <div className="bg-blue-50/50 border border-blue-100 rounded-[1.5rem] p-4 flex flex-col justify-center shadow-sm relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10"><CheckCircle2 className="w-24 h-24 text-blue-600" /></div>
                            <div className="flex items-center gap-3 mb-2 z-10">
                                <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Users className="h-5 w-5" /></div>
                                <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Operadores Activos</p>
                            </div>
                            <p className="text-3xl font-black text-blue-900 leading-none z-10">{stats.activeOperators} <span className="text-sm text-blue-700/50">/ {stats.totalOps}</span></p>
                            <p className="text-[9px] font-bold text-blue-700/60 uppercase mt-1 z-10">Han cargado al menos 1 voto</p>
                        </div>
                        
                        <div className="bg-amber-50/50 border border-amber-100 rounded-[1.5rem] p-4 flex flex-col justify-center shadow-sm relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10"><AlertTriangle className="w-24 h-24 text-amber-600" /></div>
                            <div className="flex items-center gap-3 mb-2 z-10">
                                <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><X className="h-5 w-5" /></div>
                                <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Operadores Sin Carga</p>
                            </div>
                            <p className="text-3xl font-black text-amber-900 leading-none z-10">{stats.inactiveOps}</p>
                            <p className="text-[9px] font-bold text-amber-700/60 uppercase mt-1 z-10">Con 0 votos registrados</p>
                        </div>
                    </div>

                    <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent rounded-[1.5rem] shadow-sm">
                        <CardHeader className="py-4 border-b border-primary/5 bg-white/50">
                            <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2">
                                <Award className="h-4 w-4 text-primary" /> Top Operadores
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 px-4 pb-4">
                            <div className="space-y-3">
                                {stats.topOperators.length > 0 ? stats.topOperators.map((u, i) => (
                                    <div key={u.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={cn(
                                                "font-black text-xs w-4 text-center",
                                                i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-amber-700"
                                            )}>{i + 1}</span>
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={u.photoUrl} />
                                                <AvatarFallback className="text-[8px] bg-primary/10 font-black">{u.name?.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] font-bold uppercase truncate">{u.name}</span>
                                        </div>
                                        <Badge className="h-5 px-1.5 text-[9px] font-black">{u.votosCargados}</Badge>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-muted-foreground italic text-center py-4">Aún no hay votos registrados.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex items-center">
                <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Buscar por operador o rol..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 h-14 font-bold rounded-[1.5rem] border-primary/10 shadow-sm bg-white uppercase" autoComplete="off" />
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="border rounded-[2.5rem] bg-card p-8 shadow-sm border-primary/5 space-y-4">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                    </div>
                ) : groupedUsers.sortedKeys.length > 0 ? (
                    <Accordion type="multiple" value={searchTerm ? groupedUsers.sortedKeys : undefined} defaultValue={[]} className="space-y-4">
                        {groupedUsers.sortedKeys.map(key => {
                            const usersInGroup = groupedUsers.groups[key];
                            
                            // Agregamos métricas para el grupo
                            const totalVotesInGroup = usersInGroup.reduce((acc, u) => acc + u.votosCargados, 0);
                            const activeUsersInGroup = usersInGroup.filter(u => u.votosCargados > 0).length;

                            let label = '';
                            let icon = <Users className="h-5 w-5 text-primary" />;
                            const isSpecial = ['PC', 'MULTI', 'GLOBAL'].includes(key);
                            const isEmpty = usersInGroup.length === 0 && !isSpecial;

                            if (key === 'PC') {
                                label = 'PC (Puesto de Comando)';
                                icon = <ShieldCheck className="h-5 w-5 text-primary" />;
                            } else if (key === 'MULTI') {
                                label = 'Dirigentes con Varias Seccionales';
                                icon = <Layers className="h-5 w-5 text-primary" />;
                            } else if (key === 'GLOBAL') {
                                label = 'Operadores Globales';
                                icon = <UserCircle className="h-5 w-5 text-primary" />;
                            } else if (isNaN(Number(key))) {
                                label = key;
                                icon = <Layers className="h-5 w-5 text-primary" />;
                            } else {
                                const cleanKey = String(key).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(SECCIONAL|SECCION\.|SECCION|SECC\.|SECC|SEC\.|SEC)\s*/g, '').trim();
                                label = `Seccional ${cleanKey}`;
                                icon = <MapPin className="h-5 w-5 text-primary" />;
                            }

                            return (
                                <AccordionItem 
                                    key={key} 
                                    value={key} 
                                    className={cn(
                                        "border rounded-[2.5rem] bg-card shadow-sm overflow-hidden transition-all duration-300 px-0",
                                        isEmpty ? "border-amber-200 bg-amber-50/20 opacity-80 hidden" : "border-primary/5"
                                    )}
                                >
                                    <AccordionTrigger className="hover:no-underline py-5 px-8 group">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 rounded-2xl transition-colors bg-primary/5 text-primary group-data-[state=open]:bg-primary/10">
                                                    {icon}
                                                </div>
                                                <div className="flex flex-col items-start translate-y-0.5 text-left">
                                                    <span className="font-black uppercase tracking-tight text-lg text-slate-800">{label}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                        {usersInGroup.length} Operadores ({activeUsersInGroup} Activos)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end mr-4">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Votos Seguros</span>
                                                <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary font-black text-sm px-3">{totalVotesInGroup}</Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0 border-t bg-slate-50/30">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-[9px] font-black uppercase border-b">
                                                    <TableHead className="pl-8 py-3 w-[60px]">Status</TableHead>
                                                    <TableHead>Operador / Identidad</TableHead>
                                                    <TableHead>Rol del Sistema</TableHead>
                                                    <TableHead className="text-right pr-8">Votos Cargados</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {usersInGroup.map((user, idx) => {
                                                    const hasVotes = user.votosCargados > 0;
                                                    return (
                                                        <TableRow key={user.id} className={cn("hover:bg-primary/[0.02] transition-colors border-b last:border-0", hasVotes ? "bg-white" : "bg-red-50/30")}>
                                                            <TableCell className="py-4 pl-8">
                                                                {hasVotes ? (
                                                                    <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-full w-fit">
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-amber-100 text-amber-600 p-1.5 rounded-full w-fit" title="No ha cargado votos">
                                                                        <AlertTriangle className="h-4 w-4" />
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn("relative", user.active === false && "grayscale opacity-50")}>
                                                                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm font-black uppercase">
                                                                            <AvatarImage src={user.photoUrl} className="object-cover" />
                                                                            <AvatarFallback className="bg-primary/5 text-primary text-[10px]">{ (user.name || '??').substring(0,2) }</AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-black text-xs uppercase tracking-tight text-slate-900 leading-tight">{user.name}</span>
                                                                        <span className="text-[9px] text-muted-foreground font-bold">{user.email}</span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    <Badge variant="secondary" className="w-fit font-black text-[8px] uppercase tracking-widest px-2 py-0.5 bg-slate-100 text-slate-600 border-none">
                                                                        {user.role}
                                                                    </Badge>
                                                                    {user.clasificacion && user.clasificacion !== 'SIN CLASIFICAR' && (
                                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{user.clasificacion}</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-8">
                                                                <Badge variant="outline" className={cn(
                                                                    "text-sm font-black px-3 py-0.5 shadow-sm",
                                                                    hasVotes ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                                                                )}>
                                                                    {user.votosCargados}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                ) : (
                    <div className="border rounded-[2.5rem] bg-card p-20 text-center shadow-sm border-primary/5">
                        <Users className="w-16 h-16 mx-auto mb-4 text-primary opacity-30" />
                        <p className="font-black uppercase text-sm tracking-widest text-muted-foreground opacity-60">No se encontraron operadores para esta búsqueda</p>
                    </div>
                )}
            </div>
        </div>
    );
}
