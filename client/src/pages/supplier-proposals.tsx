import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/contexts/ClientContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Check, X, Eye, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import type { MaintenancePlanProposal, Supplier } from "@shared/schema";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  em_espera: { label: "Aguardando", variant: "secondary", icon: Clock },
  aprovado: { label: "Aprovado", variant: "default", icon: CheckCircle },
  recusado: { label: "Recusado", variant: "destructive", icon: XCircle },
};

const frequencyLabels: Record<string, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  sob_demanda: "Sob Demanda",
};

export default function SupplierProposals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeClientId } = useClient();
  
  const [selectedProposal, setSelectedProposal] = useState<MaintenancePlanProposal | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: proposals, isLoading } = useQuery<MaintenancePlanProposal[]>({
    queryKey: ['/api/customers', activeClientId, 'proposals'],
    enabled: !!activeClientId,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['/api/customers', activeClientId, 'suppliers'],
    enabled: !!activeClientId,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/proposals/${id}/approve`, { reviewNotes: notes });
    },
    onSuccess: () => {
      toast({ title: "Proposta aprovada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/customers', activeClientId, 'proposals'] });
      setIsApproveDialogOpen(false);
      setSelectedProposal(null);
      setReviewNotes("");
    },
    onError: () => {
      toast({ title: "Erro ao aprovar proposta", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/proposals/${id}/reject`, { reviewNotes: notes });
    },
    onSuccess: () => {
      toast({ title: "Proposta rejeitada" });
      queryClient.invalidateQueries({ queryKey: ['/api/customers', activeClientId, 'proposals'] });
      setIsRejectDialogOpen(false);
      setSelectedProposal(null);
      setReviewNotes("");
    },
    onError: () => {
      toast({ title: "Erro ao rejeitar proposta", variant: "destructive" });
    },
  });

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers?.find(s => s.id === supplierId);
    return supplier?.name || supplier?.tradeName || "Fornecedor";
  };

  const handleApprove = (proposal: MaintenancePlanProposal) => {
    setSelectedProposal(proposal);
    setReviewNotes("");
    setIsApproveDialogOpen(true);
  };

  const handleReject = (proposal: MaintenancePlanProposal) => {
    setSelectedProposal(proposal);
    setReviewNotes("");
    setIsRejectDialogOpen(true);
  };

  const handleView = (proposal: MaintenancePlanProposal) => {
    setSelectedProposal(proposal);
    setIsViewDialogOpen(true);
  };

  const pendingProposals = proposals?.filter(p => p.status === 'em_espera') || [];
  const processedProposals = proposals?.filter(p => p.status !== 'em_espera') || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Propostas de Fornecedores</h1>
          <p className="text-muted-foreground">Analise e aprove propostas de planos de manutenção</p>
        </div>
      </div>

      {pendingProposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Propostas Pendentes ({pendingProposals.length})
            </CardTitle>
            <CardDescription>Propostas aguardando sua análise e aprovação</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Nome do Plano</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Duração Est.</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingProposals.map((proposal) => (
                  <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                    <TableCell className="font-medium">{getSupplierName(proposal.supplierId)}</TableCell>
                    <TableCell>{proposal.name}</TableCell>
                    <TableCell>{frequencyLabels[proposal.frequency] || proposal.frequency}</TableCell>
                    <TableCell>{proposal.estimatedDurationMinutes ? `${proposal.estimatedDurationMinutes} min` : '-'}</TableCell>
                    <TableCell>{proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleView(proposal)}
                          data-testid={`button-view-proposal-${proposal.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(proposal)}
                          data-testid={`button-approve-proposal-${proposal.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(proposal)}
                          data-testid={`button-reject-proposal-${proposal.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Propostas</CardTitle>
          <CardDescription>Propostas já analisadas</CardDescription>
        </CardHeader>
        <CardContent>
          {processedProposals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma proposta processada ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Nome do Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Análise</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedProposals.map((proposal) => {
                  const status = statusConfig[proposal.status];
                  const StatusIcon = status?.icon || Clock;
                  return (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">{getSupplierName(proposal.supplierId)}</TableCell>
                      <TableCell>{proposal.name}</TableCell>
                      <TableCell>
                        <Badge variant={status?.variant || "secondary"} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="w-3 h-3" />
                          {status?.label || proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleView(proposal)}
                          data-testid={`button-view-processed-${proposal.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Proposta</DialogTitle>
          </DialogHeader>
          {selectedProposal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Fornecedor</Label>
                  <p className="font-medium">{getSupplierName(selectedProposal.supplierId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={statusConfig[selectedProposal.status]?.variant || "secondary"}>
                    {statusConfig[selectedProposal.status]?.label || selectedProposal.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nome do Plano</Label>
                  <p className="font-medium">{selectedProposal.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Frequência</Label>
                  <p>{frequencyLabels[selectedProposal.frequency] || selectedProposal.frequency}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duração Estimada</Label>
                  <p>{selectedProposal.estimatedDurationMinutes ? `${selectedProposal.estimatedDurationMinutes} minutos` : 'Não especificado'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data da Proposta</Label>
                  <p>{selectedProposal.createdAt ? new Date(selectedProposal.createdAt).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
              </div>
              {selectedProposal.description && (
                <div>
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p className="mt-1">{selectedProposal.description}</p>
                </div>
              )}
              {selectedProposal.reviewNotes && (
                <div>
                  <Label className="text-muted-foreground">Observações da Análise</Label>
                  <p className="mt-1">{selectedProposal.reviewNotes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Proposta</DialogTitle>
            <DialogDescription>
              Ao aprovar, um plano de manutenção será criado automaticamente com base nesta proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Adicione comentários sobre a aprovação..."
                data-testid="input-approve-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedProposal && approveMutation.mutate({ id: selectedProposal.id, notes: reviewNotes })}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Proposta</DialogTitle>
            <DialogDescription>
              Explique o motivo da rejeição para que o fornecedor possa ajustar a proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo da Rejeição</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Explique por que a proposta foi rejeitada..."
                data-testid="input-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedProposal && rejectMutation.mutate({ id: selectedProposal.id, notes: reviewNotes })}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
