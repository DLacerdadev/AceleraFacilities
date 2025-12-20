import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Users, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  UserPlus,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard } from "@/components/ui/modern-card";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const teamSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  leaderId: z.string().optional(),
  operationalScopeId: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface OperationalScope {
  id: string;
  name: string;
  moduleId: string;
  status: string;
}

export default function ThirdPartyTeams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const { data: teams = [], isLoading: loadingTeams } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/teams'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/users'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: operationalScopes = [] } = useQuery<OperationalScope[]>({
    queryKey: ['/api/third-party-portal/operational-scopes'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const activeScopes = operationalScopes.filter(s => s.status === 'active');
  const leaders = users.filter(u => u.thirdPartyRole?.toUpperCase() === 'THIRD_PARTY_TEAM_LEADER' && u.isActive);
  const operators = users.filter(u => u.thirdPartyRole?.toUpperCase() === 'THIRD_PARTY_OPERATOR' && u.isActive);

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      leaderId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      return await apiRequest("POST", `/api/third-party-portal/teams`, data);
    },
    onSuccess: () => {
      toast({ title: "Equipe criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/teams'] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar equipe", description: error?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { teamId: string; updates: Partial<TeamFormData> }) => {
      return await apiRequest("PUT", `/api/third-party-portal/teams/${data.teamId}`, data.updates);
    },
    onSuccess: () => {
      toast({ title: "Equipe atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/teams'] });
      setIsEditDialogOpen(false);
      setEditingTeam(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar equipe", description: error?.message, variant: "destructive" });
    },
  });

  const updateMembersMutation = useMutation({
    mutationFn: async (data: { teamId: string; memberIds: string[] }) => {
      return await apiRequest("PUT", `/api/third-party-portal/teams/${data.teamId}/members`, { memberIds: data.memberIds });
    },
    onSuccess: () => {
      toast({ title: "Membros atualizados com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/teams'] });
      setIsMembersDialogOpen(false);
      setSelectedTeam(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar membros", description: error?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return await apiRequest("DELETE", `/api/third-party-portal/teams/${teamId}`);
    },
    onSuccess: () => {
      toast({ title: "Equipe excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/teams'] });
      setDeleteDialogOpen(false);
      setTeamToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir equipe", description: error?.message, variant: "destructive" });
    },
  });

  const handleManageMembers = (team: any) => {
    setSelectedTeam(team);
    setSelectedMembers(team.memberIds || []);
    setIsMembersDialogOpen(true);
  };

  if (loadingTeams) {
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
          <h1 className="text-2xl font-bold">Gestão de Equipes</h1>
          <p className="text-muted-foreground">
            Organize seus usuários em equipes de trabalho
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-new-team"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Equipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Equipe</DialogTitle>
              <DialogDescription>Crie uma nova equipe de trabalho</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Equipe</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da equipe" {...field} data-testid="input-team-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Líder da Equipe</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-team-leader">
                            <SelectValue placeholder="Selecione o líder" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leaders.map((leader) => (
                            <SelectItem key={leader.id} value={leader.id}>
                              {leader.name}
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
                  name="operationalScopeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escopo Operacional</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-team-scope">
                            <SelectValue placeholder="Selecione o escopo (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeScopes.map((scope) => (
                            <SelectItem key={scope.id} value={scope.id}>
                              {scope.name} ({scope.moduleId === 'clean' ? 'Limpeza' : 'Manutenção'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    disabled={createMutation.isPending}
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                    data-testid="button-submit-team"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Equipe"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <ModernCard variant="gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Equipes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma equipe cadastrada</p>
              <p className="text-sm">Clique em "Nova Equipe" para criar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Líder</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead className="w-[50px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id} data-testid={`row-team-${team.id}`}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      {team.operationalScope ? (
                        <Badge variant="outline">
                          {team.operationalScope.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {team.leader?.name || <span className="text-muted-foreground">Sem líder</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {team.memberIds?.length || 0} membros
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-team-actions-${team.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setEditingTeam(team);
                              setIsEditDialogOpen(true);
                            }} 
                            data-testid={`button-edit-team-${team.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleManageMembers(team)}
                            data-testid={`button-members-team-${team.id}`}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Gerenciar Membros
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setTeamToDelete(team.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600"
                            data-testid={`button-delete-team-${team.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </ModernCard>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Equipe</DialogTitle>
            <DialogDescription>Atualize as informações da equipe</DialogDescription>
          </DialogHeader>
          {editingTeam && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Equipe</label>
                <Input 
                  defaultValue={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  data-testid="input-edit-team-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Líder da Equipe</label>
                <Select 
                  defaultValue={editingTeam.leaderId}
                  onValueChange={(value) => setEditingTeam({ ...editingTeam, leaderId: value })}
                >
                  <SelectTrigger data-testid="select-edit-team-leader">
                    <SelectValue placeholder="Selecione o líder" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaders.map((leader) => (
                      <SelectItem key={leader.id} value={leader.id}>
                        {leader.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Escopo Operacional</label>
                <Select 
                  defaultValue={editingTeam.operationalScopeId || ""}
                  onValueChange={(value) => setEditingTeam({ ...editingTeam, operationalScopeId: value || null })}
                >
                  <SelectTrigger data-testid="select-edit-team-scope">
                    <SelectValue placeholder="Selecione o escopo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeScopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.name} ({scope.moduleId === 'clean' ? 'Limpeza' : 'Manutenção'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    updateMutation.mutate({
                      teamId: editingTeam.id,
                      updates: {
                        name: editingTeam.name,
                        leaderId: editingTeam.leaderId,
                        operationalScopeId: editingTeam.operationalScopeId,
                      },
                    });
                  }}
                  disabled={updateMutation.isPending}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-save-team"
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Membros</DialogTitle>
            <DialogDescription>
              Selecione os operadores que fazem parte desta equipe
            </DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <div className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                {operators.map((op) => (
                  <div key={op.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedMembers.includes(op.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedMembers([...selectedMembers, op.id]);
                        } else {
                          setSelectedMembers(selectedMembers.filter(id => id !== op.id));
                        }
                      }}
                      data-testid={`checkbox-member-${op.id}`}
                    />
                    <span className="text-sm">{op.name}</span>
                  </div>
                ))}
                {operators.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum operador disponível</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsMembersDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    updateMembersMutation.mutate({
                      teamId: selectedTeam.id,
                      memberIds: selectedMembers,
                    });
                  }}
                  disabled={updateMembersMutation.isPending}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-save-members"
                >
                  {updateMembersMutation.isPending ? "Salvando..." : "Salvar Membros"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => teamToDelete && deleteMutation.mutate(teamToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
