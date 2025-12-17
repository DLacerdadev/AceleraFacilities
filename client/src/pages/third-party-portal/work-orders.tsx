import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard } from "@/components/ui/modern-card";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  const { data: workOrders = [], isLoading: loadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['/api/third-party-portal/work-orders'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/proposals'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['/api/third-party-portal/zones'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['/api/third-party-portal/equipment'],
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
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/proposals'] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar proposta", description: error?.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberta':
        return <Badge variant="outline">Aberta</Badge>;
      case 'em_execucao':
        return <Badge className="bg-blue-500/10 text-blue-600">Em Execução</Badge>;
      case 'pausada':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Pausada</Badge>;
      case 'concluida':
        return <Badge className="bg-chart-2/10 text-chart-2">Concluída</Badge>;
      case 'vencida':
        return <Badge className="bg-red-500/10 text-red-600">Vencida</Badge>;
      case 'cancelada':
        return <Badge variant="outline" className="text-muted-foreground">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProposalStatusBadge = (status: string) => {
    switch (status) {
      case 'em_espera':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Aguardando Aprovação</Badge>;
      case 'aprovado':
        return <Badge className="bg-chart-2/10 text-chart-2">Aprovada</Badge>;
      case 'recusado':
        return <Badge className="bg-red-500/10 text-red-600">Recusada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critica':
        return <Badge className="bg-red-500/10 text-red-600">Crítica</Badge>;
      case 'alta':
        return <Badge className="bg-orange-500/10 text-orange-600">Alta</Badge>;
      case 'media':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Média</Badge>;
      case 'baixa':
        return <Badge className="bg-chart-2/10 text-chart-2">Baixa</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const activeWorkOrders = workOrders.filter(wo => wo.status !== 'concluida' && wo.status !== 'cancelada');
  const completedWorkOrders = workOrders.filter(wo => wo.status === 'concluida');

  if (loadingWorkOrders) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as ordens de serviço
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-new-proposal"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Proposta de O.S.
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
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active-orders">
            <Clock className="w-4 h-4" />
            Ativas ({activeWorkOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2" data-testid="tab-completed-orders">
            <CheckCircle className="w-4 h-4" />
            Concluídas ({completedWorkOrders.length})
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2" data-testid="tab-proposals">
            <AlertTriangle className="w-4 h-4" />
            Propostas ({proposals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ModernCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Ordens de Serviço Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeWorkOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ordem de serviço ativa</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeWorkOrders.map((wo) => (
                      <TableRow key={wo.id} data-testid={`row-wo-${wo.id}`}>
                        <TableCell className="font-medium">{wo.title}</TableCell>
                        <TableCell>{wo.zoneName || '-'}</TableCell>
                        <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                        <TableCell>
                          {wo.dueDate ? format(new Date(wo.dueDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(wo.status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" data-testid={`button-view-wo-${wo.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </ModernCard>
        </TabsContent>

        <TabsContent value="completed">
          <ModernCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Ordens de Serviço Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedWorkOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ordem de serviço concluída</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Concluída em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedWorkOrders.map((wo) => (
                      <TableRow key={wo.id} data-testid={`row-wo-completed-${wo.id}`}>
                        <TableCell className="font-medium">{wo.title}</TableCell>
                        <TableCell>{wo.zoneName || '-'}</TableCell>
                        <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                        <TableCell>
                          {wo.completedAt ? format(new Date(wo.completedAt), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" data-testid={`button-view-wo-completed-${wo.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </ModernCard>
        </TabsContent>

        <TabsContent value="proposals">
          <ModernCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Propostas de O.S.
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProposals ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma proposta enviada</p>
                  <p className="text-sm">Clique em "Nova Proposta de O.S." para criar</p>
                </div>
              ) : (
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
              )}
            </CardContent>
          </ModernCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
