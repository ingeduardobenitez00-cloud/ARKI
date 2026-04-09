
"use client";

import { useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Library, User as UserIcon, Smartphone, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PadronDocument {
  id: string;
  [key: string]: any;
}

const PAGE_SIZE = 50;
const COLLECTION_NAME = 'sheet1';

export default function PadronPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [data, setData] = useState<PadronDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toUpperCase();
    if (!term) {
        toast({ title: 'Búsqueda vacía', description: 'Ingresa una Cédula o Nombre para buscar.' });
        return;
    }

    setIsSearching(true);
    setData([]);
    setPage(1);

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
        
        setData(foundResults);
        
        if (foundResults.length === 0) {
            toast({ title: 'Sin resultados', description: 'No se encontraron registros que coincidan.' });
        }

    } catch (error) {
        console.error("Error searching padron:", error);
        toast({ title: 'Fallo de conexión', description: 'Error al acceder a la base de datos.', variant: "destructive"});
    } finally {
        setIsSearching(false);
    }
  };

  const displayData = useMemo(() => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [data, page]);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-medium uppercase tracking-tight flex items-center gap-3">
                <Library className="h-8 w-8 text-primary" />
                Consulta PADRON CAPITAL ANR
            </h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Explora y busca en la base de datos oficial de la ANR.</p>
        </div>
      </div>

      <Card className="border-primary/10 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
           <form onSubmit={handleSearch} className="space-y-4 pt-4">
                <Label htmlFor="search-input" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Buscador por Cédula, Nombre o Apellido</Label>
                <div className="flex gap-2 max-w-2xl">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            id="search-input"
                            placeholder="EJ: 4567890 O MARIA GOMEZ..."
                            className="pl-10 h-12 font-medium uppercase border-primary/20 focus-visible:ring-primary bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={isSearching} className="h-12 px-8 font-medium uppercase shadow-lg active:scale-95 transition-all">
                        {isSearching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
                        BUSCAR
                    </Button>
                </div>
           </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 text-[10px] font-medium uppercase">
                  <TableHead className="w-[120px] text-center py-4">Cédula</TableHead>
                  <TableHead className="py-4">Elector</TableHead>
                  <TableHead className="text-center py-4">SECC</TableHead>
                  <TableHead className="py-4">Local / Mesa / Orden</TableHead>
                  <TableHead className="py-4">Teléfono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSearching ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-4"><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : displayData.length > 0 ? (
                  displayData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-primary/[0.02] transition-colors border-b">
                      <TableCell className="text-center py-6">
                        <span className="font-mono text-[11px] font-medium text-muted-foreground">{row.CEDULA}</span>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium uppercase tracking-tight text-foreground">{row.NOMBRE} {row.APELLIDO}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase mt-1">{row.DIRECCION || 'SIN DIRECCIÓN DECLARADA'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-6">
                        <div className="flex justify-center">
                          <div className="h-10 w-10 rounded-full border-2 border-primary/10 flex flex-col items-center justify-center bg-white shadow-sm">
                            <span className="text-[7px] font-medium text-primary leading-none uppercase">SECC</span>
                            <span className="text-[11px] font-medium text-slate-900 leading-tight">{row.CODIGO_SEC}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-black uppercase text-slate-700 truncate max-w-[250px]">{row.LOCAL}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-black bg-primary/5 text-primary border-primary/10">
                                M: {row.MESA} / O: {row.ORDEN}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        {row.TELEFONO ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-medium">
                            <Smartphone className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-mono tracking-tight">{row.TELEFONO}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 font-medium uppercase italic">No disponible</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-80 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                        <UserIcon className="w-16 h-16 text-primary" />
                        <p className="font-medium uppercase text-xs tracking-[0.2em] text-center max-w-[200px]">
                          Realiza una búsqueda para mostrar resultados oficiales
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest">
                {data.length > 0 ? `Se hallaron ${data.length.toLocaleString()} registros en el padrón ANR` : 'Esperando búsqueda...'}
            </div>
            {data.length > PAGE_SIZE && (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0,0); }} disabled={page === 1} className="h-8 font-medium uppercase text-[10px] px-3">
                      <ChevronLeft className="h-3 w-3 mr-1" /> ANTERIOR
                    </Button>
                    <div className="h-8 px-4 rounded-md border bg-white flex items-center shadow-sm">
                      <span className="text-[10px] font-medium uppercase">Página {page} de {totalPages}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0,0); }} disabled={page === totalPages} className="h-8 font-medium uppercase text-[10px] px-3">
                      SIGUIENTE <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
