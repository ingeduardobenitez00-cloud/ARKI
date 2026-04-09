
"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, User, Hash, School, ClipboardList, UserCheck, CheckCircle2 } from 'lucide-react';

// Fix for Leaflet marker icon - Red for Pending
const RedIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Green icon for those who already voted
const GreenIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface ElectorUbicado {
    id: string;
    CEDULA: number | string;
    NOMBRE: string;
    APELLIDO: string;
    CODIGO_SEC?: string;
    LOCAL?: string;
    MESA?: string | number;
    ORDEN?: string | number;
    LATITUD: number;
    LONGITUD: number;
    registradoPor_nombre?: string;
    estado_votacion?: string;
}

interface GlobalMapDisplayProps {
  electores: ElectorUbicado[];
}

function ZoomToFit({ electores }: { electores: ElectorUbicado[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (electores.length > 0) {
      try {
        const bounds = L.latLngBounds(electores.map(e => [e.LATITUD, e.LONGITUD]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {
        console.warn("Could not fit bounds", e);
      }
    }
  }, [electores, map]);
  
  return null;
}

export default function GlobalMapDisplay({ electores }: GlobalMapDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const defaultCenter: [number, number] = [-25.3006, -57.6359]; // Asunción base

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-muted animate-pulse" />;

  return (
    <MapContainer
      key="global-map-container"
      center={defaultCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <ZoomToFit electores={electores} />

      {electores.map((elector) => {
        const haVotado = elector.estado_votacion === 'Ya Votó';
        
        return (
          <Marker 
            key={elector.id} 
            position={[elector.LATITUD, elector.LONGITUD]} 
            icon={haVotado ? GreenIcon : RedIcon}
          >
            <Popup className="custom-popup">
              <div className="p-1 space-y-2 min-w-[220px]">
                  <div className="border-b pb-2">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-primary flex items-center gap-1 uppercase">
                            <User className="h-3 w-3" /> {elector.NOMBRE} {elector.APELLIDO}
                        </p>
                        {haVotado && <Badge className="bg-green-600 text-[8px] h-4 py-0 px-1 uppercase">VOTÓ</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Hash className="h-2.5 w-2.5" /> C.I. {elector.CEDULA}
                      </p>
                  </div>
                  
                  <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" /> SECC
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 py-0 font-bold border-primary/30 text-primary">
                              SECC {elector.CODIGO_SEC || 'N/A'}
                          </Badge>
                      </div>
                      
                      <div className="bg-muted/40 p-2 rounded border border-dashed space-y-1 mt-2">
                          <p className="text-[10px] flex items-center gap-1">
                              <School className="h-2.5 w-2.5 text-blue-600" /> 
                              <strong>LOCAL:</strong> <span className="uppercase">{elector.LOCAL || 'N/A'}</span>
                          </p>
                          <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="text-[9px] font-black bg-white border-primary/20 text-primary w-fit">
                                  M: {elector.MESA || 'N/A'} / O: {elector.ORDEN || 'N/A'}
                              </Badge>
                          </div>
                      </div>

                      <div className="pt-2 flex flex-col gap-1">
                        {elector.registradoPor_nombre && (
                            <div className="flex items-center gap-1.5">
                                <UserCheck className="h-3 w-3 text-primary" />
                                <p className="text-[9px] font-medium text-muted-foreground">
                                    Ubicado por: <span className="text-primary font-bold">{elector.registradoPor_nombre}</span>
                                </p>
                            </div>
                        )}
                        {haVotado && (
                            <div className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <p className="text-[9px] font-black uppercase">Participación Confirmada</p>
                            </div>
                        )}
                      </div>
                  </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
