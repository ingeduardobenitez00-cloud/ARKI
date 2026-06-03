"use client";

import { useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, User as UserIcon, MapPin, Smartphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

const COLLECTION_NAME = 'sheet1';

export default function ConsultaPublicaPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [data, setData] = useState<PadronDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toUpperCase();
    if (!term) {
        toast({ title: 'Búsqueda vacía', description: 'Ingresa una Cédula o Nombre para buscar.' });
        return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setData([]);

    try {
        const resultsMap = new Map<string, PadronDocument>();
        const dataCollection = collection(db, COLLECTION_NAME);
        const isNumericSearch = /^\d+$/.test(term);
        let queries = [];

        if (isNumericSearch) {
            queries.push(getDocs(query(dataCollection, where('CEDULA', '==', Number(term)))));
            queries.push(getDocs(query(dataCollection, where('CEDULA', '==', term))));
        } else {
            const searchWords = term.split(' ').filter(word => word.length >= 3);
            if (searchWords.length === 0) {
                toast({ title: "Búsqueda insuficiente", description: "Ingresa al menos 3 caracteres para buscar por nombre." });
                setIsSearching(false);
                return;
            }

            searchWords.forEach(word => {
                queries.push(getDocs(query(dataCollection, where('NOMBRE', '>=', word), where('NOMBRE', '<=', word + '\uf8ff'))));
                queries.push(getDocs(query(dataCollection, where('APELLIDO', '>=', word), where('APELLIDO', '<=', word + '\uf8ff'))));
            });
        }
        
        const snapshots = await Promise.all(queries);
        snapshots.forEach(snapshot => {
            snapshot.forEach(docSnap => {
                 if (!resultsMap.has(docSnap.id)) {
                    resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PadronDocument);
                }
            });
        });
        
        let foundResults = Array.from(resultsMap.values());

        if (!isNumericSearch) {
            const searchWords = term.split(' ').filter(word => word);
            foundResults = foundResults.filter(person => {
                const fullName = `${person.NOMBRE || ''} ${person.APELLIDO || ''}`.toUpperCase();
                return searchWords.every(word => fullName.includes(word));
            });
        }

        foundResults.sort((a, b) => {
            const apellidoA = String(a.APELLIDO || '').toUpperCase();
            const apellidoB = String(b.APELLIDO || '').toUpperCase();
            if (apellidoA !== apellidoB) return apellidoA.localeCompare(apellidoB);
            return String(a.NOMBRE || '').toUpperCase().localeCompare(String(b.NOMBRE || '').toUpperCase());
        });
        
        // Limit results to 10 for public query to prevent abuse
        setData(foundResults.slice(0, 10));
        
        if (foundResults.length === 0) {
            // Toast removed since we show a big red warning inline
        } else if (foundResults.length > 10) {
            toast({ title: 'Múltiples resultados', description: 'Mostrando los primeros 10 resultados. Por favor sé más específico.' });
        }

    } catch (error) {
        console.error("Error searching padron:", error);
        toast({ title: 'Fallo de conexión', description: 'Error al acceder a la base de datos.', variant: "destructive"});
    } finally {
        setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-medium">
      {/* HEADER PÚBLICO */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto p-4 flex flex-col items-center justify-center space-y-2">
            <div className="relative h-16 w-16 mb-1">
                <Image src="/logo.png?v=3" alt="Logo Arki" fill className="object-contain" priority />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900 text-center">LISTA 2P - OPCIÓN 2</p>
            <div className="flex flex-col items-center gap-0.5">
                <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-primary text-center">CAMILO PÉREZ INTENDENTE</h2>
                <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-primary text-center">EL ARKI SOTOMAYOR CONCEJAL</h2>
            </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 pb-20">
        
        <div className="mb-6 text-center space-y-2">
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-800">Consulta de Padrón</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Verifica tu local y mesa de votación en Capital</p>
        </div>

        <Card className="border-primary/10 shadow-xl overflow-hidden rounded-[2rem] bg-white">
          <CardHeader className="bg-slate-50 border-b pb-6 p-6">
             <form onSubmit={handleSearch} className="space-y-4">
                  <Label htmlFor="search-input" className="text-[10px] font-black uppercase tracking-widest text-slate-600 block text-center">Ingresa Cédula o Nombre</Label>
                  <div className="flex flex-col gap-3">
                      <div className="relative w-full">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                              id="search-input"
                              placeholder="EJ: 4567890 O MARIA GOMEZ"
                              className="pl-12 h-14 text-center font-black uppercase border-primary/20 focus-visible:ring-primary rounded-2xl bg-white shadow-inner"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              autoComplete="off"
                          />
                      </div>
                      <Button type="submit" disabled={isSearching} className="h-14 w-full font-black text-sm uppercase rounded-2xl shadow-lg active:scale-95 transition-all">
                          {isSearching ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Search className="mr-2 h-5 w-5" />}
                          Consultar Ahora
                      </Button>
                  </div>
             </form>
          </CardHeader>
          <CardContent className="p-0 bg-slate-50/30">
            {isSearching ? (
                <div className="p-6 space-y-4">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            ) : hasSearched && data.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center gap-4 animate-in zoom-in duration-300">
                    <div className="h-20 w-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center border-4 border-white shadow-md">
                        <UserIcon className="h-10 w-10 stroke-[2]" />
                    </div>
                    <p className="font-black text-center text-red-600 uppercase text-lg tracking-tight leading-tight">
                        NO SE ENCUENTRA AFILIADO EN CAPITAL
                    </p>
                </div>
            ) : data.length > 0 ? (
                <div className="divide-y divide-slate-100">
                    {data.map((row) => (
                        <div key={row.id} className="p-6 hover:bg-white transition-colors flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* Cabecera Tarjeta */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="font-black text-lg uppercase text-slate-800 leading-tight">{row.NOMBRE} {row.APELLIDO}</h3>
                                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase">CI: <span className="font-mono tracking-tight">{row.CEDULA}</span></p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center border border-primary/20 shrink-0 shadow-sm">
                                    <span className="text-[8px] font-black uppercase text-primary leading-none">SECC</span>
                                    <span className="text-base font-black text-primary leading-none mt-0.5">{row.CODIGO_SEC}</span>
                                </div>
                            </div>
                            
                            {/* Detalles Votación */}
                            <div className="bg-slate-100/50 rounded-xl p-4 border border-slate-200/50 space-y-3">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Lugar de Votación</span>
                                    <p className="text-sm font-black uppercase text-slate-700 flex items-start gap-2">
                                        <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                                        {row.LOCAL}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-white border rounded-lg p-2 flex flex-col items-center shadow-sm">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mesa</span>
                                        <span className="text-base font-black text-primary">{row.MESA}</span>
                                    </div>
                                    <div className="flex-1 bg-white border rounded-lg p-2 flex flex-col items-center shadow-sm">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Orden</span>
                                        <span className="text-base font-black text-primary">{row.ORDEN}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-12 flex flex-col items-center justify-center gap-3 opacity-40">
                    <Search className="w-12 h-12 text-slate-400" />
                    <p className="font-black uppercase text-xs tracking-widest text-center text-slate-500">
                        Ingresa los datos para buscar
                    </p>
                </div>
            )}
          </CardContent>
        </Card>
        
        {data.length > 0 && (
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6">
                Mostrando {data.length} resultados encontrados
            </p>
        )}
      </div>

      {/* FOOTER PÚBLICO */}
      <div className="bg-slate-900 py-6 px-4 text-center mt-auto">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">SISTEMA OFICIAL DE CONSULTA</p>
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600 mt-1">LISTA 2P - CAMILO PÉREZ | EL ARKI SOTOMAYOR</p>
      </div>
    </div>
  );
}
