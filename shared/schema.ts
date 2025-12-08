import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb, pgEnum, uniqueIndex, unique, date, time, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums baseados no backup real
export const userRoleEnum = pgEnum('user_role', ['admin', 'gestor_cliente', 'supervisor_site', 'operador', 'auditor']);
export const userTypeEnum = pgEnum('user_type', ['opus_user', 'customer_user']);
export const authProviderEnum = pgEnum('auth_provider', ['local', 'microsoft']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['aberta', 'em_execucao', 'pausada', 'vencida', 'concluida', 'cancelada']);
export const workOrderTypeEnum = pgEnum('work_order_type', ['programada', 'corretiva_interna', 'corretiva_publica']);
export const priorityEnum = pgEnum('priority', ['baixa', 'media', 'alta', 'critica']);
export const qrCodeTypeEnum = pgEnum('qr_code_type', ['execucao', 'atendimento']);
export const frequencyEnum = pgEnum('frequency', ['diaria', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual', 'turno', 'custom']);
export const bathroomCounterActionEnum = pgEnum('bathroom_counter_action', ['increment', 'decrement', 'reset']);
export const moduleEnum = pgEnum('module', ['clean', 'maintenance']);
export const equipmentStatusEnum = pgEnum('equipment_status', ['operacional', 'em_manutencao', 'inoperante', 'aposentado']);
export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'anthropic', 'google', 'groq', 'azure_openai', 'cohere', 'huggingface', 'custom']);
export const aiIntegrationStatusEnum = pgEnum('ai_integration_status', ['ativa', 'inativa', 'erro']);
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'syncing', 'synced', 'failed']);

// Sistema de permissões granulares
export const permissionKeyEnum = pgEnum('permission_key', [
  'dashboard_view',
  'workorders_view',
  'workorders_create', 
  'workorders_edit',
  'workorders_delete',
  'workorders_comment',
  'workorders_evaluate',
  'schedule_view',
  'schedule_create',
  'schedule_edit', 
  'schedule_delete',
  'checklists_view',
  'checklists_create',
  'checklists_edit',
  'checklists_delete',
  'qrcodes_view',
  'qrcodes_create',
  'qrcodes_edit',
  'qrcodes_delete',
  'floor_plan_view',
  'floor_plan_edit',
  'heatmap_view',
  'sites_view',
  'sites_create',
  'sites_edit',
  'sites_delete',
  'zones_view',
  'zones_create',
  'zones_edit',
  'zones_delete',
  'users_view',
  'users_create',
  'users_edit',
  'users_delete',
  'customers_view',
  'customers_create',
  'customers_edit',
  'customers_delete',
  'reports_view',
  'audit_logs_view',
  'service_settings_view',
  'service_settings_edit',
  'roles_manage',
  'system_roles_view',
  'system_roles_edit',
  'system_roles_delete',
  'opus_users_view',
  'opus_users_create',
  'opus_users_edit',
  'opus_users_delete',
  'client_users_view',
  'client_users_create',
  'client_users_edit',
  'client_users_delete'
]);

// 1. TABELA: companies (Empresas)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  cnpj: varchar("cnpj"),
  email: varchar("email"),
  phone: varchar("phone"),
  address: varchar("address"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 2. TABELA: customers (Clientes/Contratantes)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: varchar("name").notNull(),
  subdomain: varchar("subdomain").unique(),
  email: varchar("email"),
  phone: varchar("phone"),
  document: varchar("document"),
  address: varchar("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  contactPerson: varchar("contact_person"),
  notes: text("notes"),
  modules: text("modules").array().notNull().default(sql`ARRAY['clean']::text[]`),
  loginLogo: text("login_logo"),
  sidebarLogo: text("sidebar_logo"),
  sidebarLogoCollapsed: text("sidebar_logo_collapsed"),
  homeLogo: text("home_logo"),
  favicon: text("favicon"),
  moduleColors: jsonb("module_colors"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 3. TABELA: sites (Locais)
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  module: moduleEnum("module").notNull().default('clean'),
  name: varchar("name").notNull(),
  address: varchar("address"),
  description: text("description"),
  floorPlanImageUrl: varchar("floor_plan_image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Performance indexes for common queries
  customerModuleIdx: index("sites_customer_module_idx").on(table.customerId, table.module),
  companyIdIdx: index("sites_company_id_idx").on(table.companyId),
}));

// 4. TABELA: zones (Zonas/Áreas)
export const zones = pgTable("zones", {
  id: varchar("id").primaryKey(),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  module: moduleEnum("module").notNull().default('clean'),
  name: varchar("name").notNull(),
  description: text("description"),
  areaM2: decimal("area_m2", { precision: 10, scale: 2 }),
  capacity: integer("capacity"),
  category: varchar("category"),
  positionX: decimal("position_x", { precision: 5, scale: 2 }),
  positionY: decimal("position_y", { precision: 5, scale: 2 }),
  sizeScale: decimal("size_scale", { precision: 3, scale: 2 }),
  color: varchar("color"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Performance indexes for common queries
  siteModuleIdx: index("zones_site_module_idx").on(table.siteId, table.module),
  categoryIdx: index("zones_category_idx").on(table.category),
}));

// 5. TABELA: users (Usuários do Sistema)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  userNumber: integer("user_number").unique(),
  companyId: varchar("company_id").references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  username: varchar("username").notNull(),
  email: varchar("email").notNull().unique(),
  password: varchar("password"),
  name: varchar("name").notNull(),
  role: userRoleEnum("role").notNull(),
  userType: userTypeEnum("user_type").notNull().default('opus_user'),
  assignedClientId: varchar("assigned_client_id"),
  authProvider: authProviderEnum("auth_provider").default('local'),
  externalId: varchar("external_id"),
  msTenantId: varchar("ms_tenant_id"),
  modules: text("modules").array().notNull().default(sql`ARRAY['clean']::text[]`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 5a. TABELA: user_allowed_customers (Controle de Acesso a Clientes)
export const userAllowedCustomers = pgTable("user_allowed_customers", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueUserCustomer: unique().on(table.userId, table.customerId),
}));

// 6. TABELA: service_types (Tipos de Serviço)
export const serviceTypes = pgTable("service_types", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  name: varchar("name").notNull(),
  description: text("description"),
  code: varchar("code").notNull(),
  module: moduleEnum("module").notNull().default('clean'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 7. TABELA: service_categories (Categorias de Serviço)
export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey(),
  typeId: varchar("type_id").references(() => serviceTypes.id),
  name: varchar("name").notNull(),
  description: text("description"),
  code: varchar("code").notNull().unique(),
  module: moduleEnum("module").notNull().default('clean'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  customerId: varchar("customer_id").references(() => customers.id),
});

// 8. TABELA: services (Serviços Disponíveis)
export const services = pgTable("services", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  estimatedDurationMinutes: integer("estimated_duration_minutes"),
  priority: priorityEnum("priority").default('media'),
  requirements: text("requirements"),
  module: moduleEnum("module").notNull().default('clean'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  customerId: varchar("customer_id").references(() => customers.id),
  categoryId: varchar("category_id").references(() => serviceCategories.id),
  typeId: varchar("type_id").references(() => serviceTypes.id),
});

// 9. TABELA: cleaning_activities (Atividades de Limpeza)
export const cleaningActivities = pgTable("cleaning_activities", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  serviceId: varchar("service_id").references(() => services.id),
  siteId: varchar("site_id").references(() => sites.id),
  zoneId: varchar("zone_id").references(() => zones.id),
  name: varchar("name").notNull(),
  description: text("description"),
  frequency: frequencyEnum("frequency").notNull(),
  frequencyConfig: jsonb("frequency_config"),
  module: moduleEnum("module").notNull().default('clean'),
  checklistTemplateId: varchar("checklist_template_id").references(() => checklistTemplates.id),
  slaConfigId: varchar("sla_config_id").references(() => slaConfigs.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  startTime: time("start_time"),
  endTime: time("end_time"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  siteIds: text("site_ids").array(),
  zoneIds: text("zone_ids").array(),
});

// 10. TABELA: checklist_templates (Templates de Checklist)
export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  serviceId: varchar("service_id").references(() => services.id),
  siteId: varchar("site_id").references(() => sites.id),
  name: varchar("name").notNull(),
  description: text("description"),
  items: jsonb("items").notNull(),
  module: moduleEnum("module").notNull().default('clean'),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  zoneId: varchar("zone_id").references(() => zones.id),
  siteIds: text("site_ids").array(),
  zoneIds: text("zone_ids").array(),
});

// 11. TABELA: work_orders (Ordens de Trabalho)
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey(),
  number: integer("number").notNull(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  module: moduleEnum("module").notNull().default('clean'),
  zoneId: varchar("zone_id").references(() => zones.id),
  serviceId: varchar("service_id").references(() => services.id),
  cleaningActivityId: varchar("cleaning_activity_id").references(() => cleaningActivities.id),
  maintenanceActivityId: varchar("maintenance_activity_id").references(() => maintenanceActivities.id),
  checklistTemplateId: varchar("checklist_template_id").references(() => checklistTemplates.id),
  maintenanceChecklistTemplateId: varchar("maintenance_checklist_template_id").references(() => maintenanceChecklistTemplates.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  maintenancePlanEquipmentId: varchar("maintenance_plan_equipment_id").references(() => maintenancePlanEquipments.id),
  type: workOrderTypeEnum("type").notNull(),
  status: workOrderStatusEnum("status").notNull().default('aberta'),
  priority: priorityEnum("priority").notNull().default('media'),
  title: varchar("title").notNull(),
  description: text("description"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  assignedUserIds: text("assigned_user_ids").array(),
  origin: varchar("origin"),
  qrCodePointId: varchar("qr_code_point_id").references(() => qrCodePoints.id),
  requesterName: varchar("requester_name"),
  requesterContact: varchar("requester_contact"),
  scheduledDate: timestamp("scheduled_date"),
  dueDate: timestamp("due_date"),
  scheduledStartAt: timestamp("scheduled_start_at"),
  scheduledEndAt: timestamp("scheduled_end_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }),
  slaStartMinutes: integer("sla_start_minutes"),
  slaCompleteMinutes: integer("sla_complete_minutes"),
  observations: text("observations"),
  checklistData: jsonb("checklist_data"),
  attachments: jsonb("attachments"),
  customerRating: integer("customer_rating"),
  customerRatingComment: text("customer_rating_comment"),
  ratedAt: timestamp("rated_at"),
  ratedBy: varchar("rated_by").references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  // Offline sync fields
  localId: varchar("local_id"),
  syncStatus: syncStatusEnum("sync_status").default('synced'),
  createdOffline: boolean("created_offline").default(false),
  lastSyncAttempt: timestamp("last_sync_attempt"),
  syncRetryCount: integer("sync_retry_count").default(0),
  syncError: text("sync_error"),
  syncedAt: timestamp("synced_at"),
}, (table) => ({
  uniqueWorkOrderNumber: uniqueIndex("work_orders_customer_number_unique").on(table.customerId, table.number),
  uniqueCustomerLocalId: uniqueIndex("work_orders_customer_local_id_unique").on(table.customerId, table.localId).where(sql`local_id IS NOT NULL`),
  // Performance indexes for common queries
  customerModuleIdx: index("work_orders_customer_module_idx").on(table.customerId, table.module),
  zoneIdIdx: index("work_orders_zone_id_idx").on(table.zoneId),
  statusIdx: index("work_orders_status_idx").on(table.status),
  moduleStatusIdx: index("work_orders_module_status_idx").on(table.module, table.status),
  assignedUserIdx: index("work_orders_assigned_user_idx").on(table.assignedUserId),
  completedAtIdx: index("work_orders_completed_at_idx").on(table.completedAt),
  dueDateIdx: index("work_orders_due_date_idx").on(table.dueDate),
}));

// 11a. TABELA: work_order_attachments (Anexos de Ordens de Trabalho)
export const workOrderAttachments = pgTable("work_order_attachments", {
  id: varchar("id").primaryKey(),
  workOrderId: varchar("work_order_id").notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type"),
  fileSize: integer("file_size"),
  fileUrl: varchar("file_url"),
  localPath: varchar("local_path"),
  base64Data: text("base64_data"),
  caption: text("caption"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
  // Offline sync fields
  localId: varchar("local_id"),
  syncStatus: syncStatusEnum("sync_status").default('synced'),
  createdOffline: boolean("created_offline").default(false),
  lastSyncAttempt: timestamp("last_sync_attempt"),
  syncRetryCount: integer("sync_retry_count").default(0),
  syncError: text("sync_error"),
  syncedAt: timestamp("synced_at"),
}, (table) => ({
  uniqueWorkOrderLocalId: uniqueIndex("work_order_attachments_wo_local_id_unique").on(table.workOrderId, table.localId).where(sql`local_id IS NOT NULL`),
}));

// 12. TABELA: audit_logs (Logs de Auditoria)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").references(() => companies.id),
  userId: varchar("user_id").references(() => users.id),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: varchar("action").notNull(),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// 13. TABELA: dashboard_goals (Metas do Dashboard)
export const dashboardGoals = pgTable("dashboard_goals", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  module: moduleEnum("module").notNull().default('clean'),
  goalType: varchar("goal_type").notNull(),
  goalValue: decimal("goal_value", { precision: 10, scale: 2 }).notNull(),
  currentPeriod: varchar("current_period").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 14. TABELA: custom_roles (Roles Customizados)
export const customRoles = pgTable("custom_roles", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id), // Null para funções de sistema, preenchido para funções de cliente
  name: varchar("name").notNull(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false),
  isMobileOnly: boolean("is_mobile_only").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 15. TABELA: role_permissions (Permissões por Role)
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey(),
  roleId: varchar("role_id").notNull().references(() => customRoles.id),
  permission: permissionKeyEnum("permission").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// 16. TABELA: user_role_assignments (Usuários x Roles)
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  roleId: varchar("role_id").notNull().references(() => customRoles.id),
  customerId: varchar("customer_id").references(() => customers.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// 17. TABELA: user_site_assignments (Usuários x Locais)
export const userSiteAssignments = pgTable("user_site_assignments", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 18. TABELA: site_shifts (Turnos por Local)
export const siteShifts = pgTable("site_shifts", {
  id: varchar("id").primaryKey(),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  name: varchar("name").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 19. TABELA: sla_configs (Configurações de SLA)
export const slaConfigs = pgTable("sla_configs", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: varchar("name").notNull(),
  category: varchar("category"),
  module: moduleEnum("module").notNull().default('clean'),
  timeToStartMinutes: integer("time_to_start_minutes").notNull(),
  timeToCompleteMinutes: integer("time_to_complete_minutes").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 20. TABELA: webhook_configs (Configurações de Webhooks)
export const webhookConfigs = pgTable("webhook_configs", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: varchar("name").notNull(),
  url: varchar("url").notNull(),
  events: jsonb("events").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 21. TABELA: company_counters (Contadores da Empresa)
export const companyCounters = pgTable("company_counters", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  key: varchar("key").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 21B. TABELA: customer_counters (Contadores por Cliente)
export const customerCounters = pgTable("customer_counters", {
  id: varchar("id").primaryKey(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  key: varchar("key").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueCustomerKey: unique("customer_counters_customer_key_unique").on(table.customerId, table.key),
}));

// 22. TABELA: qr_code_points (Pontos de QR Code)
export const qrCodePoints = pgTable("qr_code_points", {
  id: varchar("id").primaryKey(),
  zoneId: varchar("zone_id").references(() => zones.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  serviceId: varchar("service_id").references(() => services.id),
  code: varchar("code").notNull().unique(),
  type: qrCodeTypeEnum("type").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  sizeCm: integer("size_cm").default(5), // Tamanho em centímetros (padrão 5cm)
  module: moduleEnum("module").notNull().default('clean'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 23. TABELA: service_zones (Serviços x Zonas)
export const serviceZones = pgTable("service_zones", {
  id: varchar("id").primaryKey(),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  zoneId: varchar("zone_id").notNull().references(() => zones.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueServiceZone: unique("unique_service_zone").on(table.serviceId, table.zoneId),
}));

// 24. TABELA: bathroom_counters (Contadores de Banheiro)
export const bathroomCounters = pgTable("bathroom_counters", {
  id: varchar("id").primaryKey(),
  zoneId: varchar("zone_id").notNull().references(() => zones.id),
  currentCount: integer("current_count").default(0),
  limitCount: integer("limit_count").notNull(),
  lastReset: timestamp("last_reset").default(sql`now()`),
  autoResetTurn: boolean("auto_reset_turn").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 25. TABELA: bathroom_counter_logs (Logs dos Contadores)
export const bathroomCounterLogs = pgTable("bathroom_counter_logs", {
  id: varchar("id").primaryKey(),
  counterId: varchar("counter_id").notNull().references(() => bathroomCounters.id),
  userId: varchar("user_id").references(() => users.id),
  delta: integer("delta").notNull(),
  action: bathroomCounterActionEnum("action").notNull(),
  previousValue: integer("previous_value").notNull(),
  newValue: integer("new_value").notNull(),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// 26. TABELA: public_request_logs (Logs de Solicitações Públicas)
export const publicRequestLogs = pgTable("public_request_logs", {
  id: varchar("id").primaryKey(),
  qrCodePointId: varchar("qr_code_point_id").references(() => qrCodePoints.id),
  ipHash: varchar("ip_hash").notNull(),
  userAgent: text("user_agent"),
  requestData: jsonb("request_data"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// 27. TABELA: work_order_comments (Comentários em Work Orders)
export const workOrderComments = pgTable("work_order_comments", {
  id: varchar("id").primaryKey(),
  workOrderId: varchar("work_order_id").notNull().references(() => workOrders.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  attachments: jsonb("attachments"),
  isReopenRequest: boolean("is_reopen_request").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// ============================================================================
// MÓDULO DE MANUTENÇÃO - Tabelas Específicas
// ============================================================================

// 28. TABELA: equipment_types (Tipos de Equipamento)
export const equipmentTypes = pgTable("equipment_types", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: varchar("name").notNull(),
  description: text("description"),
  module: moduleEnum("module").notNull().default('maintenance'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 29. TABELA: equipment (Equipamentos)
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  zoneId: varchar("zone_id").notNull().references(() => zones.id),
  equipmentTypeId: varchar("equipment_type_id").references(() => equipmentTypes.id),
  name: varchar("name").notNull(),
  internalCode: varchar("internal_code"),
  manufacturer: varchar("manufacturer"),
  model: varchar("model"),
  serialNumber: varchar("serial_number").unique(),
  purchaseDate: date("purchase_date"),
  warrantyExpiry: date("warranty_expiry"),
  installationDate: date("installation_date"),
  value: decimal("value", { precision: 10, scale: 2 }),
  status: equipmentStatusEnum("status").notNull().default('operacional'),
  technicalSpecs: jsonb("technical_specs"),
  maintenanceNotes: text("maintenance_notes"),
  qrCodeUrl: varchar("qr_code_url"),
  module: moduleEnum("module").notNull().default('maintenance'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 30. TABELA: maintenance_checklist_templates (Templates de Checklist de Manutenção)
export const maintenanceChecklistTemplates = pgTable("maintenance_checklist_templates", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  name: varchar("name").notNull(),
  description: text("description"),
  version: varchar("version").notNull().default('1.0'),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  siteIds: varchar("site_ids").array(),
  zoneIds: varchar("zone_ids").array(),
  equipmentIds: varchar("equipment_ids").array(),
  items: jsonb("items").notNull(),
  module: moduleEnum("module").notNull().default('maintenance'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 30. TABELA: maintenance_checklist_executions (Execuções de Checklist de Manutenção)
export const maintenanceChecklistExecutions = pgTable("maintenance_checklist_executions", {
  id: varchar("id").primaryKey(),
  checklistTemplateId: varchar("checklist_template_id").notNull().references(() => maintenanceChecklistTemplates.id),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
  workOrderId: varchar("work_order_id").references(() => workOrders.id),
  executedByUserId: varchar("executed_by_user_id").notNull().references(() => users.id),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  status: varchar("status").notNull().default('in_progress'),
  checklistData: jsonb("checklist_data"),
  observations: text("observations"),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  // Offline sync fields
  localId: varchar("local_id"),
  syncStatus: syncStatusEnum("sync_status").default('synced'),
  createdOffline: boolean("created_offline").default(false),
  lastSyncAttempt: timestamp("last_sync_attempt"),
  syncRetryCount: integer("sync_retry_count").default(0),
  syncError: text("sync_error"),
  syncedAt: timestamp("synced_at"),
}, (table) => ({
  uniqueWorkOrderLocalId: uniqueIndex("maintenance_checklist_executions_wo_local_id_unique").on(table.workOrderId, table.localId).where(sql`local_id IS NOT NULL`),
}));

// 31. TABELA: maintenance_plans (Planos de Manutenção)
export const maintenancePlans = pgTable("maintenance_plans", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").notNull().default('preventiva'),
  module: moduleEnum("module").notNull().default('maintenance'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 32. TABELA: maintenance_plan_equipments (Equipamentos no Plano de Manutenção)
export const maintenancePlanEquipments = pgTable("maintenance_plan_equipments", {
  id: varchar("id").primaryKey(),
  planId: varchar("plan_id").notNull().references(() => maintenancePlans.id),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
  checklistTemplateId: varchar("checklist_template_id").references(() => maintenanceChecklistTemplates.id),
  frequency: frequencyEnum("frequency").notNull(),
  frequencyConfig: jsonb("frequency_config"),
  nextExecutionAt: timestamp("next_execution_at"),
  lastExecutionAt: timestamp("last_execution_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniquePlanEquipment: unique("unique_plan_equipment").on(table.planId, table.equipmentId),
}));

// 33. TABELA: maintenance_activities (Atividades de Manutenção Programadas)
export const maintenanceActivities = pgTable("maintenance_activities", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  
  // Múltiplos locais/zonas
  siteIds: varchar("site_ids").array().notNull(),
  zoneIds: varchar("zone_ids").array().notNull(),
  
  // Múltiplos equipamentos
  equipmentIds: varchar("equipment_ids").array(), // Array de IDs de equipamentos
  
  // Campos antigos mantidos para compatibilidade (deprecated) - agora nullable
  siteId: varchar("site_id"),
  zoneId: varchar("zone_id"),
  
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").notNull().default('preventiva'), // preventiva, preditiva, corretiva
  frequency: frequencyEnum("frequency").notNull(),
  frequencyConfig: jsonb("frequency_config"),
  module: moduleEnum("module").notNull().default('maintenance'),
  checklistTemplateId: varchar("checklist_template_id").references(() => maintenanceChecklistTemplates.id),
  slaConfigId: varchar("sla_config_id").references(() => slaConfigs.id),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }),
  slaMinutes: integer("sla_minutes"),
  startDate: date("start_date"),
  lastExecutedAt: timestamp("last_executed_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  startTime: time("start_time"),
  endTime: time("end_time"),
});

// 34. TABELA: parts (Peças de Estoque)
export const parts = pgTable("parts", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  equipmentTypeId: varchar("equipment_type_id").references(() => equipmentTypes.id),
  name: varchar("name").notNull(),
  description: text("description"),
  partNumber: varchar("part_number"), // Código/número da peça
  unit: varchar("unit").default('un'), // unidade, litro, kg, etc
  currentQuantity: decimal("current_quantity", { precision: 10, scale: 2 }).notNull().default('0'),
  minimumQuantity: decimal("minimum_quantity", { precision: 10, scale: 2 }).notNull().default('0'),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }), // Preço de custo
  module: moduleEnum("module").notNull().default('maintenance'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// 35. TABELA: work_order_parts (Peças usadas em Ordens de Serviço)
export const workOrderParts = pgTable("work_order_parts", {
  id: varchar("id").primaryKey(),
  workOrderId: varchar("work_order_id").notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  partId: varchar("part_id").notNull().references(() => parts.id),
  quantityPlanned: decimal("quantity_planned", { precision: 10, scale: 2 }).notNull(), // Quantidade planejada
  quantityUsed: decimal("quantity_used", { precision: 10, scale: 2 }), // Quantidade efetivamente usada
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Custo unitário no momento do uso
  notes: text("notes"),
  stockDeducted: boolean("stock_deducted").default(false), // Se já foi descontado do estoque
  deductedAt: timestamp("deducted_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueWorkOrderPart: unique("unique_work_order_part").on(table.workOrderId, table.partId),
}));

// 36. TABELA: maintenance_plan_parts (Peças em Planos de Manutenção)
export const maintenancePlanParts = pgTable("maintenance_plan_parts", {
  id: varchar("id").primaryKey(),
  planId: varchar("plan_id").notNull().references(() => maintenancePlans.id, { onDelete: 'cascade' }),
  partId: varchar("part_id").notNull().references(() => parts.id),
  quantityPerExecution: decimal("quantity_per_execution", { precision: 10, scale: 2 }).notNull(), // Qtd por execução
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniquePlanPart: unique("unique_plan_part").on(table.planId, table.partId),
}));

// 36.5 TABELA: maintenance_activity_parts (Peças em Atividades de Manutenção)
export const maintenanceActivityParts = pgTable("maintenance_activity_parts", {
  id: varchar("id").primaryKey(),
  activityId: varchar("activity_id").notNull().references(() => maintenanceActivities.id, { onDelete: 'cascade' }),
  partId: varchar("part_id").notNull().references(() => parts.id),
  quantityPerExecution: decimal("quantity_per_execution", { precision: 10, scale: 2 }).notNull(), // Qtd por execução
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueActivityPart: unique("unique_activity_part").on(table.activityId, table.partId),
}));

// 37. TABELA: part_movements (Movimentações de Estoque)
export const partMovements = pgTable("part_movements", {
  id: varchar("id").primaryKey(),
  partId: varchar("part_id").notNull().references(() => parts.id),
  movementType: varchar("movement_type").notNull(), // 'entrada', 'saida', 'ajuste'
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  previousQuantity: decimal("previous_quantity", { precision: 10, scale: 2 }).notNull(),
  newQuantity: decimal("new_quantity", { precision: 10, scale: 2 }).notNull(),
  workOrderId: varchar("work_order_id").references(() => workOrders.id), // Referência se for saída por O.S.
  reason: text("reason"),
  performedByUserId: varchar("performed_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// AI Integrations (apenas para usuários OPUS)
export const aiIntegrations = pgTable("ai_integrations", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  
  name: varchar("name").notNull(), // Nome descritivo da integração
  provider: aiProviderEnum("provider").notNull(), // openai, anthropic, google, custom
  model: varchar("model").notNull(), // gpt-4, claude-3, gemini-1.5, etc
  apiKey: text("api_key").notNull(), // Armazenado criptografado
  endpoint: varchar("endpoint"), // Endpoint personalizado (opcional)
  
  status: aiIntegrationStatusEnum("status").notNull().default('ativa'),
  isDefault: boolean("is_default").default(false), // Se é a IA padrão do sistema
  
  // Configurações avançadas
  maxTokens: integer("max_tokens").default(4096),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default('0.7'),
  enableLogs: boolean("enable_logs").default(false),
  
  // Metadata
  lastTestedAt: timestamp("last_tested_at"),
  lastErrorMessage: text("last_error_message"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Chat Conversations - Sessões de conversa com IA
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  customerId: varchar("customer_id").references(() => customers.id),
  module: moduleEnum("module").notNull(), // Módulo ativo quando iniciou conversa
  title: varchar("title"), // Título gerado automaticamente baseado na primeira mensagem
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Chat Messages - Mensagens individuais em uma conversa
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  role: varchar("role").notNull(), // 'user' ou 'assistant'
  content: text("content").notNull(),
  context: jsonb("context"), // Contexto usado pela IA (O.S do dia, etc)
  aiIntegrationId: varchar("ai_integration_id").references(() => aiIntegrations.id), // Qual integração foi usada
  tokensUsed: integer("tokens_used"), // Tokens consumidos nesta mensagem
  error: text("error"), // Se houve erro ao processar
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  customers: many(customers),
  sites: many(sites),
  users: many(users),
  auditLogs: many(auditLogs),
  dashboardGoals: many(dashboardGoals),
  customRoles: many(customRoles),
  slaConfigs: many(slaConfigs),
  webhookConfigs: many(webhookConfigs),
  companyCounters: many(companyCounters),
  cleaningActivities: many(cleaningActivities),
  workOrders: many(workOrders),
  checklistTemplates: many(checklistTemplates),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, {
    fields: [customers.companyId],
    references: [companies.id],
  }),
  sites: many(sites),
  users: many(users),
  serviceTypes: many(serviceTypes),
  serviceCategories: many(serviceCategories),
  services: many(services),
  userRoleAssignments: many(userRoleAssignments),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  company: one(companies, {
    fields: [sites.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [sites.customerId],
    references: [customers.id],
  }),
  zones: many(zones),
  siteShifts: many(siteShifts),
  userSiteAssignments: many(userSiteAssignments),
  checklistTemplates: many(checklistTemplates),
  cleaningActivities: many(cleaningActivities),
}));

export const zonesRelations = relations(zones, ({ one, many }) => ({
  site: one(sites, {
    fields: [zones.siteId],
    references: [sites.id],
  }),
  qrCodePoints: many(qrCodePoints),
  serviceZones: many(serviceZones),
  bathroomCounters: many(bathroomCounters),
  cleaningActivities: many(cleaningActivities),
  workOrders: many(workOrders),
  checklistTemplates: many(checklistTemplates),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [users.customerId],
    references: [customers.id],
  }),
  auditLogs: many(auditLogs),
  userRoleAssignments: many(userRoleAssignments),
  userSiteAssignments: many(userSiteAssignments),
  assignedWorkOrders: many(workOrders),
  bathroomCounterLogs: many(bathroomCounterLogs),
  workOrderComments: many(workOrderComments),
}));

export const serviceTypesRelations = relations(serviceTypes, ({ one, many }) => ({
  company: one(companies, {
    fields: [serviceTypes.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [serviceTypes.customerId],
    references: [customers.id],
  }),
  serviceCategories: many(serviceCategories),
  services: many(services),
}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceCategories.customerId],
    references: [customers.id],
  }),
  serviceType: one(serviceTypes, {
    fields: [serviceCategories.typeId],
    references: [serviceTypes.id],
  }),
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  customer: one(customers, {
    fields: [services.customerId],
    references: [customers.id],
  }),
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  type: one(serviceTypes, {
    fields: [services.typeId],
    references: [serviceTypes.id],
  }),
  qrCodePoints: many(qrCodePoints),
  serviceZones: many(serviceZones),
  cleaningActivities: many(cleaningActivities),
  workOrders: many(workOrders),
  checklistTemplates: many(checklistTemplates),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  company: one(companies, {
    fields: [workOrders.companyId],
    references: [companies.id],
  }),
  zone: one(zones, {
    fields: [workOrders.zoneId],
    references: [zones.id],
  }),
  service: one(services, {
    fields: [workOrders.serviceId],
    references: [services.id],
  }),
  cleaningActivity: one(cleaningActivities, {
    fields: [workOrders.cleaningActivityId],
    references: [cleaningActivities.id],
  }),
  checklistTemplate: one(checklistTemplates, {
    fields: [workOrders.checklistTemplateId],
    references: [checklistTemplates.id],
  }),
  assignedUser: one(users, {
    fields: [workOrders.assignedUserId],
    references: [users.id],
  }),
  qrCodePoint: one(qrCodePoints, {
    fields: [workOrders.qrCodePointId],
    references: [qrCodePoints.id],
  }),
  comments: many(workOrderComments),
  attachments: many(workOrderAttachments),
}));

export const workOrderAttachmentsRelations = relations(workOrderAttachments, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderAttachments.workOrderId],
    references: [workOrders.id],
  }),
  uploadedByUser: one(users, {
    fields: [workOrderAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const cleaningActivitiesRelations = relations(cleaningActivities, ({ one, many }) => ({
  company: one(companies, {
    fields: [cleaningActivities.companyId],
    references: [companies.id],
  }),
  service: one(services, {
    fields: [cleaningActivities.serviceId],
    references: [services.id],
  }),
  site: one(sites, {
    fields: [cleaningActivities.siteId],
    references: [sites.id],
  }),
  zone: one(zones, {
    fields: [cleaningActivities.zoneId],
    references: [zones.id],
  }),
  checklistTemplate: one(checklistTemplates, {
    fields: [cleaningActivities.checklistTemplateId],
    references: [checklistTemplates.id],
  }),
  slaConfig: one(slaConfigs, {
    fields: [cleaningActivities.slaConfigId],
    references: [slaConfigs.id],
  }),
  workOrders: many(workOrders),
}));

export const checklistTemplatesRelations = relations(checklistTemplates, ({ one, many }) => ({
  company: one(companies, {
    fields: [checklistTemplates.companyId],
    references: [companies.id],
  }),
  service: one(services, {
    fields: [checklistTemplates.serviceId],
    references: [services.id],
  }),
  site: one(sites, {
    fields: [checklistTemplates.siteId],
    references: [sites.id],
  }),
  zone: one(zones, {
    fields: [checklistTemplates.zoneId],
    references: [zones.id],
  }),
  cleaningActivities: many(cleaningActivities),
  workOrders: many(workOrders),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const qrCodePointsRelations = relations(qrCodePoints, ({ one, many }) => ({
  zone: one(zones, {
    fields: [qrCodePoints.zoneId],
    references: [zones.id],
  }),
  service: one(services, {
    fields: [qrCodePoints.serviceId],
    references: [services.id],
  }),
  workOrders: many(workOrders),
  publicRequestLogs: many(publicRequestLogs),
}));

export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  company: one(companies, {
    fields: [customRoles.companyId],
    references: [companies.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoleAssignments: many(userRoleAssignments),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(customRoles, {
    fields: [rolePermissions.roleId],
    references: [customRoles.id],
  }),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRoleAssignments.userId],
    references: [users.id],
  }),
  role: one(customRoles, {
    fields: [userRoleAssignments.roleId],
    references: [customRoles.id],
  }),
  customer: one(customers, {
    fields: [userRoleAssignments.customerId],
    references: [customers.id],
  }),
}));

export const userSiteAssignmentsRelations = relations(userSiteAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userSiteAssignments.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [userSiteAssignments.siteId],
    references: [sites.id],
  }),
}));

export const siteShiftsRelations = relations(siteShifts, ({ one }) => ({
  site: one(sites, {
    fields: [siteShifts.siteId],
    references: [sites.id],
  }),
}));

export const slaConfigsRelations = relations(slaConfigs, ({ one, many }) => ({
  company: one(companies, {
    fields: [slaConfigs.companyId],
    references: [companies.id],
  }),
  cleaningActivities: many(cleaningActivities),
}));

export const webhookConfigsRelations = relations(webhookConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [webhookConfigs.companyId],
    references: [companies.id],
  }),
}));

export const companyCountersRelations = relations(companyCounters, ({ one }) => ({
  company: one(companies, {
    fields: [companyCounters.companyId],
    references: [companies.id],
  }),
}));

export const dashboardGoalsRelations = relations(dashboardGoals, ({ one }) => ({
  company: one(companies, {
    fields: [dashboardGoals.companyId],
    references: [companies.id],
  }),
}));

export const serviceZonesRelations = relations(serviceZones, ({ one }) => ({
  service: one(services, {
    fields: [serviceZones.serviceId],
    references: [services.id],
  }),
  zone: one(zones, {
    fields: [serviceZones.zoneId],
    references: [zones.id],
  }),
}));

export const bathroomCountersRelations = relations(bathroomCounters, ({ one, many }) => ({
  zone: one(zones, {
    fields: [bathroomCounters.zoneId],
    references: [zones.id],
  }),
  logs: many(bathroomCounterLogs),
}));

export const bathroomCounterLogsRelations = relations(bathroomCounterLogs, ({ one }) => ({
  counter: one(bathroomCounters, {
    fields: [bathroomCounterLogs.counterId],
    references: [bathroomCounters.id],
  }),
  user: one(users, {
    fields: [bathroomCounterLogs.userId],
    references: [users.id],
  }),
  workOrder: one(workOrders, {
    fields: [bathroomCounterLogs.workOrderId],
    references: [workOrders.id],
  }),
}));

export const publicRequestLogsRelations = relations(publicRequestLogs, ({ one }) => ({
  qrCodePoint: one(qrCodePoints, {
    fields: [publicRequestLogs.qrCodePointId],
    references: [qrCodePoints.id],
  }),
}));

export const workOrderCommentsRelations = relations(workOrderComments, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderComments.workOrderId],
    references: [workOrders.id],
  }),
  user: one(users, {
    fields: [workOrderComments.userId],
    references: [users.id],
  }),
}));

// Maintenance Relations
export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  company: one(companies, {
    fields: [equipment.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [equipment.customerId],
    references: [customers.id],
  }),
  site: one(sites, {
    fields: [equipment.siteId],
    references: [sites.id],
  }),
  zone: one(zones, {
    fields: [equipment.zoneId],
    references: [zones.id],
  }),
  equipmentType: one(equipmentTypes, {
    fields: [equipment.equipmentTypeId],
    references: [equipmentTypes.id],
  }),
  maintenanceChecklistExecutions: many(maintenanceChecklistExecutions),
  maintenancePlanEquipments: many(maintenancePlanEquipments),
  workOrders: many(workOrders),
  qrCodePoints: many(qrCodePoints),
}));

export const equipmentTypesRelations = relations(equipmentTypes, ({ one, many }) => ({
  company: one(companies, {
    fields: [equipmentTypes.companyId],
    references: [companies.id],
  }),
  equipment: many(equipment),
}));

export const maintenanceChecklistTemplatesRelations = relations(maintenanceChecklistTemplates, ({ one, many }) => ({
  company: one(companies, {
    fields: [maintenanceChecklistTemplates.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [maintenanceChecklistTemplates.customerId],
    references: [customers.id],
  }),
  maintenanceChecklistExecutions: many(maintenanceChecklistExecutions),
  maintenancePlanEquipments: many(maintenancePlanEquipments),
}));

export const maintenanceChecklistExecutionsRelations = relations(maintenanceChecklistExecutions, ({ one }) => ({
  checklistTemplate: one(maintenanceChecklistTemplates, {
    fields: [maintenanceChecklistExecutions.checklistTemplateId],
    references: [maintenanceChecklistTemplates.id],
  }),
  equipment: one(equipment, {
    fields: [maintenanceChecklistExecutions.equipmentId],
    references: [equipment.id],
  }),
  workOrder: one(workOrders, {
    fields: [maintenanceChecklistExecutions.workOrderId],
    references: [workOrders.id],
  }),
  executedBy: one(users, {
    fields: [maintenanceChecklistExecutions.executedByUserId],
    references: [users.id],
  }),
}));

export const maintenancePlansRelations = relations(maintenancePlans, ({ one, many }) => ({
  company: one(companies, {
    fields: [maintenancePlans.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [maintenancePlans.customerId],
    references: [customers.id],
  }),
  maintenancePlanEquipments: many(maintenancePlanEquipments),
}));

export const maintenancePlanEquipmentsRelations = relations(maintenancePlanEquipments, ({ one }) => ({
  plan: one(maintenancePlans, {
    fields: [maintenancePlanEquipments.planId],
    references: [maintenancePlans.id],
  }),
  equipment: one(equipment, {
    fields: [maintenancePlanEquipments.equipmentId],
    references: [equipment.id],
  }),
  checklistTemplate: one(maintenanceChecklistTemplates, {
    fields: [maintenancePlanEquipments.checklistTemplateId],
    references: [maintenanceChecklistTemplates.id],
  }),
}));

// Relations for Parts (Estoque de Peças)
export const partsRelations = relations(parts, ({ one, many }) => ({
  company: one(companies, {
    fields: [parts.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [parts.customerId],
    references: [customers.id],
  }),
  equipmentType: one(equipmentTypes, {
    fields: [parts.equipmentTypeId],
    references: [equipmentTypes.id],
  }),
  workOrderParts: many(workOrderParts),
  maintenancePlanParts: many(maintenancePlanParts),
  movements: many(partMovements),
}));

export const workOrderPartsRelations = relations(workOrderParts, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderParts.workOrderId],
    references: [workOrders.id],
  }),
  part: one(parts, {
    fields: [workOrderParts.partId],
    references: [parts.id],
  }),
}));

export const maintenancePlanPartsRelations = relations(maintenancePlanParts, ({ one }) => ({
  plan: one(maintenancePlans, {
    fields: [maintenancePlanParts.planId],
    references: [maintenancePlans.id],
  }),
  part: one(parts, {
    fields: [maintenancePlanParts.partId],
    references: [parts.id],
  }),
}));

export const partMovementsRelations = relations(partMovements, ({ one }) => ({
  part: one(parts, {
    fields: [partMovements.partId],
    references: [parts.id],
  }),
  workOrder: one(workOrders, {
    fields: [partMovements.workOrderId],
    references: [workOrders.id],
  }),
  performedBy: one(users, {
    fields: [partMovements.performedByUserId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertSiteSchema = createInsertSchema(sites).omit({ id: true });
export const insertZoneSchema = createInsertSchema(zones).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true }).extend({
  modules: z.array(z.enum(['clean', 'maintenance'])).min(1, 'Selecione pelo menos um módulo').default(['clean']),
});
export const insertUserAllowedCustomerSchema = createInsertSchema(userAllowedCustomers).omit({ id: true, createdAt: true });
export const insertServiceTypeSchema = createInsertSchema(serviceTypes).omit({ id: true });
export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertCleaningActivitySchema = createInsertSchema(cleaningActivities).omit({ id: true });
export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, number: true }).extend({
  completedAt: z.union([z.date(), z.string().datetime(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  startedAt: z.union([z.date(), z.string().datetime(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  scheduledStartAt: z.union([z.date(), z.string().datetime(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  scheduledEndAt: z.union([z.date(), z.string().datetime(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  scheduledDate: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});
export const insertWorkOrderAttachmentSchema = createInsertSchema(workOrderAttachments).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export const insertDashboardGoalSchema = createInsertSchema(dashboardGoals).omit({ id: true });
export const insertCustomRoleSchema = createInsertSchema(customRoles);
export const insertRolePermissionSchema = createInsertSchema(rolePermissions);
export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments);
export const insertUserSiteAssignmentSchema = createInsertSchema(userSiteAssignments);
export const insertSiteShiftSchema = createInsertSchema(siteShifts);
export const insertSlaConfigSchema = createInsertSchema(slaConfigs);
export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs);
export const insertCompanyCounterSchema = createInsertSchema(companyCounters);
export const insertCustomerCounterSchema = createInsertSchema(customerCounters);
export const insertQrCodePointSchema = createInsertSchema(qrCodePoints).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true
}).partial({
  code: true,
  serviceId: true,
  description: true,
  sizeCm: true,
  isActive: true
});
export const insertServiceZoneSchema = createInsertSchema(serviceZones);
export const insertBathroomCounterSchema = createInsertSchema(bathroomCounters);
export const insertBathroomCounterLogSchema = createInsertSchema(bathroomCounterLogs);
export const insertPublicRequestLogSchema = createInsertSchema(publicRequestLogs);
export const insertWorkOrderCommentSchema = createInsertSchema(workOrderComments);

// Maintenance insert schemas
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true }).extend({
  value: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => (val === null || val === undefined || val === '') ? null : String(val))
    .optional()
    .nullable(),
});
export const insertMaintenanceChecklistTemplateSchema = createInsertSchema(maintenanceChecklistTemplates).omit({ id: true });
export const insertMaintenanceChecklistExecutionSchema = createInsertSchema(maintenanceChecklistExecutions).omit({ id: true });
export const insertMaintenancePlanSchema = createInsertSchema(maintenancePlans).omit({ id: true });
export const insertMaintenancePlanEquipmentSchema = createInsertSchema(maintenancePlanEquipments).omit({ id: true });
export const insertMaintenanceActivitySchema = createInsertSchema(maintenanceActivities).omit({ id: true });

// Parts (Estoque) insert schemas
export const insertPartSchema = createInsertSchema(parts).omit({ id: true }).extend({
  currentQuantity: z.union([z.string(), z.number()]).transform(val => String(val)).default('0'),
  minimumQuantity: z.union([z.string(), z.number()]).transform(val => String(val)).default('0'),
  costPrice: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => (val === null || val === undefined || val === '') ? null : String(val))
    .optional()
    .nullable(),
});
export const insertWorkOrderPartSchema = createInsertSchema(workOrderParts).omit({ id: true }).extend({
  quantityPlanned: z.union([z.string(), z.number()]).transform(val => String(val)),
  quantityUsed: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => (val === null || val === undefined || val === '') ? null : String(val))
    .optional()
    .nullable(),
  unitCost: z.union([z.string(), z.number(), z.null(), z.undefined()])
    .transform(val => (val === null || val === undefined || val === '') ? null : String(val))
    .optional()
    .nullable(),
});
export const insertMaintenancePlanPartSchema = createInsertSchema(maintenancePlanParts).omit({ id: true }).extend({
  quantityPerExecution: z.union([z.string(), z.number()]).transform(val => String(val)),
});
export const insertMaintenanceActivityPartSchema = createInsertSchema(maintenanceActivityParts).omit({ id: true }).extend({
  quantityPerExecution: z.union([z.string(), z.number()]).transform(val => String(val)),
});
export const insertPartMovementSchema = createInsertSchema(partMovements).omit({ id: true }).extend({
  quantity: z.union([z.string(), z.number()]).transform(val => String(val)),
  previousQuantity: z.union([z.string(), z.number()]).transform(val => String(val)),
  newQuantity: z.union([z.string(), z.number()]).transform(val => String(val)),
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

export type Zone = typeof zones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserAllowedCustomer = typeof userAllowedCustomers.$inferSelect;
export type InsertUserAllowedCustomer = z.infer<typeof insertUserAllowedCustomerSchema>;

export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = z.infer<typeof insertServiceTypeSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type CleaningActivity = typeof cleaningActivities.$inferSelect;
export type InsertCleaningActivity = z.infer<typeof insertCleaningActivitySchema>;

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;

export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;

export type WorkOrderAttachment = typeof workOrderAttachments.$inferSelect;
export type InsertWorkOrderAttachment = z.infer<typeof insertWorkOrderAttachmentSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type DashboardGoal = typeof dashboardGoals.$inferSelect;
export type InsertDashboardGoal = z.infer<typeof insertDashboardGoalSchema>;

export type CustomRole = typeof customRoles.$inferSelect;
export type CustomRoleWithPermissions = CustomRole & { permissions: string[] };
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;

export type UserSiteAssignment = typeof userSiteAssignments.$inferSelect;
export type InsertUserSiteAssignment = z.infer<typeof insertUserSiteAssignmentSchema>;

export type SiteShift = typeof siteShifts.$inferSelect;
export type InsertSiteShift = z.infer<typeof insertSiteShiftSchema>;

export type SlaConfig = typeof slaConfigs.$inferSelect;
export type InsertSlaConfig = z.infer<typeof insertSlaConfigSchema>;

export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;

export type CompanyCounter = typeof companyCounters.$inferSelect;
export type InsertCompanyCounter = z.infer<typeof insertCompanyCounterSchema>;

export type CustomerCounter = typeof customerCounters.$inferSelect;
export type InsertCustomerCounter = z.infer<typeof insertCustomerCounterSchema>;

export type QrCodePoint = typeof qrCodePoints.$inferSelect;
export type InsertQrCodePoint = z.infer<typeof insertQrCodePointSchema>;

export type ServiceZone = typeof serviceZones.$inferSelect;
export type InsertServiceZone = z.infer<typeof insertServiceZoneSchema>;

export type BathroomCounter = typeof bathroomCounters.$inferSelect;
export type InsertBathroomCounter = z.infer<typeof insertBathroomCounterSchema>;

export type BathroomCounterLog = typeof bathroomCounterLogs.$inferSelect;
export type InsertBathroomCounterLog = z.infer<typeof insertBathroomCounterLogSchema>;

export type PublicRequestLog = typeof publicRequestLogs.$inferSelect;
export type InsertPublicRequestLog = z.infer<typeof insertPublicRequestLogSchema>;

export type WorkOrderComment = typeof workOrderComments.$inferSelect;
export type InsertWorkOrderComment = z.infer<typeof insertWorkOrderCommentSchema>;

// Maintenance types
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type MaintenanceChecklistTemplate = typeof maintenanceChecklistTemplates.$inferSelect;
export type InsertMaintenanceChecklistTemplate = z.infer<typeof insertMaintenanceChecklistTemplateSchema>;

export type MaintenanceChecklistExecution = typeof maintenanceChecklistExecutions.$inferSelect;
export type InsertMaintenanceChecklistExecution = z.infer<typeof insertMaintenanceChecklistExecutionSchema>;

export type MaintenancePlan = typeof maintenancePlans.$inferSelect;
export type InsertMaintenancePlan = z.infer<typeof insertMaintenancePlanSchema>;

export type MaintenancePlanEquipment = typeof maintenancePlanEquipments.$inferSelect;
export type InsertMaintenancePlanEquipment = z.infer<typeof insertMaintenancePlanEquipmentSchema>;

export type MaintenanceActivity = typeof maintenanceActivities.$inferSelect;
export type InsertMaintenanceActivity = z.infer<typeof insertMaintenanceActivitySchema>;

// Parts (Estoque) types
export type Part = typeof parts.$inferSelect;
export type InsertPart = z.infer<typeof insertPartSchema>;

export type WorkOrderPart = typeof workOrderParts.$inferSelect;
export type InsertWorkOrderPart = z.infer<typeof insertWorkOrderPartSchema>;

export type MaintenancePlanPart = typeof maintenancePlanParts.$inferSelect;
export type InsertMaintenancePlanPart = z.infer<typeof insertMaintenancePlanPartSchema>;

export type MaintenanceActivityPart = typeof maintenanceActivityParts.$inferSelect;
export type InsertMaintenanceActivityPart = z.infer<typeof insertMaintenanceActivityPartSchema>;

export type PartMovement = typeof partMovements.$inferSelect;
export type InsertPartMovement = z.infer<typeof insertPartMovementSchema>;

// AI Integration schemas
export const insertAiIntegrationSchema = createInsertSchema(aiIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiIntegration = typeof aiIntegrations.$inferSelect;
export type InsertAiIntegration = z.infer<typeof insertAiIntegrationSchema>;

// Chat schemas
export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// ============================================================================
// Offline Sync Types
// ============================================================================

// Sync batch request - dados vindos do dispositivo offline
export const syncBatchRequestSchema = z.object({
  workOrders: z.array(insertWorkOrderSchema.extend({
    localId: z.string(),
    syncStatus: z.enum(['pending', 'syncing', 'synced', 'failed']).optional(),
    createdOffline: z.boolean().optional(),
  })).optional(),
  checklistExecutions: z.array(insertMaintenanceChecklistExecutionSchema.extend({
    localId: z.string(),
    syncStatus: z.enum(['pending', 'syncing', 'synced', 'failed']).optional(),
    createdOffline: z.boolean().optional(),
  })).optional(),
  attachments: z.array(insertWorkOrderAttachmentSchema.extend({
    localId: z.string(),
    syncStatus: z.enum(['pending', 'syncing', 'synced', 'failed']).optional(),
    createdOffline: z.boolean().optional(),
  })).optional(),
});

export type SyncBatchRequest = z.infer<typeof syncBatchRequestSchema>;

// Sync batch response - mapeamento de IDs locais para IDs do servidor
export type SyncBatchResponse = {
  success: boolean;
  workOrders: {
    localId: string;
    serverId: string;
    status: 'synced' | 'failed';
    error?: string;
  }[];
  checklistExecutions: {
    localId: string;
    serverId: string;
    status: 'synced' | 'failed';
    error?: string;
  }[];
  attachments: {
    localId: string;
    serverId: string;
    status: 'synced' | 'failed';
    error?: string;
  }[];
  timestamp: string;
};