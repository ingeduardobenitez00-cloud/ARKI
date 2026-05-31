"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
    FileSpreadsheet, 
    UploadCloud, 
    CheckCircle2, 
    AlertTriangle, 
    Loader2, 
    Lock,
    Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import * as XLSX from 'xlsx';

const COLLECTION_PADRON = 'sheet1';

interface LogEntry {
    type: 'success' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
}

export default function CompararPadronPage() {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAuthorized = useMemo(() => {
        if (!user) return false;
        return ['Super-Admin', 'Admin', 'Presidente', 'Coordinador', 'Dirigente'].includes(user.role);
    }, [user]);

    const [file, setFile] = useState<File | null>(null);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [mapping, setMapping] = useState({ cedula: '' });
    const [dirigenteNombre, setDirigenteNombre] = useState('');
    const [nameFormat, setNameFormat] = useState<'none' | 'together' | 'separated'>('separated');
    
    const [fetchedElectors, setFetchedElectors] = useState<Record<string, any>>({});
    
    const [status, setStatus] = useState<'idle' | 'reading' | 'checking' | 'mapping' | 'done' | 'error'>('idle');
    const [isDragging, setIsDragging] = useState(false);
    
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (type: LogEntry['type'], message: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { type, message, timestamp: time }]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            validateAndProcessFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndProcessFile(selectedFile);
        }
    };

    const validateAndProcessFile = (selectedFile: File) => {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        if (fileExt !== 'xlsx' && fileExt !== 'xls') {
            toast({
                title: "Formato no soportado",
                description: "Por favor carga un archivo Excel con extensión .xlsx o .xls",
                variant: "destructive"
            });
            return;
        }

        setFile(selectedFile);
        setStatus('reading');
        setLogs([]);
        setFetchedElectors({});
        addLog('info', `Leyendo archivo: ${selectedFile.name}...`);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const bstr = event.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

                if (jsonData.length === 0) {
                    addLog('error', 'El archivo Excel está vacío.');
                    setStatus('error');
                    toast({
                        title: "Archivo vacío",
                        description: "El archivo cargado no contiene registros.",
                        variant: "destructive"
                    });
                    return;
                }

                addLog('success', `Lectura completada. Se detectaron ${jsonData.length} filas en la hoja "${firstSheetName}".`);
                
                const detectedHeaders = Object.keys(jsonData[0] as object);
                setColumns(detectedHeaders);
                setSheetData(jsonData);

                const detectedCedula = detectedHeaders.find(h => {
                    const normalized = h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return ['CEDULA', 'CI', 'C.I.', 'C.I', 'DOCUMENTO', 'NRO_CEDULA', 'NRO CEDULA', 'CEDULA IDENTIDAD'].includes(normalized);
                }) || "";

                setMapping({
                    cedula: detectedCedula,
                });

                if (detectedCedula) {
                    addLog('info', `Columna de cédula detectada: "${detectedCedula}"`);
                    await runPreChecking(jsonData, detectedCedula);
                } else {
                    addLog('warn', 'No se pudo detectar automáticamente la columna de Cédula. Por favor, asígnala manualmente.');
                    setStatus('mapping');
                }
            } catch (err) {
                console.error(err);
                addLog('error', 'Error al procesar la estructura del Excel.');
                setStatus('error');
            }
        };

        reader.onerror = () => {
            addLog('error', 'Error al leer el archivo físico.');
            setStatus('error');
        };

        reader.readAsBinaryString(selectedFile);
    };

    const runPreChecking = async (data: any[], cedulaColumn: string) => {
        if (!db) return;
        setStatus('checking');
        addLog('info', '🔍 Consultando estado de los electores en el Padrón Nacional (Firestore)...');
        
        const tempFetched: Record<string, any> = {};
        let notFound = 0;
        const total = data.length;
        
        const allCedulas = data.map(row => {
            const rawCed = row[cedulaColumn];
            if (rawCed === undefined || rawCed === null) return null;
            const cedStr = String(rawCed).replace(/\D/g, '');
            return cedStr || null;
        });

        const batchSize = 30;
        for (let i = 0; i < total; i += batchSize) {
            const chunkCedulas = allCedulas.slice(i, i + batchSize).filter(Boolean) as string[];
            
            if (chunkCedulas.length > 0) {
                const uniqueCedulas = Array.from(new Set(chunkCedulas));
                
                const numCedulas = uniqueCedulas.map(c => Number(c));
                try {
                    const qNum = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', numCedulas));
                    const snapNum = await getDocs(qNum);
                    snapNum.forEach(docSnap => {
                        const d = docSnap.data();
                        const ced = String(d.CEDULA).replace(/\D/g, '');
                        tempFetched[ced] = { id: docSnap.id, ...d };
                    });
                } catch (e) {
                    console.error("Error en query numérica", e);
                }

                const remaining = uniqueCedulas.filter(c => !tempFetched[c]);
                if (remaining.length > 0) {
                    try {
                        const qStr = query(collection(db, COLLECTION_PADRON), where('CEDULA', 'in', remaining));
                        const snapStr = await getDocs(qStr);
                        snapStr.forEach(docSnap => {
                            const d = docSnap.data();
                            const ced = String(d.CEDULA).replace(/\D/g, '');
                            tempFetched[ced] = { id: docSnap.id, ...d };
                        });
                    } catch (e) {
                        console.error("Error en query string", e);
                    }
                }
            }

            const processed = Math.min(i + batchSize, total);
            setProgress(Math.round((processed / total) * 100));
        }

        for (let i = 0; i < total; i++) {
            const c = allCedulas[i];
            if (c) {
                if (!tempFetched[c]) {
                    tempFetched[c] = null;
                    notFound++;
                }
            } else {
                notFound++;
            }
        }

        setFetchedElectors(tempFetched);
        addLog('success', `Análisis de seccionales completado. Registrados en padrón: ${total - notFound} | No encontrados: ${notFound}`);
        setStatus('mapping');
    };

    const handleMappingChange = async (val: string) => {
        setMapping({ cedula: val });
        if (val && sheetData.length > 0) {
            await runPreChecking(sheetData, val);
        }
    };

    const processedData = useMemo(() => {
        if (!mapping.cedula || sheetData.length === 0) return [];
        
        const newData = [];
        const cedulaSet = new Set<string>();

        let countVacios = 0;
        let countRepetidos = 0;
        let countNoPadron = 0;
        let countValidos = 0;

        for (const row of sheetData) {
            const rawCed = row[mapping.cedula];
            let estado = "Válido";
            let seccional = "";
            let nombres = "";
            let apellidos = "";
            let nombreCompleto = "";
            let telefono = "";
            
            const cedulaStr = rawCed ? String(rawCed).replace(/\D/g, '') : '';
            
            if (!cedulaStr) {
                estado = "Campo Vacío";
                countVacios++;
            } else if (cedulaSet.has(cedulaStr)) {
                estado = "Repetido";
                countRepetidos++;
            } else {
                cedulaSet.add(cedulaStr);
                const elector = fetchedElectors[cedulaStr];
                if (!elector) {
                    estado = "No está en Padrón";
                    countNoPadron++;
                } else {
                    seccional = elector.CODIGO_SEC || "";
                    nombres = elector.NOMBRE || "";
                    apellidos = elector.APELLIDO || "";
                    nombreCompleto = `${nombres} ${apellidos}`.trim();
                    telefono = elector.TELEFONO || elector.TELEFONO_MIGRADO || "";
                    countValidos++;
                }
            }

            const rowData: any = { ...row };

            if (nameFormat === 'together') {
                rowData["Nombre Completo (Padrón)"] = nombreCompleto;
            } else if (nameFormat === 'separated') {
                rowData["Nombres (Padrón)"] = nombres;
                rowData["Apellidos (Padrón)"] = apellidos;
            }

            rowData["Estado"] = estado;
            rowData["Seccional"] = seccional;
            rowData["Teléfono (Padrón)"] = telefono;
            rowData["Dirigente"] = dirigenteNombre || "";

            newData.push(rowData);
        }
        
        return newData;
    }, [sheetData, mapping, fetchedElectors, dirigenteNombre, nameFormat]);

    const generateExcel = () => {
        if (!mapping.cedula) {
            toast({
                title: "Asignación incompleta",
                description: "Debes elegir qué columna corresponde a la Cédula.",
                variant: "destructive"
            });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(processedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
        
        XLSX.writeFile(workbook, `Comparacion_Padron_${new Date().getTime()}.xlsx`);
        
        toast({
            title: "Descarga exitosa",
            description: "El archivo Excel se ha generado y descargado correctamente."
        });
        
        setStatus('done');
    };

    const resetProcess = () => {
        setFile(null);
        setSheetData([]);
        setColumns([]);
        setMapping({ cedula: '' });
        setFetchedElectors({});
        setStatus('idle');
        setProgress(0);
        setLogs([]);
        setDirigenteNombre('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
                <Card className="w-full max-w-md border-red-200/50 shadow-2xl rounded-3xl overflow-hidden bg-white">
                    <div className="h-2 bg-red-600 w-full" />
                    <CardHeader className="text-center pt-8">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100">
                            <Lock className="h-8 w-8 stroke-[2.5]" />
                        </div>
                        <CardTitle className="text-xl font-black uppercase tracking-tight text-red-600 mt-4">Acceso Restringido</CardTitle>
                        <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400 mt-2">
                            Módulo de Administración Estratégica
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 text-center space-y-4">
                        <p className="text-slate-500 text-xs uppercase leading-relaxed font-semibold">
                            Este módulo está reservado exclusivamente para los roles autorizados:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {['Super-Admin', 'Admin', 'Presidente', 'Coordinador', 'Dirigente'].map(role => (
                                <Badge key={role} variant="destructive" className="bg-red-50 text-red-700 border-red-100 font-black text-[9px] uppercase px-3 py-1">
                                    {role}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                        Comparar con Padrón
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">
                        Compara un excel de electores con el Padrón Nacional sin modificar la base de datos.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm border-slate-200/60 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2 uppercase">
                            <UploadCloud className="h-4 w-4 text-blue-500" />
                            Carga de Archivo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {status === 'idle' || status === 'error' ? (
                            <div 
                                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50 bg-slate-50/50'}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                />
                                <div className="mx-auto h-16 w-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                    <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Arrastra tu Excel aquí</h3>
                                <p className="text-sm text-slate-500 mb-4">o haz clic para buscar en tu dispositivo</p>
                                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="font-bold">
                                    Seleccionar Archivo
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                    <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100 shrink-0">
                                        <FileSpreadsheet className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 truncate">{file?.name}</h4>
                                        <p className="text-xs text-slate-500 font-medium">{sheetData.length} registros detectados</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={resetProcess} className="text-slate-500 hover:text-red-600">
                                        Cambiar
                                    </Button>
                                </div>

                                {(status === 'mapping' || status === 'checking' || status === 'done') && (
                                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                                        <h3 className="font-bold text-sm uppercase text-slate-700 flex items-center gap-2">
                                            Mapeo de Columnas y Configuración
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Columna Cédula</label>
                                                <Select value={mapping.cedula} onValueChange={(val) => handleMappingChange(val)}>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Selecciona..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {columns.map(col => (
                                                            <SelectItem key={col} value={col}>{col}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Nombres del Padrón</label>
                                                <Select value={nameFormat} onValueChange={(val: any) => setNameFormat(val)}>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Selecciona formato" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No incluir nombres</SelectItem>
                                                        <SelectItem value="together">Juntos (Nombre Completo)</SelectItem>
                                                        <SelectItem value="separated">Separados (Nombres | Apellidos)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Dirigente (Opcional)</label>
                                                <Input 
                                                    value={dirigenteNombre}
                                                    onChange={(e) => setDirigenteNombre(e.target.value)}
                                                    placeholder="Nombre del Dirigente"
                                                    className="bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {(status === 'mapping' || status === 'done') && processedData.length > 0 && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                                            <h3 className="font-bold text-sm uppercase text-slate-700">Vista Previa ({Math.min(processedData.length, 50)} de {processedData.length} registros)</h3>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Columnas Exactas del Excel a Descargar</span>
                                        </div>
                                        <div className="overflow-x-auto max-h-[300px]">
                                            <Table>
                                                <TableHeader className="bg-slate-100/50 sticky top-0">
                                                    <TableRow>
                                                        {Object.keys(processedData[0]).map(k => (
                                                            <TableHead key={k} className="text-xs whitespace-nowrap">{k}</TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {processedData.slice(0, 50).map((row, i) => (
                                                        <TableRow key={i}>
                                                            {Object.values(row).map((val: any, j) => (
                                                                <TableCell key={j} className="text-xs whitespace-nowrap py-2">
                                                                    {val?.toString() || ''}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                    
                    {(status === 'mapping' || status === 'done') && (
                        <CardFooter className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-3">
                            <Button 
                                size="lg" 
                                className="font-bold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={generateExcel}
                                disabled={!mapping.cedula || status === 'checking'}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Descargar Resultados en Excel
                            </Button>
                        </CardFooter>
                    )}
                </Card>

                <Card className="shadow-sm border-slate-200/60 overflow-hidden flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2 uppercase">
                            Estado del Proceso
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col">
                        <div className="p-4 border-b border-slate-100">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-500 uppercase">Progreso</span>
                                <span className="text-primary">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                        <div className="bg-slate-950 text-slate-300 font-mono text-[10px] p-4 flex-1 overflow-y-auto max-h-[300px] lg:max-h-none space-y-2">
                            {logs.length === 0 ? (
                                <div className="text-slate-600 text-center mt-10">Esperando archivo...</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 leading-tight">
                                        <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                                        <span className={`
                                            ${log.type === 'error' ? 'text-red-400' : ''}
                                            ${log.type === 'success' ? 'text-emerald-400' : ''}
                                            ${log.type === 'warn' ? 'text-amber-400' : ''}
                                            ${log.type === 'info' ? 'text-blue-300' : ''}
                                        `}>
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
