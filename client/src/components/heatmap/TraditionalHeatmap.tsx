import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  MapPin, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  Edit3,
  Save,
  X,
  Palette,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3x3,
  Thermometer
} from 'lucide-react';

interface Zone {
  zoneId: string;
  zoneName: string;
  areaM2: number;
  slaPercentage: number;
  totalTasks: number;
  completedTasks: number;
  category: string;
  positionX?: number;
  positionY?: number;
  sizeScale?: number;
  id?: string;
  name?: string;
  description?: string;
  siteId?: string;
  isActive?: boolean;
}

interface TraditionalHeatmapProps {
  data: Zone[];
  selectedSite?: any;
  onZoneClick?: (zoneId: string) => void;
}

export default function TraditionalHeatmap({ data, selectedSite, onZoneClick }: TraditionalHeatmapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // SUPER DEBUG - Verificar se componente executa
  console.log('🔥🔥🔥 HEATMAP EXECUTANDO - Data length:', data?.length, 'Site:', selectedSite?.name);
  
  
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true); // Modo de edição ativo por padrão
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zonePositions, setZonePositions] = useState<{[key: string]: {left: number, top: number}}>({});
  const [zoneSizes, setZoneSizes] = useState<{[key: string]: number}>({});
  const [draggingZone, setDraggingZone] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartTime, setDragStartTime] = useState<number>(0);
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [mapScale, setMapScale] = useState<number>(1);
  const [mapOffset, setMapOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPos, setPanStartPos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Mutation to update zone
  const updateZoneMutation = useMutation({
    mutationFn: async (zoneData: any) => {
      const { id, ...updateData } = zoneData;
      const response = await apiRequest('PATCH', `/api/zones/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      if (selectedSite?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSite.id, "zones"] });
      }
      toast({
        title: "Zona atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    },
  });

  // Initialize positions and sizes when zones change
  React.useEffect(() => {
    if (data) {
      // Load positions from database or set defaults
      const loadedPositions: {[key: string]: {left: number, top: number}} = {};
      const loadedSizes: {[key: string]: number} = {};
      
      data.forEach((zone, index) => {
        const zoneId = zone.zoneId || zone.id || `zone-${index}`;
        
        // Use database positions if available, otherwise use defaults
        if (zone.positionX != null && zone.positionY != null) {
          loadedPositions[zoneId] = {
            left: parseFloat(zone.positionX.toString()),
            top: parseFloat(zone.positionY.toString())
          };
        } else {
          // Default positions for zones without saved positions
          const defaultPositions = [
            { left: 20, top: 30 },
            { left: 70, top: 20 },
            { left: 50, top: 70 },
            { left: 15, top: 75 },
            { left: 80, top: 75 }
          ];
          const position = defaultPositions[index] || defaultPositions[0];
          loadedPositions[zoneId] = position;
        }
        
        // Load size scale from database or use default
        if (zone.sizeScale) {
          loadedSizes[zoneId] = parseFloat(zone.sizeScale.toString());
        }
      });
      
      setZonePositions(loadedPositions);
      setZoneSizes(loadedSizes);
    }
  }, [data]);

  // Função para obter cor gradiente baseada no SLA (mapa de calor real)
  const getSLAColor = (sla: number) => {
    if (sla >= 95) return {
      bg: 'from-blue-400 to-blue-600',
      shadow: 'shadow-blue-500/30',
      glow: 'shadow-blue-400/60'
    };
    if (sla >= 85) return {
      bg: 'from-green-400 to-green-600',
      shadow: 'shadow-green-500/30', 
      glow: 'shadow-green-400/60'
    };
    if (sla >= 70) return {
      bg: 'from-yellow-400 to-orange-500',
      shadow: 'shadow-yellow-500/30',
      glow: 'shadow-yellow-400/60'
    };
    if (sla >= 50) return {
      bg: 'from-orange-500 to-red-600',
      shadow: 'shadow-orange-500/30',
      glow: 'shadow-orange-400/60'
    };
    return {
      bg: 'from-red-600 to-red-800',
      shadow: 'shadow-red-500/30',
      glow: 'shadow-red-400/60'
    };
  };

  // Função para obter ícone baseado no SLA
  const getSLAIcon = (sla: number) => {
    if (sla >= 95) return CheckCircle;
    if (sla >= 85) return TrendingUp;
    if (sla >= 70) return Activity;
    if (sla >= 50) return AlertTriangle;
    return XCircle;
  };

  // Função para obter label do SLA
  const getSLALabel = (sla: number) => {
    if (sla >= 95) return 'Excelente';
    if (sla >= 85) return 'Bom';
    if (sla >= 70) return 'Atenção';
    if (sla >= 50) return 'Ruim';
    return 'Crítico';
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalZones = data.length;
    const excellentZones = data.filter(z => (z.slaPercentage || 0) >= 95).length;
    const goodZones = data.filter(z => (z.slaPercentage || 0) >= 85 && (z.slaPercentage || 0) < 95).length;
    const warningZones = data.filter(z => (z.slaPercentage || 0) >= 70 && (z.slaPercentage || 0) < 85).length;
    const criticalZones = data.filter(z => (z.slaPercentage || 0) < 50).length;
    const avgSLA = totalZones > 0 ? Math.round(data.reduce((sum, z) => sum + (z.slaPercentage || 0), 0) / totalZones) : 0;

    return {
      totalZones,
      excellentZones,
      goodZones,
      warningZones,
      criticalZones,
      avgSLA
    };
  }, [data]);

  // Helper functions
  const snapPosition = (pos: {left: number, top: number}) => {
    if (!snapToGrid) return pos;
    const gridSize = 5; // 5% grid
    return {
      left: Math.round(pos.left / gridSize) * gridSize,
      top: Math.round(pos.top / gridSize) * gridSize
    };
  };

  const handleZoomIn = () => {
    setMapScale(prev => Math.min(prev * 1.25, 3));
  };

  const handleZoomOut = () => {
    setMapScale(prev => Math.max(prev / 1.25, 0.3));
  };

  const resetView = () => {
    setMapScale(1);
    setMapOffset({x: 0, y: 0});
  };

  // Functions for edit mode
  const handleZoneClick = (zone: any, e: React.MouseEvent) => {
    if (isEditMode && !isDragging) {
      e.stopPropagation();
      const timeSinceStart = Date.now() - dragStartTime;
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
      );
      // Só abre o modal se foi um clique real (pouco movimento e tempo)
      if (timeSinceStart < 300 && moveDistance < 10) {
        setEditingZone(zone);
      }
    } else {
      // Modo visualização - chama callback original
      onZoneClick?.(zone.zoneId || zone.id);
    }
  };

  const handleSaveZone = async () => {
    if (!editingZone) return;
    
    try {
      const updatedZone = {
        id: editingZone.zoneId || editingZone.id,
        name: editingZone.zoneName || editingZone.name,
        description: editingZone.description,
        areaM2: editingZone.areaM2?.toString(),
        category: editingZone.category,
        siteId: editingZone.siteId || selectedSite?.id,
        isActive: editingZone.isActive !== false
      };
      
      await updateZoneMutation.mutateAsync(updatedZone);
      setEditingZone(null);
    } catch (error) {
      console.error('Erro ao salvar zona:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent, zoneId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    setDragStartTime(Date.now());
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragging(false);
    setDraggingZone(zoneId);
    
    // Feedback visual correto usando currentTarget
    const zoneElement = e.currentTarget as HTMLElement;
    zoneElement.style.zIndex = '1000';
    zoneElement.style.transform = 'scale(1.02)';
    zoneElement.style.transition = 'none';
    zoneElement.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - panStartPos.x;
      const deltaY = e.clientY - panStartPos.y;
      setMapOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setPanStartPos({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (!draggingZone || !isEditMode) return;
    
    // Ultra-responsive drag detection
    setIsDragging(true);
    e.preventDefault();
    
    // Sistema de coordenadas correto: pixels -> transform -> percentual
    const innerContainer = document.querySelector('.zone-map-container .absolute.inset-4');
    if (!innerContainer) return;
    
    const rect = innerContainer.getBoundingClientRect();
    // Calcular em pixels primeiro
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    
    // Aplicar apenas escala (offset já considerado pelo getBoundingClientRect)
    const logicalX = localX / mapScale;
    const logicalY = localY / mapScale;
    
    // Usar dimensões base (não transformadas) para percentual
    const baseWidth = rect.width / mapScale;
    const baseHeight = rect.height / mapScale;
    const left = (logicalX / baseWidth) * 100;
    const top = (logicalY / baseHeight) * 100;
    
    let newPosition = { 
      left: Math.max(5, Math.min(95, left)), 
      top: Math.max(5, Math.min(95, top)) 
    };
    
    // Apply snap to grid
    if (snapToGrid) {
      newPosition = snapPosition(newPosition);
    }
    
    setZonePositions(prev => ({
      ...prev,
      [draggingZone]: newPosition
    }));
  };

  // Função centralizada para finalizar drag e salvar
  const finalizeDrag = () => {
    if (draggingZone && isDragging) {
      const zone = data.find(z => (z.zoneId || z.id) === draggingZone);
      const position = zonePositions[draggingZone];
      const currentSize = zoneSizes[draggingZone];
      
      if (zone && position) {
        updateZoneMutation.mutate({
          id: zone.zoneId || zone.id,
          name: zone.zoneName || zone.name,
          description: zone.description,
          areaM2: zone.areaM2?.toString(),
          category: zone.category,
          siteId: zone.siteId || selectedSite?.id,
          isActive: zone.isActive !== false,
          positionX: position.left.toFixed(2),
          positionY: position.top.toFixed(2),
          sizeScale: currentSize ? (currentSize / 100).toFixed(2) : "1.00",
        });
      }
    }
  };
  
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    // Não salvar aqui - deixar para o global handler para evitar duplicação
    // finalizeDrag(); // Removido para evitar dupla gravação
    
    // Remove visual feedback immediately
    if (draggingZone) {
      const zoneElement = document.querySelector(`[data-zone-id="${draggingZone}"]`) as HTMLElement;
      if (zoneElement) {
        zoneElement.style.zIndex = '';
        zoneElement.style.transform = '';
        zoneElement.style.cursor = '';
        zoneElement.style.transition = 'all 0.15s ease';
      }
    }
    
    // Reset immediately for better responsiveness
    setDraggingZone(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  // Pan functionality
  const handleMapMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle click or Ctrl+click
      e.preventDefault();
      setIsPanning(true);
      setPanStartPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Add global mouse and wheel events
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingZone) {
        // Salvar antes de limpar estado
        finalizeDrag();
        
        const zoneElement = document.querySelector(`[data-zone-id="${draggingZone}"]`) as HTMLElement;
        if (zoneElement) {
          zoneElement.style.zIndex = '';
          zoneElement.style.transform = '';
          zoneElement.style.cursor = '';
          zoneElement.style.transition = 'all 0.15s ease';
        }
      }
      
      setDraggingZone(null);
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setIsPanning(false);
    };
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - panStartPos.x;
        const deltaY = e.clientY - panStartPos.y;
        setMapOffset(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        setPanStartPos({ x: e.clientX, y: e.clientY });
        return;
      }
      
      // Handle zone dragging globally
      if (!draggingZone || !isEditMode) return;
      
      setIsDragging(true);
      e.preventDefault();
      
      // Sistema de coordenadas correto: pixels -> transform -> percentual
      const innerContainer = document.querySelector('.zone-map-container .absolute.inset-4');
      if (!innerContainer) return;
      
      const rect = innerContainer.getBoundingClientRect();
      // Calcular em pixels primeiro
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      
      // Aplicar apenas escala (offset já considerado pelo getBoundingClientRect)
      const logicalX = localX / mapScale;
      const logicalY = localY / mapScale;
      
      // Usar dimensões base (não transformadas) para percentual
      const baseWidth = rect.width / mapScale;
      const baseHeight = rect.height / mapScale;
      const left = (logicalX / baseWidth) * 100;
      const top = (logicalY / baseHeight) * 100;
      
      let newPosition = { 
        left: Math.max(5, Math.min(95, left)), 
        top: Math.max(5, Math.min(95, top)) 
      };
      
      // Apply snap to grid
      if (snapToGrid) {
        newPosition = snapPosition(newPosition);
      }
      
      setZonePositions(prev => ({
        ...prev,
        [draggingZone]: newPosition
      }));
    };

    const handleWheel = (e: WheelEvent) => {
      if (isEditMode && e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (delta > 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };
    
    if (draggingZone || isPanning) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    if (isEditMode) {
      document.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [draggingZone, isPanning, panStartPos, isEditMode, mapScale, mapOffset]);

  const resetPositions = () => {
    const positions = [
      { left: 20, top: 30 },
      { left: 70, top: 20 },
      { left: 50, top: 70 },
      { left: 15, top: 75 },
      { left: 80, top: 75 }
    ];
    
    const resetPositions: {[key: string]: {left: number, top: number}} = {};
    data.forEach((zone, index) => {
      const zoneId = zone.zoneId || zone.id || `zone-${index}`;
      const position = positions[index] || positions[0];
      resetPositions[zoneId] = snapToGrid ? snapPosition(position) : position;
    });
    setZonePositions(resetPositions);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingZone(null);
        setDraggingZone(null);
        setIsDragging(false);
      } else if (e.key === 'g' && e.ctrlKey) {
        e.preventDefault();
        setShowGrid(!showGrid);
      } else if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        setSnapToGrid(!snapToGrid);
      } else if (e.key === '=' && e.ctrlKey) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' && e.ctrlKey) {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        resetView();
      }
    };
    
    if (isEditMode) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEditMode, showGrid, snapToGrid]);

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-lg">
                <Thermometer className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Mapa de Calor - {selectedSite?.name || 'Visualização SLA'}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  SLA médio: {stats.avgSLA}% • {stats.totalZones} zonas monitoradas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={isEditMode ? "destructive" : "outline"} 
                size="sm" 
                onClick={() => setIsEditMode(!isEditMode)}
                data-testid="button-edit-mode"
              >
                {isEditMode ? (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    Sair da Edição
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Editar Mapa
                  </>
                )}
              </Button>
              {isEditMode && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetPositions}
                  data-testid="button-reset-positions"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Resetar
                </Button>
              )}
            </div>
          </div>

          {/* Estatísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Excelentes</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{stats.excellentZones}</div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Boas</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">{stats.goodZones}</div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">Atenção</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{stats.warningZones}</div>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">Críticas</span>
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">{stats.criticalZones}</div>
            </div>

            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">Total</span>
              </div>
              <div className="text-2xl font-bold text-slate-600 mt-1">{stats.totalZones}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Legenda Mapa de Calor Moderno */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
              <div className="w-4 h-4 bg-gradient-to-r from-red-600 to-red-800 rounded-sm mr-2 shadow-sm"></div>
              Crítico (&lt; 50%)
            </Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
              <div className="w-4 h-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-sm mr-2 shadow-sm"></div>
              Ruim (50-69%)
            </Badge>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
              <div className="w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-sm mr-2 shadow-sm"></div>
              Atenção (70-84%)
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
              <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-600 rounded-sm mr-2 shadow-sm"></div>
              Bom (85-94%)
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-blue-600 rounded-sm mr-2 shadow-sm"></div>
              Excelente (≥95%)
            </Badge>
          </div>

          {!data || data.length === 0 ? (
            <div className="text-center py-8">
              <Thermometer className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma zona disponível</p>
              <p className="text-sm text-muted-foreground mt-2">
                Selecione um local para visualizar o mapa de calor
              </p>
            </div>
          ) : (
            <div>
              {/* Edit mode controls */}
              {isEditMode && (
                <div className="mb-4 space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        Modo de Edição Ativo {isDragging && "- Arrastando..."} {isPanning && "- Movendo Visualização..."}
                      </span>
                    </div>
                    <p className="text-xs text-amber-700">
                      • <strong>Clique rápido</strong> na zona para editar<br/>
                      • <strong>Arraste</strong> para reposicionar<br/>
                      • <strong>Ctrl+Clique</strong> para mover visualização<br/>
                      • <strong>Atalhos:</strong> Ctrl+G (grade), Ctrl+S (ajustar), Ctrl +/- (zoom), ESC (cancelar)
                    </p>
                  </div>
                  
                  {/* Advanced Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Zoom Controls */}
                    <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                      <div className="flex items-center gap-2">
                        <ZoomIn className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Zoom</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleZoomOut}
                          className="h-8 w-8 p-0"
                        >
                          <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                          {Math.round(mapScale * 100)}%
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleZoomIn}
                          className="h-8 w-8 p-0"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetView}
                          className="h-8 w-8 p-0"
                        >
                          <Maximize className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Grid Controls */}
                    <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Grade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={showGrid ? "default" : "outline"}
                          size="sm"
                          onClick={() => setShowGrid(!showGrid)}
                          className="h-8 text-xs"
                        >
                          {showGrid ? "Ocultar" : "Mostrar"}
                        </Button>
                        <Button
                          variant={snapToGrid ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSnapToGrid(!snapToGrid)}
                          className="h-8 text-xs"
                        >
                          Ajustar
                        </Button>
                      </div>
                    </div>

                    {/* Reset Controls */}
                    <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Resetar</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetPositions}
                          className="h-8 text-xs"
                        >
                          Posições
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetView}
                          className="h-8 text-xs"
                        >
                          Visualização
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mapa de Calor Editável */}
              <div 
                className={`bg-muted/50 rounded-lg p-4 relative min-h-96 mb-6 zone-map-container overflow-hidden ${isEditMode ? 'border-2 border-dashed border-amber-300' : ''}`} 
                data-testid="zone-map"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseDown={handleMapMouseDown}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  cursor: isPanning ? 'grabbing' : isEditMode ? 'grab' : 'default',
                  userSelect: 'none',
                  height: '500px' // Forçar altura mínima para debug
                }}
              >
                <div 
                  className="absolute inset-4 bg-background border-2 border-border rounded select-none"
                  style={{
                    transform: `scale(${mapScale}) translate(${mapOffset.x}px, ${mapOffset.y}px)`,
                    transformOrigin: 'center center',
                    transition: isDragging || isPanning ? 'none' : 'transform 0.2s ease-out',
                    minHeight: '400px', // Altura mínima para o container das zonas
                    position: 'relative' // CRITICAL: Container deve ser relative para absolute children
                  }}
                >
                  {/* Grid overlay - deve ficar atrás das zonas */}
                  {showGrid && isEditMode && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                      backgroundSize: '5% 5%',
                      zIndex: 1 // Grid atrás das zonas
                    }} />
                  )}

                  
                  {/* ZONA FIXA PARA TESTE */}
                  <div
                    className="absolute bg-red-500 border-4 border-yellow-400 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                    style={{
                      left: '30%',
                      top: '30%',
                      width: '150px',
                      height: '150px',
                      zIndex: 9999
                    }}
                  >
                    ZONA TESTE
                  </div>
                  
                  {/* Zonas dos dados reais - SIMPLIFICADO */}
                  {data && data.length > 0 && data.slice(0, 3).map((zone: any, index: number) => (
                    <div
                      key={zone.zoneId || `zone-${index}`}
                      className="absolute bg-blue-500 border-2 border-white rounded-lg flex items-center justify-center text-white font-bold"
                      style={{
                        left: `${20 + (index * 25)}%`,
                        top: `${50}%`,
                        width: '120px',
                        height: '80px',
                        zIndex: 100
                      }}
                      onClick={() => console.log('Zona clicada:', zone.zoneId)}
                    >
                      <div className="text-center">
                        <div className="text-xs">{zone.zoneName}</div>
                        <div className="text-lg">{zone.slaPercentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Dica:</strong> {isEditMode ? 
                'Use os controles de edição para personalizar o layout. Arraste as zonas para reposicionar!' :
                'Ative o modo de edição para personalizar posições e tamanhos das zonas no mapa.'
              }
            </p>
          </div>
        </CardContent>

        {/* Edit Zone Modal */}
        {editingZone && (
          <Dialog open={!!editingZone} onOpenChange={() => setEditingZone(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Zona</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={editingZone.zoneName || editingZone.name || ''}
                    onChange={(e) => setEditingZone((prev: any) => ({ ...prev, zoneName: e.target.value, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={editingZone.description || ''}
                    onChange={(e) => setEditingZone((prev: any) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={editingZone.areaM2 || ''}
                    onChange={(e) => setEditingZone((prev: any) => ({ ...prev, areaM2: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={editingZone.category || ''}
                    onChange={(e) => setEditingZone((prev: any) => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingZone(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveZone} disabled={updateZoneMutation.isPending}>
                    {updateZoneMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Card>
    </TooltipProvider>
  );
}