'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import * as fflate from 'fflate';
import { Wand2, Database, Camera, Code, AlertCircle, MapPin, Briefcase, Loader2 } from 'lucide-react';
import { INTENDENTE_CANDIDATES, getJuntaOptions } from '@/data/electoral-metadata';
import { MOLDES_ARKI, getMolde } from '@/lib/electoral-config';
import { procesarQRARKI, ResultadoProcesamiento } from '@/lib/qr-processor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { loadElectoralConfig } from '@/services/config-service';

export default function QRLaboratoryPage() {
    const db = useFirestore();
    const [scanResult, setScanResult] = useState<string>('');
    const [hexInput, setHexInput] = useState<string>('');
    const [decodedData, setDecodedData] = useState<number[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Configuración Dinámica
    const [moldesRemote, setMoldesRemote] = useState<any>(MOLDES_ARKI);
    const [isSynced, setIsSynced] = useState(false);
    const [depto, setDepto] = useState<string>('CAPITAL');
    const [cargo, setCargo] = useState<'INTENDENTE' | 'JUNTA'>('INTENDENTE');
    const [procesado, setProcesado] = useState<ResultadoProcesamiento | null>(null);
    
    // Cargar configuración desde Firebase al iniciar
    useEffect(() => {
        if (!db) return;
        loadElectoralConfig(db).then(config => {
            setMoldesRemote(config);
            setIsSynced(true);
        });
    }, [db]);

    useEffect(() => {
        let scanner: any = null;
        
        const initScanner = async () => {
            const { Html5QrcodeScanner } = await import('html5-qrcode');
            scanner = new Html5QrcodeScanner('reader', { 
                fps: 10, 
                qrbox: { width: 250, height: 250 } 
            }, false);

            scanner.render(
                (result: string) => {
                    setScanResult(result);
                    processHex(result);
                },
                (err: any) => { /* ignore */ }
            );
        };

        initScanner();

        return () => {
            if (scanner) {
                scanner.clear().catch(console.error);
            }
        };
    }, [depto, cargo]); // Re-init on config change if needed

    const processHex = (hex: string) => {
        try {
            setError(null);
            const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
            if (cleanHex.length < 30) throw new Error("HEX demasiado corto para ser un acta válida");

            const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const compressedData = bytes.slice(15);
            const decompressed = fflate.unzlibSync(compressedData);
            const fullArray = Array.from(decompressed);
            setDecodedData(fullArray);

            // Aplicar Procesamiento Dinámico (Bottom-Up)
            const resultado = procesarQRARKI(fullArray, depto, cargo);
            setProcesado(resultado);
            
            if (!resultado.validado && resultado.error) {
                setError(resultado.error);
            }
        } catch (e: any) {
            setError(e.message);
            setDecodedData(null);
            setProcesado(null);
        }
    };

    // Auto-reprocesar cuando cambie el depto o cargo si hay datos
    useEffect(() => {
        if (hexInput || scanResult) {
            processHex(hexInput || scanResult);
        }
    }, [depto, cargo]);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 rounded-lg text-white font-black italic shadow-lg shadow-purple-500/20">ARKI</div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laboratorio QR Dinámico</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Database className="w-3 h-3"/> Ingeniería Inversa & Factory Pattern
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 bg-slate-100 p-1.5 rounded-xl border">
                    <div className="w-40">
                        <Select value={depto} onValueChange={setDepto}>
                            <SelectTrigger className="h-9 bg-white border-none shadow-sm text-xs font-bold">
                                <MapPin className="w-3 h-3 mr-2 text-purple-600"/>
                                <SelectValue placeholder="Depto" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(moldesRemote).map(d => (
                                    <SelectItem key={d} value={d} className="text-xs font-bold">{d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center px-3 border-l text-[10px] font-black uppercase text-slate-400 gap-2">
                        {isSynced ? (
                            <><div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div> Cloud</>
                        ) : (
                            <><Loader2 className="w-3 h-3 animate-spin"/> Local</>
                        )}
                    </div>
                    <div className="w-40">
                        <Select value={cargo} onValueChange={(v: any) => setCargo(v)}>
                            <SelectTrigger className="h-9 bg-white border-none shadow-sm text-xs font-bold">
                                <Briefcase className="w-3 h-3 mr-2 text-blue-600"/>
                                <SelectValue placeholder="Cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="INTENDENTE" className="text-xs font-bold">INTENDENTE</SelectItem>
                                <SelectItem value="JUNTA" className="text-xs font-bold">JUNTA MUNICIPAL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Escáner y Entrada */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b py-3 px-4">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-500">
                                <Camera className="w-3.5 h-3.5"/> Captura de Datos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-3">
                                <div id="reader" className="rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 aspect-square flex items-center justify-center relative">
                                    {!scanResult && (
                                        <div className="text-center p-6">
                                            <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Escáner no iniciado</p>
                                        </div>
                                    )}
                                </div>
                                <Button 
                                    onClick={() => {
                                        // Esto forzará un re-render o activación si el scanner está en el DOM
                                        window.location.reload(); 
                                    }}
                                    variant="outline" 
                                    className="w-full text-[10px] font-black h-8 bg-slate-50"
                                >
                                    REINICIAR MOTOR DE CÁMARA
                                </Button>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Entrada HEX Manual</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={hexInput} 
                                            onChange={(e) => { setHexInput(e.target.value); processHex(e.target.value); }} 
                                            placeholder="0x1C..." 
                                            className="font-mono text-[11px] h-10 border-slate-200 focus:ring-purple-500" 
                                        />
                                        <Button 
                                            onClick={() => {
                                                const testHex = "1C0000000000000000000000000000789c63646260606066000000060000"; // Dummy test
                                                setHexInput(testHex);
                                                processHex(testHex);
                                            }}
                                            size="icon"
                                            className="shrink-0 bg-purple-600 hover:bg-purple-700"
                                            title="Inyectar HEX de Prueba"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {procesado && (
                        <Card className={`border-2 ${procesado.validado ? 'border-green-500 bg-green-50/30' : 'border-red-500 bg-red-50/30'}`}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${procesado.validado ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        <Code className="w-4 h-4"/>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-slate-500">Estado de Validación</p>
                                        <p className={`text-xs font-black ${procesado.validado ? 'text-green-700' : 'text-red-700'}`}>
                                            {procesado.validado ? 'ANCLAJE CORRECTO (TOT OK)' : 'ERROR DE INTEGRIDAD'}
                                        </p>
                                    </div>
                                </div>
                                <Badge className={procesado.validado ? 'bg-green-600' : 'bg-red-600'}>
                                    {procesado.cierre.tot} Votos
                                </Badge>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Columna Derecha: Decodificación y Mapeo */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="bg-slate-950 text-slate-300 border-slate-800 shadow-2xl min-h-[600px] flex flex-col">
                        <CardHeader className="border-b border-slate-800/50 py-4 px-6 bg-slate-900/50">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white font-bold">
                                    <Code className="w-4 h-4 text-purple-400" />
                                    Terminal de Decodificación Inversa
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 font-mono">
                                        OFFSET: {procesado?.votos.length || 0}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] border-slate-700 text-purple-400 font-mono">
                                        MOLDE: {depto}
                                    </Badge>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="p-6 flex-1 space-y-8">
                            {error && (
                                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs flex items-center gap-2 animate-pulse">
                                    <AlertCircle className="w-4 h-4 shrink-0"/> 
                                    <span className="font-bold">KERNEL ERROR:</span> {error}
                                </div>
                            )}

                            {!decodedData && !error && (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                                    <Wand2 className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-xs italic font-medium">Escaneando firma digital (0x1C)...</p>
                                </div>
                            )}
                            
                            {decodedData && procesado && (
                                <>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></div>
                                                Secuencia Bruta (ZLIB Decompressed)
                                            </h4>
                                            <span className="text-[10px] font-mono text-slate-600">LEN: {decodedData.length} B</span>
                                        </div>
                                        <div className="p-4 bg-black/50 rounded-xl border border-slate-800 font-mono text-[10px] break-all max-h-32 overflow-y-auto leading-relaxed text-slate-400 shadow-inner">
                                            {decodedData.join(', ')}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center gap-2">
                                            <Wand2 className="w-3.5 h-3.5 text-blue-400"/> 
                                            Mapeo de Votos: {cargo} - {depto}
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Aquí mapeamos según el cargo y el depto */}
                                            {cargo === 'INTENDENTE' && depto === 'CAPITAL' ? (
                                                <div className="col-span-full space-y-2">
                                                    {INTENDENTE_CANDIDATES.map((c, i) => (
                                                        <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-900/50 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:text-white transition-colors">
                                                                    {c.list}
                                                                </div>
                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200">{c.name}</span>
                                                            </div>
                                                            <span className="font-black text-white text-sm tabular-nums">{procesado.votos[i] || 0}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="col-span-full p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800/50 border-dashed">
                                                    <p className="text-xs text-slate-500 italic">
                                                        Visualización genérica para {depto}. 
                                                        Los {procesado.votos.length} campos se mapearán a los candidatos de {depto} una vez cargada la metadata.
                                                    </p>
                                                    <div className="mt-4 flex flex-wrap gap-1 justify-center">
                                                        {procesado.votos.map((v, i) => (
                                                            <div key={i} className={`w-8 h-8 flex items-center justify-center rounded text-[10px] font-mono border ${v > 0 ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                                                {v}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="text-center">
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">NULOS</p>
                                                    <p className="text-lg font-black text-white">{procesado.cierre.nul}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">BLANCOS</p>
                                                    <p className="text-lg font-black text-white">{procesado.cierre.blc}</p>
                                                </div>
                                                <div className="text-center border-x border-slate-800">
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">VACIOS</p>
                                                    <p className="text-lg font-black text-white">{procesado.cierre.vac}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[9px] font-bold text-purple-400 uppercase">TOTAL (TOT)</p>
                                                    <p className="text-lg font-black text-purple-400">{procesado.cierre.tot}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>

                        <div className="p-4 bg-slate-900/80 border-t border-slate-800/50 backdrop-blur-sm">
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-600">
                                <span>BUILD: ARKI_v1.0.8_DYNAMIC</span>
                                <span className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                    SISTEMA OPERATIVO
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

