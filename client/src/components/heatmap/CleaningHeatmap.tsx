import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CleaningHeatmapProps {
  companyId: string;
  siteId: string;
  onZoneClick?: (zoneId: string) => void;
  selectedSite?: any;
}

interface HeatmapZone {
  zoneId: string;
  zoneName: string;
  category: string;
  positionX: number;
  positionY: number;
  areaM2: number;
  sizeScale: number;
  slaPercentage: number;
  heatLevel: 'excellent' | 'good' | 'warning' | 'critical';
  color: string;
  metrics: {
    scheduledActivities: number;
    completedOnTime: number;
    overdueOrders: number;
    totalOrders: number;
  };
}

const HeatLevelIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'excellent':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'good':
      return <CheckCircle className="w-4 h-4 text-lime-500" />;
    case 'warning':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <XCircle className="w-4 h-4 text-gray-500" />;
  }
};

const getLevelLabel = (level: string): string => {
  switch (level) {
    case 'excellent':
      return 'Excelente';
    case 'good':
      return 'Bom';
    case 'warning':
      return 'Atenção';
    case 'critical':
      return 'Crítico';
    default:
      return 'N/A';
  }
};

export default function CleaningHeatmap({ companyId, siteId, onZoneClick, selectedSite }: CleaningHeatmapProps) {
  // Use the same zones query as SiteMap to get identical position data
  const { data: zones, isLoading: zonesLoading, error: zonesError } = useQuery({
    queryKey: ["/api/sites", siteId, "zones"],
    enabled: !!siteId,
  });

  // Get SLA data for each zone
  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useQuery({
    queryKey: ['/api/companies', companyId, 'heatmap', siteId],
    enabled: !!(companyId && siteId),
  });

  // Merge zone position data from SiteMap with SLA data from heatmap - MOVED TO TOP
  const zonesWithSLA = React.useMemo(() => {
    if (!zones || !heatmapData) return [];
    
    return (zones as any[]).map((zone: any) => {
      const slaData = Array.isArray(heatmapData) ? heatmapData.find((hm: any) => hm.zoneId === zone.id) : null;
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        category: zone.category,
        positionX: zone.positionX,
        positionY: zone.positionY,
        areaM2: zone.areaM2 ? Number(zone.areaM2) : 0,
        sizeScale: zone.sizeScale ? Number(zone.sizeScale) : 1,
        slaPercentage: slaData?.slaPercentage || 100,
        heatLevel: slaData?.heatLevel || 'excellent',
        color: slaData?.color || '#10B981',
        metrics: slaData?.metrics || {
          scheduledActivities: 0,
          completedOnTime: 0,
          overdueOrders: 0,
          totalOrders: 0
        }
      };
    });
  }, [zones, heatmapData]);

  const isLoading = zonesLoading || heatmapLoading;
  const error = zonesError || heatmapError;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"></div>
            Mapa de Calor - SLA de Limpeza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse space-y-2 w-full">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <div className="w-5 h-5 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"></div>
            Erro - Mapa de Calor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500">Erro ao carregar dados do mapa de calor</p>
            <p className="text-sm text-muted-foreground mt-2">
              Verifique a conexão e tente novamente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (zonesWithSLA.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"></div>
            Mapa de Calor - SLA de Limpeza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full mx-auto mb-4 opacity-20"></div>
            <p className="text-muted-foreground">Nenhuma zona encontrada para análise</p>
            <p className="text-sm text-muted-foreground mt-2">
              Adicione locais ao site para visualizar o mapa de calor
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded"></div>
          Mapa de Calor - SLA de Limpeza
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Mostra o cumprimento do SLA de limpeza por zona (atividades executadas no prazo)
        </p>
      </CardHeader>
      <CardContent>
        {/* Heat Map Visualization - Same layout as SiteMap */}
        <div className="bg-muted/50 rounded-lg p-4 relative min-h-96 overflow-hidden">
          <div className="absolute inset-4 bg-background border-2 border-border rounded select-none">
            {/* Site title */}
            <div className="absolute top-2 left-4 text-sm font-medium text-foreground z-50">
              {selectedSite?.name} - Mapa de SLA de Limpeza
            </div>
            
            <TooltipProvider>
              {zonesWithSLA.map((zone, index) => {
                const area = parseFloat(zone.areaM2?.toString() || '0');
                const allAreas = zonesWithSLA.map((z: any) => parseFloat(z.areaM2?.toString() || '0'));
                const maxArea = Math.max(...allAreas);
                const minArea = Math.min(...allAreas.filter(a => a > 0));
                
                // Calculate proportional size exactly like SiteMap
                const minSize = 80;
                const maxSize = 180;
                const sizeRatio = maxArea > minArea && area > 0 ? (area - minArea) / (maxArea - minArea) : 0;
                const calculatedSize = minSize + (sizeRatio * (maxSize - minSize));
                const size = Math.max(minSize, Math.min(maxSize, calculatedSize));
                
                // Use EXACT same positioning logic as SiteMap component  
                // Use direct index (NOT sorted by area) to match SiteMap exactly
                const directIndex = index;
                
                // Default positions matching SiteMap exactly
                const defaultPositions = [
                  { left: 20, top: 30 },
                  { left: 70, top: 20 },
                  { left: 50, top: 70 },
                  { left: 15, top: 75 },
                  { left: 80, top: 75 }
                ];
                
                // Use saved positions from "Planta dos Locais" if available, otherwise use defaults
                // This ensures EXACT layout replication from the site map editor
                const position = zone.positionX && zone.positionY
                  ? { left: parseFloat(zone.positionX.toString()), top: parseFloat(zone.positionY.toString()) }
                  : defaultPositions[directIndex] || defaultPositions[0];

                return (
                  <Tooltip key={zone.zoneId}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute cursor-pointer border-2 border-white shadow-lg hover:scale-105 transition-all duration-200 z-10 rounded-lg flex flex-col items-center justify-center text-white text-xs font-semibold p-2"
                        style={{
                          backgroundColor: zone.color,
                          left: `${position.left}%`,
                          top: `${position.top}%`,
                          width: `${size}px`,
                          height: `${size * 0.75}px`, // Rectangle aspect ratio
                          transform: 'translate(-50%, -50%)',
                          opacity: 0.9,
                          borderWidth: '2px'
                        }}
                        onClick={() => onZoneClick?.(zone.zoneId)}
                        data-testid={`heatmap-zone-${zone.zoneId}`}
                      >
                        <div className="text-center">
                          <div className="font-bold text-white truncate max-w-full text-xs">
                            {zone.zoneName}
                          </div>
                          <div className="text-xs opacity-90 font-bold">
                            {zone.slaPercentage}% SLA
                          </div>
                          {zone.areaM2 > 0 && (
                            <div className="text-xs opacity-75">
                              {zone.areaM2}m²
                            </div>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-2">
                        <div className="font-semibold flex items-center gap-2">
                          <HeatLevelIcon level={zone.heatLevel} />
                          {zone.zoneName}
                        </div>
                        <div className="text-sm space-y-1">
                          <p><strong>SLA:</strong> {zone.slaPercentage}%</p>
                          <p><strong>Nível:</strong> {getLevelLabel(zone.heatLevel)}</p>
                          <p><strong>Atividades Programadas:</strong> {zone.metrics.scheduledActivities}</p>
                          <p><strong>Concluídas no Prazo:</strong> {zone.metrics.completedOnTime}</p>
                          <p><strong>Em Atraso:</strong> {zone.metrics.overdueOrders}</p>
                          {zone.areaM2 > 0 && <p><strong>Área:</strong> {zone.areaM2}m²</p>}
                          {zone.category && <p><strong>Categoria:</strong> {zone.category}</p>}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Legenda:</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Excelente (≥95%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-lime-500 rounded"></div>
              <span>Bom (85-94%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span>Atenção (70-84%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Crítico (&lt;70%)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}