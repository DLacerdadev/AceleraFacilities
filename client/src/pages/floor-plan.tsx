import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Building, Edit3, X, RotateCcw, MapPin, Palette, Plus, Minus, Save, AlertCircle, Thermometer, Wrench, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useClient } from '@/contexts/ClientContext';
import { useModule } from '@/contexts/ModuleContext';
import { ModernPageHeader } from '@/components/ui/modern-page-header';
import { ModernCard } from '@/components/ui/modern-card';
import { useModuleTheme } from '@/hooks/use-module-theme';

export default function FloorPlanPage() {
  const { activeClientId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isHeatmapMode, setIsHeatmapMode] = React.useState(false);
  const [editingZone, setEditingZone] = React.useState<any>(null);
  const [zonePositions, setZonePositions] = React.useState<{[key: string]: {left: number, top: number}}>({});
  const [zoneSizes, setZoneSizes] = React.useState<{[key: string]: number}>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [draggingZone, setDraggingZone] = React.useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [containerRect, setContainerRect] = React.useState<DOMRect | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const lastMousePos = React.useRef({ x: 0, y: 0 });
  const [selectedZoneForEquipment, setSelectedZoneForEquipment] = React.useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get customer data to fetch companyId
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", activeClientId],
    enabled: !!activeClientId,
  });

  const companyId = (customer as any)?.companyId;

  // Get sites for the active customer only
  const { data: sites, isLoading } = useQuery({
    queryKey: ['/api/customers', activeClientId, 'sites', { module: currentModule }],
    enabled: !!activeClientId,
  });

  // Get zones for selected site
  const { data: zones } = useQuery({
    queryKey: ["/api/sites", selectedSiteId, "zones", { module: currentModule }],
    enabled: !!selectedSiteId,
  });

  // Get heatmap data for selected site
  const { data: heatmapData } = useQuery({
    queryKey: ['/api/companies', companyId, 'heatmap', selectedSiteId],
    enabled: !!selectedSiteId && isHeatmapMode,
  });

  // Get equipment for selected zone (for equipment popup)
  const { data: zoneEquipment = [] } = useQuery({
    queryKey: ['/api/zones', selectedZoneForEquipment?.id, 'equipment', { module: currentModule }],
    enabled: !!selectedZoneForEquipment?.id && currentModule === 'maintenance',
  });

  // Get work orders for SLA calculation
  const { data: workOrders = [] } = useQuery({
    queryKey: ['/api/customers', activeClientId, 'work-orders', { module: currentModule }],
    enabled: !!activeClientId && !!selectedZoneForEquipment && currentModule === 'maintenance',
  });

  const allZones = zones as any[] || [];

  // Update zone mutation
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

  // Save floor plan mutation
  const saveFloorPlanMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = [];
      
      // Save zone positions and sizes
      allZones.forEach((zone: any) => {
        const position = zonePositions[zone.id];
        const size = zoneSizes[zone.id];
        
        let updateData: any = {};
        
        if (position) {
          updateData.positionX = position.left.toString();
          updateData.positionY = position.top.toString();
        }
        
        if (size) {
          updateData.sizeScale = (size / 120).toString(); // Convert to scale
        }
        
        if (Object.keys(updateData).length > 0) {
          promises.push(
            apiRequest('PATCH', `/api/zones/${zone.id}`, updateData)
          );
        }
      });
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
      setHasUnsavedChanges(false);
      toast({
        title: "Planta baixa salva!",
        description: "O layout das zonas foi salvo no banco de dados.",
      });
    },
    onError: (error) => {
      console.error('Erro ao salvar planta:', error);
      toast({
        title: "Erro ao salvar planta",
        description: "Não foi possível salvar o layout da planta baixa.",
        variant: "destructive",
      });
    },
  });

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
      console.error('Error saving zone:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, zoneId: string) => {
    // If not in edit mode and in maintenance module, open equipment popup
    if (!isEditMode && currentModule === 'maintenance') {
      const zone = allZones.find((z: any) => z.id === zoneId);
      if (zone) {
        setSelectedZoneForEquipment(zone);
      }
      return;
    }
    
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    setDragStartTime(Date.now());
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragging(false);
    
    const container = (e.target as HTMLElement).closest('.zone-map-container');
    const rect = container?.getBoundingClientRect();
    if (rect) {
      setContainerRect(rect);
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setDragOffset({ x: offsetX, y: offsetY });
      setDraggingZone(zoneId);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Ultra-smooth drag with requestAnimationFrame
  const updateDragPosition = React.useCallback(() => {
    if (!draggingZone || !containerRect) return;
    
    const { x, y } = lastMousePos.current;
    const relX = ((x - containerRect.left) / containerRect.width) * 100;
    const relY = ((y - containerRect.top) / containerRect.height) * 100;
    
    setZonePositions(prev => ({
      ...prev,
      [draggingZone]: {
        left: Math.max(3, Math.min(97, relX)),
        top: Math.max(3, Math.min(97, relY))
      }
    }));
    setHasUnsavedChanges(true);
  }, [draggingZone, containerRect]);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingZone || !isEditMode) return;
    
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
    );
    
    if (moveDistance > 0.5) { // Instantly responsive
      if (!isDragging) {
        setIsDragging(true);
      }
      
      e.preventDefault();
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(updateDragPosition);
    }
  };

  const handleMouseUp = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (draggingZone && !isDragging && isEditMode) {
      const clickDuration = Date.now() - dragStartTime;
      if (clickDuration < 150) {
        const zone = allZones.find(z => z.id === draggingZone);
        if (zone) {
          setEditingZone(zone);
        }
      }
    }
    
    setDraggingZone(null);
    setIsDragging(false);
    setDragStartTime(0);
    setContainerRect(null);
  };
  
  // Global mouse events for ultra-smooth dragging
  React.useEffect(() => {
    if (!draggingZone) return;
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingZone) return;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateDragPosition);
    };
    
    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = '';
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draggingZone, updateDragPosition]);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggingZone(null);
      setIsDragging(false);
    };

    if (draggingZone) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [draggingZone]);

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
      resetPositions[zone.id] = position;
    });
    setZonePositions(resetPositions);
  };

  React.useEffect(() => {
    if (sites && (sites as any[]).length > 0 && !selectedSiteId) {
      setSelectedSiteId((sites as any[])[0].id);
    }
  }, [sites, selectedSiteId]);

  // Load saved zone sizes and positions when zones data loads
  React.useEffect(() => {
    if (allZones.length > 0) {
      const savedSizes: {[key: string]: number} = {};
      const savedPositions: {[key: string]: {left: number, top: number}} = {};
      
      // Default positions for zones without saved positions
      const defaultPositions = [
        { left: 20, top: 30 },
        { left: 70, top: 20 },
        { left: 50, top: 70 },
        { left: 15, top: 75 },
        { left: 80, top: 75 }
      ];
      
      let defaultIndex = 0;
      
      allZones.forEach((zone: any) => {
        // Load saved sizes
        if (zone.sizeScale) {
          const savedSize = Math.round(120 * parseFloat(zone.sizeScale));
          savedSizes[zone.id] = savedSize;
        }
        
        // Load saved positions or assign default
        if (zone.positionX !== null && zone.positionY !== null) {
          savedPositions[zone.id] = {
            left: parseFloat(zone.positionX),
            top: parseFloat(zone.positionY)
          };
        } else {
          // Assign default position if not saved
          const defaultPos = defaultPositions[defaultIndex % defaultPositions.length];
          savedPositions[zone.id] = defaultPos;
          defaultIndex++;
        }
      });
      
      // Apply saved data (always apply positions now)
      if (Object.keys(savedSizes).length > 0) {
        setZoneSizes(prev => ({ ...prev, ...savedSizes }));
      }
      setZonePositions(savedPositions);
      
    }
  }, [allZones]);

  const selectedSite = sites ? (sites as any[]).find(site => site.id === selectedSiteId) : null;

  // Função para obter cores do heatmap baseado na performance
  const getHeatmapColors = (zoneId: string) => {
    if (!isHeatmapMode || !heatmapData) {
      return null; // Retorna null se não for modo heatmap
    }
    
    const heatmapZone = (heatmapData as any[])?.find((hz: any) => hz.zoneId === zoneId);
    const slaPercentage = heatmapZone?.slaPercentage || 0;
    
    // Cores baseadas em performance (SLA)
    if (slaPercentage >= 85) {
      return { bg: 'bg-green-400', border: 'border-green-600', dot: 'bg-green-600', text: 'text-green-800' };
    } else if (slaPercentage >= 70) {
      return { bg: 'bg-yellow-400', border: 'border-yellow-600', dot: 'bg-yellow-600', text: 'text-yellow-800' };
    } else if (slaPercentage >= 50) {
      return { bg: 'bg-orange-400', border: 'border-orange-600', dot: 'bg-orange-600', text: 'text-orange-800' };
    } else {
      return { bg: 'bg-red-400', border: 'border-red-600', dot: 'bg-red-600', text: 'text-red-800' };
    }
  };

  // Calculate SLA for each equipment
  const calculateEquipmentSLA = (equipmentId: string) => {
    if (!Array.isArray(workOrders)) return { slaPercentage: 100, total: 0, onTime: 0 };
    
    const equipmentWOs = (workOrders as any[]).filter((wo: any) => wo.equipmentId === equipmentId);
    const total = equipmentWOs.length;
    
    if (total === 0) return { slaPercentage: 100, total: 0, onTime: 0 };
    
    const now = new Date();
    const completed = equipmentWOs.filter((wo: any) => wo.status === 'concluida' || wo.status === 'finalizada');
    const onTime = completed.filter((wo: any) => {
      if (!wo.completedAt || !wo.deadline) return false;
      const completedDate = new Date(wo.completedAt);
      const deadlineDate = new Date(wo.deadline);
      return completedDate <= deadlineDate;
    });
    
    const slaPercentage = total > 0 ? Math.round((onTime.length / total) * 100) : 100;
    
    return { slaPercentage, total, onTime: onTime.length };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Building className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando locais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50/30 to-white">
      <div className="w-full px-6 py-6">
        <ModernPageHeader
          title="Planta dos Locais"
          description="Visualize e edite o layout das zonas"
          icon={MapPin}
          actions={
            <div className="flex items-center gap-3">
              {/* Site selector inline */}
              {sites && Array.isArray(sites) && sites.length > 0 && (
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="w-64" data-testid="select-site">
                    <SelectValue placeholder="Selecione um local" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sites as any[]).map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{site.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Botão Mapa de Calor */}
              <Button 
                variant={isHeatmapMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => {
                  setIsHeatmapMode(!isHeatmapMode);
                  if (!isHeatmapMode) {
                    setIsEditMode(false);
                  }
                }}
                className={isHeatmapMode ? theme.buttons.primary : ''}
                data-testid="button-heatmap-mode"
              >
                <Thermometer className="w-4 h-4 mr-1" />
                Mapa de Calor
              </Button>
              
              <Button 
                variant={isEditMode ? "destructive" : "outline"} 
                size="sm" 
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  if (!isEditMode) {
                    setIsHeatmapMode(false);
                  }
                }}
                data-testid="button-edit-mode"
                disabled={isHeatmapMode}
              >
                {isEditMode ? (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    Sair
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Editar
                  </>
                )}
              </Button>
              
              {isEditMode && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetPositions}
                    data-testid="button-reset-positions"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Resetar
                  </Button>

                  {hasUnsavedChanges && (
                    <Button 
                      size="sm"
                      onClick={() => saveFloorPlanMutation.mutate()}
                      disabled={saveFloorPlanMutation.isPending}
                      className={theme.buttons.primary}
                      data-testid="button-save-floor-plan"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {saveFloorPlanMutation.isPending ? "Salvando..." : "Salvar Planta"}
                    </Button>
                  )}
                </>
              )}

              {hasUnsavedChanges && (
                <div className="flex items-center text-orange-600 ml-2">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Mudanças não salvas</span>
                </div>
              )}
            </div>
          }
        />

        {/* Main Content Area - Full Height */}
        <div className="mt-6">
        {!zones || (zones as any[]).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Nenhuma zona encontrada</h3>
              <p className="text-muted-foreground">
                {selectedSite ? 
                  `Não há zonas cadastradas para ${selectedSite.name}` : 
                  'Selecione um local para visualizar suas zonas'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-[800px] flex flex-col p-4">
            {/* Legend and Edit mode instructions */}
            <div className="mb-3 flex justify-between items-start gap-4">
              {/* Legend - Dynamic based on mode */}
              <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  {isHeatmapMode ? 'Legenda de Performance (SLA)' : 'Legenda das Categorias'}
                </h4>
                <div className="flex flex-wrap gap-3">
                  {isHeatmapMode ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-400 border border-red-600 rounded"></div>
                        <span className="text-xs text-gray-600">Crítico (&lt; 50%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-400 border border-orange-600 rounded"></div>
                        <span className="text-xs text-gray-600">Atenção (50-69%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-400 border border-yellow-600 rounded"></div>
                        <span className="text-xs text-gray-600">Regular (70-84%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-400 border border-green-600 rounded"></div>
                        <span className="text-xs text-gray-600">Excelente (&ge; 85%)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded"></div>
                        <span className="text-xs text-gray-600">Banheiro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                        <span className="text-xs text-gray-600">Escritório</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-200 border border-orange-400 rounded"></div>
                        <span className="text-xs text-gray-600">Produção</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 border border-gray-400 rounded"></div>
                        <span className="text-xs text-gray-600">Outras</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Edit mode instructions - compact */}
              {isEditMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        Modo de Edição {isDragging && "- Arrastando..."}
                      </span>
                    </div>
                    <div className="text-xs text-amber-700 ml-4">
                      Clique rápido: editar • Arraste: mover • +/-: redimensionar
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Large Visual Map - Full Available Height */}
            <div 
              className={`flex-1 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-8 relative zone-map-container border-2 ${
                isEditMode ? 'border-dashed border-amber-300' : 'border-slate-200'
              }`} 
              data-testid="zone-map"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <div className="absolute inset-6 bg-white/90 backdrop-blur-sm border border-slate-300 rounded-lg shadow-sm select-none">
                
                {/* Site title */}
                <div className="absolute top-4 left-6 text-lg font-medium text-foreground">
                  {selectedSite?.name} - {isHeatmapMode ? 'Mapa de Calor' : 'Planta Baixa'} 
                  {isEditMode && <span className="text-amber-600">(Editando)</span>}
                  {isHeatmapMode && <span className="text-orange-600">(Modo Performance)</span>}
                </div>

                {/* Zone blocks with better positioning */}
                {(zones as any[] || []).map((zone: any, index: number) => {
                  const area = parseFloat(zone.areaM2 || '0');
                  const allAreas = (zones as any[] || []).map((z: any) => parseFloat(z.areaM2 || '0'));
                  const maxArea = Math.max(...allAreas);
                  const minArea = Math.min(...allAreas.filter(a => a > 0));
                  
                  // Calculate proportional size
                  const minSize = 120;
                  const maxSize = 200;
                  const sizeRatio = area > 0 ? (area - minArea) / (maxArea - minArea) : 0;
                  const calculatedSize = minSize + (sizeRatio * (maxSize - minSize));
                  const size = Math.max(minSize, calculatedSize);
                  
                  // Color coding - Heatmap mode ou categoria
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
                  
                  // Usar cores do heatmap se estiver no modo heatmap, senão usar cores da categoria
                  const heatmapColors = getHeatmapColors(zone.id);
                  const colors = heatmapColors || getZoneColors(zone.category);
                  
                  // Better default positioning
                  const defaultPositions = [
                    { left: 25, top: 25 },
                    { left: 65, top: 25 }, 
                    { left: 25, top: 65 },
                    { left: 65, top: 65 },
                    { left: 45, top: 45 }
                  ];
                  
                  const position = zonePositions[zone.id] || defaultPositions[index] || defaultPositions[0];
                  const customSize = zoneSizes[zone.id] || size;
                  
                  return (
                    <div 
                      key={zone.id}
                      className={`absolute ${colors.bg} border-2 ${colors.border} rounded-lg flex flex-col items-center justify-center transition-all duration-200 shadow-md ${
                        isEditMode ? 'cursor-move' : 'cursor-pointer'
                      } ${
                        draggingZone === zone.id && isDragging ? 'z-50 scale-110 shadow-xl opacity-90' : 
                        draggingZone === zone.id ? 'z-40' : 
                        isEditMode ? 'hover:scale-105 hover:shadow-lg' : 'hover:opacity-80'
                      }`}
                      style={{
                        width: `${customSize}px`,
                        height: `${customSize}px`,
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, zone.id)}
                      data-testid={`zone-${zone.id}`}
                    >
                      {/* Zone content */}
                      <div className={`w-3 h-3 ${colors.dot} rounded-full mb-1`}></div>
                      <div className={`text-xs font-medium ${colors.text} text-center px-2`}>
                        {zone.name}
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {isHeatmapMode ? (
                          <>
                            {(() => {
                              const heatmapZone = (heatmapData as any[])?.find((hz: any) => hz.zoneId === zone.id);
                              return `${heatmapZone?.slaPercentage || 0}% SLA`;
                            })()} 
                          </>
                        ) : (
                          `${zone.areaM2}m²`
                        )}
                      </div>
                      
                      {/* BOTÕES DENTRO DO CARD - CANTO SUPERIOR DIREITO */}
                      {isEditMode && (
                        <div 
                          className="absolute -top-2 -right-2 flex gap-1" 
                          style={{ 
                            pointerEvents: 'auto', 
                            zIndex: 1000 
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <button
                            className="w-6 h-6 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-xl transition-all duration-200 hover:scale-110 border-2 border-white cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const currentSize = zoneSizes[zone.id] || 120;
                              const newSize = Math.min(400, currentSize + 25);
                              
                              // Update local state immediately
                              setZoneSizes(prev => ({ ...prev, [zone.id]: newSize }));
                              setHasUnsavedChanges(true);
                            }}
                            title={`Aumentar ${zone.name}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            className="w-6 h-6 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-xl transition-all duration-200 hover:scale-110 border-2 border-white cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const currentSize = zoneSizes[zone.id] || 120;
                              const newSize = Math.max(60, currentSize - 25);
                              
                              // Update local state immediately
                              setZoneSizes(prev => ({ ...prev, [zone.id]: newSize }));
                              setHasUnsavedChanges(true);
                            }}
                            title={`Diminuir ${zone.name}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        )}

        {/* Edit Zone Dialog */}
        <Dialog open={!!editingZone} onOpenChange={(open) => !open && setEditingZone(null)}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-edit-zone">
            <DialogHeader>
              <DialogTitle>Editar Zona: {editingZone?.name}</DialogTitle>
            </DialogHeader>
            {editingZone && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="zone-name">Nome</Label>
                  <Input
                    id="zone-name"
                    value={editingZone.name}
                    onChange={(e) => setEditingZone({...editingZone, name: e.target.value})}
                    data-testid="input-zone-name"
                  />
                </div>

                <div>
                  <Label htmlFor="zone-description">Descrição</Label>
                  <Textarea
                    id="zone-description"
                    value={editingZone.description || ''}
                    onChange={(e) => setEditingZone({...editingZone, description: e.target.value})}
                    data-testid="textarea-zone-description"
                  />
                </div>

                <div>
                  <Label htmlFor="zone-area">Área (m²)</Label>
                  <Input
                    id="zone-area"
                    type="number"
                    value={editingZone.areaM2 || ''}
                    onChange={(e) => setEditingZone({...editingZone, areaM2: e.target.value})}
                    data-testid="input-zone-area"
                  />
                </div>

                <div>
                  <Label htmlFor="zone-category">Categoria</Label>
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

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditingZone(null)}>
                    Cancelar
                  </Button>
                  <Button 
                    variant="default"
                    onClick={handleSaveZone} 
                    disabled={updateZoneMutation.isPending} 
                    data-testid="button-save-zone"
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                  >
                    {updateZoneMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Equipment List Dialog */}
        <Dialog open={!!selectedZoneForEquipment} onOpenChange={(open) => !open && setSelectedZoneForEquipment(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-zone-equipment">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Equipamentos - {selectedZoneForEquipment?.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedZoneForEquipment?.description || 'Lista de equipamentos e SLA desta zona'}
              </p>
            </DialogHeader>
            
            {currentModule === 'maintenance' && (
              <div className="space-y-4 mt-4">
                {Array.isArray(zoneEquipment) && zoneEquipment.length > 0 ? (
                  <div className="space-y-3">
                    {(zoneEquipment as any[]).map((equipment: any) => {
                      const slaData = calculateEquipmentSLA(equipment.id);
                      const slaColor = slaData.slaPercentage >= 85 
                        ? 'text-green-600 bg-green-50 border-green-200' 
                        : slaData.slaPercentage >= 70 
                        ? 'text-yellow-600 bg-yellow-50 border-yellow-200' 
                        : 'text-red-600 bg-red-50 border-red-200';
                      
                      return (
                        <Card key={equipment.id} className="border-2">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Wrench className="w-4 h-4 text-orange-600" />
                                  <h3 className="font-semibold text-base">{equipment.name}</h3>
                                  {equipment.status && (
                                    <Badge variant="outline" className={
                                      equipment.status === 'operacional' ? 'bg-green-50 text-green-700' :
                                      equipment.status === 'em_manutencao' ? 'bg-yellow-50 text-yellow-700' :
                                      'bg-red-50 text-red-700'
                                    }>
                                      {equipment.status === 'operacional' ? (
                                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Operacional</>
                                      ) : equipment.status === 'em_manutencao' ? (
                                        <><AlertCircle className="w-3 h-3 mr-1" /> Em Manutenção</>
                                      ) : (
                                        <><XCircle className="w-3 h-3 mr-1" /> {equipment.status}</>
                                      )}
                                    </Badge>
                                  )}
                                </div>
                                
                                {equipment.description && (
                                  <p className="text-sm text-muted-foreground">{equipment.description}</p>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                  {equipment.manufacturer && (
                                    <div>
                                      <span className="font-medium">Fabricante:</span> {equipment.manufacturer}
                                    </div>
                                  )}
                                  {equipment.model && (
                                    <div>
                                      <span className="font-medium">Modelo:</span> {equipment.model}
                                    </div>
                                  )}
                                  {equipment.serialNumber && (
                                    <div>
                                      <span className="font-medium">Série:</span> {equipment.serialNumber}
                                    </div>
                                  )}
                                  {equipment.internalCode && (
                                    <div>
                                      <span className="font-medium">Código:</span> {equipment.internalCode}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                <div className={`px-4 py-2 rounded-lg border-2 ${slaColor} text-center min-w-[100px]`}>
                                  <div className="text-xs font-medium uppercase">SLA</div>
                                  <div className="text-2xl font-bold">{slaData.slaPercentage}%</div>
                                </div>
                                <div className="text-xs text-muted-foreground text-right">
                                  <div>{slaData.onTime} de {slaData.total} no prazo</div>
                                  {slaData.total === 0 && (
                                    <div className="text-xs text-gray-400 italic">Sem histórico</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhum equipamento encontrado nesta zona</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedZoneForEquipment(null)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}