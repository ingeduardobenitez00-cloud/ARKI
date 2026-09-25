"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, BarChart3, TrendingUp, UserCheck, ChevronRight, FileDown, Settings, Save, Loader2, Download, Search, Trophy } from 'lucide-react';
import { DISTRITOS_ALTO_PARANA } from '@/data/distritos';
import { toast } from '@/hooks/use-toast';
import { calculateDHondt, rankCandidatesByPreferential } from '@/lib/electoral-math';

export default function ResumenDepartamentalPage() {
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    // Almacena no solo la data en bruto, sino la procesada (electos)
    const [distritoData, setDistritoData] = useState<Record<string, { intendente: any, junta: any[], bancasDefault: number }>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    // Initial load of mappings
    useEffect(() => {
        fetch('/api/faction-mappings')
            .then(res => res.json())
            .then(data => setMappings(data || {}))
            .catch(err => console.error("Error loading mappings", err));
    }, []);

    const fetchAllDistritos = async () => {
        setIsLoadingData(true);
        setLoadingProgress(0);
        const newData: Record<string, { intendente: any, junta: any[], bancasDefault: number }> = {};
        
        for (let i = 0; i < DISTRITOS_ALTO_PARANA.length; i++) {
            const dist = DISTRITOS_ALTO_PARANA[i];
            try {
                const [intRes, junRes] = await Promise.all([
                    fetch(`/api/tsje-proxy?path=dinamics/divulgacion.ajax.php%3Fcodeleccion%3D44%26candidatura%3D1%26departamento%3D10%26distrito%3D${dist.id}`),
                    fetch(`/api/tsje-proxy?path=dinamics/divulgacion.ajax.php%3Fcodeleccion%3D44%26candidatura%3D2%26departamento%3D10%26distrito%3D${dist.id}`)
                ]);
                const intData = await intRes.json().catch(() => null);
                const junData = await junRes.json().catch(() => null);
                
                // --- PROCESAMIENTO ELECTORAL ---

                // 1. Ganador Intendente (Más votado del partido)
                let intendenteGanador = null;
                if (intData?.candidatos && intData.candidatos.length > 0) {
                    intendenteGanador = intData.candidatos.reduce((prev: any, current: any) => {
                        return (Number(current.votos) > Number(prev.votos)) ? current : prev;
                    });
                    // Filtramos si el ganador no es de HC (Lista 2*)
                    if (!intendenteGanador.numLista.startsWith('2')) {
                        intendenteGanador = null; 
                    }
                }

                // 2. Concejales Electos (D'Hondt)
                const juntaLists = (junData?.candidatos || []).map((c: any) => {
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

                const bancas = dist.bancasDefault;
                const dHondtResults = calculateDHondt(juntaLists, bancas);
                
                const concejalesElectos: any[] = [];
                dHondtResults.forEach(res => {
                    if (res.seats > 0) {
                        const listOriginal = juntaLists.find((l: any) => l.id === res.listId);
                        if (listOriginal) {
                            const ranked = rankCandidatesByPreferential(
                                listOriginal.options, 
                                listOriginal.candidatosOriginal.map((c: any) => ({
                                    id: c.ordCandidato.toString(),
                                    nomCandidato: c.nomCandidato,
                                    ordCandidato: c.ordCandidato,
                                    votos: c.votos
                                }))
                            );
                            
                            const winners = ranked.slice(0, res.seats);
                            winners.forEach((w) => {
                                // Solo nos interesan los electos de HC
                                if (listOriginal.numLista.startsWith('2')) {
                                    concejalesElectos.push({
                                        ...w,
                                        numLista: listOriginal.numLista
                                    });
                                }
                            });
                        }
                    }
                });

                newData[dist.id] = { 
                    intendente: intendenteGanador, 
                    junta: concejalesElectos,
                    bancasDefault: bancas
                };

            } catch (e) {
                console.error(`Error fetching distrito ${dist.id}`, e);
            }
            setLoadingProgress(Math.round(((i + 1) / DISTRITOS_ALTO_PARANA.length) * 100));
        }
        
        setDistritoData(newData);
        setIsLoadingData(false);
    };

    const handleSaveMappings = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/faction-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mappings)
            });
            if (res.ok) {
                toast({ title: 'Guardado', description: 'Configuración de electos guardada correctamente.' });
            } else {
                toast({ title: 'Error', description: 'Hubo un error al guardar.', variant: 'destructive' });
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Hubo un error de conexión.', variant: 'destructive' });
        }
        setIsSaving(false);
    };

    const updateMapping = (key: string, faction: string) => {
        setMappings(prev => ({
            ...prev,
            [key]: faction
        }));
    };

    const getFallbackFaction = (numLista: string) => {
        if (numLista === '2A') return 'zacarias';
        if (numLista === '2R') return 'landy';
        if (numLista === '2') return 'consenso';
        return 'otras';
    };

    // Calculamos totales SOLO de los ELECTOS
    const calculateTotals = () => {
        const results = {
            zacarias: { nombre: "Equipo Zacarías Irún (Lista 2A)", intendentes: { electos: 0, votos: 0 }, concejales: { electos: 0, votos: 0 } },
            landy: { nombre: "Equipo César 'Landy' Torres (Lista 2R)", intendentes: { electos: 0, votos: 0 }, concejales: { electos: 0, votos: 0 } },
            consenso: { nombre: "Listas de Consenso (Lista 2)", intendentes: { electos: 0, votos: 0 }, concejales: { electos: 0, votos: 0 } },
            otras: { nombre: "Otras Listas HC", intendentes: { electos: 0, votos: 0 }, concejales: { electos: 0, votos: 0 } },
        };

        let grandTotalIntendentes = 0;
        let grandTotalConcejales = 0;
        let grandTotalVotos = 0; // Solo de los electos

        Object.keys(distritoData).forEach(distId => {
            const data = distritoData[distId];
            
            // Intendente Ganador
            if (data.intendente) {
                const cand = data.intendente;
                const key = `int-${distId}-${cand.numLista}-${cand.ordCandidato}`;
                const faction = mappings[key] || getFallbackFaction(cand.numLista);

                if (results[faction as keyof typeof results]) {
                    results[faction as keyof typeof results].intendentes.electos += 1;
                    results[faction as keyof typeof results].intendentes.votos += Number(cand.votos) || 0;
                    grandTotalIntendentes += 1;
                    grandTotalVotos += Number(cand.votos) || 0;
                }
            }

            // Concejales Electos
            if (data.junta) {
                data.junta.forEach((pref: any) => {
                    const key = `jun-${distId}-${pref.numLista}-${pref.ordCandidato}`;
                    const faction = mappings[key] || getFallbackFaction(pref.numLista);

                    if (results[faction as keyof typeof results]) {
                        results[faction as keyof typeof results].concejales.electos += 1;
                        results[faction as keyof typeof results].concejales.votos += Number(pref.votos) || 0;
                        grandTotalConcejales += 1;
                        grandTotalVotos += Number(pref.votos) || 0;
                    }
                });
            }
        });

        return { results, grandTotalIntendentes, grandTotalConcejales, grandTotalVotos };
    };

    const { results, grandTotalIntendentes, grandTotalConcejales, grandTotalVotos } = calculateTotals();

    const factionsArray = [
        { id: 'zacarias', data: results.zacarias, color: 'bg-red-600', textColor: 'text-red-600', icon: <TrendingUp className="w-5 h-5 text-red-600" /> },
        { id: 'landy', data: results.landy, color: 'bg-blue-600', textColor: 'text-blue-600', icon: <TrendingUp className="w-5 h-5 text-blue-600" /> },
        { id: 'consenso', data: results.consenso, color: 'bg-green-600', textColor: 'text-green-600', icon: <UserCheck className="w-5 h-5 text-green-600" /> },
        { id: 'otras', data: results.otras, color: 'bg-slate-600', textColor: 'text-slate-600', icon: <Users className="w-5 h-5 text-slate-600" /> },
    ];

    const exportToWord = () => {
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Resumen Departamental - Electos</title>
        <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .faction-title { font-size: 18px; font-weight: bold; margin-top: 20px; color: #333; }
        </style>
        </head><body>`;
        const footer = "</body></html>";
        
        let content = `
            <h1 style="text-align: center;">Resumen Departamental - Alto Paraná</h1>
            <p style="text-align: center; font-size: 14px; color: #555;">Radiografía de Candidatos Electos (Filtro D'Hondt aplicado)</p>
            <hr />
            <h2>Balance General de Electos</h2>
            <ul>
                <li><b>Total Candidaturas Ganadas (Intendencia + Junta):</b> ${grandTotalIntendentes + grandTotalConcejales}</li>
                <li><b>Total Votos Retenidos (Solo Electos):</b> ${grandTotalVotos.toLocaleString()}</li>
            </ul>
        `;

        factionsArray.forEach(faction => {
            content += `
                <div class="faction-title">${faction.data.nombre}</div>
                <table>
                    <tr><th>Cargo</th><th>Candidatos Electos</th><th>Votos Totales (Solo Electos)</th></tr>
                    <tr>
                        <td>Candidaturas a Intendente</td>
                        <td>${faction.data.intendentes.electos}</td>
                        <td>${faction.data.intendentes.votos.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Bancas Junta Municipal</td>
                        <td>${faction.data.concejales.electos}</td>
                        <td>${faction.data.concejales.votos.toLocaleString()}</td>
                    </tr>
                    <tr style="background-color: #f9f9f9; font-weight: bold;">
                        <td colspan="2">Total Votos Fuerza Real</td>
                        <td>${(faction.data.intendentes.votos + faction.data.concejales.votos).toLocaleString()}</td>
                    </tr>
                </table>
            `;
        });

        const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Resumen_Departamental_Electos.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-amber-500" />
                        Resumen Departamental (Electos)
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Análisis de fuerza real: cargos ganados en las Elecciones Internas.
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <Badge variant="outline" className="px-3 py-1 text-sm bg-amber-50 text-amber-700 border-amber-200">
                        {grandTotalVotos.toLocaleString()} Votos (Solo Electos)
                    </Badge>
                </div>
            </div>

            <Tabs defaultValue="resumen" className="w-full">
                <TabsList className="mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <TabsTrigger value="resumen" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm px-6">
                        <BarChart3 className="w-4 h-4 mr-2" /> Poder Real (Gráfico)
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm px-6">
                        <Trophy className="w-4 h-4 mr-2" /> Configurar Electos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-6">
                    {Object.keys(distritoData).length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                <Search className="w-16 h-16 text-slate-300 mb-4" />
                                <h3 className="text-xl font-bold text-slate-700 mb-2">Datos no procesados</h3>
                                <p className="text-slate-500 mb-6 max-w-md">
                                    Para generar la radiografía real, primero necesitamos correr el filtro D'Hondt y Mayoritario sobre los 22 distritos para determinar quiénes fueron los electos.
                                </p>
                                {isLoadingData ? (
                                    <div className="w-full max-w-md space-y-2">
                                        <div className="flex justify-between text-sm text-amber-600 font-medium">
                                            <span>Procesando matemática electoral TSJE...</span>
                                            <span>{loadingProgress}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
                                        </div>
                                    </div>
                                ) : (
                                    <Button onClick={fetchAllDistritos} className="bg-amber-500 hover:bg-amber-600 text-white">
                                        Procesar Electos
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="flex justify-end mb-4">
                                <Button variant="outline" onClick={exportToWord} className="flex items-center gap-2">
                                    <FileDown className="w-4 h-4" /> Exportar a Word
                                </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-lg">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-slate-300 font-medium">Cargos Totales Ganados</p>
                                                <h3 className="text-4xl font-bold mt-2">{grandTotalIntendentes + grandTotalConcejales}</h3>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <Trophy className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-0 shadow-lg">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-indigo-100 font-medium">Candidaturas Intendente</p>
                                                <h3 className="text-4xl font-bold mt-2">{grandTotalIntendentes}</h3>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <UserCheck className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-0 shadow-lg">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-blue-100 font-medium">Bancas Junta Municipal</p>
                                                <h3 className="text-4xl font-bold mt-2">{grandTotalConcejales}</h3>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <Users className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                {factionsArray.map((faction) => (
                                    <Card key={faction.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200/60 shadow-sm">
                                        <div className={`h-1.5 w-full ${faction.color}`} />
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                    <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800`}>
                                                        {faction.icon}
                                                    </div>
                                                    {faction.data.nombre}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 relative overflow-hidden group">
                                                    <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-full ${faction.textColor}`} />
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Candidaturas Intendencia</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={`text-3xl font-bold ${faction.textColor}`}>
                                                            {faction.data.intendentes.electos}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">ganadas</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Votos: {faction.data.intendentes.votos.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 relative overflow-hidden group">
                                                    <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-full ${faction.textColor}`} />
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Bancas Junta Municipal</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={`text-3xl font-bold ${faction.textColor}`}>
                                                            {faction.data.concejales.electos}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">ganadas</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Votos: {faction.data.concejales.votos.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Votos Retenidos (Fuerza Real)</span>
                                                <span className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                                    {(faction.data.intendentes.votos + faction.data.concejales.votos).toLocaleString()}
                                                    <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="config" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Los Elegidos (Candidatos Electos)</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Aquí solo aparecen quienes ganaron matemáticamente la candidatura o banca por su distrito. Asigna a qué frente responden actualmente.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {Object.keys(distritoData).length === 0 && (
                                    <Button onClick={fetchAllDistritos} disabled={isLoadingData} variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                                        {isLoadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
                                        Procesar Ganadores
                                    </Button>
                                )}
                                <Button onClick={handleSaveMappings} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Guardar Configuración
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(distritoData).length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    Haz clic en "Procesar Ganadores" para correr el algoritmo D'Hondt y ver la lista filtrada.
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {DISTRITOS_ALTO_PARANA.map(dist => {
                                        const distData = distritoData[dist.id];
                                        if (!distData) return null;

                                        const intendente = distData.intendente;
                                        const junta = distData.junta || [];

                                        if (!intendente && junta.length === 0) return null;

                                        return (
                                            <div key={dist.id} className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                                                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                                    <div className="w-3 h-8 bg-amber-500 rounded-full" />
                                                    {dist.nombre} 
                                                    <span className="text-sm font-normal text-slate-500 ml-2">({distData.bancasDefault} bancas totales)</span>
                                                </h3>
                                                
                                                {/* Intendente Electo */}
                                                {intendente && (
                                                    <div className="mb-8">
                                                        <h4 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                            <UserCheck className="w-5 h-5 text-indigo-600" />
                                                            Candidato Electo a Intendente
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                            {(() => {
                                                                const cand = intendente;
                                                                const key = `int-${dist.id}-${cand.numLista}-${cand.ordCandidato}`;
                                                                const currentValue = mappings[key] || getFallbackFaction(cand.numLista);
                                                                
                                                                return (
                                                                    <div key={key} className="flex flex-col bg-white border border-indigo-100 shadow-md p-4 rounded-xl gap-3 relative overflow-hidden ring-1 ring-indigo-500/20">
                                                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-bl-full" />
                                                                        <div className="flex justify-between items-start gap-2">
                                                                            <div>
                                                                                <Badge className="mb-2 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">Lista {cand.numLista}</Badge>
                                                                                <p className="font-bold text-slate-800 line-clamp-2 leading-tight text-lg">
                                                                                    {cand.nomCandidato || cand.desPartido}
                                                                                </p>
                                                                                <p className="text-sm font-medium text-slate-500 mt-1">
                                                                                    {Number(cand.votos).toLocaleString()} votos (Ganador)
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <Select value={currentValue} onValueChange={(val) => updateMapping(key, val)}>
                                                                            <SelectTrigger className="w-full">
                                                                                <SelectValue placeholder="Seleccionar frente" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="zacarias">Zacarías (2A)</SelectItem>
                                                                                <SelectItem value="landy">Landy (2R)</SelectItem>
                                                                                <SelectItem value="consenso">Consenso (2)</SelectItem>
                                                                                <SelectItem value="otras">Otras Listas HC</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Concejales Electos */}
                                                {junta.length > 0 && (
                                                    <div>
                                                        <h4 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                            <Users className="w-5 h-5 text-indigo-600" />
                                                            Concejales Electos (Bancas asignadas a HC)
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                            {junta.map((pref: any) => {
                                                                const key = `jun-${dist.id}-${pref.numLista}-${pref.ordCandidato}`;
                                                                const currentValue = mappings[key] || getFallbackFaction(pref.numLista);

                                                                return (
                                                                    <div key={key} className="flex flex-col justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
                                                                        <div className="flex items-start gap-3 mb-3">
                                                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm border border-slate-300">
                                                                                {pref.ordCandidato}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-bold text-slate-800 text-sm leading-tight" title={pref.nomCandidato}>
                                                                                    {pref.nomCandidato || `Concejal Opción ${pref.ordCandidato}`}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 bg-slate-50">L-{pref.numLista}</Badge>
                                                                                    <p className="text-xs font-medium text-slate-500">
                                                                                        {Number(pref.votos).toLocaleString()} votos pref.
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Select value={currentValue} onValueChange={(val) => updateMapping(key, val)}>
                                                                            <SelectTrigger className="w-full h-8 text-xs">
                                                                                <SelectValue placeholder="Frente actual" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="zacarias">Zacarías (2A)</SelectItem>
                                                                                <SelectItem value="landy">Landy (2R)</SelectItem>
                                                                                <SelectItem value="consenso">Consenso (2)</SelectItem>
                                                                                <SelectItem value="otras">Otras Listas HC</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
