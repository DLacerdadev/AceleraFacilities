import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, FileText, Truck, Plus, Eye, Send, CheckCircle, Loader2, Clock, XCircle, AlertTriangle, Building2, ShoppingCart } from "lucide-react";
import type { Supplier, Part, MaintenancePlanProposal, SupplierPartBatch, SupplierWorkOrder, SupplierWorkOrderItem } from "@shared/schema";

type Customer = {
  id: string;
  name: string;
  tradeName?: string;
};

type EnrichedSupplierWorkOrderItem = SupplierWorkOrderItem & {
  part?: Part;
};

type EnrichedSupplierWorkOrder = SupplierWorkOrder & {
  items: EnrichedSupplierWorkOrderItem[];
  customer?: Customer;
};

type SupplierCustomer = {
  id: string;
  supplierId: string;
  customerId: string;
  customer?: Customer;
};

function getAuthData() {
  const authStr = localStorage.getItem('acelera_auth');
  if (!authStr) return null;
  try {
    return JSON.parse(authStr);
  } catch {
    return null;
  }
}

export default function SupplierPortal() {
  const authData = getAuthData();
  const userId = authData?.user?.id;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [isViewProposalDialogOpen, setIsViewProposalDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<MaintenancePlanProposal | null>(null);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  
  const [proposalName, setProposalName] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalCustomerId, setProposalCustomerId] = useState("");
  const [proposalFrequency, setProposalFrequency] = useState<string>("mensal");
  const [proposalDuration, setProposalDuration] = useState("");
  
  const [batchCustomerId, setBatchCustomerId] = useState("");
  const [batchPartId, setBatchPartId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchExpectedDate, setBatchExpectedDate] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchWorkOrderId, setBatchWorkOrderId] = useState("");
  
  const [isShipDialogOpen, setIsShipDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<EnrichedSupplierWorkOrder | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const { data: userSupplier, isLoading: isLoadingSupplier } = useQuery<Supplier>({
    queryKey: ['/api/users', userId, 'supplier'],
    enabled: !!userId,
  });
  
  const supplierId = userSupplier?.id;

  const { data: supplierCustomersRaw } = useQuery<SupplierCustomer[]>({
    queryKey: ['/api/suppliers', supplierId, 'customers'],
    enabled: !!supplierId,
  });

  const supplierCustomers = supplierCustomersRaw?.map(sc => sc.customer).filter(Boolean) as Customer[] | undefined;

  useEffect(() => {
    if (supplierCustomers && supplierCustomers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(supplierCustomers[0].id);
    }
  }, [supplierCustomers, selectedCustomerId]);

  const { data: customerParts, isLoading: isLoadingParts } = useQuery<Part[]>({
    queryKey: ['/api/suppliers', supplierId, 'customers', selectedCustomerId, 'parts'],
    enabled: !!supplierId && !!selectedCustomerId,
  });

  const { data: proposals, isLoading: isLoadingProposals } = useQuery<MaintenancePlanProposal[]>({
    queryKey: ['/api/suppliers', supplierId, 'proposals'],
    enabled: !!supplierId,
  });

  const { data: partBatches, isLoading: isLoadingBatches } = useQuery<SupplierPartBatch[]>({
    queryKey: ['/api/suppliers', supplierId, 'part-batches'],
    enabled: !!supplierId,
  });

  const { data: workOrders = [], isLoading: isLoadingWorkOrders } = useQuery<EnrichedSupplierWorkOrder[]>({
    queryKey: ['/api/suppliers', supplierId, 'work-orders'],
    enabled: !!supplierId,
  });

  const { data: selectedCustomerParts } = useQuery<Part[]>({
    queryKey: ['/api/suppliers', supplierId, 'customers', batchCustomerId, 'parts'],
    enabled: !!supplierId && !!batchCustomerId && isBatchDialogOpen,
  });

  const { data: selectedCustomerWorkOrders = [] } = useQuery<any[]>({
    queryKey: ['/api/customers', batchCustomerId, 'work-orders'],
    enabled: !!batchCustomerId && isBatchDialogOpen,
    select: (data) => Array.isArray(data) ? data : [],
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/suppliers/${supplierId}/proposals`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Proposta criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', supplierId, 'proposals'] });
      setIsProposalDialogOpen(false);
      resetProposalForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar proposta", description: error.message, variant: "destructive" });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/suppliers/${supplierId}/part-batches`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Lote criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', supplierId, 'part-batches'] });
      setIsBatchDialogOpen(false);
      resetBatchForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar lote", description: error.message, variant: "destructive" });
    },
  });

  const shipBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest("PATCH", `/api/part-batches/${batchId}/ship`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Lote marcado como enviado" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', supplierId, 'part-batches'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar lote", description: error.message, variant: "destructive" });
    },
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/supplier-work-orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pedido atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', supplierId, 'work-orders'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar pedido", description: error.message, variant: "destructive" });
    },
  });

  function resetProposalForm() {
    setProposalName("");
    setProposalDescription("");
    setProposalCustomerId("");
    setProposalFrequency("mensal");
    setProposalDuration("");
  }

  function resetBatchForm() {
    setBatchCustomerId("");
    setBatchPartId("");
    setBatchQuantity("");
    setBatchExpectedDate("");
    setBatchNotes("");
    setBatchWorkOrderId("");
  }

  function handleCreateProposal() {
    if (!proposalName.trim() || !proposalCustomerId) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    createProposalMutation.mutate({
      customerId: proposalCustomerId,
      name: proposalName.trim(),
      description: proposalDescription.trim() || null,
      frequency: proposalFrequency,
      estimatedDurationMinutes: proposalDuration ? parseInt(proposalDuration) : null,
    });
  }

  function handleCreateBatch() {
    if (!batchCustomerId || !batchPartId || !batchQuantity) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    createBatchMutation.mutate({
      customerId: batchCustomerId,
      partId: batchPartId,
      quantityPlanned: parseInt(batchQuantity),
      expectedDeliveryDate: batchExpectedDate || null,
      notes: batchNotes.trim() || null,
      workOrderId: batchWorkOrderId && batchWorkOrderId !== 'none' ? batchWorkOrderId : null,
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'em_espera':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Em Espera</Badge>;
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Aprovado</Badge>;
      case 'recusado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Recusado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getBatchStatusBadge(status: string) {
    switch (status) {
      case 'planejado':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Planejado</Badge>;
      case 'enviado':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Enviado</Badge>;
      case 'recebido':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Recebido</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getCustomerName(customerId: string) {
    const customer = supplierCustomers?.find((c: Customer) => c.id === customerId);
    return customer?.tradeName || customer?.name || 'Cliente não encontrado';
  }

  function getPartName(partId: string) {
    const allParts = customerParts || selectedCustomerParts;
    const part = allParts?.find(p => p.id === partId);
    return part?.name || partId;
  }

  function getWorkOrderStatusBadge(status: string) {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'confirmado':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><CheckCircle className="w-3 h-3 mr-1" />Confirmado</Badge>;
      case 'enviado':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"><Truck className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'recebido':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Recebido</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'baixa':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Baixa</Badge>;
      case 'media':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Média</Badge>;
      case 'alta':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Alta</Badge>;
      case 'urgente':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Urgente</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  }

  function handleConfirmOrder(order: EnrichedSupplierWorkOrder) {
    updateWorkOrderMutation.mutate({
      id: order.id,
      data: { status: 'confirmado', confirmedAt: new Date().toISOString() }
    });
  }

  function handleCancelOrder(order: EnrichedSupplierWorkOrder) {
    updateWorkOrderMutation.mutate({
      id: order.id,
      data: { status: 'cancelado' }
    });
  }

  function handleShipOrder() {
    if (!selectedWorkOrder) return;
    updateWorkOrderMutation.mutate({
      id: selectedWorkOrder.id,
      data: { 
        status: 'enviado', 
        shippedAt: new Date().toISOString(),
        trackingCode: trackingCode || null,
        invoiceNumber: invoiceNumber || null,
      }
    });
    setIsShipDialogOpen(false);
    setSelectedWorkOrder(null);
    setTrackingCode("");
    setInvoiceNumber("");
  }

  const pendingOrders = workOrders.filter(o => o.status === 'pendente');
  const confirmedOrders = workOrders.filter(o => o.status === 'confirmado');
  const shippedOrders = workOrders.filter(o => o.status === 'enviado');
  const completedOrders = workOrders.filter(o => o.status === 'recebido' || o.status === 'cancelado');

  if (isLoadingSupplier) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userSupplier) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Você não está vinculado a nenhum fornecedor. Entre em contato com o administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Portal do Fornecedor</h1>
          <p className="text-muted-foreground">{userSupplier.tradeName || userSupplier.name}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="orders" data-testid="tab-orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Pedidos</span>
            {pendingOrders.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{pendingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Estoque</span>
          </TabsTrigger>
          <TabsTrigger value="proposals" data-testid="tab-proposals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="shipments" data-testid="tab-shipments" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Envios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Pedidos de Reposição</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie os pedidos de peças dos clientes
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingWorkOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : workOrders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum pedido recebido ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        Aguardando Confirmação ({pendingOrders.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingOrders.map((order) => (
                          <Card key={order.id} className="border-yellow-200 dark:border-yellow-800" data-testid={`card-order-${order.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{order.orderNumber}</span>
                                    {getPriorityBadge(order.priority)}
                                    {order.source === 'auto' && <Badge variant="secondary">Auto</Badge>}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {order.customer?.tradeName || order.customer?.name || 'Cliente'}
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    {order.items.slice(0, 3).map((item) => (
                                      <div key={item.id} className="text-sm flex justify-between">
                                        <span className="truncate">{item.part?.name || 'Peça'}</span>
                                        <span className="text-muted-foreground ml-2">{item.quantityRequested} {item.part?.unit || 'un'}</span>
                                      </div>
                                    ))}
                                    {order.items.length > 3 && (
                                      <p className="text-sm text-muted-foreground">+{order.items.length - 3} mais itens</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleConfirmOrder(order)}
                                    disabled={updateWorkOrderMutation.isPending}
                                    data-testid={`button-confirm-${order.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Confirmar
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleCancelOrder(order)}
                                    disabled={updateWorkOrderMutation.isPending}
                                    data-testid={`button-cancel-${order.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {confirmedOrders.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        Prontos para Envio ({confirmedOrders.length})
                      </h3>
                      <div className="space-y-3">
                        {confirmedOrders.map((order) => (
                          <Card key={order.id} className="border-blue-200 dark:border-blue-800" data-testid={`card-order-${order.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{order.orderNumber}</span>
                                    {getWorkOrderStatusBadge(order.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {order.customer?.tradeName || order.customer?.name}
                                  </p>
                                  <p className="text-sm mt-1">{order.items.length} itens</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedWorkOrder(order);
                                    setIsShipDialogOpen(true);
                                  }}
                                  data-testid={`button-ship-${order.id}`}
                                >
                                  <Truck className="h-4 w-4 mr-1" />
                                  Enviar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {shippedOrders.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Truck className="h-4 w-4 text-purple-600" />
                        Em Trânsito ({shippedOrders.length})
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Rastreio</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippedOrders.map((order) => (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                              <TableCell className="font-medium">{order.orderNumber}</TableCell>
                              <TableCell>{order.customer?.tradeName || order.customer?.name}</TableCell>
                              <TableCell>{order.trackingCode || '-'}</TableCell>
                              <TableCell>{getWorkOrderStatusBadge(order.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {completedOrders.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-green-600" />
                        Finalizados ({completedOrders.length})
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedOrders.slice(0, 10).map((order) => (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                              <TableCell className="font-medium">{order.orderNumber}</TableCell>
                              <TableCell>{order.customer?.tradeName || order.customer?.name}</TableCell>
                              <TableCell>{order.items.length}</TableCell>
                              <TableCell>{getWorkOrderStatusBadge(order.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isShipDialogOpen} onOpenChange={setIsShipDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Envio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedWorkOrder && (
                  <div className="bg-muted rounded-md p-3">
                    <p className="font-medium">{selectedWorkOrder.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{selectedWorkOrder.items.length} itens</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tracking-code">Código de Rastreio</Label>
                  <Input
                    id="tracking-code"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="Ex: BR123456789BR"
                    data-testid="input-tracking-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-number">Número da Nota Fiscal</Label>
                  <Input
                    id="invoice-number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: 12345"
                    data-testid="input-invoice-number"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsShipDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleShipOrder}
                  disabled={updateWorkOrderMutation.isPending}
                  data-testid="button-confirm-ship"
                >
                  {updateWorkOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Truck className="h-4 w-4 mr-2" />
                  Confirmar Envio
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Estoque do Cliente</CardTitle>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-64" data-testid="select-customer-inventory">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {supplierCustomers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.tradeName || customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {!selectedCustomerId ? (
                <p className="text-muted-foreground text-center py-8">
                  Selecione um cliente para visualizar o estoque
                </p>
              ) : isLoadingParts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !customerParts?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma peça encontrada para este cliente
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Estoque Mín.</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerParts.map((part) => (
                      <TableRow key={part.id} data-testid={`row-part-${part.id}`}>
                        <TableCell className="font-medium">{part.name}</TableCell>
                        <TableCell>{part.partNumber || '-'}</TableCell>
                        <TableCell className="text-right">{part.currentQuantity}</TableCell>
                        <TableCell className="text-right">{part.minimumQuantity}</TableCell>
                        <TableCell className="text-right">
                          {part.costPrice ? `R$ ${parseFloat(part.costPrice).toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Propostas de Planos de Manutenção</CardTitle>
              <Dialog open={isProposalDialogOpen} onOpenChange={setIsProposalDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-proposal">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Proposta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Proposta</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="proposal-customer">Cliente *</Label>
                      <Select value={proposalCustomerId} onValueChange={setProposalCustomerId}>
                        <SelectTrigger id="proposal-customer" data-testid="select-proposal-customer">
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplierCustomers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.tradeName || customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposal-name">Nome *</Label>
                      <Input
                        id="proposal-name"
                        value={proposalName}
                        onChange={(e) => setProposalName(e.target.value)}
                        placeholder="Nome do plano de manutenção"
                        data-testid="input-proposal-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposal-description">Descrição</Label>
                      <Textarea
                        id="proposal-description"
                        value={proposalDescription}
                        onChange={(e) => setProposalDescription(e.target.value)}
                        placeholder="Descrição detalhada do plano"
                        data-testid="input-proposal-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposal-frequency">Frequência *</Label>
                      <Select value={proposalFrequency} onValueChange={setProposalFrequency}>
                        <SelectTrigger id="proposal-frequency" data-testid="select-proposal-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diaria">Diária</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposal-duration">Duração Estimada (minutos)</Label>
                      <Input
                        id="proposal-duration"
                        type="number"
                        value={proposalDuration}
                        onChange={(e) => setProposalDuration(e.target.value)}
                        placeholder="60"
                        data-testid="input-proposal-duration"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsProposalDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateProposal} 
                      disabled={createProposalMutation.isPending}
                      data-testid="button-submit-proposal"
                    >
                      {createProposalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Proposta
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingProposals ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !proposals?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma proposta cadastrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((proposal) => (
                      <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                        <TableCell className="font-medium">{proposal.name}</TableCell>
                        <TableCell>{getCustomerName(proposal.customerId)}</TableCell>
                        <TableCell className="capitalize">{proposal.frequency}</TableCell>
                        <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedProposal(proposal);
                              setIsViewProposalDialogOpen(true);
                            }}
                            data-testid={`button-view-proposal-${proposal.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={isViewProposalDialogOpen} onOpenChange={setIsViewProposalDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Detalhes da Proposta</DialogTitle>
              </DialogHeader>
              {selectedProposal && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{selectedProposal.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p>{getCustomerName(selectedProposal.customerId)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Descrição</Label>
                    <p>{selectedProposal.description || 'Sem descrição'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Frequência</Label>
                    <p className="capitalize">{selectedProposal.frequency}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Duração Estimada</Label>
                    <p>{selectedProposal.estimatedDurationMinutes ? `${selectedProposal.estimatedDurationMinutes} minutos` : 'Não informado'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedProposal.status)}</div>
                  </div>
                  {selectedProposal.reviewNotes && (
                    <div>
                      <Label className="text-muted-foreground">Observações da Revisão</Label>
                      <p>{selectedProposal.reviewNotes}</p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewProposalDialogOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Envios de Peças</CardTitle>
              <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-batch">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Lote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Lote de Peças</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="batch-customer">Cliente *</Label>
                      <Select value={batchCustomerId} onValueChange={setBatchCustomerId}>
                        <SelectTrigger id="batch-customer" data-testid="select-batch-customer">
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplierCustomers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.tradeName || customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-part">Peça *</Label>
                      <Select value={batchPartId} onValueChange={setBatchPartId} disabled={!batchCustomerId}>
                        <SelectTrigger id="batch-part" data-testid="select-batch-part">
                          <SelectValue placeholder={batchCustomerId ? "Selecione uma peça" : "Selecione o cliente primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCustomerParts?.map((part) => (
                            <SelectItem key={part.id} value={part.id}>
                              {part.name} {part.partNumber ? `(${part.partNumber})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-quantity">Quantidade *</Label>
                      <Input
                        id="batch-quantity"
                        type="number"
                        min="1"
                        value={batchQuantity}
                        onChange={(e) => setBatchQuantity(e.target.value)}
                        placeholder="10"
                        data-testid="input-batch-quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-work-order">Vincular a O.S. (opcional)</Label>
                      <Select value={batchWorkOrderId} onValueChange={setBatchWorkOrderId} disabled={!batchCustomerId}>
                        <SelectTrigger id="batch-work-order" data-testid="select-batch-work-order">
                          <SelectValue placeholder={batchCustomerId ? "Selecione uma O.S. (opcional)" : "Selecione o cliente primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {(selectedCustomerWorkOrders || []).filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled').map((wo) => (
                            <SelectItem key={wo.id} value={wo.id}>
                              #{wo.orderNumber || wo.id.slice(0, 8)} - {wo.title || wo.description?.slice(0, 30) || 'Sem título'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-date">Data Prevista de Entrega</Label>
                      <Input
                        id="batch-date"
                        type="date"
                        value={batchExpectedDate}
                        onChange={(e) => setBatchExpectedDate(e.target.value)}
                        data-testid="input-batch-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-notes">Observações</Label>
                      <Textarea
                        id="batch-notes"
                        value={batchNotes}
                        onChange={(e) => setBatchNotes(e.target.value)}
                        placeholder="Observações sobre o lote"
                        data-testid="input-batch-notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateBatch} 
                      disabled={createBatchMutation.isPending}
                      data-testid="button-submit-batch"
                    >
                      {createBatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Lote
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingBatches ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !partBatches?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum lote de peças cadastrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Peça</TableHead>
                      <TableHead className="text-right">Qtd. Planejada</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partBatches.map((batch) => (
                      <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                        <TableCell>{getCustomerName(batch.customerId)}</TableCell>
                        <TableCell>{getPartName(batch.partId)}</TableCell>
                        <TableCell className="text-right">{batch.quantityPlanned}</TableCell>
                        <TableCell>{getBatchStatusBadge(batch.status)}</TableCell>
                        <TableCell className="text-right">
                          {batch.status === 'planejado' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => shipBatchMutation.mutate(batch.id)}
                              disabled={shipBatchMutation.isPending}
                              data-testid={`button-ship-batch-${batch.id}`}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Enviar
                            </Button>
                          )}
                          {batch.status === 'enviado' && (
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aguardando Recebimento
                            </Badge>
                          )}
                          {batch.status === 'recebido' && (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Recebido
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
