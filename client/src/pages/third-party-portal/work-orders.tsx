import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ClipboardList, 
  Plus, 
  Eye,
  Calendar,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useModule } from "@/contexts/ModuleContext";
import { ModernCard, ModernCardHeader, ModernCardContent } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { WorkOrder, Zone, Equipment } from "@shared/schema";

const workOrderProposalSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  zoneId: z.string().min(1, "Zona é obrigatória"),
  equipmentId: z.string().optional(),
  priority: z.enum(["baixa", "media", "alta", "critica"]),
  dueDate: z.string().min(1, "Data de prazo é obrigatória"),
  module: z.enum(["clean", "maintenance"]),
});

type WorkOrderProposalFormData = z.infer<typeof workOrderProposalSchema>;

export default function ThirdPartyWorkOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  const { currentModule } = useModule();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>("todas");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: workOrders = [], isLoading: loadingWorkOrders, refetch } = useQuery<WorkOrder[]>({
    queryKey: ['/api/third-party-portal/work-orders', user?.thirdPartyCompanyId, currentModule],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/proposals', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['/api/third-party-portal/zones', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['/api/third-party-portal/equipment', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const form = useForm<WorkOrderProposalFormData>({
    resolver: zodResolver(workOrderProposalSchema),
    defaultValues: {
      title: "",
      description: "",
      zoneId: "",
      equipmentId: "",
      priority: "media",
      dueDate: "",
      module: "maintenance",
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: WorkOrderProposalFormData) => {
      return await apiRequest("POST", `/api/third-party-portal/proposals`, data);
    },
    onSuccess: () => {
      toast({ title: "Proposta de O.S. criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/proposals', user?.thirdPartyCompanyId] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar proposta", description: error?.message, variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberta':
        return <Badge className="bg-blue-600 text-white border-0">Aberta</Badge>;
      case 'em_execucao':
        return <Badge className="bg-yellow-600 text-white border-0">Em Execução</Badge>;
      case 'pausada':
        return <Badge className="bg-orange-600 text-white border-0">Pausada</Badge>;
      case 'concluida':
        return <Badge className="bg-green-600 text-white border-0">Concluída</Badge>;
      case 'vencida':
        return <Badge className="bg-red-600 text-white border-0">Vencida</Badge>;
      case 'cancelada':
        return <Badge className="bg-gray-500 text-white border-0">Cancelada</Badge>;
      default:
        return <Badge className="bg-blue-600 text-white border-0">Aberta</Badge>;
    }
  };

  const getProposalStatusBadge = (status: string) => {
    switch (status) {
      case 'em_espera':
        return <Badge className="bg-yellow-600 text-white border-0">Aguardando Aprovação</Badge>;
      case 'aprovado':
        return <Badge className="bg-green-600 text-white border-0">Aprovada</Badge>;
      case 'recusado':
        return <Badge className="bg-red-600 text-white border-0">Recusada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critica':
        return <Badge className="bg-red-500 text-white border-0">Crítica</Badge>;
      case 'alta':
        return <Badge className="bg-orange-500 text-white border-0">Alta</Badge>;
      case 'media':
        return <Badge className="bg-yellow-500 text-white border-0">Média</Badge>;
      default:
        return <Badge className="bg-blue-500 text-white border-0">Baixa</Badge>;
    }
  };

  const getStatusPriority = (status: string): number => {
    switch (status) {
      case 'vencida':
      case 'atrasada':
        return 1;
      case 'aberta':
        return 2;
      case 'pausada':
        return 3;
      case 'em_execucao':
        return 4;
      case 'concluida':
        return 5;
      case 'cancelada':
        return 6;
      default:
        return 3;
    }
  };

  const sortWorkOrders = (orders: typeof workOrders) => {
    return [...orders].sort((a, b) => {
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }
      
      const dateA = a.scheduledDate ? new Date(a.scheduledDate) : a.createdAt ? new Date(a.createdAt) : null;
      const dateB = b.scheduledDate ? new Date(b.scheduledDate) : b.createdAt ? new Date(b.createdAt) : null;
      
      if (dateA && dateB) {
        return dateA.getTime() - dateB.getTime();
      }
      
      return 0;
    });
  };

  const filteredWorkOrders = sortWorkOrders(workOrders.filter(wo => {
    if (statusFilter.length > 0 && !statusFilter.includes(wo.status)) {
      return false;
    }
    if (zoneFilter !== "todas" && wo.zoneId !== zoneFilter) {
      return false;
    }
    return true;
  }));

  const totalAbertas = workOrders.filter(wo => wo.status === 'aberta').length;
  const totalVencidas = workOrders.filter(wo => wo.status === 'vencida').length;
  const totalPausadas = workOrders.filter(wo => wo.status === 'pausada').length;
  const totalConcluidas = workOrders.filter(wo => wo.status === 'concluida').length;

  const formatDateOnly = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return '-';
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('pt-BR');
    }
    const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return new Date(dateValue).toLocaleDateString('pt-BR');
  };

  if (loadingWorkOrders) {
    return (
      <div className={cn("flex-1 flex items-center justify-center min-h-screen", theme.gradients.page)}>
        <div className="text-center">
          <div className={cn(
            "w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4",
            theme.borders.primary
          )}></div>
          <p className="text-slate-600 font-medium">Carregando ordens de serviço...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ModernPageHeader 
        title="Ordens de Serviço"
        description="Gerencie e acompanhe as ordens de serviço atribuídas"
        icon={ClipboardList}
        actions={
          <>
            <Button 
              onClick={handleRefresh}
              className={cn("flex items-center gap-2", theme.buttons.primary)}
              style={theme.buttons.primaryStyle}
              size="sm"
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-new-proposal"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Proposta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Proposta de O.S.</DialogTitle>
                  <DialogDescription>
                    Crie uma proposta de ordem de serviço para aprovação do cliente
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createProposalMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input placeholder="Título da O.S." {...field} data-testid="input-proposal-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Descrição detalhada..." {...field} data-testid="input-proposal-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="module"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Módulo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-proposal-module">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="clean">Limpeza</SelectItem>
                                <SelectItem value="maintenance">Manutenção</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prioridade</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-proposal-priority">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="baixa">Baixa</SelectItem>
                                <SelectItem value="media">Média</SelectItem>
                                <SelectItem value="alta">Alta</SelectItem>
                                <SelectItem value="critica">Crítica</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="zoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-proposal-zone">
                                <SelectValue placeholder="Selecione a zona" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {zones.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                  {zone.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="equipmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipamento (opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-proposal-equipment">
                                <SelectValue placeholder="Selecione o equipamento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {equipment.map((eq) => (
                                <SelectItem key={eq.id} value={eq.id}>
                                  {eq.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Prazo</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-proposal-due-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createProposalMutation.isPending}
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-submit-proposal"
                      >
                        {createProposalMutation.isPending ? "Enviando..." : "Enviar Proposta"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      
      <main className={cn("flex-1 overflow-auto p-4", theme.gradients.page)}>
        <div className="w-full px-6 space-y-3">
          <ModernCard variant="gradient">
            <ModernCardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('aberta') ? [] : ['aberta']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('aberta') && "ring-2 ring-blue-500 ring-offset-2"
                  )}
                  data-testid="button-filter-abertas"
                >
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-7 h-7 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Abertas</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {totalAbertas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('vencida') ? [] : ['vencida']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('vencida') && "ring-2 ring-red-500 ring-offset-2"
                  )}
                  data-testid="button-filter-vencidas"
                >
                  <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Vencidas</p>
                    <p className="text-3xl font-bold text-red-600">
                      {totalVencidas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('pausada') ? [] : ['pausada']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('pausada') && "ring-2 ring-orange-500 ring-offset-2"
                  )}
                  data-testid="button-filter-pausadas"
                >
                  <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                    <PauseCircle className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Pausadas</p>
                    <p className="text-3xl font-bold text-foreground">
                      {totalPausadas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('concluida') ? [] : ['concluida']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('concluida') && "ring-2 ring-green-500 ring-offset-2"
                  )}
                  data-testid="button-filter-concluidas"
                >
                  <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Concluídas</p>
                    <p className="text-3xl font-bold text-green-600">
                      {totalConcluidas}
                    </p>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t">
                <Select 
                  value={statusFilter.length === 0 ? "todos" : statusFilter.length === 1 ? statusFilter[0] : "multiplos"}
                  onValueChange={(value) => {
                    if (value === "todos") {
                      setStatusFilter([]);
                    } else {
                      setStatusFilter([value]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="select-status-filter">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="aberta">Abertas</SelectItem>
                    <SelectItem value="em_execucao">Em Execução</SelectItem>
                    <SelectItem value="pausada">Pausadas</SelectItem>
                    <SelectItem value="vencida">Vencidas</SelectItem>
                    <SelectItem value="concluida">Concluídas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="w-full" data-testid="select-zone-filter">
                    <SelectValue placeholder="Todas as Zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Zonas</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </ModernCardContent>
          </ModernCard>

          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList>
              <TabsTrigger value="orders" className="flex items-center gap-2" data-testid="tab-orders">
                <ClipboardList className="w-4 h-4" />
                Ordens de Serviço ({filteredWorkOrders.length})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="flex items-center gap-2" data-testid="tab-proposals">
                <FileText className="w-4 h-4" />
                Propostas ({proposals.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <ModernCard>
                <ModernCardHeader icon={<ClipboardList className={cn("w-5 h-5", theme.text.primary)} />}>
                  Lista de Ordens de Serviço
                </ModernCardHeader>
                <ModernCardContent>
                  {filteredWorkOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Nenhuma ordem de serviço encontrada</p>
                      <p className="text-sm">Tente ajustar os filtros ou aguarde novas atribuições</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Zona</TableHead>
                            <TableHead>Prioridade</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[80px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredWorkOrders.map((wo) => (
                            <TableRow key={wo.id} data-testid={`row-wo-${wo.id}`}>
                              <TableCell className="font-medium max-w-[200px] truncate">{wo.title}</TableCell>
                              <TableCell>{zones.find(z => z.id === wo.zoneId)?.name || '-'}</TableCell>
                              <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                              <TableCell>{formatDateOnly(wo.dueDate)}</TableCell>
                              <TableCell>{getStatusBadge(wo.status)}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setSelectedWorkOrder(wo)}
                                  data-testid={`button-view-wo-${wo.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ModernCardContent>
              </ModernCard>
            </TabsContent>

            <TabsContent value="proposals">
              <ModernCard>
                <ModernCardHeader icon={<FileText className={cn("w-5 h-5", theme.text.primary)} />}>
                  Propostas de O.S.
                </ModernCardHeader>
                <ModernCardContent>
                  {loadingProposals ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : proposals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Nenhuma proposta enviada</p>
                      <p className="text-sm">Clique em "Nova Proposta" para criar uma solicitação</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Módulo</TableHead>
                            <TableHead>Prioridade</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {proposals.map((proposal) => (
                            <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                              <TableCell className="font-medium">{proposal.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {proposal.module === 'clean' ? 'Limpeza' : 'Manutenção'}
                                </Badge>
                              </TableCell>
                              <TableCell>{getPriorityBadge(proposal.priority)}</TableCell>
                              <TableCell>
                                {proposal.dueDate ? format(new Date(proposal.dueDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                              </TableCell>
                              <TableCell>{getProposalStatusBadge(proposal.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ModernCardContent>
              </ModernCard>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modal de Detalhes da O.S. */}
      <Dialog open={!!selectedWorkOrder} onOpenChange={(open) => !open && setSelectedWorkOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Detalhes da Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Visualize os detalhes da ordem de serviço atribuída
            </DialogDescription>
          </DialogHeader>
          
          {selectedWorkOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Título</label>
                  <p className="text-sm font-semibold">{selectedWorkOrder.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedWorkOrder.status)}</div>
                </div>
              </div>

              {selectedWorkOrder.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{selectedWorkOrder.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Zona</label>
                  <p className="text-sm">{zones.find(z => z.id === selectedWorkOrder.zoneId)?.name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                  <div className="mt-1">{getPriorityBadge(selectedWorkOrder.priority)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Prazo</label>
                  <p className="text-sm">{formatDateOnly(selectedWorkOrder.dueDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Módulo</label>
                  <Badge variant="outline">
                    {selectedWorkOrder.module === 'clean' ? 'Limpeza' : 'Manutenção'}
                  </Badge>
                </div>
              </div>

              {selectedWorkOrder.equipmentId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Equipamento</label>
                  <p className="text-sm">{equipment.find(e => e.id === selectedWorkOrder.equipmentId)?.name || '-'}</p>
                </div>
              )}


              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedWorkOrder(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
