import { ModernCard, ModernCardContent, ModernCardHeader } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Edit, 
  Trash2,
  Package,
  RefreshCw,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  Search
} from "lucide-react";
import type { Part, PartMovement } from "@shared/schema";

type EquipmentType = {
  id: string;
  name: string;
  description: string | null;
  module: 'clean' | 'maintenance';
  companyId: string;
  isActive: boolean | null;
};

interface PartsInventoryProps {
  customerId: string;
  companyId: string;
}

export default function PartsInventory({ customerId, companyId }: PartsInventoryProps) {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAdjustStockDialogOpen, setIsAdjustStockDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [selectedPartForStock, setSelectedPartForStock] = useState<Part | null>(null);
  const [selectedPartForHistory, setSelectedPartForHistory] = useState<Part | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [selectedEquipmentTypeId, setSelectedEquipmentTypeId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [unit, setUnit] = useState("un");
  const [costPrice, setCostPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [partLocation, setPartLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  
  const [stockMovementType, setStockMovementType] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [stockMovementQuantity, setStockMovementQuantity] = useState("");
  const [stockMovementReason, setStockMovementReason] = useState("");

  const { toast } = useToast();

  // Extended Part type with projections
  type PartWithProjection = Part & {
    reservedQuantity?: string;
    projectedQuantity?: string;
    openOrdersCount?: number;
  };

  const { data: parts, isLoading: partsLoading, refetch: refetchParts } = useQuery<PartWithProjection[]>({
    queryKey: [`/api/customers/${customerId}/parts/with-projections`, currentModule],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/parts/with-projections?module=${currentModule}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch parts');
      return response.json();
    },
    enabled: !!customerId
  });

  const { data: lowStockParts } = useQuery<Part[]>({
    queryKey: [`/api/customers/${customerId}/parts/low-stock`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/parts/low-stock`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch low stock parts');
      return response.json();
    },
    enabled: !!customerId
  });

  const { data: equipmentTypes } = useQuery<EquipmentType[]>({
    queryKey: [`/api/companies/${companyId}/equipment-categories`, currentModule],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/equipment-categories?module=${currentModule}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch equipment categories');
      return response.json();
    },
    enabled: !!companyId
  });

  const { data: partMovements } = useQuery<PartMovement[]>({
    queryKey: [`/api/parts/${selectedPartForHistory?.id}/movements`],
    queryFn: async () => {
      const response = await fetch(`/api/parts/${selectedPartForHistory?.id}/movements`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch movements');
      return response.json();
    },
    enabled: !!selectedPartForHistory?.id && isHistoryDialogOpen
  });

  const createPartMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/parts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` 
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create part');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      toast({ title: "Sucesso", description: "Peça criada com sucesso!" });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao criar peça", variant: "destructive" });
    }
  });

  const updatePartMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/parts/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` 
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update part');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      toast({ title: "Sucesso", description: "Peça atualizada com sucesso!" });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao atualizar peça", variant: "destructive" });
    }
  });

  const deletePartMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/parts/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to delete part');
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      toast({ title: "Sucesso", description: "Peça excluída com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao excluir peça", variant: "destructive" });
    }
  });

  const adjustStockMutation = useMutation({
    mutationFn: async ({ partId, data }: { partId: string; data: any }) => {
      const response = await fetch(`/api/parts/${partId}/adjust-stock`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` 
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to adjust stock');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      toast({ title: "Sucesso", description: "Estoque atualizado com sucesso!" });
      setIsAdjustStockDialogOpen(false);
      setStockMovementQuantity("");
      setStockMovementReason("");
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao ajustar estoque", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setPartName("");
    setPartNumber("");
    setPartDescription("");
    setSelectedEquipmentTypeId("");
    setCurrentQuantity("");
    setMinimumQuantity("");
    setUnit("un");
    setCostPrice("");
    setUnitCost("");
    setPartLocation("");
    setSupplier("");
    setEditingPart(null);
  };

  const handleCreate = () => {
    if (!partName.trim()) {
      toast({ title: "Erro", description: "Nome da peça é obrigatório", variant: "destructive" });
      return;
    }

    createPartMutation.mutate({
      companyId,
      customerId,
      module: currentModule,
      name: partName,
      partNumber: partNumber || null,
      description: partDescription || null,
      equipmentTypeId: selectedEquipmentTypeId || null,
      currentQuantity: currentQuantity || "0",
      minimumQuantity: minimumQuantity || "0",
      unit: unit || "un",
      costPrice: costPrice || null,
      isActive: true
    });
  };

  const handleEdit = () => {
    if (!editingPart || !partName.trim()) {
      toast({ title: "Erro", description: "Nome da peça é obrigatório", variant: "destructive" });
      return;
    }

    updatePartMutation.mutate({
      id: editingPart.id,
      data: {
        name: partName,
        partNumber: partNumber || null,
        description: partDescription || null,
        equipmentTypeId: selectedEquipmentTypeId || null,
        minimumQuantity: minimumQuantity || "0",
        unit: unit || "un",
        costPrice: costPrice || null
      }
    });
  };

  const handleAdjustStock = () => {
    if (!selectedPartForStock || !stockMovementQuantity) {
      toast({ title: "Erro", description: "Quantidade é obrigatória", variant: "destructive" });
      return;
    }

    adjustStockMutation.mutate({
      partId: selectedPartForStock.id,
      data: {
        movementType: stockMovementType,
        quantity: parseFloat(stockMovementQuantity),
        reason: stockMovementReason || null
      }
    });
  };

  const openEditDialog = (part: Part) => {
    setEditingPart(part);
    setPartName(part.name);
    setPartNumber(part.partNumber || "");
    setPartDescription(part.description || "");
    setSelectedEquipmentTypeId(part.equipmentTypeId || "");
    setCurrentQuantity(part.currentQuantity);
    setMinimumQuantity(part.minimumQuantity);
    setUnit(part.unit || "un");
    setCostPrice(part.costPrice || "");
    setIsEditDialogOpen(true);
  };

  const openStockDialog = (part: Part) => {
    setSelectedPartForStock(part);
    setStockMovementType("entrada");
    setStockMovementQuantity("");
    setStockMovementReason("");
    setIsAdjustStockDialogOpen(true);
  };

  const openHistoryDialog = (part: Part) => {
    setSelectedPartForHistory(part);
    setIsHistoryDialogOpen(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchParts();
    setIsRefreshing(false);
  };

  const isLowStock = (part: Part) => {
    return parseFloat(part.currentQuantity) < parseFloat(part.minimumQuantity);
  };

  const getEquipmentTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    const type = equipmentTypes?.find(t => t.id === typeId);
    return type?.name || "-";
  };

  const filteredParts = parts?.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.partNumber && part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLowStock = !showLowStockOnly || isLowStock(part);
    return matchesSearch && matchesLowStock;
  });

  const lowStockCount = lowStockParts?.length || 0;

  if (partsLoading) {
    return (
      <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50/30 to-white">
      <div className="w-full px-6 py-6">
        <ModernPageHeader
          title="Estoque de Peças"
          description="Gerencie peças e componentes de manutenção"
          icon={Package}
        />
        
        {lowStockCount > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Alerta de Estoque Baixo</p>
              <p className="text-sm text-amber-700">
                {lowStockCount} {lowStockCount === 1 ? 'peça está' : 'peças estão'} abaixo do estoque mínimo
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              data-testid="button-toggle-low-stock"
            >
              {showLowStockOnly ? "Mostrar Todas" : "Ver Apenas Baixo Estoque"}
            </Button>
          </div>
        )}

        <ModernCard className="mt-6">
          <ModernCardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" style={{ color: theme.styles.color.color }} />
                <h2 className="text-lg font-semibold">Peças Cadastradas</h2>
                <Badge variant="secondary">{parts?.length || 0}</Badge>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar peça..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-parts"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  data-testid="button-refresh-parts"
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </Button>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        resetForm();
                        setIsCreateDialogOpen(true);
                      }}
                      className={theme.buttons.primary}
                      style={theme.buttons.primaryStyle}
                      data-testid="button-create-part"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Peça
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nova Peça</DialogTitle>
                      <DialogDescription>
                        Cadastre uma nova peça no estoque
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="partName">Nome *</Label>
                          <Input
                            id="partName"
                            value={partName}
                            onChange={(e) => setPartName(e.target.value)}
                            placeholder="Ex: Filtro de Ar"
                            data-testid="input-part-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="partNumber">Código</Label>
                          <Input
                            id="partNumber"
                            value={partNumber}
                            onChange={(e) => setPartNumber(e.target.value)}
                            placeholder="Ex: FA-001"
                            data-testid="input-part-number"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="equipmentType">Tipo de Equipamento</Label>
                          <Select value={selectedEquipmentTypeId} onValueChange={setSelectedEquipmentTypeId}>
                            <SelectTrigger data-testid="select-equipment-type">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {equipmentTypes?.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit">Unidade de Medida</Label>
                          <Select value={unit} onValueChange={setUnit}>
                            <SelectTrigger data-testid="select-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unidade">Unidade</SelectItem>
                              <SelectItem value="par">Par</SelectItem>
                              <SelectItem value="kg">Quilograma (kg)</SelectItem>
                              <SelectItem value="litro">Litro</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="caixa">Caixa</SelectItem>
                              <SelectItem value="pacote">Pacote</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentQuantity">Quantidade Atual</Label>
                          <Input
                            id="currentQuantity"
                            type="number"
                            value={currentQuantity}
                            onChange={(e) => setCurrentQuantity(e.target.value)}
                            placeholder="0"
                            data-testid="input-current-quantity"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="minimumQuantity">Quantidade Mínima</Label>
                          <Input
                            id="minimumQuantity"
                            type="number"
                            value={minimumQuantity}
                            onChange={(e) => setMinimumQuantity(e.target.value)}
                            placeholder="0"
                            data-testid="input-minimum-quantity"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unitCost">Custo Unitário (R$)</Label>
                          <Input
                            id="unitCost"
                            type="number"
                            step="0.01"
                            value={unitCost}
                            onChange={(e) => setUnitCost(e.target.value)}
                            placeholder="0.00"
                            data-testid="input-unit-cost"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="location">Localização no Almoxarifado</Label>
                          <Input
                            id="location"
                            value={partLocation}
                            onChange={(e) => setPartLocation(e.target.value)}
                            placeholder="Ex: Prateleira A3"
                            data-testid="input-location"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier">Fornecedor</Label>
                          <Input
                            id="supplier"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="Nome do fornecedor"
                            data-testid="input-supplier"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          value={partDescription}
                          onChange={(e) => setPartDescription(e.target.value)}
                          placeholder="Descrição detalhada da peça..."
                          rows={3}
                          data-testid="input-description"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreate}
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        disabled={createPartMutation.isPending}
                        data-testid="button-save-part"
                      >
                        {createPartMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </ModernCardHeader>

          <ModernCardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo Equipamento</TableHead>
                  <TableHead className="text-right">Estoque Real</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Projetado</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Nenhuma peça encontrada para a busca" : "Nenhuma peça cadastrada"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParts?.map((part) => {
                    const reserved = parseFloat(part.reservedQuantity || '0');
                    const projected = parseFloat(part.projectedQuantity || part.currentQuantity);
                    const minimum = parseFloat(part.minimumQuantity);
                    const isProjectedLow = projected <= minimum;
                    
                    return (
                    <TableRow key={part.id} className={cn(isLowStock(part) && "bg-amber-50/50")}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {part.name}
                          {isLowStock(part) && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{part.partNumber || "-"}</TableCell>
                      <TableCell>{getEquipmentTypeName(part.equipmentTypeId)}</TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        isLowStock(part) && "text-amber-600"
                      )}>
                        {part.currentQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {reserved > 0 ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {reserved.toFixed(0)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        isProjectedLow && "text-red-600"
                      )}>
                        {projected.toFixed(0)}
                        {isProjectedLow && projected !== parseFloat(part.currentQuantity) && (
                          <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">{part.minimumQuantity}</TableCell>
                      <TableCell>{part.unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openStockDialog(part)}
                            title="Ajustar Estoque"
                            data-testid={`button-adjust-stock-${part.id}`}
                          >
                            <ArrowUpCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openHistoryDialog(part)}
                            title="Histórico de Movimentações"
                            data-testid={`button-history-${part.id}`}
                          >
                            <History className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(part)}
                            title="Editar"
                            data-testid={`button-edit-part-${part.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir esta peça?")) {
                                deletePartMutation.mutate(part.id);
                              }
                            }}
                            title="Excluir"
                            data-testid={`button-delete-part-${part.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </ModernCardContent>
        </ModernCard>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Peça</DialogTitle>
            <DialogDescription>
              Altere os dados da peça
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editPartName">Nome *</Label>
                <Input
                  id="editPartName"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  data-testid="input-edit-part-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPartNumber">Código</Label>
                <Input
                  id="editPartNumber"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  data-testid="input-edit-part-number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editEquipmentType">Tipo de Equipamento</Label>
                <Select value={selectedEquipmentTypeId} onValueChange={setSelectedEquipmentTypeId}>
                  <SelectTrigger data-testid="select-edit-equipment-type">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editUnit">Unidade de Medida</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger data-testid="select-edit-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="par">Par</SelectItem>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="pacote">Pacote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editMinimumQuantity">Quantidade Mínima</Label>
                <Input
                  id="editMinimumQuantity"
                  type="number"
                  value={minimumQuantity}
                  onChange={(e) => setMinimumQuantity(e.target.value)}
                  data-testid="input-edit-minimum-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCostPrice">Custo Unitário (R$)</Label>
                <Input
                  id="editCostPrice"
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  data-testid="input-edit-cost-price"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Descrição</Label>
              <Textarea
                id="editDescription"
                value={partDescription}
                onChange={(e) => setPartDescription(e.target.value)}
                rows={3}
                data-testid="textarea-edit-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              disabled={updatePartMutation.isPending}
              data-testid="button-update-part"
            >
              {updatePartMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustStockDialogOpen} onOpenChange={setIsAdjustStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              {selectedPartForStock?.name} - Quantidade atual: {selectedPartForStock?.currentQuantity} {selectedPartForStock?.unit}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Movimentação</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={stockMovementType === "entrada" ? "default" : "outline"}
                  onClick={() => setStockMovementType("entrada")}
                  className={cn(
                    "flex-1",
                    stockMovementType === "entrada" && "bg-green-600 hover:bg-green-700"
                  )}
                  data-testid="button-movement-entrada"
                >
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Entrada
                </Button>
                <Button
                  type="button"
                  variant={stockMovementType === "saida" ? "default" : "outline"}
                  onClick={() => setStockMovementType("saida")}
                  className={cn(
                    "flex-1",
                    stockMovementType === "saida" && "bg-red-600 hover:bg-red-700"
                  )}
                  data-testid="button-movement-saida"
                >
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  Saída
                </Button>
                <Button
                  type="button"
                  variant={stockMovementType === "ajuste" ? "default" : "outline"}
                  onClick={() => setStockMovementType("ajuste")}
                  className={cn(
                    "flex-1",
                    stockMovementType === "ajuste" && "bg-blue-600 hover:bg-blue-700"
                  )}
                  data-testid="button-movement-ajuste"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Ajuste
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockQuantity">
                {stockMovementType === "ajuste" ? "Nova Quantidade" : "Quantidade"}
              </Label>
              <Input
                id="stockQuantity"
                type="number"
                value={stockMovementQuantity}
                onChange={(e) => setStockMovementQuantity(e.target.value)}
                placeholder="0"
                data-testid="input-stock-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockReason">Motivo</Label>
              <Textarea
                id="stockReason"
                value={stockMovementReason}
                onChange={(e) => setStockMovementReason(e.target.value)}
                placeholder="Ex: Compra, Devolução, Ajuste de inventário..."
                rows={2}
                data-testid="input-stock-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustStockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdjustStock}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              disabled={adjustStockMutation.isPending}
              data-testid="button-confirm-stock-adjustment"
            >
              {adjustStockMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentações</DialogTitle>
            <DialogDescription>
              {selectedPartForHistory?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Novo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partMovements?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma movimentação registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  partMovements?.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {new Date(movement.createdAt!).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          movement.movementType === 'entrada' ? 'default' :
                          movement.movementType === 'saida' ? 'destructive' :
                          'secondary'
                        }>
                          {movement.movementType === 'entrada' ? 'Entrada' :
                           movement.movementType === 'saida' ? 'Saída' :
                           'Ajuste'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {movement.movementType === 'entrada' ? '+' : 
                         movement.movementType === 'saida' ? '-' : ''}
                        {movement.quantity}
                      </TableCell>
                      <TableCell className="text-right">{movement.previousQuantity}</TableCell>
                      <TableCell className="text-right">{movement.newQuantity}</TableCell>
                      <TableCell>{movement.reason || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
