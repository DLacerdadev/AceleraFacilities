import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Loader2, Building, UserPlus, Link2, X, Users } from "lucide-react";
import { useClient } from "@/contexts/ClientContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleTheme } from "@/hooks/use-module-theme";
import type { Supplier } from "@shared/schema";

type Customer = {
  id: string;
  name: string;
  tradeName?: string;
};

type SupplierCustomer = {
  id: string;
  supplierId: string;
  customerId: string;
  customer?: Customer;
};

type SupplierUser = {
  id: string;
  supplierId: string;
  userId: string;
  role: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
  userType: string;
};

export default function Suppliers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeClient, activeClientId, customers } = useClient();
  const { can } = usePermissions();
  const theme = useModuleTheme();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCustomersDialogOpen, setIsCustomersDialogOpen] = useState(false);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    tradeName: "",
    cnpj: "",
    email: "",
    phone: "",
  });

  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");

  const companyId = activeClient?.companyId;
  const hasViewPermission = can.viewSuppliers();

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    enabled: !!companyId && hasViewPermission,
  });

  const { data: supplierCustomers = [] } = useQuery<SupplierCustomer[]>({
    queryKey: ['/api/suppliers', selectedSupplier?.id, 'customers'],
    enabled: !!selectedSupplier?.id && isCustomersDialogOpen,
  });

  const { data: supplierUsers = [] } = useQuery<SupplierUser[]>({
    queryKey: ['/api/suppliers', selectedSupplier?.id, 'users'],
    enabled: !!selectedSupplier?.id && isUsersDialogOpen,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAddUserDialogOpen,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/suppliers", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Fornecedor criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar fornecedor", description: error.message, variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/suppliers/${selectedSupplier?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Fornecedor atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar fornecedor", description: error.message, variant: "destructive" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/suppliers/${supplierToDelete?.id}`);
    },
    onSuccess: () => {
      toast({ title: "Fornecedor excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir fornecedor", description: error.message, variant: "destructive" });
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest("POST", `/api/suppliers/${selectedSupplier?.id}/customers`, { customerId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Cliente vinculado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', selectedSupplier?.id, 'customers'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao vincular cliente", description: error.message, variant: "destructive" });
    },
  });

  const removeCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await apiRequest("DELETE", `/api/suppliers/${selectedSupplier?.id}/customers/${customerId}`);
    },
    onSuccess: () => {
      toast({ title: "Cliente desvinculado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', selectedSupplier?.id, 'customers'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao desvincular cliente", description: error.message, variant: "destructive" });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      const response = await apiRequest("POST", `/api/suppliers/${selectedSupplier?.id}/users`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário adicionado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', selectedSupplier?.id, 'users'] });
      setIsAddUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("viewer");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar usuário", description: error.message, variant: "destructive" });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/suppliers/${selectedSupplier?.id}/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Usuário removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers', selectedSupplier?.id, 'users'] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover usuário", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      tradeName: "",
      cnpj: "",
      email: "",
      phone: "",
    });
    setSelectedCustomers([]);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    
    createSupplierMutation.mutate({
      ...formData,
      companyId,
      isActive: true,
      initialCustomerId: activeClientId,
    });
  };

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    
    updateSupplierMutation.mutate(formData);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      tradeName: supplier.tradeName || "",
      cnpj: supplier.cnpj || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteDialogOpen(true);
  };

  const handleManageCustomers = (supplier: Supplier) => {
    if (!can.editSuppliers()) return;
    setSelectedSupplier(supplier);
    setIsCustomersDialogOpen(true);
  };

  const handleManageUsers = (supplier: Supplier) => {
    if (!can.editSuppliers()) return;
    setSelectedSupplier(supplier);
    setIsUsersDialogOpen(true);
  };

  const linkedCustomerIds = supplierCustomers.map(sc => sc.customerId);
  const availableCustomers = customers.filter(c => !linkedCustomerIds.includes(c.id));

  const existingUserIds = supplierUsers.map(su => su.userId);
  const availableUsers = allUsers.filter(u => !existingUserIds.includes(u.id));

  if (!hasViewPermission) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Você não tem permissão para visualizar fornecedores.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-suppliers-title">Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Gerencie os fornecedores do sistema</p>
        </div>
        {can.createSuppliers() && (
          <Button
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className={theme.buttons.primary}
            style={theme.buttons.primaryStyle}
            data-testid="button-create-supplier"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum fornecedor cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.tradeName || "-"}</TableCell>
                    <TableCell>{supplier.cnpj || "-"}</TableCell>
                    <TableCell>{supplier.email || "-"}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={supplier.isActive ? "default" : "secondary"}>
                        {supplier.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can.editSuppliers() && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleManageCustomers(supplier)}
                              title="Gerenciar Clientes"
                              data-testid={`button-manage-customers-${supplier.id}`}
                            >
                              <Link2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleManageUsers(supplier)}
                              title="Gerenciar Usuários"
                              data-testid={`button-manage-users-${supplier.id}`}
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {can.editSuppliers() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(supplier)}
                            data-testid={`button-edit-supplier-${supplier.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {can.deleteSuppliers() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(supplier)}
                            data-testid={`button-delete-supplier-${supplier.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Razão Social"
                data-testid="input-supplier-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nome Fantasia</Label>
              <Input
                id="tradeName"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                placeholder="Nome Fantasia"
                data-testid="input-supplier-trade-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ/CPF</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                data-testid="input-supplier-cnpj"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@fornecedor.com"
                data-testid="input-supplier-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                data-testid="input-supplier-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createSupplierMutation.isPending}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-confirm-create-supplier"
            >
              {createSupplierMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Razão Social"
                data-testid="input-edit-supplier-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tradeName">Nome Fantasia</Label>
              <Input
                id="edit-tradeName"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                placeholder="Nome Fantasia"
                data-testid="input-edit-supplier-trade-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cnpj">CNPJ/CPF</Label>
              <Input
                id="edit-cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                data-testid="input-edit-supplier-cnpj"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@fornecedor.com"
                data-testid="input-edit-supplier-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                data-testid="input-edit-supplier-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateSupplierMutation.isPending}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-confirm-edit-supplier"
            >
              {updateSupplierMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomersDialogOpen} onOpenChange={setIsCustomersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clientes Vinculados - {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(customerId) => {
                  if (customerId) {
                    addCustomerMutation.mutate(customerId);
                  }
                }}
              >
                <SelectTrigger className="flex-1" data-testid="select-add-customer">
                  <SelectValue placeholder="Selecione um cliente para vincular..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg divide-y">
              {supplierCustomers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum cliente vinculado
                </div>
              ) : (
                supplierCustomers.map((sc) => (
                  <div key={sc.id} className="flex items-center justify-between p-3" data-testid={`linked-customer-${sc.customerId}`}>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span>{sc.customer?.name || "Cliente não encontrado"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomerMutation.mutate(sc.customerId)}
                      disabled={removeCustomerMutation.isPending}
                      data-testid={`button-remove-customer-${sc.customerId}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomersDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usuários do Fornecedor - {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              onClick={() => setIsAddUserDialogOpen(true)}
              variant="outline"
              className="w-full"
              data-testid="button-add-supplier-user"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Usuário
            </Button>

            <div className="border rounded-lg divide-y">
              {supplierUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum usuário vinculado
                </div>
              ) : (
                supplierUsers.map((su) => (
                  <div key={su.id} className="flex items-center justify-between p-3" data-testid={`supplier-user-${su.userId}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-secondary-foreground">
                          {su.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{su.user?.name || "Usuário não encontrado"}</p>
                        <p className="text-sm text-muted-foreground">{su.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{su.role === 'admin' ? 'Administrador' : 'Visualizador'}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUserMutation.mutate(su.userId)}
                        disabled={removeUserMutation.isPending}
                        data-testid={`button-remove-user-${su.userId}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUsersDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário ao Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione o Usuário</Label>
              <Select onValueChange={setNewUserEmail}>
                <SelectTrigger data-testid="select-new-supplier-user">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (newUserEmail) {
                  addUserMutation.mutate({ userId: newUserEmail, role: newUserRole });
                }
              }}
              disabled={!newUserEmail || addUserMutation.isPending}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-confirm-add-user"
            >
              {addUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fornecedor "{supplierToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSupplierMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-supplier"
            >
              {deleteSupplierMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
