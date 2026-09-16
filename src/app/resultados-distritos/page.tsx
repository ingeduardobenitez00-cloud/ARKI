"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Medal, Gavel, Server, MapPin } from 'lucide-react';
import { calculateDHondt, rankCandidatesByPreferential, ListResult } from '@/lib/electoral-math';
import { DISTRITOS_ALTO_PARANA, Distrito } from '@/data/distritos';

export default function ResultadosDistritosPage() {
    const [selectedDistritoId, setSelectedDistritoId] = useState<string>("0");
    const [bancasOverride, setBancasOverride] = useState<string>("default");
    const [dataIntendente, setDataIntendente] = useState<any>(null);
    const [dataJunta, setDataJunta] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const selectedDistrito = useMemo(() => {
        return DISTRITOS_ALTO_PARANA.find(d => d.id.toString() === selectedDistritoId) || DISTRITOS_ALTO_PARANA[0];
    }, [selectedDistritoId]);

    const activeBancas = useMemo(() => {
        if (bancasOverride && bancasOverride !== "default") return parseInt(bancasOverride, 10);
        return selectedDistrito.bancasDefault;
    }, [bancasOverride, selectedDistrito]);

    useEffect(() => {
        setIsLoading(true);
        Promise.all([
            fetch(`/api/tsje-proxy?path=dinamics/divulgacion.ajax.php%3Fcodeleccion%3D44%26candidatura%3D1%26departamento%3D10%26distrito%3D${selectedDistritoId}`).then(res => res.json()).catch(() => null),
            fetch(`/api/tsje-proxy?path=dinamics/divulgacion.ajax.php%3Fcodeleccion%3D44%26candidatura%3D2%26departamento%3D10%26distrito%3D${selectedDistritoId}`).then(res => res.json()).catch(() => null)
        ])
        .then(([intData, juntaData]) => {
            setDataIntendente(intData);
            setDataJunta(juntaData);
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Error fetching TSJE", err);
            setIsLoading(false);
        });
    }, [selectedDistritoId]);

    const juntaLists = useMemo(() => {
        if (!dataJunta || !dataJunta.candidatos) return [];
        return dataJunta.candidatos.map((c: any) => {
            const listId = `lista-${c.numLista}`;
            const options: Record<string, number> = {};
            if (c.candidatosPref) {
                c.candidatosPref.forEach((pref: any) => {
                    options[pref.ordCandidato.toString()] = pref.votos;
                });
            }
            return {
                id: listId,
                name: c.desPartido,
                numLista: c.numLista,
                totalVotes: c.votos,
                options,
                candidatosOriginal: c.candidatosPref || []
            };
        });
    }, [dataJunta]);

    const dHondtResults = useMemo(() => {
        if (juntaLists.length === 0) return [];
        const lists: ListResult[] = juntaLists.map((l: any) => ({
            id: l.id,
            name: l.name,
            totalVotes: l.totalVotes,
            options: l.options
        }));
        return calculateDHondt(lists, activeBancas);
    }, [juntaLists, activeBancas]);

    const electedConcejales = useMemo(() => {
        const elected: any[] = [];
        dHondtResults.forEach(res => {
            const listOriginal = juntaLists.find((l: any) => l.id === res.listId);
            if (listOriginal) {
                // Rank candidates for this list
                const ranked = rankCandidatesByPreferential(
                    listOriginal.options, 
                    listOriginal.candidatosOriginal.map((c: any) => ({
                        id: c.ordCandidato.toString(),
                        name: c.nomCandidato,
                        option: c.ordCandidato,
                        photo: c.imgCandidato ? `https://resultados.tsje.gov.py/fotos/anr2022/${c.imgCandidato}.jpg` : ''
                    }))
                );
                
                const winners = ranked.slice(0, res.seats);
                winners.forEach((w, index) => {
                    elected.push({
                        ...w,
                        listId: res.listId,
                        listName: listOriginal.name,
                        listNumber: listOriginal.numLista,
                        position: index + 1,
                        quotient: res.quotients?.[index] || 0
                    });
                });
            }
        });
        
        // Sort globally by quotient to represent the exact D'Hondt sequence
        elected.sort((a, b) => b.quotient - a.quotient);
        return elected;
    }, [dHondtResults, juntaLists]);

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Detalle por Distrito</h1>
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                        <Badge variant="outline" className="animate-pulse bg-red-50 text-red-600 border-red-200">
                            <Server className="w-3 h-3 mr-1"/> TSJE OFICIAL
                        </Badge>
                        <span className="font-bold">Elecciones Internas ANR 2026 - Alto Paraná</span>
                    </div>
                </div>
                
                <div className="flex gap-4 items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <Select value={selectedDistritoId} onValueChange={setSelectedDistritoId}>
                        <SelectTrigger className="w-[250px] font-bold">
                            <SelectValue placeholder="Seleccionar Distrito" />
                        </SelectTrigger>
                        <SelectContent>
                            {DISTRITOS_ALTO_PARANA.map(d => (
                                <SelectItem key={d.id} value={d.id.toString()}>
                                    ID: {d.id} - {d.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="border-l pl-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Bancas (Junta)</span>
                        <Select value={bancasOverride} onValueChange={setBancasOverride}>
                            <SelectTrigger className="w-[100px] h-8 font-bold text-xs">
                                <SelectValue placeholder={`${selectedDistrito.bancasDefault} (Default)`} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">{selectedDistrito.bancasDefault} (Default)</SelectItem>
                                <SelectItem value="9">9 Bancas</SelectItem>
                                <SelectItem value="12">12 Bancas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border shadow-sm border-dashed">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
                    <div className="font-bold text-slate-700">Conectando con Servidores TSJE...</div>
                    <div className="text-sm text-slate-400">Descargando datos del distrito {selectedDistrito.nombre}</div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-white border-none shadow-sm">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600"><Users /></div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium">Votos Totales (Junta Municipal)</div>
                                    <div className="text-3xl font-black">{dataJunta?.totales?.totalVotos?.toLocaleString() || 0}</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-none shadow-sm">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-green-50 text-green-600"><Users /></div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium">Votos Totales (Intendencia)</div>
                                    <div className="text-3xl font-black">{dataIntendente?.totales?.totalVotos?.toLocaleString() || 0}</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Intendentes */}
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between pb-3">
                            <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                <Medal className="w-4 h-4" /> Candidatos a Intendente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                {dataIntendente?.candidatos?.length > 0 ? [...dataIntendente.candidatos].sort((a: any, b: any) => b.votos - a.votos).map((c: any, i: number) => {
                                    const pct = dataIntendente?.totales?.totalVotos ? ((c.votos / dataIntendente.totales.totalVotos) * 100).toFixed(1) : '0.0';
                                    return (
                                        <div key={`int-${i}-${c.numLista}`} className="p-4 flex items-center gap-4 hover:bg-green-50/30 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-md">
                                                {i + 1}
                                            </div>
                                            <img 
                                                src={c.imgCandidato ? `https://resultados.tsje.gov.py/fotos/anr2022/${c.imgCandidato}.jpg` : 'https://via.placeholder.com/150'} 
                                                alt={c.nomCandidato}
                                                referrerPolicy="no-referrer"
                                                className="w-12 h-12 rounded-full object-cover border-2 border-green-200 bg-slate-100 shadow-sm shrink-0"
                                                onError={(e) => (e.target as any).src = 'https://via.placeholder.com/150'}
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-black text-slate-800 uppercase leading-none">{c.nomCandidato || c.desPartido}</div>
                                                <div className="text-xs font-bold text-slate-500 mt-1 uppercase">Lista {c.numLista} - {c.desPartido}</div>
                                            </div>
                                            <div className="text-right flex-shrink-0 bg-slate-50 p-2 rounded-lg border min-w-[80px]">
                                                <div className="text-sm font-black text-slate-900 leading-none">{c.votos?.toLocaleString() || 0}</div>
                                                <div className="text-[9px] text-slate-500 uppercase font-bold leading-none mt-1">{pct}%</div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="p-12 text-center text-slate-400 text-sm italic">
                                        No se encontraron candidatos a Intendente para este distrito.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Listas y Bancadas */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border-none shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                        <Gavel className="w-4 h-4" /> Bancadas (D'Hondt)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {dHondtResults.length > 0 ? dHondtResults.map(res => (
                                        <div key={res.listId} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{res.listName}</span>
                                                <span className="text-sm font-black text-slate-700">LISTA {juntaLists.find((l: any) => l.id === res.listId)?.numLista}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border shadow-sm">
                                                <span className="text-2xl font-black text-red-600">{res.seats}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">Escaños</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center text-sm text-slate-400 italic py-4">No hay datos de bancadas</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b bg-slate-50/50">
                                    <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500">Resumen Votos por Lista (Junta)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                    {juntaLists.sort((a:any, b:any) => b.totalVotes - a.totalVotes).map((list: any) => {
                                        const pct = dataJunta?.totales?.totalVotos ? ((list.totalVotes / dataJunta.totales.totalVotos) * 100).toFixed(1) : '0.0';
                                        return (
                                            <div key={list.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-blue-600">LISTA {list.numLista}</span>
                                                    <span className="text-xs font-bold text-slate-600">{list.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-slate-900">{list.totalVotes.toLocaleString()}</div>
                                                    <div className="text-[10px] font-bold text-slate-400">{pct}%</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Concejales Electos */}
                        <div className="lg:col-span-2">
                            <Card className="border-none shadow-sm overflow-hidden bg-white">
                                <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between pb-3">
                                    <CardTitle className="uppercase tracking-widest text-sm font-bold text-slate-500 flex items-center gap-2">
                                        <Medal className="w-4 h-4" /> Concejales Electos (Preferencial + D'Hondt)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[800px] overflow-y-auto divide-y divide-slate-100">
                                        {electedConcejales.length > 0 ? electedConcejales.map((c, i) => (
                                            <div key={`electo-${i}-${c.name}`} className="p-4 flex items-center gap-4 hover:bg-red-50/30 transition-colors">
                                                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-md">
                                                    {i + 1}
                                                </div>
                                                <img 
                                                    src={c.photo || 'https://via.placeholder.com/150'} 
                                                    alt={c.name}
                                                    referrerPolicy="no-referrer"
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-red-200 bg-slate-100 shadow-sm shrink-0"
                                                    onError={(e) => (e.target as any).src = 'https://via.placeholder.com/150'}
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-black text-slate-800 uppercase leading-none">{c.name}</div>
                                                    <div className="text-xs font-bold text-slate-500 mt-1 uppercase">Lista {c.listNumber} - {c.listName}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">Opción {c.option}</div>
                                                </div>
                                                <div className="text-right flex-shrink-0 bg-slate-50 p-2 rounded-lg border">
                                                    <div className="text-sm font-black text-slate-900 leading-none">{c.votes?.toLocaleString() || 0}</div>
                                                    <div className="text-[9px] text-slate-500 uppercase font-bold leading-none mt-1">Votos Pref.</div>
                                                </div>
                                                <div className="text-right flex-shrink-0 w-24">
                                                    <div className="text-xs font-black text-blue-700 leading-none">{c.quotient.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                                    <div className="text-[9px] text-blue-500/70 uppercase font-bold leading-none mt-1">Cociente</div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-12 text-center text-slate-400 text-sm italic">
                                                No se encontraron candidatos electos o los datos del distrito están vacíos.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
