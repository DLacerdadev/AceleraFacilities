import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { 
  Building, 
  MapPin, 
  Users, 
  Ruler,
  Activity,
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
  Grid3x3
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SiteMapProps {
  companyId: string;
}

export default function SiteMap({ companyId }: SiteMapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: sites, isLoading } = useQuery({
    queryKey: ["/api/companies", companyId, "sites"],
    enabled: !!companyId,
  });

  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [allZones, setAllZones] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zonePositions, setZonePositions] = useState<{[key: string]: {left: number, top: number}}>({});
  const [zoneSizes, setZoneSizes] = useState<{[key: string]: number}>({});
  const [zoneColors, setZoneColors] = useState<{[key: string]: string}>({});
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
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const { data: zones } = useQuery({
    queryKey: ["/api/sites", selectedSiteId, "zones"],
    enabled: !!selectedSiteId,
  });

  // Mutation to update zone
  const updateZoneMutation = useMutation({
    mutationFn: async (zoneData: any) => {
      const { id, ...updateData } = zoneData;
      const response = await apiRequest('PATCH', `/api/zones/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
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

  // Mutation to delete zone
  const deleteZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      await apiRequest('DELETE', `/api/zones/${zoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
      toast({
        title: "Zona excluída",
        description: "A zona foi removida com sucesso.",
      });
      setEditingZone(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a zona.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteZone = async () => {
    if (!editingZone) return;
    
    if (confirm(`Deseja realmente excluir a zona "${editingZone.name}"? Esta ação não pode ser desfeita.`)) {
      await deleteZoneMutation.mutateAsync(editingZone.id);
    }
  };

  // Initialize positions and sizes when zones change
  React.useEffect(() => {
    if (zones) {
      setAllZones(zones as any[]);
      
      // Load positions from database or set defaults
      const loadedPositions: {[key: string]: {left: number, top: number}} = {};
      const loadedSizes: {[key: string]: number} = {};
      
      (zones as any[]).forEach((zone, index) => {
        // Use database positions if available, otherwise use defaults
        if (zone.positionX && zone.positionY) {
          loadedPositions[zone.id] = {
            left: parseFloat(zone.positionX),
            top: parseFloat(zone.positionY)
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
          loadedPositions[zone.id] = position;
        }
        
        // Load size scale from database or use default
        if (zone.sizeScale) {
          loadedSizes[zone.id] = parseFloat(zone.sizeScale);
        }
      });
      
      setZonePositions(loadedPositions);
      setZoneSizes(loadedSizes);
    }
  }, [zones]);

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
    }
  };

  const handleSaveZone = async () => {
    if (!editingZone) return;
    
    try {
      const updatedZone = {
        id: editingZone.id,
        name: editingZone.name,
        description: editingZone.description,
        areaM2: editingZone.areaM2?.toString(),
        category: editingZone.category,
        siteId: editingZone.siteId,
        isActive: editingZone.isActive
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
    
    // Simplified visual feedback
    const zoneElement = e.target as HTMLElement;
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
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    let newPosition = { 
      left: Math.max(2, Math.min(98, x)), 
      top: Math.max(2, Math.min(98, y)) 
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

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    // Save position and size to database when dragging ends
    if (draggingZone && isDragging) {
      const zone = allZones.find(z => z.id === draggingZone);
      const position = zonePositions[draggingZone];
      const currentSize = zoneSizes[draggingZone];
      
      if (zone && position) {
        updateZoneMutation.mutate({
          id: zone.id,
          name: zone.name,
          description: zone.description,
          areaM2: zone.areaM2?.toString(),
          category: zone.category,
          siteId: zone.siteId,
          isActive: zone.isActive,
          positionX: position.left.toFixed(2),
          positionY: position.top.toFixed(2),
          sizeScale: currentSize ? (currentSize / 100).toFixed(2) : "1.00",
        });
      }
    }
    
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
      }
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
  }, [draggingZone, isPanning, panStartPos, isEditMode]);

  const resetPositions = () => {
    const positions = [
      { left: 20, top: 30 },
      { left: 70, top: 20 },
      { left: 50, top: 70 },
      { left: 15, top: 75 },
      { left: 80, top: 75 }
    ];
    
    const resetPositions: {[key: string]: {left: number, top: number}} = {};
    allZones.forEach((zone, index) => {
      const position = positions[index] || positions[0];
      resetPositions[zone.id] = snapToGrid ? snapPosition(position) : position;
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

  // Get zones for the first site by default
  React.useEffect(() => {
    if (sites && (sites as any[]).length > 0 && !selectedSiteId) {
      setSelectedSiteId((sites as any[])[0].id);
    }
  }, [sites]);

  const selectedSite = (sites as any[] || []).find((site: any) => site.id === selectedSiteId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Mapa de Metragem dos Locais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando locais...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between text-lg font-semibold text-foreground">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Mapa de Metragem dos Locais
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Site selector */}
        {sites && (sites as any[]).length > 0 && (
          <div className="mb-6">
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione um local" />
              </SelectTrigger>
              <SelectContent>
                {(sites as any[]).map((site: any) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!sites || (sites as any[]).length === 0 ? (
          <div className="text-center py-8">
            <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum local cadastrado</p>
            <p className="text-sm text-muted-foreground mt-2">
              Cadastre locais para visualizar o mapa de metragem
            </p>
          </div>
        ) : !zones || (zones as any[]).length === 0 ? (
          <div className="text-center py-8">
            <Ruler className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma zona cadastrada</p>
            <p className="text-sm text-muted-foreground mt-2">
              {selectedSite ? `Cadastre zonas para ${selectedSite.name}` : 'Selecione um local'}
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

            {/* Visual map of zones with area metrics */}
            <div 
              className={`bg-muted/50 rounded-lg p-4 relative min-h-96 mb-6 zone-map-container overflow-hidden ${isEditMode ? 'border-2 border-dashed border-amber-300' : ''}`} 
              data-testid="zone-map"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseDown={handleMapMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                cursor: isPanning ? 'grabbing' : isEditMode ? 'grab' : 'default',
                userSelect: 'none'
              }}
            >
              <div 
                className="absolute inset-4 bg-background border-2 border-border rounded select-none"
                style={{
                  transform: `scale(${mapScale}) translate(${mapOffset.x / mapScale}px, ${mapOffset.y / mapScale}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging || isPanning ? 'none' : 'transform 0.15s ease-out',
                  willChange: 'transform'
                }}
              >
                
                {/* Grid overlay for snap-to-grid visualization */}
                {isEditMode && showGrid && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)',
                      backgroundSize: '5% 5%'
                    }}
                  />
                )}
                
                {/* Drop zone indicator */}
                {isDragging && (
                  <div className="absolute inset-0 pointer-events-none bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg" />
                )}
                
                {/* Site title */}
                <div className="absolute top-2 left-4 text-sm font-medium text-foreground z-50">
                  {selectedSite?.name} - Mapa de Áreas {isEditMode && <span className="text-amber-600">(Editando)</span>}
                  {isEditMode && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Zoom: {Math.round(mapScale * 100)}% | Grade: {showGrid ? 'Ativa' : 'Inativa'} | Ajuste: {snapToGrid ? 'Ativo' : 'Inativo'}
                    </div>
                  )}
                </div>

                {/* Dynamic zone blocks based on actual data with proportional sizing */}
                {(zones as any[] || []).map((zone: any, index: number) => {
                  const area = parseFloat(zone.areaM2 || '0');
                  const allAreas = (zones as any[] || []).map((z: any) => parseFloat(z.areaM2 || '0'));
                  const maxArea = Math.max(...allAreas);
                  const minArea = Math.min(...allAreas.filter(a => a > 0));
                  
                  // Calculate proportional size (min 80px, max 180px for better visibility)
                  const minSize = 80;
                  const maxSize = 180;
                  const sizeRatio = area > 0 ? (area - minArea) / (maxArea - minArea) : 0;
                  const calculatedSize = minSize + (sizeRatio * (maxSize - minSize));
                  const size = Math.max(minSize, calculatedSize);
                  
                  // Color coding by category
                  const getZoneColors = (category: string) => {
                    switch (category?.toLowerCase()) {
                      case 'banheiro':
                        return { bg: 'bg-blue-200', border: 'border-blue-400', dot: 'bg-blue-400', text: 'text-blue-600' };
                      case 'escritorio':
                        return { bg: 'bg-green-200', border: 'border-green-400', dot: 'bg-green-400', text: 'text-green-600' };
                      case 'producao':
                        return { bg: 'bg-orange-200', border: 'border-orange-400', dot: 'bg-orange-400', text: 'text-orange-600' };
                      default:
                        return { bg: 'bg-gray-200', border: 'border-gray-400', dot: 'bg-gray-400', text: 'text-gray-600' };
                    }
                  };
                  
                  const colors = getZoneColors(zone.category);
                  
                  // Better positioning: sort by size and arrange accordingly
                  const sortedZones = [...(zones as any[] || [])].sort((a, b) => parseFloat(b.areaM2 || '0') - parseFloat(a.areaM2 || '0'));
                  const sortedIndex = sortedZones.findIndex(z => z.id === zone.id);
                  
                  // Use custom positions if available, otherwise use default positions
                  const defaultPositions = [
                    { left: 20, top: 30 }, // Large area - center left
                    { left: 70, top: 20 }, // Medium area - top right  
                    { left: 50, top: 70 }, // Small area - bottom center
                    { left: 15, top: 75 }, // Extra position
                    { left: 80, top: 75 }  // Extra position
                  ];
                  
                  const position = zonePositions[zone.id] || defaultPositions[sortedIndex] || defaultPositions[0];
                  const customSize = zoneSizes[zone.id] || size;
                  
                  const isDraggingThis = draggingZone === zone.id;
                  const isHovered = hoveredZone === zone.id;
                  
                  return (
                    <div 
                      key={zone.id}
                      data-zone-id={zone.id}
                      className={`absolute ${colors.bg} border-2 rounded-lg flex items-center justify-center transition-all duration-200 select-none ${
                        isDraggingThis ? 'z-50 border-primary shadow-2xl' : isHovered ? 'z-40 border-primary/50' : `${colors.border} shadow-md`
                      } ${
                        isEditMode ? 'cursor-move hover:shadow-lg' : 'cursor-pointer hover:shadow-md'
                      } ${
                        isHovered && !isDraggingThis ? 'ring-2 ring-primary/50' : ''
                      }`}
                      style={{
                        width: `${customSize}px`,
                        height: `${customSize}px`,
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        transform: `translate(-50%, -50%) ${isDraggingThis ? 'scale(1.03)' : isHovered ? 'scale(1.01)' : 'scale(1)'}`,
                        zIndex: isDraggingThis ? 1000 : isHovered ? 100 : 10,
                        boxShadow: isDraggingThis ? '0 8px 25px rgba(0,0,0,0.3)' : isHovered ? '0 4px 15px rgba(0,0,0,0.1)' : '',
                        transition: isDraggingThis ? 'none' : 'all 0.15s ease'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, zone.id)}
                      onClick={(e) => handleZoneClick(zone, e)}
                      onMouseEnter={() => setHoveredZone(zone.id)}
                      onMouseLeave={() => setHoveredZone(null)}
                      data-testid={`zone-${zone.id}`}
                    >
                      <div className="text-center p-1 relative pointer-events-none">
                        <div className={`w-3 h-3 ${colors.dot} rounded-full mx-auto mb-1`}></div>
                        <span className="text-xs font-semibold text-foreground block leading-tight truncate">
                          {zone.name}
                        </span>
                        <span className="text-sm font-bold text-foreground block mt-1">
                          {area > 0 ? `${area}m²` : 'Sem área'}
                        </span>
                        {zone.category && (
                          <span className={`text-xs ${colors.text} block mt-1 capitalize`}>
                            {zone.category}
                          </span>
                        )}
                        
                        {/* Tooltip for edit mode */}
                        {isEditMode && isHovered && (
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
                            Arraste para mover • Clique para editar
                          </div>
                        )}
                        
                        {/* Size controls when in edit mode */}
                        {isEditMode && (
                          <div className="absolute -top-2 -right-2 flex flex-col gap-1 pointer-events-auto">
                            <button
                              className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs font-bold hover:bg-blue-600 flex items-center justify-center transition-colors shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const currentSize = zoneSizes[zone.id] || size;
                                setZoneSizes(prev => ({
                                  ...prev,
                                  [zone.id]: Math.min(250, currentSize + 15)
                                }));
                              }}
                              data-testid={`button-increase-${zone.id}`}
                              title="Aumentar tamanho"
                            >
                              +
                            </button>
                            <button
                              className="w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 flex items-center justify-center transition-colors shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const currentSize = zoneSizes[zone.id] || size;
                                setZoneSizes(prev => ({
                                  ...prev,
                                  [zone.id]: Math.max(50, currentSize - 15)
                                }));
                              }}
                              data-testid={`button-decrease-${zone.id}`}
                              title="Diminuir tamanho"
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* Area summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {(zones as any[] || []).reduce((total, zone) => total + parseFloat(zone.areaM2 || '0'), 0).toLocaleString()}m²
                </div>
                <div className="text-sm text-muted-foreground">Área Total do Site</div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-foreground">{(zones as any[] || []).length}</div>
                <div className="text-sm text-muted-foreground">Zonas Cadastradas</div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {(zones as any[] || []).filter(zone => parseFloat(zone.areaM2 || '0') > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Com Área Definida</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Legend */}
        {zones && (zones as any[]).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Banheiro</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Escritório</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-400 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Produção</span>
            </div>
            <div className="flex items-center space-x-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tamanho = Área</span>
            </div>
          </div>
        )}

        {/* Zone editing dialog */}
        <Dialog open={!!editingZone} onOpenChange={() => setEditingZone(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Zona: {editingZone?.name}</DialogTitle>
            </DialogHeader>
            {editingZone && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={editingZone.areaM2}
                    onChange={(e) => setEditingZone({...editingZone, areaM2: e.target.value})}
                    placeholder="Ex: 25.5"
                    data-testid="input-zone-area"
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={editingZone.category} onValueChange={(value) => setEditingZone({...editingZone, category: value})}>
                    <SelectTrigger data-testid="select-zone-category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banheiro">Banheiro</SelectItem>
                      <SelectItem value="escritorio">Escritório</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                      <SelectItem value="deposito">Depósito</SelectItem>
                      <SelectItem value="recepcao">Recepção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-muted-foreground p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium mb-1">💡 Dica de Edição:</p>
                  <p>Use os botões + e - que aparecem na zona para ajustar o tamanho visual, ou arraste a zona para reposicioná-la no mapa.</p>
                </div>

                <div className="flex justify-between pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteZone} 
                    disabled={deleteZoneMutation.isPending}
                    data-testid="button-delete-zone"
                  >
                    {deleteZoneMutation.isPending ? "Excluindo..." : "Excluir Zona"}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditingZone(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveZone} disabled={updateZoneMutation.isPending} data-testid="button-save-zone">
                      {updateZoneMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
