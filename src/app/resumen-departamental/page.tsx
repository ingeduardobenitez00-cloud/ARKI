"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, BarChart3, TrendingUp, UserCheck, ChevronRight, FileDown } from 'lucide-react';
import { RESUMEN_DEPARTAMENTAL } from '@/data/resumen-departamental';

export default function ResumenDepartamentalPage() {
    const factions = [
        { id: 'zacarias', data: RESUMEN_DEPARTAMENTAL.zacarias, color: 'bg-red-600', textColor: 'text-red-600', icon: <TrendingUp className="w-5 h-5 text-red-600" /> },
        { id: 'landy', data: RESUMEN_DEPARTAMENTAL.landy, color: 'bg-blue-600', textColor: 'text-blue-600', icon: <TrendingUp className="w-5 h-5 text-blue-600" /> },
        { id: 'consenso', data: RESUMEN_DEPARTAMENTAL.consenso, color: 'bg-green-600', textColor: 'text-green-600', icon: <UserCheck className="w-5 h-5 text-green-600" /> },
        { id: 'otras', data: RESUMEN_DEPARTAMENTAL.otras, color: 'bg-slate-600', textColor: 'text-slate-600', icon: <Users className="w-5 h-5 text-slate-600" /> },
    ];

    const totalIntendentes = factions.reduce((acc, curr) => acc + curr.data.intendentes.candidatos, 0);
    const totalConcejales = factions.reduce((acc, curr) => acc + curr.data.concejales.candidatos, 0);
    const totalVotos = factions.reduce((acc, curr) => acc + curr.data.intendentes.votos + curr.data.concejales.votos, 0);

    const exportToWord = () => {
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Resumen Departamental</title>
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
            <p style="text-align: center; font-size: 14px; color: #555;">Análisis de fuerzas políticas (Elecciones Internas)</p>
            <hr />
            <h2>Balance General</h2>
            <ul>
                <li><b>Total Candidatos (Intendencia + Junta):</b> ${totalIntendentes + totalConcejales}</li>
                <li><b>Total Votos Analizados:</b> ${totalVotos.toLocaleString()}</li>
            </ul>
        `;

        factions.forEach(faction => {
            content += `
                <div class="faction-title">${faction.data.nombre}</div>
                <table>
                    <tr><th>Cargo</th><th>Precandidatos</th><th>Votos Totales</th></tr>
                    <tr>
                        <td>Intendencia</td>
                        <td>${faction.data.intendentes.candidatos}</td>
                        <td>${faction.data.intendentes.votos.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Junta Municipal</td>
                        <td>${faction.data.concejales.candidatos}</td>
                        <td>${faction.data.concejales.votos.toLocaleString()}</td>
                    </tr>
                    <tr style="background-color: #f9f9f9; font-weight: bold;">
                        <td colspan="2">Total Votos Fricción</td>
                        <td>${(faction.data.intendentes.votos + faction.data.concejales.votos).toLocaleString()}</td>
                    </tr>
                </table>
            `;
        });

        const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Resumen_Departamental_Alto_Parana.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        Resumen Departamental
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Análisis de fuerzas políticas en Alto Paraná (Elecciones Internas)
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <Badge variant="outline" className="px-3 py-1 text-sm bg-indigo-50 text-indigo-700 border-indigo-200">
                        {totalVotos.toLocaleString()} Votos Totales Analizados
                    </Badge>
                    <Button variant="outline" onClick={exportToWord} className="flex items-center gap-2">
                        <FileDown className="w-4 h-4" />
                        Exportar a Word
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-300 font-medium">Total Candidatos</p>
                                <h3 className="text-4xl font-bold mt-2">{totalIntendentes + totalConcejales}</h3>
                            </div>
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-0 shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-indigo-100 font-medium">Precandidatos Intendentes</p>
                                <h3 className="text-4xl font-bold mt-2">{totalIntendentes}</h3>
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
                                <p className="text-blue-100 font-medium">Precandidatos Concejales</p>
                                <h3 className="text-4xl font-bold mt-2">{totalConcejales}</h3>
                            </div>
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {factions.map((faction) => (
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
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Intendencia</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-2xl font-bold ${faction.textColor}`}>
                                            {faction.data.intendentes.votos.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">votos</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {faction.data.intendentes.candidatos} precandidatos
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 relative overflow-hidden group">
                                    <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-full ${faction.textColor}`} />
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Junta Municipal</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-2xl font-bold ${faction.textColor}`}>
                                            {faction.data.concejales.votos.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">votos</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {faction.data.concejales.candidatos} precandidatos
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Votos Fricción</span>
                                <span className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                    {(faction.data.intendentes.votos + faction.data.concejales.votos).toLocaleString()}
                                    <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
