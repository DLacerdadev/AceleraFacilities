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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Target, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Archive,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const scopeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  moduleId: z.string().min(1, "Módulo é obrigatório"),
  description: z.string().optional(),
});

type ScopeFormData = z.infer<typeof scopeSchema>;

interface OperationalScope {
  id: string;
  name: string;
  moduleId: string;
  description: string | null;
  customerId: string;
  thirdPartyCompanyId: string;
  status: string;
}

export default function ThirdPartyOperationalScopes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [scopeToArchive, setScopeToArchive] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState<OperationalScope | null>(null);

  const { data: scopes = [], isLoading: loadingScopes } = useQuery<OperationalScope[]>({
    queryKey: ['/api/third-party-portal/operational-scopes'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: modulesData } = useQuery<{ allowedModules: string[] }>({
    queryKey: ['/api/third-party-portal/my-modules'],
    enabled: !!user?.thirdPartyCompanyId,
  });
  const modules = modulesData?.allowedModules || [];

  const form = useForm<ScopeFormData>({
    resolver: zodResolver(scopeSchema),
    defaultValues: {
      name: "",
      moduleId: "",
      description: "",
    },
  });

  const editForm = useForm<ScopeFormData>({
    resolver: zodResolver(scopeSchema),
    defaultValues: {
      name: "",
      moduleId: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ScopeFormData) => {
      return await apiRequest("POST", `/api/third-party-portal/operational-scopes`, data);
    },
    onSuccess: () => {
      toast({ title: "Escopo operacional criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/operational-scopes'] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar escopo", description: error?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { scopeId: string; updates: Partial<ScopeFormData> }) => {
      return await apiRequest("PUT", `/api/third-party-portal/operational-scopes/${data.scopeId}`, data.updates);
    },
    onSuccess: () => {
      toast({ title: "Escopo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/operational-scopes'] });
      setIsEditDialogOpen(false);
      setEditingScope(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar escopo", description: error?.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (scopeId: string) => {
      return await apiRequest("DELETE", `/api/third-party-portal/operational-scopes/${scopeId}`);
    },
    onSuccess: () => {
      toast({ title: "Escopo arquivado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/operational-scopes'] });
      setArchiveDialogOpen(false);
      setScopeToArchive(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao arquivar escopo", description: error?.message, variant: "destructive" });
    },
  });

  const handleEdit = (scope: OperationalScope) => {
    setEditingScope(scope);
    editForm.reset({
      name: scope.name,
      moduleId: scope.moduleId,
      description: scope.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const getModuleName = (moduleId: string) => {
    switch (moduleId) {
      case 'clean': return 'Limpeza';
      case 'maintenance': return 'Manutenção';
      default: return moduleId;
    }
  };

  const getModuleBadgeClass = (moduleId: string) => {
    switch (moduleId) {
      case 'clean': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const activeScopes = scopes.filter(s => s.status === 'active');
  const archivedScopes = scopes.filter(s => s.status === 'archived');

  if (loadingScopes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isManager = user?.thirdPartyRole?.toUpperCase() === 'THIRD_PARTY_MANAGER';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Escopos Operacionais</h1>
          <p className="text-muted-foreground">
            Gerencie os escopos de trabalho da sua empresa
          </p>
        </div>
        {isManager && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                data-testid="button-new-scope"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Escopo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Escopo Operacional</DialogTitle>
                <DialogDescription>
                  Crie um escopo para organizar o trabalho da sua empresa
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Escopo</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Limpeza Bloco A" 
                            {...field} 
                            data-testid="input-scope-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="moduleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Módulo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-scope-module">
                              <SelectValue placeholder="Selecione o módulo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {modules.map((mod: any) => (
                              <SelectItem key={mod.id} value={mod.id}>
                                {mod.name}
                              </SelectItem>
                            ))}
                            {modules.length === 0 && (
                              <>
                                <SelectItem value="clean">Limpeza</SelectItem>
                                <SelectItem value="maintenance">Manutenção</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva o escopo de trabalho..." 
                            {...field} 
                            data-testid="input-scope-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-scope"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      className={theme.buttons.primary}
                      style={theme.buttons.primaryStyle}
                      data-testid="button-save-scope"
                    >
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Escopo
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Escopos Ativos ({activeScopes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeScopes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum escopo operacional cadastrado.
              {isManager && " Clique em 'Novo Escopo' para começar."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Descrição</TableHead>
                  {isManager && <TableHead className="w-[50px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeScopes.map((scope) => (
                  <TableRow key={scope.id} data-testid={`row-scope-${scope.id}`}>
                    <TableCell className="font-medium">{scope.name}</TableCell>
                    <TableCell>
                      <Badge className={getModuleBadgeClass(scope.moduleId)}>
                        {getModuleName(scope.moduleId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {scope.description || "-"}
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-scope-menu-${scope.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(scope)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setScopeToArchive(scope.id);
                                setArchiveDialogOpen(true);
                              }}
                              className="text-orange-600"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Arquivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {archivedScopes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Archive className="w-5 h-5" />
              Escopos Arquivados ({archivedScopes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedScopes.map((scope) => (
                  <TableRow key={scope.id} className="opacity-60">
                    <TableCell className="font-medium">{scope.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getModuleName(scope.moduleId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {scope.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Escopo</DialogTitle>
            <DialogDescription>Atualize as informações do escopo operacional</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form 
              onSubmit={editForm.handleSubmit((data) => 
                editingScope && updateMutation.mutate({ scopeId: editingScope.id, updates: data })
              )} 
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Escopo</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-scope-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-scope-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-update-scope"
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Escopo?</AlertDialogTitle>
            <AlertDialogDescription>
              O escopo será arquivado e não poderá mais ser usado para novas equipes.
              Equipes já vinculadas continuarão funcionando.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scopeToArchive && archiveMutation.mutate(scopeToArchive)}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
