'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import * as fflate from 'fflate';
import { Wand2, Database, Camera, Code, AlertCircle, MapPin, Briefcase, Loader2, History } from 'lucide-react';
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
    const [moldesRemote, setMoldesRemote] = useState<any>({});
    const [isSynced, setIsSynced] = useState(false);
    const [depto, setDepto] = useState<string>('CENTRAL');
    const [cargo, setCargo] = useState<'INTENDENTE' | 'JUNTA'>('INTENDENTE');
    const [manualOffset, setManualOffset] = useState<number>(0);
    const [procesado, setProcesado] = useState<ResultadoProcesamiento | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    
    const listasCentral = [510, 520, 530, 540, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 710, 720];

    useEffect(() => {
        if (!db) return;
        loadElectoralConfig(db).then(config => {
            setMoldesRemote(config);
            setIsSynced(true);
        });
    }, [db]);

    const qrInstance = useRef<any>(null);
    const isStarting = useRef(false);

    const stopCamera = async () => {
        if (qrInstance.current && qrInstance.current.isScanning) {
            await qrInstance.current.stop();
        }
    };

    const startCamera = async () => {
        if (isStarting.current) return;
        isStarting.current = true;

        try {
            if (qrInstance.current) {
                try {
                    if (qrInstance.current.isScanning) await qrInstance.current.stop();
                    qrInstance.current.clear();
                } catch (e) {}
                qrInstance.current = null;
            }

            const container = document.getElementById("reader");
            if (container) container.innerHTML = "";

            setCapturedImage(null);
            setScanResult('');
            setDecodedData(null);
            setProcesado(null);
            setError(null);

            const { Html5Qrcode } = await import('html5-qrcode');
            const newInstance = new Html5Qrcode("reader");
            qrInstance.current = newInstance;
            
            await newInstance.start(
                { facingMode: "environment" }, 
                { fps: 15, qrbox: { width: 250, height: 250 } },
                (result: string) => {
                    setScanResult(result);
                    processHex(result);
                },
                () => { /* ignore */ }
            );
        } catch (err) {
            console.error("Scanner error:", err);
        } finally {
            isStarting.current = false;
        }
    };

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera().catch(() => {});
        };
    }, [depto, cargo, db]); 

    const processHex = (hex: string) => {
        try {
            setError(null);
            if (!hex) return;
            
            let bytes: Uint8Array;
            const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
            if (cleanHex.length >= 10 && cleanHex.length % 2 === 0) {
                const match = cleanHex.match(/.{1,2}/g);
                bytes = new Uint8Array(match!.map(byte => parseInt(byte, 16)));
            } else {
                try {
                    const binaryString = atob(hex);
                    bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                } catch (e) {
                    throw new Error("El formato del QR no es HEX ni Base64 válido.");
                }
            }
            
            let finalArray: number[] = [];
            let zlibOffset = -1;
            for (let i = 0; i < bytes.length - 1; i++) {
                if (bytes[i] === 0x78 && (bytes[i+1] === 0x9C || bytes[i+1] === 0x01)) {
                    zlibOffset = i;
                    break;
                }
            }

            if (zlibOffset !== -1) {
                console.log("Descomprimiendo Zlib en Laboratorio...");
                const compressedData = bytes.slice(zlibOffset);
                const decompressed = fflate.unzlibSync(compressedData);
                finalArray = Array.from(decompressed);
            } else {
                console.log("Usando Raw Bytes en Laboratorio (No detectada compresión)");
                finalArray = Array.from(bytes);
            }
            
            setDecodedData(finalArray);

            const resultado = procesarQRARKI(finalArray, depto, cargo, manualOffset);
            setProcesado(resultado);
            
            if (!resultado.validado && resultado.error) setError(resultado.error);
        } catch (e: any) {
            setError(e.message);
            setDecodedData(null);
            setProcesado(null);
        }
    };

    useEffect(() => {
        if (hexInput || scanResult) processHex(hexInput || scanResult);
    }, [depto, cargo, manualOffset]);

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
                                {['CENTRAL', 'CAPITAL'].map(d => (
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
                <div className="lg:col-span-4 space-y-6">
                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b py-3 px-4">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-500">
                                <Camera className="w-3.5 h-3.5"/> Captura de Datos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-3">
                                <div className="rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 relative min-h-[300px] flex items-center justify-center">
                                    <div id="reader" className={`w-full h-full absolute inset-0 ${capturedImage ? 'hidden' : 'block'}`}></div>
                                    {capturedImage && (
                                        <img src={capturedImage} alt="Captura" className="w-full h-full object-contain absolute inset-0 z-20 bg-black" />
                                    )}
                                    {!scanResult && !capturedImage && (
                                        <div className="text-center p-6 z-10 pointer-events-none">
                                            <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Iniciando cámara...</p>
                                        </div>
                                    )}
                                </div>

                                {!capturedImage ? (
                                    <Button 
                                        onClick={async () => {
                                            const video = document.querySelector('#reader video') as HTMLVideoElement;
                                            if (video && qrInstance.current) {
                                                const canvas = document.createElement('canvas');
                                                canvas.width = video.videoWidth;
                                                canvas.height = video.videoHeight;
                                                const ctx = canvas.getContext('2d');
                                                ctx?.drawImage(video, 0, 0);
                                                const dataUrl = canvas.toDataURL('image/webp');
                                                setCapturedImage(dataUrl);
                                                await stopCamera();
                                                try {
                                                    const result = await qrInstance.current.scanFile(canvas as any, false);
                                                    setScanResult(result);
                                                    processHex(result);
                                                } catch (err) {
                                                    setError("No se detectó un código QR claro en la foto.");
                                                }
                                            }
                                        }}
                                        className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-black text-lg gap-2"
                                    >
                                        <Camera className="w-6 h-6" />
                                        CAPTURAR QR
                                    </Button>
                                ) : (
                                    <Button 
                                        onClick={() => startCamera()}
                                        variant="outline"
                                        className="w-full h-14 border-2 border-slate-200 text-slate-600 font-black text-lg gap-2"
                                    >
                                        <History className="w-6 h-6" />
                                        REINTENTAR CAPTURA
                                    </Button>
                                )}
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Entrada HEX Manual</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={hexInput} 
                                            onChange={(e) => { setHexInput(e.target.value); processHex(e.target.value); }} 
                                            placeholder="0x1C..." 
                                            className="font-mono text-[11px] h-10 border-slate-200" 
                                        />
                                        <Button 
                                            onClick={() => {
                                                const testHex = "1C0000000000000000000000000000789c63646260606066000000060000";
                                                setHexInput(testHex);
                                                processHex(testHex);
                                            }}
                                            size="icon"
                                            className="shrink-0 bg-purple-600"
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

                <div className="lg:col-span-8 space-y-6">
                    <Card className="bg-slate-950 text-slate-300 border-slate-800 shadow-2xl min-h-[600px] flex flex-col">
                        <CardHeader className="border-b border-slate-800/50 py-4 px-6 bg-slate-900/50">
                            <CardTitle className="text-sm flex items-center justify-between text-white font-bold">
                                <div className="flex items-center gap-2">
                                    <Code className="w-4 h-4 text-purple-400" />
                                    Terminal de Decodificación Inversa
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 font-mono">
                                        OFFSET: {procesado?.votos.length || 0}
                                    </Badge>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="p-6 flex-1 space-y-8">
                            {error && (
                                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0"/> 
                                    <span className="font-bold">KERNEL ERROR:</span> {error}
                                </div>
                            )}

                            {decodedData && procesado && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                Secuencia Bruta (Análisis de Bytes)
                                            </div>
                                            <span className="text-slate-600 font-mono">LEN: {decodedData.length}</span>
                                        </h4>
                                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                                    <Wand2 className="w-4 h-4"/>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-500">Calibración de Offset</p>
                                                    <p className="text-xs font-bold text-white">Salto de Cabecera: {manualOffset} bytes</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setManualOffset(prev => Math.max(0, prev - 1))}
                                                    className="h-8 w-8 p-0 border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                                                >
                                                    -1
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setManualOffset(prev => prev + 1)}
                                                    className="h-8 w-8 p-0 border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                                                >
                                                    +1
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setManualOffset(0)}
                                                    className="px-3 h-8 border-slate-700 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black"
                                                >
                                                    RESET
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                                            <h5 className="text-[10px] font-black text-yellow-600 uppercase flex items-center gap-2">
                                                <AlertCircle className="w-3 h-3"/> Radar de Valores No-Cero
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                                {decodedData.map((byte, idx) => byte > 0 ? (
                                                    <Badge key={idx} variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-500 font-mono text-[10px]">
                                                        [{idx}]: {byte}
                                                    </Badge>
                                                ) : null)}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-black/80 rounded-xl border border-slate-800 font-mono text-[10px] grid grid-cols-10 md:grid-cols-20 gap-1 max-h-64 overflow-y-auto shadow-inner">
                                            {decodedData.map((byte, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`flex flex-col items-center p-1 rounded ${byte > 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'opacity-30'}`}
                                                    title={`Index: ${idx}`}
                                                >
                                                    <span className="text-[8px] text-slate-600 mb-0.5">{idx}</span>
                                                    <span className={`font-bold ${byte > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{byte}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 flex items-center gap-2">
                                            <Wand2 className="w-3.5 h-3.5 text-blue-400"/> 
                                            Mapeo de Votos: {cargo} - {depto}
                                        </h4>
                                        
                                        {cargo === 'INTENDENTE' ? (
                                            <div className="space-y-2">
                                                {procesado.votos.map((v, i) => (
                                                    <div key={v.id || i} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:bg-slate-900 transition-all group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-xs font-black text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                                                                {v.nombre.split(' ')[1] || v.id}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">PARTIDO</span>
                                                                <span className="text-xs font-bold text-slate-300 group-hover:text-white">{v.nombre}</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-white text-xl tabular-nums">
                                                            {v.votos || 0}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-black/30">
                                                <table className="w-full text-[9px] border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-900">
                                                            <th className="p-2 border-b border-slate-800 text-left w-12">LISTA</th>
                                                            {Array.from({length: 24}).map((_, i) => (
                                                                <th key={i} className="p-1 border-b border-slate-800 text-center w-6">{i+1}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {listasCentral.map((num, lIdx) => (
                                                            <tr key={num} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                                                <td className="p-2 font-black text-purple-400 bg-slate-900/50">{num}</td>
                                                                {Array.from({length: 24}).map((_, cIdx) => {
                                                                    const v = procesado.votos[lIdx * 24 + cIdx];
                                                                    return (
                                                                        <td key={cIdx} className={`p-1 text-center border-r border-slate-800/30 ${v?.votos > 0 ? 'bg-blue-900/40 text-blue-300 font-bold' : 'text-slate-600'}`}>
                                                                            {v?.votos || 0}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
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
                                </div>
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
