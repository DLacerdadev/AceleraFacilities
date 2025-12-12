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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Search,
  Truck,
  CheckCircle2,
  Clock,
  CircleDot,
  PackageCheck,
  Loader2
} from "lucide-react";
import type { Part, PartMovement, Supplier } from "@shared/schema";

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
  const [maximumQuantity, setMaximumQuantity] = useState("");
  const [unit, setUnit] = useState("un");
  const [costPrice, setCostPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [partLocation, setPartLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  
  const [stockMovementType, setStockMovementType] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [stockMovementQuantity, setStockMovementQuantity] = useState("");
  const [stockMovementReason, setStockMovementReason] = useState("");
  
  const [activeTab, setActiveTab] = useState("inventory");
  const [isConfirmReceiptDialogOpen, setIsConfirmReceiptDialogOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<any>(null);
  const [receiptNotes, setReceiptNotes] = useState("");

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
    queryKey: [`/api/customers/${customerId}/equipment-categories`, currentModule],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/equipment-categories?module=${currentModule}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch equipment categories');
      return response.json();
    },
    enabled: !!customerId
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

  const { data: customerSuppliers } = useQuery<Supplier[]>({
    queryKey: [`/api/customers/${customerId}/suppliers`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/suppliers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      return response.json();
    },
    enabled: !!customerId
  });

  type SupplierWorkOrderWithDetails = {
    id: string;
    orderNumber: string | null;
    status: string;
    priority: string;
    createdAt: string | null;
    confirmedAt: string | null;
    shippedAt: string | null;
    receivedAt: string | null;
    receivedBy: string | null;
    receivedNotes: string | null;
    expectedDeliveryDate: string | null;
    trackingCode: string | null;
    invoiceNumber: string | null;
    notes: string | null;
    source: string | null;
    supplier: { id: string; name: string } | null;
    items: Array<{
      id: string;
      partId: string;
      quantityRequested: string;
      quantityConfirmed: string | null;
      quantityShipped: string | null;
      quantityReceived: string | null;
      part: Part | null;
    }>;
  };

  const { data: replenishmentOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<SupplierWorkOrderWithDetails[]>({
    queryKey: ['/api/customers', customerId, 'supplier-work-orders'],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/supplier-work-orders`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch replenishment orders');
      return response.json();
    },
    enabled: !!customerId
  });

  const confirmReceiptMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const response = await apiRequest('POST', `/api/supplier-work-orders/${orderId}/confirm-receipt`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'supplier-work-orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/with-projections`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      toast({ title: "Sucesso", description: "Recebimento confirmado! Estoque atualizado." });
      setIsConfirmReceiptDialogOpen(false);
      setSelectedOrderForReceipt(null);
      setReceiptNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao confirmar recebimento", variant: "destructive" });
    }
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

  const generateReplenishmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/auto-replenishment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('acelera_token')}` 
        }
      });
      if (!response.ok) throw new Error('Failed to generate replenishment orders');
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/parts/low-stock`] });
      if (data.ordersCreated > 0) {
        toast({ 
          title: "Pedidos Gerados", 
          description: `${data.ordersCreated} pedido(s) de reposição criado(s). Valor total: R$ ${data.totalValue?.toFixed(2) || '0.00'}` 
        });
      } else {
        toast({ 
          title: "Nenhum Pedido", 
          description: data.message || "Não há peças em estoque baixo com fornecedor definido" 
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Falha ao gerar pedidos", variant: "destructive" });
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
    setMaximumQuantity("");
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
      maximumQuantity: maximumQuantity || null,
      unit: unit || "un",
      costPrice: costPrice || null,
      location: partLocation || null,
      supplierId: supplier || null,
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
        maximumQuantity: maximumQuantity || null,
        unit: unit || "un",
        costPrice: costPrice || null,
        location: partLocation || null,
        supplierId: supplier || null
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
    setMaximumQuantity((part as any).maximumQuantity || "");
    setUnit(part.unit || "un");
    setCostPrice(part.costPrice || "");
    setPartLocation(part.location || "");
    setSupplier(part.supplierId || "");
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
    const current = parseFloat(part.currentQuantity || '0');
    const minimum = parseFloat(part.minimumQuantity || '0');
    if (isNaN(current) || isNaN(minimum)) return false;
    return current < minimum;
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="inventory" data-testid="tab-inventory">
              <Package className="w-4 h-4 mr-2" />
              Inventário de Peças
            </TabsTrigger>
            <TabsTrigger value="replenishment" data-testid="tab-replenishment">
              <Truck className="w-4 h-4 mr-2" />
              Pedidos de Reabastecimento
              {replenishmentOrders && replenishmentOrders.filter(o => o.status !== 'recebido' && o.status !== 'cancelado').length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {replenishmentOrders.filter(o => o.status !== 'recebido' && o.status !== 'cancelado').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
        <ModernCard>
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
                
                {lowStockParts && lowStockParts.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => generateReplenishmentMutation.mutate()}
                    disabled={generateReplenishmentMutation.isPending}
                    data-testid="button-generate-replenishment"
                  >
                    <Truck className={cn("w-4 h-4 mr-2", generateReplenishmentMutation.isPending && "animate-pulse")} />
                    Gerar Pedidos de Reposição
                    <Badge variant="destructive" className="ml-2">{lowStockParts.length}</Badge>
                  </Button>
                )}
                
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
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          <Label htmlFor="maximumQuantity">Quantidade Máxima</Label>
                          <Input
                            id="maximumQuantity"
                            type="number"
                            value={maximumQuantity}
                            onChange={(e) => setMaximumQuantity(e.target.value)}
                            placeholder="Ex: 100"
                            data-testid="input-maximum-quantity"
                          />
                          <p className="text-xs text-muted-foreground">
                            Usado para calcular a quantidade de reabastecimento
                          </p>
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
                          <Select value={supplier} onValueChange={setSupplier}>
                            <SelectTrigger id="supplier" data-testid="select-supplier">
                              <SelectValue placeholder="Selecione um fornecedor" />
                            </SelectTrigger>
                            <SelectContent>
                              {customerSuppliers?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
          </TabsContent>

          <TabsContent value="replenishment">
            <ModernCard>
              <ModernCardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5" style={{ color: theme.styles.color.color }} />
                    <h2 className="text-lg font-semibold">Pedidos de Reabastecimento</h2>
                    <Badge variant="secondary">{replenishmentOrders?.length || 0}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchOrders()}
                    data-testid="button-refresh-orders"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </ModernCardHeader>
              <ModernCardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !replenishmentOrders || replenishmentOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum pedido de reabastecimento encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replenishmentOrders.sort((a, b) => 
                      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    ).map((order) => {
                      const formatDate = (dateStr: string | null) => {
                        if (!dateStr) return null;
                        return new Date(dateStr).toLocaleString('pt-BR', { 
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                      };
                      
                      const getStatusBadge = (status: string) => {
                        switch (status) {
                          case 'pendente': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Aguardando Confirmação</Badge>;
                          case 'confirmado': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Confirmado</Badge>;
                          case 'enviado': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Enviado</Badge>;
                          case 'recebido': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Recebido</Badge>;
                          case 'cancelado': return <Badge variant="destructive">Cancelado</Badge>;
                          default: return <Badge variant="secondary">{status}</Badge>;
                        }
                      };

                      const canConfirmReceipt = order.shippedAt && !order.receivedAt;

                      return (
                        <div key={order.id} className="border rounded-lg p-4 space-y-4" data-testid={`order-card-${order.id}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">#{order.orderNumber || order.id.slice(0, 8)}</h3>
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Fornecedor: {order.supplier?.name || 'Não definido'}
                              </p>
                              {order.trackingCode && (
                                <p className="text-sm text-muted-foreground">
                                  Código de rastreio: <span className="font-mono">{order.trackingCode}</span>
                                </p>
                              )}
                            </div>
                            {canConfirmReceipt && (
                              <Button
                                onClick={() => {
                                  setSelectedOrderForReceipt(order);
                                  setIsConfirmReceiptDialogOpen(true);
                                }}
                                className={theme.buttons.primary}
                                style={theme.buttons.primaryStyle}
                                data-testid={`button-confirm-receipt-${order.id}`}
                              >
                                <PackageCheck className="w-4 h-4 mr-2" />
                                Confirmar Recebimento
                              </Button>
                            )}
                          </div>

                          <div className="border-t pt-4">
                            <p className="text-sm font-medium mb-2">Itens do Pedido:</p>
                            <div className="space-y-1">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                                  <span>{item.part?.name || 'Peça desconhecida'}</span>
                                  <span className="font-mono">
                                    {item.quantityShipped || item.quantityConfirmed || item.quantityRequested} un
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <p className="text-sm font-medium mb-3">Linha do Tempo:</p>
                            <div className="relative pl-6">
                              <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-muted"></div>
                              
                              <div className="relative pb-4">
                                <div className={cn(
                                  "absolute left-[-18px] w-4 h-4 rounded-full flex items-center justify-center",
                                  "bg-green-100 border-2 border-green-500"
                                )}>
                                  <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Pedido Criado</span>
                                  <span className="text-muted-foreground ml-2">{formatDate(order.createdAt)}</span>
                                </div>
                              </div>

                              <div className="relative pb-4">
                                <div className={cn(
                                  "absolute left-[-18px] w-4 h-4 rounded-full flex items-center justify-center",
                                  order.confirmedAt 
                                    ? "bg-green-100 border-2 border-green-500" 
                                    : "bg-gray-100 border-2 border-gray-300"
                                )}>
                                  {order.confirmedAt 
                                    ? <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                                    : <Clock className="w-2.5 h-2.5 text-gray-400" />
                                  }
                                </div>
                                <div className="text-sm">
                                  <span className={cn("font-medium", !order.confirmedAt && "text-muted-foreground")}>
                                    Confirmado pelo Fornecedor
                                  </span>
                                  {order.confirmedAt && (
                                    <span className="text-muted-foreground ml-2">{formatDate(order.confirmedAt)}</span>
                                  )}
                                </div>
                              </div>

                              <div className="relative pb-4">
                                <div className={cn(
                                  "absolute left-[-18px] w-4 h-4 rounded-full flex items-center justify-center",
                                  order.shippedAt 
                                    ? "bg-green-100 border-2 border-green-500" 
                                    : "bg-gray-100 border-2 border-gray-300"
                                )}>
                                  {order.shippedAt 
                                    ? <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                                    : <Clock className="w-2.5 h-2.5 text-gray-400" />
                                  }
                                </div>
                                <div className="text-sm">
                                  <span className={cn("font-medium", !order.shippedAt && "text-muted-foreground")}>
                                    Enviado
                                  </span>
                                  {order.shippedAt && (
                                    <span className="text-muted-foreground ml-2">{formatDate(order.shippedAt)}</span>
                                  )}
                                </div>
                              </div>

                              <div className="relative">
                                <div className={cn(
                                  "absolute left-[-18px] w-4 h-4 rounded-full flex items-center justify-center",
                                  order.receivedAt 
                                    ? "bg-green-100 border-2 border-green-500" 
                                    : "bg-gray-100 border-2 border-gray-300"
                                )}>
                                  {order.receivedAt 
                                    ? <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                                    : <CircleDot className="w-2.5 h-2.5 text-gray-400" />
                                  }
                                </div>
                                <div className="text-sm">
                                  <span className={cn("font-medium", !order.receivedAt && "text-muted-foreground")}>
                                    Recebido
                                  </span>
                                  {order.receivedAt && (
                                    <span className="text-muted-foreground ml-2">{formatDate(order.receivedAt)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ModernCardContent>
            </ModernCard>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isConfirmReceiptDialogOpen} onOpenChange={setIsConfirmReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Confirme que as peças do pedido {selectedOrderForReceipt?.orderNumber || selectedOrderForReceipt?.id?.slice(0, 8)} foram recebidas.
              O estoque será atualizado automaticamente.
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrderForReceipt && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Itens a serem adicionados ao estoque:</p>
                {selectedOrderForReceipt.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.part?.name}</span>
                    <span className="font-mono text-green-600">
                      +{item.quantityShipped || item.quantityConfirmed || item.quantityRequested} un
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receipt-notes">Observações (opcional)</Label>
                <Textarea
                  id="receipt-notes"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="Ex: Todas as peças em bom estado"
                  data-testid="input-receipt-notes"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmReceiptDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedOrderForReceipt) {
                  confirmReceiptMutation.mutate({
                    orderId: selectedOrderForReceipt.id,
                    notes: receiptNotes
                  });
                }
              }}
              disabled={confirmReceiptMutation.isPending}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-submit-receipt"
            >
              {confirmReceiptMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Label htmlFor="editMaximumQuantity">Quantidade Máxima</Label>
                <Input
                  id="editMaximumQuantity"
                  type="number"
                  value={maximumQuantity}
                  onChange={(e) => setMaximumQuantity(e.target.value)}
                  data-testid="input-edit-maximum-quantity"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para calcular a quantidade de reabastecimento
                </p>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editLocation">Localização no Almoxarifado</Label>
                <Input
                  id="editLocation"
                  value={partLocation}
                  onChange={(e) => setPartLocation(e.target.value)}
                  placeholder="Ex: Prateleira A3"
                  data-testid="input-edit-location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSupplier">Fornecedor</Label>
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger id="editSupplier" data-testid="select-edit-supplier">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerSuppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
