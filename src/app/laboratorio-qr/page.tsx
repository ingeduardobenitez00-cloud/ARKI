'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import * as fflate from 'fflate';
import { Wand2, Database, Camera, Code, AlertCircle } from 'lucide-react';
import { INTENDENTE_CANDIDATES } from '@/data/electoral-metadata';

export default function QRLaboratoryPage() {
    const [scanResult, setScanResult] = useState<string>('');
    const [hexInput, setHexInput] = useState<string>('');
    const [decodedData, setDecodedData] = useState<number[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'INT' | 'JUN'>('INT');
    
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
    }, []);

    const processHex = (hex: string) => {
        try {
            setError(null);
            const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
            if (cleanHex.length < 30) throw new Error("HEX corto");

            const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const compressedData = bytes.slice(15);
            const decompressed = fflate.unzlibSync(compressedData);
            setDecodedData(Array.from(decompressed));
        } catch (e: any) {
            setError(e.message);
            setDecodedData(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
                <div className="p-2 bg-purple-600 rounded-lg text-white font-black italic">AGY</div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Laboratorio QR MSA</h1>
                    <p className="text-sm text-muted-foreground">Módulo de Ingeniería Inversa y Pruebas</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Camera className="w-4 h-4"/> Escáner en Vivo</CardTitle></CardHeader>
                    <CardContent>
                        <div id="reader" className="rounded-lg border overflow-hidden"></div>
                        <div className="mt-4 space-y-2">
                            <label className="text-[10px] font-bold uppercase">Entrada Hexadecimal Manual</label>
                            <Input 
                                value={hexInput} 
                                onChange={(e) => { setHexInput(e.target.value); processHex(e.target.value); }} 
                                placeholder="Pega el HEX aquí..." 
                                className="font-mono text-xs" 
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 text-green-400 border-green-900/50 shadow-xl shadow-green-900/10">
                    <CardHeader className="border-b border-green-900/20">
                        <CardTitle className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4" />
                                Bytes Traducidos
                            </div>
                            {decodedData && <Badge variant="outline" className="text-green-400 border-green-400 animate-pulse">ACTIVO</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                        {error && <div className="text-red-400 text-xs p-2 bg-red-950/50 rounded flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>}
                        {!decodedData && !error && <p className="text-xs text-slate-600 italic">Esperando datos del escáner...</p>}
                        
                        {decodedData && (
                            <>
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Secuencia Decimal</h4>
                                    <div className="p-3 bg-black rounded border border-green-900/30 font-mono text-[10px] break-all max-h-32 overflow-y-auto leading-relaxed">
                                        {decodedData.join(', ')}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-white uppercase border-b border-green-900/20 pb-1 flex items-center gap-2">
                                        <Wand2 className="w-3 h-3"/> Mapeo Intendente
                                    </h4>
                                    <div className="space-y-2">
                                        {INTENDENTE_CANDIDATES.map((c, i) => (
                                            <div key={c.id} className="flex justify-between text-[11px] border-b border-green-900/10 pb-1">
                                                <span className="text-slate-400">Lista {c.list}:</span>
                                                <span className="font-bold text-white">{decodedData[i] || 0}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 p-3 bg-green-900/10 rounded border border-green-900/20">
                                        <div className="flex justify-between font-bold text-white text-xs">
                                            <span>NUL / BLC / VAC / TOT:</span>
                                            <span className="text-green-400">{decodedData.slice(-4).join(' / ')}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
