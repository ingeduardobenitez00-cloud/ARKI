"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, getDocs, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { INTENDENTE_CANDIDATES, JUNTA_LISTS, getJuntaOptions } from '@/data/electoral-metadata';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Vote, Percent, TrendingUp, Gavel, Medal } from 'lucide-react';
import { calculateDHondt, rankCandidatesByPreferential, ListResult } from '@/lib/electoral-math';

export default function ResultadosElectoralesPage() {
    const db = useFirestore();
    const [totals, setTotals] = useState<any>(null);
    const [totalMesasGlobal, setTotalMesasGlobal] = useState(0);
    const [totalElectoresGlobal, setTotalElectoresGlobal] = useState(0);

    useEffect(() => {
        if (!db) return;

        // Fetch Total Mesas from Metadata (Static)
        getDocs(collection(db, 'seccionales_metadata')).then(snap => {
            let totalM = 0;
            let totalE = 0;
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.mesas_por_local) {
                    data.mesas_por_local.forEach((l: any) => {
                        totalM += (l.mesas?.length || 0);
                        totalE += (l.mesas?.length || 0) * 300; 
                    });
                }
                if (data.total_electores) totalE = (totalE - ((data.mesas_por_local?.length || 0) * 300)) + data.total_electores;
            });
            setTotalMesasGlobal(totalM);
            setTotalElectoresGlobal(totalE);
        });

        // Listen only to ONE document for ALL results (Fastest & Cheapest)
        const unsub = onSnapshot(doc(db, 'electoral_stats', 'totals'), (snap) => {
            if (snap.exists()) setTotals(snap.data());
        });

        return () => unsub();
    }, [db]);

    const intendenteTotals = useMemo(() => {
        return totals?.intendente || { votos_nulos: 0, votos_blancos: 0 };
    }, [totals]);

    const juntaTotals = useMemo(() => {
        const res: Record<string, number> = {};
        if (totals?.junta) {
            Object.keys(totals.junta).forEach(listId => {
                res[listId] = totals.junta[listId].total || 0;
            });
        }
        return res;
    }, [totals]);

    const totalVotosIntendente = useMemo(() => {
        if (!totals?.intendente) return 0;
        return Object.values(totals.intendente).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
    }, [totals]);

    const dHondtResults = useMemo(() => {
        if (!totals?.junta) return [];
        const lists: ListResult[] = JUNTA_LISTS.map(l => ({
            id: l.id,
            name: l.name,
            totalVotes: totals.junta[l.id]?.total || 0,
            options: totals.junta[l.id]?.opciones || {}
        }));
        return calculateDHondt(lists, 24);
    }, [totals]);

    const preferentialRankings = useMemo(() => {
        if (!totals?.junta) return {};
        const rankings: Record<string, any[]> = {};
        JUNTA_LISTS.forEach(list => {
            const options = totals.junta[list.id]?.opciones || {};
            const candidates = getJuntaOptions(list.id);
            rankings[list.id] = rankCandidatesByPreferential(options, candidates);
        });
        return rankings;
    }, [totals]);

    const intendenteChartData = useMemo(() => {
        return INTENDENTE_CANDIDATES.map(c => ({
            name: c.name,
            votos: intendenteTotals[c.id] || 0,
            color: c.list.includes('2') ? '#ef4444' : c.list.includes('7') ? '#3b82f6' : '#10b981'
        })).sort((a, b) => b.votos - a.votos);
    }, [intendenteTotals]);

    const electedConcejales = useMemo(() => {
        const elected: any[] = [];
        dHondtResults.forEach(res => {
            const listRanked = preferentialRankings[res.listId] || [];
            const winners = listRanked.slice(0, res.seats);
            winners.forEach((w, index) => {
                elected.push({
                    ...w,
                    listId: res.listId,
                    listNumber: JUNTA_LISTS.find(l => l.id === res.listId)?.listNumber,
                    position: index + 1
                });
            });
        });
        return elected;
    }, [dHondtResults, preferentialRankings]);

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Escrutinio Real-Time</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="outline" className="animate-pulse bg-red-50 text-red-600 border-red-200">LIVE</Badge>
                        <span>Resultados Provisorios - TREP Interno</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Mesas Procesadas</div>
                        <div className="text-2xl font-black">{totals?.processedMesas || 0} <span className="text-sm font-normal text-slate-400">/ {totalMesasGlobal || '...'}</span></div>
                    </div>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-none shadow-sm overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-2xl text-red-600"><Users /></div>
                        <div>
                            <div className="text-sm text-slate-500 font-medium">Votos Totales</div>
                            <div className="text-2xl font-black">{totalVotosIntendente.toLocaleString()}</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-none shadow-sm overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Percent /></div>
                        <div>
                            <div className="text-sm text-slate-500 font-medium">Participación</div>
                            <div className="text-2xl font-black">
                                {totalElectoresGlobal ? ((totalVotosIntendente / totalElectoresGlobal) * 100).toFixed(1) : '0.0'}%
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* ... more stats */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Intendente Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Intendencia Municipal
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 divide-y">
                                {intendenteChartData.map((data) => {
                                    const candidate = INTENDENTE_CANDIDATES.find(c => c.name === data.name);
                                    const percentage = totalVotosIntendente ? (data.votos / totalVotosIntendente * 100) : 0;
                                    const photoUrl = candidate?.photo || 'https://via.placeholder.com/150';
                                    const listName = candidate?.list || 'N/A';
                                    
                                    return (
                                        <div key={data.name} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-colors">
                                            <div className="relative">
                                                <img src={photoUrl} className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 shadow-md" onError={(e) => (e.target as any).src = 'https://via.placeholder.com/150'} />
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: data.color }} />
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <div className="text-lg font-black text-slate-800">{data.name}</div>
                                                        <div className="text-xs font-bold text-slate-400 uppercase">{listName}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xl font-black text-slate-900">{data.votos.toLocaleString()} <span className="text-sm text-slate-400 font-normal">votos</span></div>
                                                        <div className="text-base font-bold text-blue-600">{percentage.toFixed(1)}%</div>
                                                    </div>
                                                </div>
                                                <Progress value={percentage} className="h-3" style={{ '--progress-background': data.color } as any} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                    
                    {/* Intendente Chart */}
                    <Card className="border-none shadow-sm overflow-hidden bg-white h-[300px]">
                        <CardContent className="p-6 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={intendenteChartData}>
                                    <XAxis dataKey="name" hide />
                                    <YAxis hide />
                                    <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-2 shadow-lg border rounded-lg">
                                                    <div className="text-xs font-bold">{payload[0].name}</div>
                                                    <div className="text-sm font-black">{payload[0].value.toLocaleString()} votos</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Bar dataKey="votos" radius={[10, 10, 0, 0]}>
                                        {intendenteChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                <Medal className="w-4 h-4" /> Votos Preferencias Concejales
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
                                {electedConcejales.map((c, i) => (
                                    <div key={`${c.listId}-${c.name}`} className="p-3 flex items-center gap-4 hover:bg-blue-50/30 transition-colors">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-black">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-black text-slate-800 uppercase leading-none">{c.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Lista {c.listNumber} • Pos. {c.position}</div>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">ELECTO</Badge>
                                    </div>
                                ))}
                                {electedConcejales.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">
                                        Esperando datos de escrutinio...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 text-center">Resumen Junta Municipal</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {JUNTA_LISTS.map(list => {
                                    const total = juntaTotals[list.id] || 0;
                                    return (
                                        <div key={list.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-600">LISTA {list.listNumber}</span>
                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{list.name}</span>
                                        </div>
                                        <div className="text-lg font-black text-slate-900">{total.toLocaleString()}</div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                <Gavel className="w-4 h-4" /> Bancadas (D&apos;Hondt)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {dHondtResults.map(res => (
                                <div key={res.listId} className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{res.listName}</span>
                                        <span className="text-sm font-black text-slate-700">LISTA {JUNTA_LISTS.find(l => l.id === res.listId)?.listNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-black text-primary">{res.seats}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Escaños</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500">Otros Votos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 text-sm">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="font-bold text-slate-600 uppercase tracking-tighter">Votos en Blanco</span>
                                <span className="text-lg font-black">{(intendenteTotals.votos_blancos || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="font-bold text-slate-600 uppercase tracking-tighter">Votos Nulos</span>
                                <span className="text-lg font-black">{(intendenteTotals.votos_nulos || 0).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <Vote className="w-8 h-8" />
                                <div className="text-xl font-black uppercase tracking-tighter">Progreso TREP</div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold uppercase">
                                    <span>Escaneadas</span>
                                    <span>{totals?.processedMesas || 0} de {totalMesasGlobal || '...'}</span>
                                </div>
                                <Progress value={totalMesasGlobal ? ((totals?.processedMesas || 0) / totalMesasGlobal) * 100 : 0} className="h-2 bg-white/20" />
                            </div>
                            <p className="text-[10px] text-white/60 leading-relaxed">
                                Datos actualizados instantáneamente desde los centros de votación vía escaneo de actas QR.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
