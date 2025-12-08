import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { broadcast, forceLogoutUser } from "./websocket";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { 
  insertCompanySchema, insertSiteSchema, insertZoneSchema, insertQrCodePointSchema,
  insertUserSchema, insertChecklistTemplateSchema, insertSlaConfigSchema,
  insertCleaningActivitySchema, insertWorkOrderSchema, insertBathroomCounterSchema,
  insertWebhookConfigSchema, insertServiceSchema, insertServiceTypeSchema, insertServiceCategorySchema,
  insertDashboardGoalSchema, insertCustomerSchema,
  insertCustomRoleSchema, insertRolePermissionSchema, insertUserRoleAssignmentSchema,
  insertUserSiteAssignmentSchema, insertPublicRequestLogSchema, insertSiteShiftSchema,
  insertBathroomCounterLogSchema, insertCompanyCounterSchema,
  insertEquipmentSchema, insertMaintenanceChecklistTemplateSchema,
  insertMaintenanceChecklistExecutionSchema, insertMaintenancePlanSchema,
  insertMaintenancePlanEquipmentSchema, insertMaintenanceActivitySchema,
  insertAiIntegrationSchema,
  insertPartSchema, insertWorkOrderPartSchema, insertMaintenancePlanPartSchema,
  insertMaintenanceActivityPartSchema, insertPartMovementSchema,
  syncBatchRequestSchema,
  customers,
  type User, type InsertUser
} from "@shared/schema";
import { nanoid } from "nanoid";
import { z } from "zod";
import crypto from "crypto";
import { db } from "./db";
import { eq, and, ne } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  requireManageClients,
  requireManageUsers,
  requireManageWorkOrders,
  requireViewReports,
  requireOwnCustomer,
  requireOpusUser,
  requirePermission,
  requireCustomerAccessOrPermission,
  getUserPermissions,
  validatePermissionsByUserType,
  getUserFromToken,
  ALL_PERMISSIONS,
  CLIENT_ALLOWED_PERMISSIONS
} from "./middleware/auth";
import { sanitizeUser, sanitizeUsers } from "./utils/security";
import { serializeForAI } from "./utils/serialization";

const JWT_SECRET = process.env.JWT_SECRET || 'kJsXXrXanldoNcZJG/iHeTEI8WdMch4PFWNIao1llTU=';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ============================================================================
  // 🔧 FUNÇÃO AUXILIAR: Desconto automático de estoque ao completar O.S.
  // ============================================================================
  async function deductStockForWorkOrder(workOrderId: string, userId?: string) {
    // Buscar a O.S. para verificar se tem checklist template
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      console.error(`[STOCK] O.S. ${workOrderId} não encontrada.`);
      return;
    }
    
    // Buscar peças associadas diretamente à O.S.
    let workOrderParts = await storage.getWorkOrderParts(workOrderId);
    
    // Se a O.S. tem um checklist template, verificar as peças dos itens
    if (workOrder.maintenanceChecklistTemplateId) {
      console.log(`[STOCK] O.S. ${workOrderId} tem checklist template: ${workOrder.maintenanceChecklistTemplateId}`);
      
      const template = await storage.getMaintenanceChecklistTemplate(workOrder.maintenanceChecklistTemplateId);
      if (template && template.items && Array.isArray(template.items)) {
        for (const item of template.items as any[]) {
          if (item.partId) {
            // Verificar se essa peça já está associada diretamente à O.S.
            const existingPart = workOrderParts.find(wp => wp.partId === item.partId);
            if (!existingPart) {
              console.log(`[STOCK] Criando associação para peça ${item.partId} do checklist template`);
              
              // Criar associação da peça com a O.S.
              const quantity = item.partQuantity ? String(item.partQuantity) : '1';
              const newWoPart = await storage.createWorkOrderPart({
                workOrderId: workOrderId,
                partId: item.partId,
                quantityPlanned: quantity,
                quantityUsed: quantity,
                notes: `Peça do checklist: ${item.label || 'Item sem rótulo'}`
              });
              
              // Adicionar à lista para processamento
              workOrderParts.push(newWoPart);
            }
          }
        }
      }
    }
    
    if (workOrderParts.length === 0) {
      console.log(`[STOCK] O.S. ${workOrderId} não tem peças associadas.`);
      return;
    }
    
    console.log(`[STOCK] Processando ${workOrderParts.length} peça(s) para O.S. ${workOrderId}...`);
    
    for (const woPart of workOrderParts) {
      // Verificar se já foi descontada
      if (woPart.stockDeducted) {
        console.log(`[STOCK] Peça ${woPart.partId} já foi descontada anteriormente.`);
        continue;
      }
      
      // Buscar peça atual
      const part = await storage.getPart(woPart.partId);
      if (!part) {
        console.error(`[STOCK] Peça ${woPart.partId} não encontrada.`);
        continue;
      }
      
      // Calcular quantidade a descontar (usar quantityUsed se disponível, senão quantityPlanned)
      const quantityToDeduct = parseFloat(woPart.quantityUsed || woPart.quantityPlanned);
      const previousQuantity = parseFloat(part.currentQuantity);
      const newQuantity = Math.max(0, previousQuantity - quantityToDeduct);
      
      console.log(`[STOCK] Descontando ${quantityToDeduct} de ${part.name} (${previousQuantity} → ${newQuantity})`);
      
      // Atualizar estoque da peça
      await storage.updatePart(part.id, { 
        currentQuantity: String(newQuantity) 
      });
      
      // Registrar movimento de estoque
      const movement = insertPartMovementSchema.parse({
        partId: part.id,
        movementType: 'saida',
        quantity: String(quantityToDeduct),
        previousQuantity: String(previousQuantity),
        newQuantity: String(newQuantity),
        reason: `Consumo O.S. #${workOrderId.substring(0, 8)}`,
        workOrderId: workOrderId,
        performedByUserId: userId || null
      });
      await storage.createPartMovement(movement);
      
      // Marcar peça como descontada na O.S.
      await storage.updateWorkOrderPart(woPart.id, {
        stockDeducted: true,
        deductedAt: new Date()
      });
      
      // Broadcast atualização da peça
      broadcast({ type: 'update', resource: 'parts', data: { id: part.id } });
    }
    
    console.log(`[STOCK] Desconto de estoque concluído para O.S. ${workOrderId}`);
  }
  
  // ============================================================================
  // 🧪 ENDPOINTS DE TESTE - NOVO SISTEMA DE PERMISSÕES
  // ============================================================================
  
  /**
   * Endpoint para buscar as permissões do usuário logado
   * Útil para debug e validação do novo sistema
   */
  app.get("/api/auth/my-permissions", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      
      const permissions = await getUserPermissions(req.user.id);
      
      res.json({
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        userType: req.user.userType,
        permissions: permissions,
        permissionCount: permissions.length
      });
    } catch (error) {
      console.error('[GET /api/auth/my-permissions] Error:', error);
      res.status(500).json({ error: 'Erro ao buscar permissões' });
    }
  });
  
  /**
   * Endpoint de teste usando o NOVO sistema de permissões
   * Requer permissão 'users_view' ao invés de role
   */
  app.get("/api/test/permissions/users-view", requirePermission('users_view'), async (req, res) => {
    try {
      const permissions = await getUserPermissions(req.user!.id);
      
      res.json({
        success: true,
        message: '✅ Acesso permitido! Você tem a permissão users_view',
        user: {
          id: req.user!.id,
          username: req.user!.username,
          role: req.user!.role,
          userType: req.user!.userType
        },
        permissions: permissions
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro no teste' });
    }
  });
  
  /**
   * Endpoint de teste para permissões OPUS-only
   * Requer permissão 'customers_create' (exclusiva OPUS)
   */
  app.get("/api/test/permissions/customers-create", requirePermission('customers_create'), async (req, res) => {
    try {
      res.json({
        success: true,
        message: '✅ Acesso permitido! Você tem permissão OPUS: customers_create',
        user: {
          id: req.user!.id,
          username: req.user!.username,
          role: req.user!.role,
          userType: req.user!.userType
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro no teste' });
    }
  });
  
  // ============================================================================
  // FIM DOS ENDPOINTS DE TESTE
  // ============================================================================
  
  // Companies
  app.get("/api/companies", requirePermission('customers_view'), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Failed to get companies" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to get company" });
    }
  });

  app.post("/api/companies", requirePermission('customers_create'), async (req, res) => {
    try {
      const company = insertCompanySchema.parse(req.body);
      const newCompany = await storage.createCompany(company);
      res.status(201).json(newCompany);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put("/api/companies/:id", requirePermission('customers_edit'), async (req, res) => {
    try {
      const company = insertCompanySchema.partial().parse(req.body);
      const updatedCompany = await storage.updateCompany(req.params.id, company);
      res.json(updatedCompany);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Sites
  app.get("/api/companies/:companyId/sites", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const sites = await storage.getSitesByCompany(req.params.companyId, module);
      res.json(sites);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sites" });
    }
  });

  // Get sites by customer
  app.get("/api/customers/:customerId/sites", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const sites = await storage.getSitesByCustomer(req.params.customerId, module);
      res.json(sites);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sites" });
    }
  });

  // Create site for customer (new route for customer filtering)
  app.post("/api/customers/:customerId/sites", requirePermission('sites_create'), async (req, res) => {
    try {
      console.log("Creating site with data:", req.body, "customerId:", req.params.customerId);
      
      // Get the customer to find their companyId
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      const dataToValidate = {
        ...req.body,
        customerId: req.params.customerId,
        companyId: customer.companyId
      };
      
      console.log("Site data to validate:", dataToValidate);
      
      const site = insertSiteSchema.parse(dataToValidate);
      const newSite = await storage.createSite(site);
      
      // Broadcast site creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'sites',
        data: newSite,
        customerId: req.params.customerId,
      });
      
      res.status(201).json(newSite);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating site:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating site:", error);
      res.status(500).json({ message: "Erro ao criar local" });
    }
  });

  app.get("/api/sites/:id", async (req, res) => {
    try {
      const site = await storage.getSite(req.params.id);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }
      res.json(site);
    } catch (error) {
      res.status(500).json({ message: "Failed to get site" });
    }
  });

  app.post("/api/sites", requirePermission('sites_create'), async (req, res) => {
    try {
      const site = insertSiteSchema.parse({
        ...req.body,
        module: req.body.module || 'clean'
      });
      const newSite = await storage.createSite(site);
      
      // Broadcast site creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'sites',
        data: newSite,
        customerId: newSite.customerId ?? undefined,
      });
      
      res.status(201).json(newSite);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create site" });
    }
  });

  app.put("/api/sites/:id", requirePermission('sites_edit'), async (req, res) => {
    try {
      const site = insertSiteSchema.partial().parse(req.body);
      const updatedSite = await storage.updateSite(req.params.id, site);
      
      // Broadcast site update to all connected clients
      broadcast({
        type: 'update',
        resource: 'sites',
        data: updatedSite,
        customerId: updatedSite.customerId ?? undefined,
      });
      
      res.json(updatedSite);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update site" });
    }
  });

  app.delete("/api/sites/:id", requirePermission('sites_delete'), async (req, res) => {
    try {
      const site = await storage.getSite(req.params.id);
      await storage.deleteSite(req.params.id);
      
      // Broadcast site deletion to all connected clients
      if (site) {
        broadcast({
          type: 'delete',
          resource: 'sites',
          data: { id: req.params.id },
          customerId: site.customerId ?? undefined,
        });
      }
      
      res.json({ message: "Site excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir site:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Falha ao excluir site" 
      });
    }
  });

  // Zones
  app.get("/api/companies/:companyId/zones", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const zones = await storage.getZonesByCompany(req.params.companyId, module);
      res.json(zones);
    } catch (error) {
      res.status(500).json({ message: "Failed to get zones" });
    }
  });

  // QR Code Points by Company
  app.get("/api/companies/:companyId/qr-points", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const qrPoints = await storage.getQrCodePointsByCompany(req.params.companyId, module);
      res.json(qrPoints);
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code points" });
    }
  });

  // QR Points by Customer (filtrado por cliente)
  app.get("/api/customers/:customerId/qr-points", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const qrPoints = await storage.getQrCodePointsByCustomer(req.params.customerId, module);
      res.json(qrPoints);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer QR code points" });
    }
  });

  // QR Metadata Bulk - for offline sync (QR points + zones + scheduled WOs + checklists)
  app.get("/api/customers/:customerId/qr-metadata/bulk", async (req, res) => {
    try {
      const { customerId } = req.params;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;

      // Fetch all metadata in parallel
      const [qrPoints, zones, scheduledWorkOrders] = await Promise.all([
        storage.getQrCodePointsByCustomer(customerId, module),
        storage.getZonesByCustomer(customerId, module),
        storage.getScheduledWorkOrdersForCache(customerId, module)
      ]);

      // Transform QR points to cache schema
      const qrPointsCache = qrPoints
        .filter(p => p.isActive)
        .map(p => ({
          code: p.code,
          pointId: p.id,
          name: p.name || p.code,
          description: p.description || undefined,
          zoneId: p.zoneId,
          customerId: customerId,
          module: p.module as 'clean' | 'maintenance',
        }));

      // Transform zones to cache schema
      const zonesCache = zones
        .filter(z => z.isActive)
        .map(z => ({
          id: z.id,
          name: z.name,
          areaM2: z.areaM2 || undefined,
          siteId: z.siteId,
          siteName: undefined,
          customerId: customerId,
          module: z.module as 'clean' | 'maintenance',
        }));

      // Transform scheduled work orders to cache schema
      const scheduledWOsCache = scheduledWorkOrders.map(wo => ({
        id: wo.id,
        qrCode: (wo as any).qrCode || '',
        title: wo.title,
        description: wo.description || undefined,
        priority: wo.priority || undefined,
        slaCompleteMinutes: wo.slaCompleteMinutes || undefined,
        checklistTemplateId: wo.checklistTemplateId || undefined,
        customerId: customerId,
        module: wo.module as 'clean' | 'maintenance',
        // Serialize Date objects to ISO strings for cache compatibility
        scheduledStartAt: wo.scheduledStartAt ? new Date(wo.scheduledStartAt).toISOString() : undefined,
        createdAt: wo.createdAt ? new Date(wo.createdAt).toISOString() : undefined,
      }));

      // Extract unique checklist template IDs
      const templateIds = new Set<string>();
      scheduledWorkOrders.forEach(wo => {
        if (wo.checklistTemplateId) {
          templateIds.add(wo.checklistTemplateId);
        }
      });

      // Fetch checklist templates
      const checklistTemplates = await storage.getChecklistTemplatesByIds(Array.from(templateIds));

      // Transform checklist templates to cache schema
      const checklistTemplatesCache = checklistTemplates.map(tpl => {
        const items = Array.isArray(tpl.items) ? tpl.items : [];
        return {
          id: tpl.id,
          name: tpl.name,
          items: items.map((item: any) => ({
            id: item.id,
            label: item.label,
            type: item.type,
            required: item.required || false,
          })),
          customerId: customerId,
          module: tpl.module as 'clean' | 'maintenance',
        };
      });

      res.json({
        qrPoints: qrPointsCache,
        zones: zonesCache,
        scheduledWorkOrders: scheduledWOsCache,
        checklistTemplates: checklistTemplatesCache,
        timestamp: Date.now(),
        count: {
          qrPoints: qrPointsCache.length,
          zones: zonesCache.length,
          scheduledWorkOrders: scheduledWOsCache.length,
          checklistTemplates: checklistTemplatesCache.length
        }
      });

      console.log(`[QR METADATA BULK] Sent ${qrPointsCache.length} QR points, ${zonesCache.length} zones, ${scheduledWOsCache.length} WOs, ${checklistTemplatesCache.length} templates`);
    } catch (error) {
      console.error("[QR METADATA BULK] Error:", error);
      res.status(500).json({ message: "Failed to get QR metadata" });
    }
  });

  // Cleaning Activities by Customer (filtrado por cliente)
  app.get("/api/customers/:customerId/cleaning-activities", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const activities = await storage.getCleaningActivitiesByCustomer(req.params.customerId, module);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer cleaning activities" });
    }
  });

  // Services by Customer (filtrado por cliente)
  app.get("/api/customers/:customerId/services", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const services = await storage.getServicesByCustomer(req.params.customerId, module);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer services" });
    }
  });

  // Users by Customer (filtrado por cliente)
  app.get("/api/customers/:customerId/users", async (req, res) => {
    try {
      const users = await storage.getUsersByCustomer(req.params.customerId);
      
      // Para cada usuário, buscar seus roles customizados, sites vinculados e remover senha
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const roleAssignments = await storage.getUserRoleAssignments(user.id);
          const siteAssignments = await storage.getUserSiteAssignments(user.id);
          const sanitized = sanitizeUser(user);
          return {
            ...sanitized,
            customRoles: roleAssignments,
            siteAssignments: siteAssignments
          };
        })
      );
      
      res.json(usersWithRoles);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer users" });
    }
  });

  // Checklist Templates by Customer (filtrado por cliente)  
  app.get("/api/customers/:customerId/checklist-templates", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const templates = await storage.getChecklistTemplatesByCustomer(req.params.customerId, module);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer checklist templates" });
    }
  });

  // Get a specific checklist template by ID
  app.get("/api/checklist-templates/:id", async (req, res) => {
    try {
      const template = await storage.getChecklistTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Checklist template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching checklist template:", error);
      res.status(500).json({ message: "Failed to fetch checklist template" });
    }
  });

  app.post("/api/customers/:customerId/checklist-templates", requirePermission('checklists_create'), async (req, res) => {
    try {
      // Validate that the checklist belongs to the customer
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Use the first site's company for the checklist template
      const companyId = customerSites[0].companyId;
      
      // Keep arrays for multi-site/zone support + ADD customerId for multi-tenant security
      const checklistData = { 
        ...req.body, 
        companyId,
        customerId: req.params.customerId,
      };
      
      console.log("[CHECKLIST CREATE] Data:", JSON.stringify(checklistData, null, 2));
      
      const template = await storage.createChecklistTemplate(checklistData);
      res.json(template);
    } catch (error: any) {
      console.error("Error creating checklist template:", error?.message || error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ message: error?.message || "Failed to create customer checklist template" });
    }
  });

  app.put("/api/customers/:customerId/checklist-templates/:id", async (req, res) => {
    try {
      // Validate that the customer exists and get their company
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const companyId = customerSites[0].companyId;
      
      // Verify the template belongs to this customer (multi-tenant security)
      const existingTemplate = await storage.getChecklistTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.customerId !== req.params.customerId) {
        return res.status(403).json({ message: "Checklist template not found or access denied" });
      }

      // Keep arrays for multi-site/zone support + ensure customerId stays correct
      const checklistData = { 
        ...req.body, 
        companyId,
        customerId: req.params.customerId,
      };
      
      console.log("[CHECKLIST UPDATE] Data:", JSON.stringify(checklistData, null, 2));
      
      const template = await storage.updateChecklistTemplate(req.params.id, checklistData);
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to update customer checklist template" });
    }
  });

  app.delete("/api/customers/:customerId/checklist-templates/:id", requirePermission('checklists_delete'), async (req, res) => {
    try {
      // Validate that the customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Verify the template belongs to this customer (multi-tenant security)
      const existingTemplate = await storage.getChecklistTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.customerId !== req.params.customerId) {
        return res.status(403).json({ message: "Checklist template not found or access denied" });
      }

      // Check if checklist is being used by work orders
      const workOrdersUsingChecklist = await storage.getWorkOrdersByChecklistTemplate(req.params.id);
      if (workOrdersUsingChecklist.length > 0) {
        return res.status(409).json({ 
          message: "Checklist não pode ser excluído pois está sendo usado por ordens de serviço",
          workOrdersCount: workOrdersUsingChecklist.length
        });
      }

      await storage.deleteChecklistTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer checklist template" });
    }
  });

  // Work Orders by Customer - List (filtrado por cliente) com paginação
  app.get("/api/customers/:customerId/work-orders", async (req, res) => {
    try {
      // Validate that the customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get all work orders for this customer
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      let workOrders = await storage.getWorkOrdersByCustomer(req.params.customerId, module);
      
      // Apply filters from query params
      const { zoneId, zoneIds, assignedTo, status, statusList, serviceId, includeAll, orderType, searchTerm } = req.query;
      
      // Automatically filter out canceled work orders for mobile/collaborators
      // unless explicitly requesting all statuses or a specific status
      if (!status && !statusList && includeAll !== 'true') {
        workOrders = workOrders.filter(wo => wo.status !== 'cancelada');
      }
      
      // Filter by zone if provided (single or multiple)
      if (zoneId) {
        workOrders = workOrders.filter(wo => wo.zoneId === zoneId);
      } else if (zoneIds) {
        const zoneIdList = (zoneIds as string).split(',');
        workOrders = workOrders.filter(wo => zoneIdList.includes(wo.zoneId || ''));
      }
      
      // Filter by assignedTo if provided
      if (assignedTo) {
        const assignedToStr = assignedTo as string;
        if (assignedToStr === 'nao_atribuido') {
          // Filtrar apenas ordens sem responsável atribuído
          workOrders = workOrders.filter(wo => 
            wo.assignedUserId === null && 
            (!wo.assignedUserIds || wo.assignedUserIds.length === 0)
          );
        } else {
          // Filtrar por um responsável específico (APENAS as O.S. atribuídas a ele)
          workOrders = workOrders.filter(wo => 
            wo.assignedUserId === assignedToStr || 
            (wo.assignedUserIds && wo.assignedUserIds.includes(assignedToStr))
          );
        }
      }
      
      // Filter by orderType (tipo de OS: programada, corretiva_interna, corretiva_publica)
      if (orderType && orderType !== 'todos') {
        workOrders = workOrders.filter((wo: any) => wo.type === orderType);
      }
      
      // Filter by searchTerm (busca por número, título ou descrição)
      if (searchTerm) {
        const term = (searchTerm as string).toLowerCase();
        workOrders = workOrders.filter((wo: any) => {
          const matchesNumber = wo.number?.toString().includes(term);
          const matchesTitle = wo.title?.toLowerCase().includes(term);
          const matchesDescription = wo.description?.toLowerCase().includes(term);
          return matchesNumber || matchesTitle || matchesDescription;
        });
      }
      
      // Filter by serviceId if provided
      if (serviceId) {
        workOrders = workOrders.filter(wo => wo.serviceId === serviceId);
      }
      
      // IMPORTANTE: Calcular contadores por status ANTES de aplicar o filtro de status
      // Isso garante que os contadores sempre mostrem os totais gerais
      const statusCounts = {
        abertas: workOrders.filter((wo: any) => wo.status === 'aberta').length,
        vencidas: workOrders.filter((wo: any) => wo.status === 'vencida').length,
        pausadas: workOrders.filter((wo: any) => wo.status === 'pausada').length,
        concluidas: workOrders.filter((wo: any) => wo.status === 'concluida').length,
      };
      
      // AGORA aplicar o filtro de status (depois de calcular os contadores)
      if (status) {
        workOrders = workOrders.filter(wo => wo.status === status);
      } else if (statusList) {
        const statusArray = (statusList as string).split(',');
        workOrders = workOrders.filter(wo => statusArray.includes(wo.status || ''));
      }
      
      // Ordenação por número (descendente = maiores números primeiro)
      workOrders.sort((a: any, b: any) => {
        const numberA = parseInt(a.number || a.id);
        const numberB = parseInt(b.number || b.id);
        return numberB - numberA; // Descendente - maiores números primeiro
      });
      
      // Paginação (aplicada DEPOIS dos filtros e ordenação)
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // Padrão: 50 por página
      const total = workOrders.length;
      const totalPages = Math.ceil(total / limit);
      
      // Calcular skip e aplicar paginação
      const skip = (page - 1) * limit;
      const paginatedWorkOrders = workOrders.slice(skip, skip + limit);
      
      // Retornar dados com metadados de paginação e contadores
      res.json({
        data: paginatedWorkOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        statusCounts
      });
    } catch (error) {
      console.error("Error fetching customer work orders:", error);
      res.status(500).json({ message: "Failed to fetch customer work orders" });
    }
  });

  // Dashboard stats by Customer
  app.get("/api/customers/:customerId/dashboard-stats/:period/:siteId", async (req, res) => {
    try {
      const { customerId, period, siteId } = req.params;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      
      // Verify customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Get stats filtered by customer's sites (pode ser vazio se não houver sites)
      const stats = await storage.getDashboardStatsByCustomer(customerId, period, siteId === 'todos' ? '' : siteId, module);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching customer dashboard stats:", error);
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Analytics by Customer
  app.get("/api/customers/:customerId/analytics/:period/:siteId", async (req, res) => {
    try {
      const { customerId, period, siteId } = req.params;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      
      // Verify customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Get analytics filtered by customer (pode ser vazio se não houver sites/work orders)
      const analytics = await storage.getAnalyticsByCustomer(customerId, period, siteId === 'todos' ? '' : siteId, module);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching customer analytics:", error);
      res.status(500).json({ message: "Failed to get performance analytics" });
    }
  });

  // Work Orders by Customer - Create (filtrado por cliente)
  app.post("/api/customers/:customerId/work-orders", requirePermission('workorders_create'), async (req, res) => {
    try {
      // Validate that the customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Validate that site belongs to customer
      if (req.body.siteId) {
        const site = await storage.getSite(req.body.siteId);
        if (!site || site.customerId !== req.params.customerId) {
          return res.status(403).json({ message: "Site does not belong to customer" });
        }
      }

      // Validate that zone belongs to customer (via site)
      if (req.body.zoneId) {
        const zone = await storage.getZone(req.body.zoneId);
        if (zone) {
          const zoneSite = await storage.getSite(zone.siteId);
          if (!zoneSite || zoneSite.customerId !== req.params.customerId) {
            return res.status(403).json({ message: "Zone does not belong to customer" });
          }
        }
      }
      
      const workOrder = await storage.createWorkOrder(req.body);
      
      // Broadcast work order creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'workorders',
        data: workOrder,
        customerId: req.params.customerId
      });
      
      res.json(workOrder);
    } catch (error) {
      console.error("[CREATE WO ERROR] Detailed error:", error);
      console.error("[CREATE WO ERROR] Request body:", JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Failed to create customer work order" });
    }
  });

  // Work Orders by Customer - Delete (filtrado por cliente) - APENAS ADMIN
  app.delete("/api/customers/:customerId/work-orders/:id", requirePermission('workorders_delete'), async (req, res) => {
    try {
      // Validate that the customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Verify the work order belongs to this customer by checking its site
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // Get zone first, then site
      if (!workOrder.zoneId) {
        return res.status(400).json({ message: "Work order has no zone" });
      }
      const zone = await storage.getZone(workOrder.zoneId);
      if (!zone) {
        return res.status(404).json({ message: "Zone not found" });
      }
      const workOrderSite = await storage.getSite(zone.siteId);
      if (!workOrderSite || workOrderSite.customerId !== req.params.customerId) {
        return res.status(403).json({ message: "Work order not found or access denied" });
      }

      await storage.deleteWorkOrder(req.params.id);
      
      // Broadcast work order deletion to all connected clients
      broadcast({
        type: 'delete',
        resource: 'workorders',
        id: req.params.id,
        customerId: req.params.customerId
      });
      
      res.json({ message: "Ordem de serviço deletada com sucesso" });
    } catch (error) {
      console.error("[DELETE WO ERROR]", error);
      res.status(500).json({ message: "Failed to delete customer work order" });
    }
  });

  // QR Points by Customer - Create (filtrado por cliente)
  app.post("/api/customers/:customerId/qr-points", requirePermission('qrcodes_create'), async (req, res) => {
    try {
      // Validate that the customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Validate that zone belongs to customer
      if (req.body.zoneId) {
        const zone = await storage.getZone(req.body.zoneId);
        if (zone) {
          const zoneSite = await storage.getSite(zone.siteId);
          if (!zoneSite || zoneSite.customerId !== req.params.customerId) {
            return res.status(403).json({ message: "Zone does not belong to customer" });
          }
        }
      }
      
      // Parse and validate the request body
      const qrPointData = insertQrCodePointSchema.parse(req.body);
      const qrPoint = await storage.createQrCodePoint(qrPointData);
      res.json(qrPoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create customer QR point" });
    }
  });


  // Reports by Customer (filtrado por cliente)
  app.get("/api/customers/:customerId/reports/metrics", async (req, res) => {
    try {
      const period = req.query.period as string || "30";
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const analytics = await storage.getAnalyticsByCustomer(req.params.customerId, period, "todos", module);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer metrics" });
    }
  });

  app.get("/api/customers/:customerId/reports/work-orders-status", async (req, res) => {
    try {
      const period = req.query.period as string || "30";
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const analytics = await storage.getAnalyticsByCustomer(req.params.customerId, period, "todos", module);
      
      // Transform statusBreakdown to the format expected by frontend
      const statusLabels: Record<string, string> = {
        'aberta': 'Aberta',
        'em_execucao': 'Em Execução',
        'concluida': 'Concluída',
        'vencida': 'Vencida',
        'cancelada': 'Cancelada'
      };
      
      const statusColors: Record<string, string> = {
        'aberta': 'bg-yellow-500',
        'em_execucao': 'bg-blue-500',
        'concluida': 'bg-green-500',
        'vencida': 'bg-red-500',
        'cancelada': 'bg-gray-500'
      };
      
      const workOrdersStatus = (analytics?.statusBreakdown || []).map((item: any) => ({
        status: item.status,
        label: statusLabels[item.status] || item.status,
        count: item.count,
        color: statusColors[item.status] || 'bg-gray-500',
        percentage: item.percentage
      }));
      
      res.json(workOrdersStatus);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer work orders status" });
    }
  });

  app.get("/api/customers/:customerId/reports/sla-performance", async (req, res) => {
    try {
      const period = req.query.period as string || "30";
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const analytics = await storage.getAnalyticsByCustomer(req.params.customerId, period, "todos", module);
      res.json(analytics?.slaPerformance || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to get customer SLA performance" });
    }
  });

  // NOVOS ENDPOINTS ESPECÍFICOS PARA CADA TIPO DE RELATÓRIO

  // 1. Relatório Geral - Visão completa das operações com todos os KPIs principais  
  app.get("/api/customers/:customerId/reports/general", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const generalReport = await storage.getGeneralReport(customerId, period, module);
      res.json(generalReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to get general report" });
    }
  });

  // 2. Análise de SLA - Performance detalhada de cumprimento de prazos
  app.get("/api/customers/:customerId/reports/sla-analysis", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const slaAnalysis = await storage.getSLAAnalysis(customerId, period, module);
      res.json(slaAnalysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to get SLA analysis" });
    }
  });

  // 3. Produtividade - Métricas de eficiência e produtividade operacional
  app.get("/api/customers/:customerId/reports/productivity", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const productivityReport = await storage.getProductivityReport(customerId, period, module);
      res.json(productivityReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to get productivity report" });
    }
  });

  // 4. Performance de Operadores - Análise individual e comparativa
  app.get("/api/customers/:customerId/reports/operators", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const operatorPerformance = await storage.getOperatorPerformance(customerId, period, module);
      res.json(operatorPerformance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get operator performance" });
    }
  });

  // 5. Análise por Locais - Distribuição e performance por zona e site
  app.get("/api/customers/:customerId/reports/locations", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const locationAnalysis = await storage.getLocationAnalysis(customerId, period, module);
      res.json(locationAnalysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to get location analysis" });
    }
  });

  // 6. Análise Temporal - Tendências e padrões ao longo do tempo
  app.get("/api/customers/:customerId/reports/temporal", async (req, res) => {
    try {
      const { customerId } = req.params;
      const period = req.query.period as string || '30';
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const temporalAnalysis = await storage.getTemporalAnalysis(customerId, period, module);
      res.json(temporalAnalysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to get temporal analysis" });
    }
  });

  app.get("/api/customers/:customerId/reports/assets", async (req, res) => {
    try {
      const { customerId } = req.params;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const assetReport = await storage.getAssetReport(customerId, module);
      res.json(assetReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to get asset report" });
    }
  });

  app.get("/api/sites/:siteId/zones", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const zones = await storage.getZonesBySite(req.params.siteId, module);
      res.json(zones);
    } catch (error) {
      res.status(500).json({ message: "Failed to get zones" });
    }
  });

  // Get zones for a customer (all zones or filtered by sites)
  app.get("/api/customers/:customerId/zones", async (req, res) => {
    try {
      const { customerId } = req.params;
      const { siteIds, module } = req.query;
      const moduleParam = module as 'clean' | 'maintenance' | undefined;
      
      // Get all customer sites first
      const customerSites = await storage.getSitesByCustomer(customerId, moduleParam);
      
      // If no siteIds provided, return zones from ALL customer sites
      if (!siteIds) {
        const allZones = [];
        for (const site of customerSites) {
          const zones = await storage.getZonesBySite(site.id, moduleParam);
          allZones.push(...zones);
        }
        return res.json(allZones);
      }
      
      // If siteIds provided, validate and return zones from specified sites only
      const siteIdArray = typeof siteIds === 'string' ? siteIds.split(',') : [];
      const validSiteIds = new Set(customerSites.map(site => site.id));
      
      const invalidSites = siteIdArray.filter(siteId => !validSiteIds.has(siteId.trim()));
      if (invalidSites.length > 0) {
        return res.status(403).json({ 
          message: "One or more sites do not belong to this customer",
          invalidSites 
        });
      }
      
      const allZones = [];
      for (const siteId of siteIdArray) {
        const zones = await storage.getZonesBySite(siteId.trim(), moduleParam);
        allZones.push(...zones);
      }
      
      res.json(allZones);
    } catch (error) {
      res.status(500).json({ message: "Failed to get zones" });
    }
  });

  // Get zones by multiple sites (DEPRECATED - use /api/customers/:customerId/zones instead)
  app.get("/api/zones", async (req, res) => {
    try {
      const { siteIds, module } = req.query;
      if (!siteIds) {
        return res.status(400).json({ message: "siteIds parameter is required" });
      }
      
      const siteIdArray = typeof siteIds === 'string' ? siteIds.split(',') : [];
      const moduleParam = module as 'clean' | 'maintenance' | undefined;
      const allZones = [];
      
      for (const siteId of siteIdArray) {
        const zones = await storage.getZonesBySite(siteId.trim(), moduleParam);
        allZones.push(...zones);
      }
      
      res.json(allZones);
    } catch (error) {
      res.status(500).json({ message: "Failed to get zones" });
    }
  });

  app.get("/api/zones/:id", async (req, res) => {
    try {
      const zone = await storage.getZone(req.params.id);
      if (!zone) {
        return res.status(404).json({ message: "Zone not found" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ message: "Failed to get zone" });
    }
  });

  app.post("/api/zones", requirePermission('zones_create'), async (req, res) => {
    try {
      const zone = insertZoneSchema.parse({
        ...req.body,
        module: req.body.module || 'clean'
      });
      const newZone = await storage.createZone(zone);
      
      // Broadcast zone creation to all connected clients (no customer filter needed)
      broadcast({
        type: 'create',
        resource: 'zones',
        data: newZone,
      });
      
      res.status(201).json(newZone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create zone" });
    }
  });

  app.put("/api/zones/:id", requirePermission('zones_edit'), async (req, res) => {
    try {
      const zone = insertZoneSchema.partial().parse(req.body);
      const updatedZone = await storage.updateZone(req.params.id, zone);
      
      // Broadcast zone update to all connected clients (no customer filter needed)
      broadcast({
        type: 'update',
        resource: 'zones',
        data: updatedZone,
      });
      
      res.json(updatedZone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update zone" });
    }
  });

  app.patch("/api/zones/:id", requirePermission('zones_edit'), async (req, res) => {
    try {
      const zone = insertZoneSchema.partial().parse(req.body);
      const updatedZone = await storage.updateZone(req.params.id, zone);
      
      // Broadcast zone update to all connected clients (no customer filter needed)
      broadcast({
        type: 'update',
        resource: 'zones',
        data: updatedZone,
      });
      
      res.json(updatedZone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update zone" });
    }
  });

  app.delete("/api/zones/:id", requirePermission('zones_delete'), async (req, res) => {
    try {
      // Buscar a zone ANTES de deletar para ter o siteId e customerId
      const zone = await storage.getZone(req.params.id);
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      await storage.deleteZone(req.params.id);
      
      // Broadcast zone deletion to all connected clients
      if (zone && site) {
        broadcast({
          type: 'delete',
          resource: 'zones',
          data: { id: req.params.id },
          customerId: site.customerId || undefined,
        });
      }
      
      res.json({ message: "Zone deleted successfully" });
    } catch (error) {
      console.error("Error deleting zone:", error);
      res.status(500).json({ message: "Failed to delete zone" });
    }
  });

  // QR Code Points
  app.get("/api/zones/:zoneId/qr-points", async (req, res) => {
    try {
      const points = await storage.getQrCodePointsByZone(req.params.zoneId);
      res.json(points);
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code points" });
    }
  });

  // List all QR points (debug endpoint)  
  app.get("/api/qr-points", async (req, res) => {
    try {
      // Lista todos os QR points da empresa padrão
      const points = await storage.getQrCodePointsByCompany("company-opus-default");
      res.json(points || []);
    } catch (error) {
      console.error("Error getting QR points:", error);
      res.status(500).json({ message: "Failed to get QR points" });
    }
  });

  app.get("/api/qr-points/:id", async (req, res) => {
    try {
      const point = await storage.getQrCodePoint(req.params.id);
      if (!point) {
        return res.status(404).json({ message: "QR code point not found" });
      }
      res.json(point);
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code point" });
    }
  });

  app.get("/api/qr-points/code/:code", async (req, res) => {
    try {
      const point = await storage.getQrCodePointByCode(req.params.code);
      if (!point) {
        return res.status(404).json({ message: "QR code point not found" });
      }
      res.json(point);
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code point" });
    }
  });

  // QR Code Resolution - Returns all context in one call - REQUIRES AUTH
  app.get("/api/qr-scan/resolve", requireAuth, async (req, res) => {
    try {
      const code = req.query.code as string;
      const user = req.user!;
      
      if (!code) {
        return res.status(400).json({ message: "QR code parameter is required" });
      }

      const resolved = await storage.resolveQrCode(code);
      
      if (!resolved) {
        return res.status(404).json({ message: "QR code not found or inactive" });
      }

      // Verificar se o usuário tem acesso ao módulo do QR code
      const qrModule = resolved.qrPoint.module;
      const userModules = user.modules || [];
      
      if (!userModules.includes(qrModule)) {
        console.warn(`[QR ACCESS DENIED] User ${user.id} tentou acessar QR code do módulo ${qrModule} mas só tem acesso a: ${userModules.join(', ')}`);
        return res.status(403).json({ 
          error: 'Acesso negado',
          message: `Você não tem acesso ao módulo ${qrModule === 'clean' ? 'OPUS Clean' : 'OPUS Manutenção'}.`
        });
      }

      // Verificar se o usuário tem acesso ao cliente do QR code
      // Admin pode acessar qualquer cliente
      if (user.role !== 'admin' && user.customerId !== resolved.customer.id) {
        console.warn(`[QR ACCESS DENIED] User ${user.id} tentou acessar QR code do cliente ${resolved.customer.id} mas pertence ao cliente ${user.customerId}`);
        return res.status(403).json({ 
          error: 'Acesso negado',
          message: 'Você não tem permissão para acessar QR codes deste cliente.'
        });
      }

      // Disable caching for dynamic QR resolution
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(resolved);
    } catch (error) {
      console.error("Error resolving QR code:", error);
      res.status(500).json({ message: "Failed to resolve QR code" });
    }
  });

  // QR Code Resolution - NEW correct endpoint format - REQUIRES AUTH
  app.get("/api/qrs/:code/resolve", requireAuth, async (req, res) => {
    try {
      const code = req.params.code;
      const user = req.user!;
      
      if (!code) {
        return res.status(400).json({ message: "QR code parameter is required" });
      }

      const resolved = await storage.resolveQrCode(code);
      
      if (!resolved) {
        return res.status(404).json({ message: "QR code not found or inactive" });
      }

      // Verificar se o usuário tem acesso ao módulo do QR code
      const qrModule = resolved.qrPoint.module;
      const userModules = user.modules || [];
      
      if (!userModules.includes(qrModule)) {
        console.warn(`[QR ACCESS DENIED] User ${user.id} tentou acessar QR code do módulo ${qrModule} mas só tem acesso a: ${userModules.join(', ')}`);
        return res.status(403).json({ 
          error: 'Acesso negado',
          message: `Você não tem acesso ao módulo ${qrModule === 'clean' ? 'OPUS Clean' : 'OPUS Manutenção'}.`
        });
      }

      // Verificar se o usuário tem acesso ao cliente do QR code
      // Admin pode acessar qualquer cliente
      if (user.role !== 'admin' && user.customerId !== resolved.customer.id) {
        console.warn(`[QR ACCESS DENIED] User ${user.id} tentou acessar QR code do cliente ${resolved.customer.id} mas pertence ao cliente ${user.customerId}`);
        return res.status(403).json({ 
          error: 'Acesso negado',
          message: 'Você não tem permissão para acessar QR codes deste cliente.'
        });
      }

      res.json(resolved);
    } catch (error) {
      console.error("Error resolving QR code:", error);
      res.status(500).json({ message: "Failed to resolve QR code" });
    }
  });

  app.post("/api/qr-points", requirePermission('qrcodes_create'), async (req, res) => {
    try {
      const qrPoint = insertQrCodePointSchema.parse({
        ...req.body,
        module: req.body.module || 'clean'
      });
      // Generate unique code if not provided
      if (!qrPoint.code) {
        qrPoint.code = crypto.randomUUID();
      }
      const newPoint = await storage.createQrCodePoint(qrPoint);
      
      // Buscar a zone para obter o customerId
      const zone = newPoint.zoneId ? await storage.getZone(newPoint.zoneId) : null;
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      // Broadcast QR code creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'qrcodes',
        data: newPoint,
        customerId: site?.customerId ?? undefined,
      });
      
      res.status(201).json(newPoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create QR code point" });
    }
  });

  app.put("/api/qr-points/:id", async (req, res) => {
    try {
      const qrPoint = insertQrCodePointSchema.partial().parse(req.body);
      const updatedPoint = await storage.updateQrCodePoint(req.params.id, qrPoint);
      
      // Buscar a zone para obter o customerId
      const zone = updatedPoint.zoneId ? await storage.getZone(updatedPoint.zoneId) : null;
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      // Broadcast QR code update to all connected clients
      broadcast({
        type: 'update',
        resource: 'qrcodes',
        data: updatedPoint,
        customerId: site?.customerId ?? undefined,
      });
      
      res.json(updatedPoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update QR code point" });
    }
  });

  app.delete("/api/qr-points/:id", requirePermission('qrcodes_delete'), async (req, res) => {
    try {
      // Buscar o QR point ANTES de deletar para ter o zoneId e customerId
      const qrPoint = await storage.getQrCodePoint(req.params.id);
      const zone = qrPoint && qrPoint.zoneId ? await storage.getZone(qrPoint.zoneId) : null;
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      await storage.deleteQrCodePoint(req.params.id);
      
      // Broadcast QR code deletion to all connected clients
      if (qrPoint && site) {
        broadcast({
          type: 'delete',
          resource: 'qrcodes',
          data: { id: req.params.id },
          customerId: site.customerId ?? undefined,
        });
      }
      
      res.json({ message: "QR code point deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete QR code point" });
    }
  });

  // Users - PROTEGIDO: Requer permissão users_view
  app.get("/api/users", requirePermission('users_view'), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(sanitizeUsers(users));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.get("/api/companies/:companyId/users", requirePermission('users_view'), async (req, res) => {
    try {
      const users = await storage.getUsersByCompany(req.params.companyId);
      res.json(sanitizeUsers(users));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/users", requirePermission('users_create'), async (req, res) => {
    try {
      const { role: customRoleId, ...userData } = req.body;
      
      // Validar dados do usuário (sem o role que vem como customRoleId)
      const validatedData = insertUserSchema.omit({ role: true }).parse(userData);
      
      // VALIDAÇÃO DE MÓDULOS: Verificar se os módulos solicitados são compatíveis com o cliente
      if (validatedData.userType === 'customer_user' && validatedData.customerId) {
        const customer = await storage.getCustomer(validatedData.customerId);
        
        if (!customer) {
          return res.status(400).json({
            message: "Cliente não encontrado",
            details: "O cliente selecionado não existe no sistema."
          });
        }
        
        const customerModules = customer.modules || ['clean'];
        const requestedModules = validatedData.modules || ['clean'];
        
        // Verificar se todos os módulos solicitados estão disponíveis no cliente
        const invalidModules = requestedModules.filter(m => !customerModules.includes(m));
        
        if (invalidModules.length > 0) {
          return res.status(400).json({
            message: "Módulos incompatíveis",
            details: `Os módulos ${invalidModules.join(', ')} não estão disponíveis para o cliente "${customer.name}". Módulos disponíveis: ${customerModules.join(', ')}`
          });
        }
      }
      
      // Buscar custom role e mapear para role base
      let baseRole: 'admin' | 'gestor_cliente' | 'supervisor_site' | 'operador' | 'auditor' = 'operador';
      
      if (customRoleId && customRoleId.startsWith('role-')) {
        const customRole = await storage.getCustomRoleById(customRoleId);
        
        if (customRole) {
          // Mapear nome do custom role para role base
          const roleName = customRole.name.toLowerCase();
          
          if (roleName.includes('admin') || roleName.includes('administrador')) {
            baseRole = 'admin';
          } else if (roleName.includes('gestor') || roleName.includes('gerente') || roleName.includes('cliente')) {
            baseRole = 'gestor_cliente';
          } else if (roleName.includes('supervisor') || roleName.includes('coordenador')) {
            baseRole = 'supervisor_site';
          } else if (roleName.includes('auditor')) {
            baseRole = 'auditor';
          } else {
            baseRole = 'operador';
          }
        }
      }
      
      // Generate unique user ID
      const userId = `user-${validatedData.username}-${Date.now()}`;
      
      // Hash password if provided (for local auth users)
      if (validatedData.password && validatedData.authProvider === 'local') {
        validatedData.password = await bcrypt.hash(validatedData.password, 12);
      }
      
      // Criar usuário com role base mapeado do custom role
      const newUser = await storage.createUser({
        ...validatedData,
        id: userId,
        role: baseRole,
      } as any);

      // Se foi enviado um customRoleId, criar userRoleAssignment via storage
      if (customRoleId && customRoleId.startsWith('role-')) {
        await storage.createUserRoleAssignment({
          id: `ura-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: newUser.id,
          roleId: customRoleId,
          customerId: validatedData.customerId || null,
        });
      }
      
      // AUTO-VINCULAR admin do cliente ao cliente via userAllowedCustomers
      // Se é customer_user, admin, e tem customerId -> vincular automaticamente
      if (validatedData.userType === 'customer_user' && 
          baseRole === 'admin' && 
          validatedData.customerId) {
        try {
          await storage.addUserAllowedCustomer({
            userId: newUser.id,
            customerId: validatedData.customerId,
          });
          console.log(`[AUTO-LINK] ✅ Admin ${newUser.username} vinculado ao cliente ${validatedData.customerId}`);
        } catch (linkError) {
          console.log(`[AUTO-LINK] ℹ️ Admin ${newUser.username} já estava vinculado ao cliente`);
        }
      }
      
      // Broadcast user creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'users',
        data: sanitizeUser(newUser),
        customerId: newUser.customerId || undefined,
      });
      
      res.status(201).json(sanitizeUser(newUser));
    } catch (error: any) {
      // Tratamento de erros do Zod (validação)
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          errors: error.errors 
        });
      }
      
      // Tratamento de erros do PostgreSQL
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint === 'users_email_unique') {
          return res.status(400).json({ 
            message: "Email já cadastrado",
            details: `O email "${error.detail?.match(/\(([^)]+)\)/)?.[1] || 'informado'}" já está sendo usado por outro usuário. Por favor, use um email diferente.`
          });
        }
        if (error.constraint === 'users_username_unique') {
          return res.status(400).json({ 
            message: "Nome de usuário já existe",
            details: `O nome de usuário "${error.detail?.match(/\(([^)]+)\)/)?.[1] || 'informado'}" já está em uso. Por favor, escolha outro nome de usuário.`
          });
        }
        // Outras violações de unique constraint
        return res.status(400).json({ 
          message: "Valor duplicado",
          details: "Um campo único já possui esse valor no sistema. Verifique os dados e tente novamente."
        });
      }
      
      if (error.code === '23503') {
        // Foreign key violation
        return res.status(400).json({ 
          message: "Referência inválida",
          details: "Um dos campos referencia um registro que não existe. Verifique cliente, empresa ou outros relacionamentos."
        });
      }
      
      if (error.code === '23502') {
        // Not null violation
        return res.status(400).json({ 
          message: "Campo obrigatório faltando",
          details: `O campo "${error.column || 'desconhecido'}" é obrigatório e não pode ser vazio.`
        });
      }
      
      // Erro genérico
      console.error("Error creating user:", error);
      res.status(500).json({ 
        message: "Erro ao criar usuário",
        details: process.env.NODE_ENV === 'development' ? error.message : "Ocorreu um erro inesperado. Tente novamente ou contate o suporte."
      });
    }
  });

  app.put("/api/users/:id", requirePermission('users_edit'), async (req, res) => {
    try {
      const user = insertUserSchema.partial().parse(req.body);
      
      // VALIDAÇÃO DE MÓDULOS: Verificar se os módulos solicitados são compatíveis com o cliente
      if (user.modules && user.customerId) {
        const existingUser = await storage.getUser(req.params.id);
        
        if (existingUser && existingUser.userType === 'customer_user') {
          const customer = await storage.getCustomer(user.customerId);
          
          if (!customer) {
            return res.status(400).json({
              message: "Cliente não encontrado",
              details: "O cliente selecionado não existe no sistema."
            });
          }
          
          const customerModules = customer.modules || ['clean'];
          const requestedModules = user.modules;
          
          // Verificar se todos os módulos solicitados estão disponíveis no cliente
          const invalidModules = requestedModules.filter(m => !customerModules.includes(m));
          
          if (invalidModules.length > 0) {
            return res.status(400).json({
              message: "Módulos incompatíveis",
              details: `Os módulos ${invalidModules.join(', ')} não estão disponíveis para o cliente "${customer.name}". Módulos disponíveis: ${customerModules.join(', ')}`
            });
          }
        }
      }
      
      const updatedUser = await storage.updateUser(req.params.id, user);
      
      // Broadcast user update to all connected clients
      broadcast({
        type: 'update',
        resource: 'users',
        data: sanitizeUser(updatedUser),
        customerId: updatedUser.customerId || undefined,
      });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id", requirePermission('users_edit'), async (req, res) => {
    try {
      const user = insertUserSchema.partial().parse(req.body);
      
      // VALIDAÇÃO DE MÓDULOS: Verificar se os módulos solicitados são compatíveis com o cliente
      if (user.modules && user.customerId) {
        const existingUser = await storage.getUser(req.params.id);
        
        if (existingUser && existingUser.userType === 'customer_user') {
          const customer = await storage.getCustomer(user.customerId);
          
          if (!customer) {
            return res.status(400).json({
              message: "Cliente não encontrado",
              details: "O cliente selecionado não existe no sistema."
            });
          }
          
          const customerModules = customer.modules || ['clean'];
          const requestedModules = user.modules;
          
          // Verificar se todos os módulos solicitados estão disponíveis no cliente
          const invalidModules = requestedModules.filter(m => !customerModules.includes(m));
          
          if (invalidModules.length > 0) {
            return res.status(400).json({
              message: "Módulos incompatíveis",
              details: `Os módulos ${invalidModules.join(', ')} não estão disponíveis para o cliente "${customer.name}". Módulos disponíveis: ${customerModules.join(', ')}`
            });
          }
        }
      }
      
      const updatedUser = await storage.updateUser(req.params.id, user);
      
      // Broadcast user update to all connected clients
      broadcast({
        type: 'update',
        resource: 'users',
        data: sanitizeUser(updatedUser),
        customerId: updatedUser.customerId || undefined,
      });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/deactivate", requirePermission('users_edit'), async (req, res) => {
    try {
      const user = await storage.deactivateUser(req.params.id);
      
      // Broadcast user deactivation to all connected clients
      broadcast({
        type: 'update',
        resource: 'users',
        data: sanitizeUser(user),
        customerId: user.customerId || undefined,
      });
      
      // IMPORTANTE: Desconectar o usuário desativado em tempo real via WebSocket
      forceLogoutUser(req.params.id);
      
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  app.delete("/api/users/:id", requirePermission('users_delete'), async (req, res) => {
    try {
      // Buscar o usuário ANTES de deletar para ter o customerId
      const user = await storage.getUser(req.params.id);
      
      await storage.deleteUser(req.params.id);
      
      // Broadcast user deletion to all connected clients
      if (user) {
        broadcast({
          type: 'delete',
          resource: 'users',
          data: { id: req.params.id },
          customerId: user.customerId || undefined,
        });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Services
  app.get("/api/customers/:customerId/services", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const services = await storage.getServicesByCustomer(req.params.customerId, module);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to get services" });
    }
  });

  app.get("/api/services/:id", async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to get service" });
    }
  });

  app.post("/api/services", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      const dataWithModule = {
        ...req.body,
        module: req.body.module || 'clean'
      };
      console.log("Creating service with data:", dataWithModule);
      const service = insertServiceSchema.parse(dataWithModule);
      console.log("Validated service:", service);
      const newService = await storage.createService(service);
      
      // Broadcast service creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'services',
        data: newService,
        customerId: newService.customerId || undefined,
      });
      
      res.status(201).json(newService);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Service validation error:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", async (req, res) => {
    try {
      const service = insertServiceSchema.partial().parse(req.body);
      const updatedService = await storage.updateService(req.params.id, service);
      
      // Broadcast service update to all connected clients
      broadcast({
        type: 'update',
        resource: 'services',
        data: updatedService,
        customerId: updatedService.customerId || undefined,
      });
      
      res.json(updatedService);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      // Buscar o service ANTES de deletar para ter o customerId
      const service = await storage.getService(req.params.id);
      
      await storage.deleteService(req.params.id);
      
      // Broadcast service deletion to all connected clients
      if (service) {
        broadcast({
          type: 'delete',
          resource: 'services',
          data: { id: req.params.id },
          customerId: service.customerId || undefined,
        });
      }
      
      res.json({ message: "Service deleted successfully" });
    } catch (error: any) {
      // Se a mensagem começa com "Não é possível excluir", é nosso erro controlado
      if (error.message?.includes('Não é possível excluir porque existem OSs concluídas')) {
        return res.status(400).json({ message: error.message });
      }
      
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Falha ao excluir serviço" });
    }
  });

  // Checklist Templates
  app.get("/api/companies/:companyId/checklist-templates", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const templates = await storage.getChecklistTemplatesByCompany(req.params.companyId, module);
      res.json(templates);
    } catch (error) {
      console.error("Error getting checklist templates:", error);
      res.status(500).json({ message: "Failed to get checklist templates" });
    }
  });

  // Create checklist template
  app.post("/api/companies/:companyId/checklist-templates", requirePermission('checklists_create'), async (req, res) => {
    try {
      const template = insertChecklistTemplateSchema.parse({
        ...req.body,
        companyId: req.params.companyId
      });
      const newTemplate = await storage.createChecklistTemplate(template);
      res.status(201).json(newTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating checklist template:", error);
      res.status(500).json({ message: "Failed to create checklist template" });
    }
  });

  // Update checklist template
  app.put("/api/companies/:companyId/checklist-templates/:id", async (req, res) => {
    try {
      const template = insertChecklistTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateChecklistTemplate(req.params.id, template);
      res.json(updatedTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating checklist template:", error);
      res.status(500).json({ message: "Failed to update checklist template" });
    }
  });

  // Delete checklist template
  app.delete("/api/companies/:companyId/checklist-templates/:id", requirePermission('checklists_delete'), async (req, res) => {
    try {
      await storage.deleteChecklistTemplate(req.params.id);
      res.json({ message: "Checklist template deleted successfully" });
    } catch (error) {
      console.error("Error deleting checklist template:", error);
      res.status(500).json({ message: "Failed to delete checklist template" });
    }
  });

  // Get checklist template for a specific service
  app.get("/api/services/:serviceId/checklist", async (req, res) => {
    try {
      const checklist = await storage.getChecklistTemplateByServiceId(req.params.serviceId);
      if (!checklist) {
        return res.status(404).json({ message: "No checklist found for this service" });
      }
      res.json(checklist);
    } catch (error) {
      console.error("Error getting checklist for service:", error);
      res.status(500).json({ message: "Failed to get service checklist" });
    }
  });

  // Services by Zone
  app.get("/api/customers/:customerId/zones/:zoneId/services", async (req, res) => {
    try {
      const services = await storage.getServicesByZone(req.params.customerId, req.params.zoneId);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to get services for zone" });
    }
  });

  // Service Types
  app.get("/api/customers/:customerId/service-types", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const serviceTypes = await storage.getServiceTypesByCustomer(req.params.customerId, module);
      res.json(serviceTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to get service types" });
    }
  });

  app.post("/api/customers/:customerId/service-types", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      // Buscar customer para obter companyId
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const companyId = customer.companyId;
      console.log("Creating service type with data:", req.body, "customerId:", req.params.customerId, "companyId:", companyId);
      
      // Generate code from name if not provided
      const code = req.body.code || req.body.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      
      const dataToValidate = {
        ...req.body,
        code,
        companyId,
        customerId: req.params.customerId,
        module: req.body.module || 'clean'
      };
      
      console.log("Data to validate:", dataToValidate);
      
      const serviceType = insertServiceTypeSchema.parse(dataToValidate);
      const newServiceType = await storage.createServiceType(serviceType);
      res.status(201).json(newServiceType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating service type:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating service type:", error);
      res.status(500).json({ message: "Erro ao criar tipo de serviço" });
    }
  });

  app.delete("/api/customers/:customerId/service-types/:id", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      await storage.deleteServiceType(req.params.id);
      res.json({ message: "Service type deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting service type:", error);
      
      // Verificar se é o erro de atividades concluídas (a mensagem já vem formatada com os números das OSs)
      if (error.message?.includes('OSs concluídas vinculadas')) {
        return res.status(400).json({ 
          message: error.message
        });
      }
      
      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        return res.status(400).json({ 
          message: "Não é possível excluir este tipo de serviço porque existem vínculos com outros registros." 
        });
      }
      
      res.status(500).json({ message: "Falha ao excluir serviço" });
    }
  });

  app.put("/api/service-types/:id", async (req, res) => {
    try {
      const serviceType = insertServiceTypeSchema.partial().parse(req.body);
      const updatedServiceType = await storage.updateServiceType(req.params.id, serviceType);
      res.json(updatedServiceType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service type" });
    }
  });

  app.delete("/api/service-types/:id", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      await storage.deleteServiceType(req.params.id);
      res.json({ message: "Service type deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service type" });
    }
  });

  // CATEGORIAS - TODAS AS ROTAS COMENTADAS (MANTER PARA REFERÊNCIA FUTURA)
  /* app.get("/api/customers/:customerId/service-categories", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const serviceCategories = await storage.getServiceCategoriesByCustomer(req.params.customerId, module);
      res.json(serviceCategories);
    } catch (error) {
      res.status(500).json({ message: "Failed to get service categories" });
    }
  });

  app.delete("/api/customers/:customerId/service-categories/:id", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      await storage.deleteServiceCategory(req.params.id);
      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ message: "Failed to delete service category" });
    }
  });

  app.get("/api/service-types/:typeId/categories", async (req, res) => {
    try {
      const serviceCategories = await storage.getServiceCategoriesByType(req.params.typeId);
      res.json(serviceCategories);
    } catch (error) {
      res.status(500).json({ message: "Failed to get service categories by type" });
    }
  });

  app.post("/api/customers/:customerId/service-categories", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      // Generate code from name if not provided
      const code = req.body.code || req.body.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      
      const serviceCategory = insertServiceCategorySchema.parse({
        ...req.body,
        code,
        customerId: req.params.customerId
      });
      const newServiceCategory = await storage.createServiceCategory(serviceCategory);
      res.status(201).json(newServiceCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create service category" });
    }
  });

  app.put("/api/service-categories/:id", async (req, res) => {
    try {
      const serviceCategory = insertServiceCategorySchema.partial().parse(req.body);
      const updatedServiceCategory = await storage.updateServiceCategory(req.params.id, serviceCategory);
      res.json(updatedServiceCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service category" });
    }
  });

  app.delete("/api/service-categories/:id", requirePermission('service_settings_edit'), async (req, res) => {
    try {
      await storage.deleteServiceCategory(req.params.id);
      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service category" });
    }
  }); */

  // Work Orders
  app.get("/api/companies/:companyId/work-orders", async (req, res) => {
    try {
      const { zoneId, assignedTo } = req.query;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      let workOrders = await storage.getWorkOrdersByCompany(req.params.companyId, module);
      
      // Filter by zone if provided
      if (zoneId) {
        workOrders = workOrders.filter(wo => wo.zoneId === zoneId);
      }
      
      // Filter by assignedTo if provided (include unassigned work orders and paused ones)
      if (assignedTo) {
        workOrders = workOrders.filter(wo => 
          wo.assignedUserId === assignedTo || 
          wo.assignedUserId === null || 
          wo.status === 'pausada' // Operadores podem ver O.S. pausadas por qualquer colaborador
        );
      }
      
      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get work orders" });
    }
  });

  app.get("/api/users/:userId/work-orders", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrdersByUser(req.params.userId);
      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get work orders" });
    }
  });

  app.get("/api/work-orders/:id", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json(workOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to get work order" });
    }
  });

  app.post("/api/work-orders", requirePermission('workorders_create'), async (req, res) => {
    try {
      const dataWithModule = {
        ...req.body,
        module: req.body.module || 'clean'
      };
      
      const workOrder = insertWorkOrderSchema.parse(dataWithModule);
      const newWorkOrder = await storage.createWorkOrder(workOrder);
      
      // Send webhook notification if configured
      // TODO: Implement webhook sending logic
      
      res.status(201).json(newWorkOrder);
    } catch (error: any) {
      // Tratamento de erros do Zod (validação)
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => {
          const field = e.path.join('.');
          const fieldNames: Record<string, string> = {
            'title': 'Título',
            'description': 'Descrição',
            'type': 'Tipo',
            'status': 'Status',
            'priority': 'Prioridade',
            'zoneId': 'Zona/Local',
            'serviceId': 'Serviço',
            'companyId': 'Empresa',
            'scheduledDate': 'Data agendada',
            'dueDate': 'Data de vencimento',
          };
          const friendlyField = fieldNames[field] || field;
          return `${friendlyField}: ${e.message}`;
        });
        
        return res.status(400).json({ 
          message: "Dados inválidos na ordem de serviço",
          details: fieldErrors.join('; '),
          errors: error.errors 
        });
      }
      
      // Tratamento de erros do PostgreSQL
      if (error.code === '23505') {
        return res.status(400).json({ 
          message: "Registro duplicado",
          details: "Já existe uma ordem de serviço com esses dados."
        });
      }
      
      if (error.code === '23503') {
        return res.status(400).json({ 
          message: "Referência inválida",
          details: "A zona, serviço ou usuário selecionado não existe. Por favor, verifique os dados e tente novamente."
        });
      }
      
      console.error('Erro ao criar ordem de serviço:', error);
      res.status(500).json({ 
        message: "Erro ao criar ordem de serviço",
        details: "Ocorreu um erro inesperado. Por favor, tente novamente."
      });
    }
  });

  app.put("/api/work-orders/:id", requireAuth, async (req, res) => {
    try {
      const workOrder = insertWorkOrderSchema.partial().parse(req.body);
      
      // Se está sendo cancelada, adicionar timestamp e usuário
      if (workOrder.status === 'cancelada') {
        workOrder.cancelledAt = new Date();
        workOrder.cancelledBy = req.user?.id;
      }
      
      // Obter O.S. atual para verificar mudança de status
      const currentWO = await storage.getWorkOrder(req.params.id);
      
      // 🔥 ATUALIZADO: Adicionar colaborador ao array de responsáveis em QUALQUER alteração
      if (req.user?.id) {
        if (currentWO) {
          // Pegar array atual de responsáveis (ou inicializar vazio)
          const currentAssignedIds = currentWO.assignedUserIds || [];
          
          // Adicionar usuário atual se não estiver na lista (evitar duplicatas)
          if (!currentAssignedIds.includes(req.user.id)) {
            workOrder.assignedUserIds = [...currentAssignedIds, req.user.id];
            console.log(`[WO UPDATE] Adicionando colaborador ${req.user.id} ao array. Array atual:`, currentAssignedIds, '→ Novo array:', workOrder.assignedUserIds);
          }
          
          // Também atualizar assignedUserId para última pessoa que editou
          workOrder.assignedUserId = req.user.id;
        }
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.id, workOrder);
      
      // 🔧 DESCONTO AUTOMÁTICO DE ESTOQUE: Quando O.S. é concluída
      if (currentWO && currentWO.status !== 'concluida' && workOrder.status === 'concluida') {
        console.log(`[WO COMPLETE] O.S. ${req.params.id} concluída - Processando desconto de estoque...`);
        try {
          await deductStockForWorkOrder(req.params.id, req.user?.id);
        } catch (stockError) {
          console.error(`[WO COMPLETE] Erro ao descontar estoque para O.S. ${req.params.id}:`, stockError);
          // Não bloquear a conclusão da O.S., apenas logar o erro
        }
      }
      
      // Send webhook notification if configured
      // TODO: Implement webhook sending logic
      
      res.json(updatedWorkOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.patch("/api/work-orders/:id", async (req, res) => {
    try {
      // Extrair usuário do token se disponível (sem rejeitar se não houver)
      const user = await getUserFromToken(req);
      if (user) {
        req.user = user;
      }
      
      const workOrder = insertWorkOrderSchema.partial().parse(req.body);
      
      // Se está sendo cancelada, adicionar timestamp e usuário
      if (workOrder.status === 'cancelada') {
        workOrder.cancelledAt = new Date();
        workOrder.cancelledBy = req.user?.id;
      }
      
      // Obter O.S. atual para verificar mudança de status
      const currentWO = await storage.getWorkOrder(req.params.id);
      
      // 🔥 ATUALIZADO: Adicionar colaborador ao array de responsáveis em QUALQUER alteração
      if (req.user?.id) {
        if (currentWO) {
          // Pegar array atual de responsáveis (ou inicializar vazio)
          const currentAssignedIds = currentWO.assignedUserIds || [];
          
          // Adicionar usuário atual se não estiver na lista (evitar duplicatas)
          if (!currentAssignedIds.includes(req.user.id)) {
            workOrder.assignedUserIds = [...currentAssignedIds, req.user.id];
            console.log(`[WO UPDATE] Adicionando colaborador ${req.user.id} ao array. Array atual:`, currentAssignedIds, '→ Novo array:', workOrder.assignedUserIds);
          }
          
          // Também atualizar assignedUserId para última pessoa que editou
          workOrder.assignedUserId = req.user.id;
        }
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.id, workOrder);
      
      // 🔧 DESCONTO AUTOMÁTICO DE ESTOQUE: Quando O.S. é concluída
      if (currentWO && currentWO.status !== 'concluida' && workOrder.status === 'concluida') {
        console.log(`[WO COMPLETE] O.S. ${req.params.id} concluída (PATCH) - Processando desconto de estoque...`);
        try {
          await deductStockForWorkOrder(req.params.id, req.user?.id);
        } catch (stockError) {
          console.error(`[WO COMPLETE] Erro ao descontar estoque para O.S. ${req.params.id}:`, stockError);
          // Não bloquear a conclusão da O.S., apenas logar o erro
        }
      }
      
      // Send webhook notification if configured
      // TODO: Implement webhook sending logic
      
      res.json(updatedWorkOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteWorkOrder(req.params.id);
      res.json({ message: "Work order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete work order" });
    }
  });

  // Clear all work orders (for testing/reset)
  app.delete("/api/work-orders/clear-all", requireAdmin, async (req, res) => {
    try {
      await storage.clearAllWorkOrders();
      res.json({ message: "All work orders cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear work orders" });
    }
  });

  // Work Order Comments
  app.get("/api/work-orders/:workOrderId/comments", async (req, res) => {
    try {
      const comments = await storage.getWorkOrderComments(req.params.workOrderId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  // Work Order Execution Time - Calcula tempo real de execução (pausas descontadas)
  app.get("/api/work-orders/:workOrderId/execution-time", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (!workOrder.startedAt) {
        return res.json({ 
          milliseconds: 0, 
          formatted: "Não iniciada",
          periods: []
        });
      }

      const comments = await storage.getWorkOrderComments(req.params.workOrderId);
      const executionPeriods: { start: Date; end: Date | null }[] = [];
      let currentPeriodStart: Date | null = new Date(workOrder.startedAt);

      // Processar comentários em ordem cronológica
      for (const comment of comments) {
        const text = comment.comment || "";
        const timestamp = new Date(comment.createdAt as Date);

        // Detectar PAUSA - finaliza período atual
        if ((text.includes("pausou a OS") || text.includes("pausou o OS")) && currentPeriodStart) {
          executionPeriods.push({
            start: currentPeriodStart,
            end: timestamp
          });
          currentPeriodStart = null;
        }

        // Detectar RETOMADA ou INÍCIO - inicia novo período
        if ((text.includes("iniciou a execução") || text.includes("retomou a execução")) && !currentPeriodStart) {
          currentPeriodStart = timestamp;
        }
      }

      // Se ainda está em execução
      if (currentPeriodStart && workOrder.status === 'em_execucao') {
        executionPeriods.push({
          start: currentPeriodStart,
          end: null // null indica "em execução agora"
        });
      }

      // Se foi concluída, finaliza o último período
      if (currentPeriodStart && workOrder.status === 'concluida' && workOrder.completedAt) {
        executionPeriods.push({
          start: currentPeriodStart,
          end: new Date(workOrder.completedAt)
        });
      }

      // Calcular tempo total
      let totalMs = 0;
      const now = new Date();
      
      for (const period of executionPeriods) {
        const endTime = period.end || now;
        const duration = endTime.getTime() - period.start.getTime();
        totalMs += duration;
      }

      // Formatar tempo
      const hours = Math.floor(totalMs / (1000 * 60 * 60));
      const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

      let formatted = "";
      if (hours > 0) {
        formatted = `${hours}h ${minutes}min`;
      } else if (minutes > 0) {
        formatted = `${minutes}min ${seconds}s`;
      } else {
        formatted = `${seconds}s`;
      }

      res.json({
        milliseconds: totalMs,
        formatted,
        periods: executionPeriods.map(p => ({
          start: p.start.toISOString(),
          end: p.end ? p.end.toISOString() : null,
          durationMs: p.end ? p.end.getTime() - p.start.getTime() : now.getTime() - p.start.getTime()
        }))
      });
    } catch (error) {
      console.error("Error calculating execution time:", error);
      res.status(500).json({ message: "Failed to calculate execution time" });
    }
  });

  app.post("/api/work-orders/:workOrderId/comments", requirePermission('workorders_comment'), async (req, res) => {
    try {
      const comment = {
        id: crypto.randomUUID(),
        workOrderId: req.params.workOrderId,
        userId: req.body.userId,
        comment: req.body.comment,
        attachments: req.body.attachments,
        isReopenRequest: req.body.isReopenRequest || false,
      };
      const newComment = await storage.createWorkOrderComment(comment);
      res.status(201).json(newComment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.delete("/api/work-orders/:workOrderId/comments/:commentId", requirePermission('workorders_comment'), async (req, res) => {
    try {
      await storage.deleteWorkOrderComment(req.params.commentId);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Work Order Rating (Customer Feedback)
  app.post("/api/work-orders/:workOrderId/rating", requirePermission('workorders_evaluate'), async (req, res) => {
    try {
      const { rating, comment, userId } = req.body;
      
      if (!rating || rating < 1 || rating > 10) {
        return res.status(400).json({ message: "Rating must be between 1 and 10" });
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.workOrderId, {
        customerRating: rating,
        customerRatingComment: comment || null,
        ratedAt: new Date(),
        ratedBy: userId,
      });
      
      res.json(updatedWorkOrder);
    } catch (error) {
      console.error("Error rating work order:", error);
      res.status(500).json({ message: "Failed to rate work order" });
    }
  });

  // Work Order Reopen
  app.post("/api/work-orders/:workOrderId/reopen", requirePermission('workorders_edit'), async (req, res) => {
    try {
      const { userId, reason, attachments } = req.body;
      const reopenedWorkOrder = await storage.reopenWorkOrder(
        req.params.workOrderId,
        userId,
        reason,
        attachments
      );
      res.json(reopenedWorkOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to reopen work order" });
    }
  });

  // ============================================================
  // MOBILE APP ENDPOINTS - Endpoints específicos para o app móvel
  // ============================================================

  // Start Work Order (Mobile)
  app.post("/api/work-orders/:workOrderId/start", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const workOrder = await storage.getWorkOrder(workOrderId);
      
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Verificar se a O.S. pode ser iniciada (status aberta ou vencida)
      if (workOrder.status !== 'aberta' && workOrder.status !== 'vencida') {
        return res.status(400).json({ 
          message: `Ordem de serviço não pode ser iniciada. Status atual: ${workOrder.status}` 
        });
      }
      
      // Montar array de assignedUserIds filtrando undefined
      const currentIds = workOrder.assignedUserIds || [];
      const newIds = req.user?.id ? [...currentIds, req.user.id].filter((id, idx, arr) => id && arr.indexOf(id) === idx) : currentIds;
      
      const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
        status: 'em_execucao',
        startedAt: new Date(),
        assignedUserId: req.user?.id,
        assignedUserIds: newIds as string[],
      });
      
      console.log(`[MOBILE] O.S. ${workOrderId} iniciada por ${req.user?.username}`);
      broadcast({
        type: 'update',
        resource: 'work_orders',
        data: updatedWorkOrder,
        customerId: workOrder.customerId || undefined,
      });
      
      res.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
      console.error("[MOBILE] Erro ao iniciar O.S.:", error);
      res.status(500).json({ message: "Erro ao iniciar ordem de serviço" });
    }
  });

  // Complete Work Order (Mobile)
  app.post("/api/work-orders/:workOrderId/complete", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const { notes, checklistAnswers, photos } = req.body;
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Verificar se a O.S. pode ser concluída
      if (workOrder.status !== 'em_execucao') {
        return res.status(400).json({ 
          message: `Ordem de serviço não pode ser concluída. Status atual: ${workOrder.status}` 
        });
      }
      
      // Processar fotos se houver
      const uploadedPhotos: string[] = [];
      if (photos && Array.isArray(photos)) {
        for (const photo of photos) {
          try {
            const base64Clean = photo.base64.includes(',') 
              ? photo.base64.split(',')[1] 
              : photo.base64;
            const buffer = Buffer.from(base64Clean, 'base64');
            const { relativePath } = await storage.saveWorkOrderAttachmentFile({
              buffer,
              format: photo.type || 'jpg',
            });
            uploadedPhotos.push(relativePath);
          } catch (photoError) {
            console.error("[MOBILE] Erro ao processar foto:", photoError);
          }
        }
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
        status: 'concluida',
        completedAt: new Date(),
      });
      
      // Adicionar comentário com fotos se houver
      if (notes && notes.trim()) {
        await storage.createWorkOrderComment({
          id: nanoid(),
          workOrderId,
          comment: notes,
          userId: req.user?.id || 'system',
          attachments: uploadedPhotos,
        });
      }
      
      console.log(`[MOBILE] O.S. ${workOrderId} concluída por ${req.user?.username}`);
      broadcast({
        type: 'update',
        resource: 'work_orders',
        data: updatedWorkOrder,
        customerId: workOrder.customerId || undefined,
      });
      
      res.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
      console.error("[MOBILE] Erro ao concluir O.S.:", error);
      res.status(500).json({ message: "Erro ao concluir ordem de serviço" });
    }
  });

  // Pause Work Order (Mobile)
  app.post("/api/work-orders/:workOrderId/pause", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const { reason, photos } = req.body;
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Verificar se a O.S. pode ser pausada
      if (workOrder.status !== 'em_execucao') {
        return res.status(400).json({ 
          message: `Ordem de serviço não pode ser pausada. Status atual: ${workOrder.status}` 
        });
      }
      
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Motivo da pausa é obrigatório" });
      }
      
      // Processar fotos se houver
      const uploadedPhotos: string[] = [];
      if (photos && Array.isArray(photos)) {
        for (const photo of photos) {
          try {
            const base64Clean = photo.base64.includes(',') 
              ? photo.base64.split(',')[1] 
              : photo.base64;
            const buffer = Buffer.from(base64Clean, 'base64');
            const { relativePath } = await storage.saveWorkOrderAttachmentFile({
              buffer,
              format: 'jpg',
            });
            uploadedPhotos.push(relativePath);
          } catch (photoError) {
            console.error("[MOBILE] Erro ao processar foto de pausa:", photoError);
          }
        }
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
        status: 'pausada',
      });
      
      // Adicionar comentário com motivo da pausa
      await storage.createWorkOrderComment({
        id: nanoid(),
        workOrderId,
        comment: `[PAUSA] ${reason}`,
        userId: req.user?.id || 'system',
        attachments: uploadedPhotos,
      });
      
      console.log(`[MOBILE] O.S. ${workOrderId} pausada por ${req.user?.username}: ${reason}`);
      broadcast({
        type: 'update',
        resource: 'work_orders',
        data: updatedWorkOrder,
        customerId: workOrder.customerId || undefined,
      });
      
      res.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
      console.error("[MOBILE] Erro ao pausar O.S.:", error);
      res.status(500).json({ message: "Erro ao pausar ordem de serviço" });
    }
  });

  // Resume Work Order (Mobile)
  app.post("/api/work-orders/:workOrderId/resume", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const workOrder = await storage.getWorkOrder(workOrderId);
      
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Verificar se a O.S. pode ser retomada
      if (workOrder.status !== 'pausada') {
        return res.status(400).json({ 
          message: `Ordem de serviço não pode ser retomada. Status atual: ${workOrder.status}` 
        });
      }
      
      const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
        status: 'em_execucao',
      });
      
      // Adicionar comentário de retomada
      await storage.createWorkOrderComment({
        id: nanoid(),
        workOrderId,
        comment: '[RETOMADA] Ordem de serviço retomada',
        userId: req.user?.id || 'system',
      });
      
      console.log(`[MOBILE] O.S. ${workOrderId} retomada por ${req.user?.username}`);
      broadcast({
        type: 'update',
        resource: 'work_orders',
        data: updatedWorkOrder,
        customerId: workOrder.customerId || undefined,
      });
      
      res.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
      console.error("[MOBILE] Erro ao retomar O.S.:", error);
      res.status(500).json({ message: "Erro ao retomar ordem de serviço" });
    }
  });

  // Upload Work Order Photo (Mobile)
  app.post("/api/work-orders/:workOrderId/photos", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const { base64, type, checklistItemId } = req.body;
      
      if (!base64) {
        return res.status(400).json({ message: "Foto é obrigatória" });
      }
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Processar foto
      const base64Clean = base64.includes(',') 
        ? base64.split(',')[1] 
        : base64;
      const buffer = Buffer.from(base64Clean, 'base64');
      
      const { relativePath, absolutePath } = await storage.saveWorkOrderAttachmentFile({
        buffer,
        format: 'jpg',
      });
      
      // Criar registro de anexo
      const attachment = await storage.createWorkOrderAttachmentRecord({
        workOrderId,
        userId: req.user?.id || 'system',
        relativePath,
        originalName: `photo_${Date.now()}.jpg`,
        fileType: 'image/jpeg',
        fileSize: buffer.length,
      });
      
      console.log(`[MOBILE] Foto adicionada à O.S. ${workOrderId} por ${req.user?.username}`);
      
      res.json({ id: attachment.id, path: relativePath });
    } catch (error) {
      console.error("[MOBILE] Erro ao fazer upload de foto:", error);
      res.status(500).json({ message: "Erro ao fazer upload de foto" });
    }
  });

  // Submit Checklist Execution (Mobile)
  app.post("/api/work-orders/:workOrderId/checklist", requireAuth, async (req, res) => {
    try {
      const workOrderId = req.params.workOrderId;
      const { checklistTemplateId, answers } = req.body;
      
      if (!checklistTemplateId || !answers) {
        return res.status(400).json({ message: "Template e respostas são obrigatórios" });
      }
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Ordem de serviço não encontrada" });
      }
      
      // Salvar respostas do checklist como comentário estruturado
      const answersJson = JSON.stringify(answers);
      await storage.createWorkOrderComment({
        id: nanoid(),
        workOrderId,
        comment: `[CHECKLIST] Template: ${checklistTemplateId}\n${answersJson}`,
        userId: req.user?.id || 'system',
      });
      
      console.log(`[MOBILE] Checklist executado para O.S. ${workOrderId} por ${req.user?.username}`);
      
      res.json({ id: nanoid(), success: true });
    } catch (error) {
      console.error("[MOBILE] Erro ao submeter checklist:", error);
      res.status(500).json({ message: "Erro ao submeter checklist" });
    }
  });

  // ============================================================
  // FIM DOS ENDPOINTS MOBILE
  // ============================================================

  // Upload Base64 Attachment (for mobile photo uploads)
  const uploadBase64Schema = z.object({
    base64: z.string().min(1),
    format: z.enum(['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']),
    workOrderId: z.string().optional(),
  });

  app.post("/api/attachments/upload-base64", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const validatedData = uploadBase64Schema.parse(req.body);
      const { base64, format, workOrderId } = validatedData;

      // Strip data URL prefix if present (data:image/jpeg;base64,XXXXX)
      const base64Clean = base64.includes(',') 
        ? base64.split(',')[1] 
        : base64;

      // Decode Base64 to Buffer
      const buffer = Buffer.from(base64Clean, 'base64');

      // Validate workOrderId ownership if provided
      if (workOrderId && req.user) {
        const workOrder = await storage.getWorkOrder(workOrderId);
        if (!workOrder || workOrder.customerId !== req.user.customerId) {
          return res.status(403).json({ 
            message: "Forbidden: Work order not found or not authorized" 
          });
        }
      }

      // Save file to disk
      const { relativePath, absolutePath } = await storage.saveWorkOrderAttachmentFile({
        buffer,
        format,
      });

      // Create DB record if workOrderId provided
      let attachmentId: string | undefined;
      if (workOrderId && req.user) {
        const result = await storage.createWorkOrderAttachmentRecord({
          workOrderId,
          userId: req.user.id,
          relativePath,
          fileSize: buffer.length,
          fileType: `image/${format}`,
          originalName: `upload_${Date.now()}.${format}`,
        });
        attachmentId = result.id;
      }

      // Return success response
      res.status(201).json({
        success: true,
        filename: relativePath.split('/').pop(),
        url: relativePath,
        id: attachmentId,
      });
    } catch (error) {
      console.error('[UPLOAD] Base64 upload error:', error);

      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid upload data", 
          errors: error.errors 
        });
      }

      // Handle size/format errors from helper
      if (error instanceof Error) {
        if (error.message.includes('exceeds 8MB')) {
          return res.status(413).json({ message: error.message });
        }
        if (error.message.includes('Unsupported format')) {
          return res.status(400).json({ message: error.message });
        }
      }

      // Default error
      res.status(500).json({ 
        message: "Failed to upload attachment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Batch upload endpoint for multiple photos
  const uploadBase64BatchSchema = z.object({
    attachments: z.array(z.object({
      base64: z.string().min(1),
      format: z.enum(['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']),
    })),
  });

  app.post("/api/attachments/upload-base64-batch", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const validatedData = uploadBase64BatchSchema.parse(req.body);
      const { attachments } = validatedData;

      if (attachments.length === 0) {
        return res.status(400).json({ message: "No attachments provided" });
      }

      // Process all photos
      const results = await Promise.all(
        attachments.map(async ({ base64, format }) => {
          // Strip data URL prefix if present
          const base64Clean = base64.includes(',') 
            ? base64.split(',')[1] 
            : base64;

          // Decode Base64 to Buffer
          const buffer = Buffer.from(base64Clean, 'base64');

          // Save file to disk
          const { relativePath } = await storage.saveWorkOrderAttachmentFile({
            buffer,
            format,
          });

          return {
            filename: relativePath.split('/').pop() as string,
            url: relativePath,
          };
        })
      );

      // Return batch response
      res.status(201).json({
        success: true,
        filenames: results.map(r => r.filename),
        urls: results.map(r => r.url),
      });
    } catch (error) {
      console.error('[BATCH UPLOAD] Batch upload error:', error);

      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid batch upload data", 
          errors: error.errors 
        });
      }

      // Handle size/format errors
      if (error instanceof Error) {
        if (error.message.includes('exceeds 8MB')) {
          return res.status(413).json({ message: error.message });
        }
        if (error.message.includes('Unsupported format')) {
          return res.status(400).json({ message: error.message });
        }
      }

      // Default error
      res.status(500).json({ 
        message: "Failed to upload attachments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Dashboard stats
  app.get("/api/companies/:companyId/dashboard-stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.params.companyId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Dashboard stats with filters
  app.get("/api/companies/:companyId/dashboard-stats/:period/:siteId", async (req, res) => {
    try {
      const { companyId, period, siteId } = req.params;
      const stats = await storage.getDashboardStats(companyId, period, siteId === 'todos' ? undefined : siteId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Performance analytics
  app.get("/api/companies/:companyId/analytics", async (req, res) => {
    try {
      const period = req.query.period as string || '7d';
      const analytics = await storage.getPerformanceAnalytics(req.params.companyId, period);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get performance analytics" });
    }
  });

  // Reports metrics endpoint
  app.get("/api/companies/:companyId/reports/metrics", async (req, res) => {
    try {
      const { companyId } = req.params;
      const period = req.query.period as string || '30';
      const metrics = await storage.getReportsMetrics(companyId, period);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get reports metrics" });
    }
  });

  // Work orders status distribution
  app.get("/api/companies/:companyId/reports/work-orders-status", async (req, res) => {
    try {
      const { companyId } = req.params;
      const period = req.query.period as string || '30';
      const statusData = await storage.getWorkOrdersStatusDistribution(companyId, period);
      res.json(statusData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get work orders status distribution" });
    }
  });

  // SLA performance breakdown
  app.get("/api/companies/:companyId/reports/sla-performance", async (req, res) => {
    try {
      const { companyId } = req.params;
      const period = req.query.period as string || '30';
      const slaData = await storage.getSLAPerformanceBreakdown(companyId, period);
      res.json(slaData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get SLA performance breakdown" });
    }
  });

  // Performance analytics with filters
  app.get("/api/companies/:companyId/analytics/:period/:siteId", async (req, res) => {
    try {
      const { companyId, period, siteId } = req.params;
      const analytics = await storage.getPerformanceAnalytics(companyId, period, siteId === 'todos' ? undefined : siteId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get performance analytics" });
    }
  });

  // QR Code scanning endpoints
  app.get("/api/qr-execution/:code", async (req, res) => {
    try {
      const point = await storage.getQrCodePointByCode(req.params.code);
      if (!point || point.type !== 'execucao') {
        return res.status(404).json({ message: "QR code not found or invalid type" });
      }
      
      // 🔥 FIX: Buscar work orders agendadas para esta zona
      let scheduledWorkOrders: any[] = [];
      let zone = null;
      
      if (point.zoneId) {
        // Buscar a zona para pegar o siteId
        zone = await storage.getZone(point.zoneId);
        console.log('[QR EXECUTION] Zone:', zone);
        
        if (zone && zone.siteId) {
          console.log('[QR EXECUTION] Zone has siteId:', zone.siteId);
          
          // Buscar o site para pegar o customerId
          const site = await storage.getSite(zone.siteId);
          console.log('[QR EXECUTION] Site result:', site);
          
          if (site) {
            console.log('[QR EXECUTION] Site customerId:', site.customerId);
            
            if (site.customerId) {
              // Buscar work orders do cliente com filtro de módulo
              console.log('[QR EXECUTION] Fetching WOs for customer:', site.customerId, 'module:', point.module);
              const allWorkOrders = await storage.getWorkOrdersByCustomer(site.customerId, point.module as 'clean' | 'maintenance');
              console.log('[QR EXECUTION] All work orders for customer:', allWorkOrders.length);
              
              // Filtrar work orders desta zona específica que não estão concluídas/canceladas
              scheduledWorkOrders = allWorkOrders.filter((wo: any) => 
                wo.zoneId === point.zoneId && 
                wo.status !== 'concluida' && 
                wo.status !== 'cancelada'
              );
              console.log('[QR EXECUTION] Filtered work orders for zone:', scheduledWorkOrders.length);
            } else {
              console.log('[QR EXECUTION] Site has no customerId!');
            }
          } else {
            console.log('[QR EXECUTION] Site not found for siteId:', zone.siteId);
          }
        } else {
          console.log('[QR EXECUTION] Zone has no siteId or zone is null');
        }
      }
      
      // Se há work orders agendadas, retorna a mais prioritária
      const hasScheduledActivity = scheduledWorkOrders.length > 0;
      const scheduledWorkOrder = hasScheduledActivity ? scheduledWorkOrders[0] : null;
      
      res.json({ 
        point, 
        zone,
        hasScheduledActivity,
        scheduledWorkOrder
      });
    } catch (error) {
      console.error('[QR EXECUTION] Error:', error);
      res.status(500).json({ message: "Failed to process QR scan" });
    }
  });

  app.get("/api/qr-public/:code", async (req, res) => {
    try {
      const point = await storage.getQrCodePointByCode(req.params.code);
      if (!point || point.type !== 'atendimento') {
        return res.status(404).json({ message: "QR code not found or invalid type" });
      }
      
      res.json({ point });
    } catch (error) {
      res.status(500).json({ message: "Failed to process QR scan" });
    }
  });

  app.post("/api/qr-public/:code/service-request", requireAuth, async (req, res) => {
    try {
      const point = await storage.getQrCodePointByCode(req.params.code);
      if (!point || point.type !== 'atendimento') {
        return res.status(404).json({ message: "QR code not found or invalid type" });
      }

      const { description, photo, requesterName, requesterContact } = req.body;
      
      // Create IP hash for spam control
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
      
      // Check for recent requests from this IP for spam control
      const recentRequests = await storage.checkRecentPublicRequests(ipHash, point.id, 24);
      if (recentRequests >= 5) {
        return res.status(429).json({ 
          message: "Muitas solicitações. Tente novamente em algumas horas.",
          code: "TOO_MANY_REQUESTS" 
        });
      }
      
      // Get zone and company info
      if (!point.zoneId) {
        return res.status(400).json({ message: "QR code point has no zone associated" });
      }
      const zone = await storage.getZone(point.zoneId);
      if (!zone) {
        return res.status(404).json({ message: "Zone not found" });
      }

      const site = await storage.getSite(zone.siteId);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }

      // Create corrective work order
      const workOrder = await storage.createWorkOrder({
        companyId: site.companyId,
        zoneId: zone.id,
        qrCodePointId: point.id,
        requesterName,
        requesterContact,
        type: 'corretiva_publica',
        priority: 'media',
        title: `Solicitação de Atendimento - ${zone.name}`,
        description: description || 'Solicitação via QR Code público',
        origin: 'QR Atendimento',
        attachments: photo ? [photo] : undefined,
        scheduledDate: null,
        dueDate: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        startedAt: null,
        completedAt: null
      });

      // Log the public request for spam control
      await storage.createPublicRequestLog({
        id: crypto.randomUUID(),
        ipHash,
        qrCodePointId: point.id,
        userAgent: req.get('User-Agent') || 'unknown',
        requestData: { workOrderId: workOrder.id }
      });

      // TODO: Send webhook notification for WhatsApp integration
      
      res.status(201).json({ 
        message: "Solicitação criada com sucesso",
        workOrderNumber: workOrder.number 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create service request" });
    }
  });

  // Bathroom counter endpoints
  app.post("/api/zones/:zoneId/bathroom-counter/increment", requirePermission('workorders_create'), async (req, res) => {
    try {
      const counter = await storage.incrementBathroomCounter(req.params.zoneId);
      res.json(counter);
    } catch (error) {
      res.status(500).json({ message: "Failed to increment bathroom counter" });
    }
  });

  app.get("/api/zones/:zoneId/bathroom-counter", async (req, res) => {
    try {
      const counter = await storage.getBathroomCounterByZone(req.params.zoneId);
      if (!counter) {
        return res.status(404).json({ message: "Bathroom counter not found" });
      }
      res.json(counter);
    } catch (error) {
      res.status(500).json({ message: "Failed to get bathroom counter" });
    }
  });

  app.post("/api/bathroom-counters", requirePermission('workorders_create'), async (req, res) => {
    try {
      const counter = insertBathroomCounterSchema.parse(req.body);
      const newCounter = await storage.createBathroomCounter(counter);
      res.status(201).json(newCounter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bathroom counter" });
    }
  });

  // Dashboard Goals Configuration
  app.get("/api/companies/:companyId/dashboard-goals", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const goals = await storage.getDashboardGoals(req.params.companyId, module);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard goals" });
    }
  });

  app.post("/api/companies/:companyId/dashboard-goals", requirePermission('dashboard_view'), async (req, res) => {
    try {
      const goal = insertDashboardGoalSchema.parse({
        ...req.body,
        companyId: req.params.companyId,
        module: req.body.module || 'clean'
      });
      const newGoal = await storage.createDashboardGoal(goal);
      res.status(201).json(newGoal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create dashboard goal" });
    }
  });

  app.put("/api/dashboard-goals/:id", async (req, res) => {
    try {
      const goal = insertDashboardGoalSchema.partial().parse(req.body);
      const updatedGoal = await storage.updateDashboardGoal(req.params.id, goal);
      res.json(updatedGoal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update dashboard goal" });
    }
  });

  app.delete("/api/dashboard-goals/:id", requirePermission('dashboard_view'), async (req, res) => {
    try {
      await storage.deleteDashboardGoal(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dashboard goal" });
    }
  });

  // Customer dashboard goals (delegates to company goals)
  app.get("/api/customers/:customerId/dashboard-goals", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const goals = await storage.getDashboardGoals(customer.companyId, module);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard goals" });
    }
  });

  app.post("/api/customers/:customerId/dashboard-goals", requirePermission('dashboard_view'), async (req, res) => {
    try {
      console.log("Creating dashboard goal with data:", req.body, "customerId:", req.params.customerId);
      
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      const dataToValidate = {
        ...req.body,
        companyId: customer.companyId,
        module: req.body.module || 'clean'
      };
      
      console.log("Dashboard goal data to validate:", dataToValidate);
      
      const goal = insertDashboardGoalSchema.parse(dataToValidate);
      const newGoal = await storage.createDashboardGoal(goal);
      res.status(201).json(newGoal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating dashboard goal:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating dashboard goal:", error);
      res.status(500).json({ message: "Erro ao criar meta" });
    }
  });

  app.put("/api/customers/:customerId/dashboard-goals/:id", async (req, res) => {
    try {
      const goal = insertDashboardGoalSchema.partial().parse(req.body);
      const updatedGoal = await storage.updateDashboardGoal(req.params.id, goal);
      res.json(updatedGoal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error updating dashboard goal:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating dashboard goal:", error);
      res.status(500).json({ message: "Erro ao atualizar meta" });
    }
  });

  app.delete("/api/customers/:customerId/dashboard-goals/:id", requirePermission('dashboard_view'), async (req, res) => {
    try {
      await storage.deleteDashboardGoal(req.params.id);
      res.json({ message: "Meta excluída com sucesso" });
    } catch (error) {
      console.error("Error deleting dashboard goal:", error);
      res.status(500).json({ message: "Erro ao excluir meta" });
    }
  });

  // Audit Logs routes - PROTEGIDO: Apenas admin pode acessar
  app.get("/api/companies/:companyId/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      const { limit } = req.query;
      const logs = await storage.getAuditLogsByCompany(companyId, limit ? parseInt(limit as string) : undefined);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/:entityType/:entityId", requireAdmin, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching entity audit logs:", error);
      res.status(500).json({ error: "Failed to fetch entity audit logs" });
    }
  });

  // Heatmap for cleaning performance by zone
  app.get("/api/companies/:companyId/heatmap/:siteId", async (req, res) => {
    try {
      const { companyId, siteId } = req.params;
      const heatmapData = await storage.getCleaningHeatmapData(companyId, siteId);
      res.json(heatmapData);
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to get heatmap data" });
    }
  });

  // Customers endpoints
  app.get("/api/companies/:companyId/customers", requirePermission('customers_view'), async (req, res) => {
    try {
      const customers = await storage.getCustomersByCompany(req.params.companyId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  app.get("/api/customers/:id", requireCustomerAccessOrPermission, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to get customer" });
    }
  });

  app.post("/api/companies/:companyId/customers", requirePermission('customers_create'), async (req, res) => {
    try {
      // Generate subdomain from customer name if not provided
      let subdomain = req.body.subdomain;
      if (!subdomain && req.body.name) {
        subdomain = req.body.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
          .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        
        // Check if subdomain already exists
        const existing = await db
          .select()
          .from(customers)
          .where(eq(customers.subdomain, subdomain))
          .limit(1);
        
        if (existing.length > 0) {
          // Append random suffix if exists
          subdomain = `${subdomain}-${Math.floor(Math.random() * 1000)}`;
        }
      }
      
      const customer = insertCustomerSchema.parse({
        ...req.body,
        companyId: req.params.companyId,
        subdomain
      });
      const newCustomer = await storage.createCustomer(customer);
      
      // Auto-create 3 default client roles for this specific customer
      try {
        const companyId = newCustomer.companyId;
        const customerId = newCustomer.id;
        const timestamp = Date.now();
        
        // 1. Operador (Mobile-only, 4 permissions)
        const operadorRole = await storage.createCustomRole({
          id: `role-operador-${customerId}-${timestamp}`,
          companyId,
          customerId, // Função específica deste cliente
          name: 'Operador',
          description: 'Operador de campo - executa OS via aplicativo mobile',
          isSystemRole: false,
          isMobileOnly: true,
          isActive: true
        });
        await storage.setRolePermissions(operadorRole.id, [
          'dashboard_view',
          'workorders_view',
          'workorders_comment',
          'checklists_view'
        ]);
        
        // 2. Cliente (Web, 8 permissions)
        const clienteRole = await storage.createCustomRole({
          id: `role-cliente-${customerId}-${timestamp + 1}`,
          companyId,
          customerId, // Função específica deste cliente
          name: 'Cliente',
          description: 'Visualização de dashboards, relatórios, plantas dos locais e ordens de serviço. Pode comentar e avaliar OS.',
          isSystemRole: false,
          isMobileOnly: false,
          isActive: true
        });
        await storage.setRolePermissions(clienteRole.id, [
          'dashboard_view',
          'workorders_view',
          'workorders_comment',
          'workorders_evaluate',
          'floor_plan_view',
          'heatmap_view',
          'sites_view',
          'reports_view'
        ]);
        
        // 3. Administrador (TODAS as permissões - OPUS + CLIENT)
        const adminRole = await storage.createCustomRole({
          id: `role-admin-${customerId}-${timestamp + 2}`,
          companyId,
          customerId, // Função específica deste cliente
          name: 'Administrador',
          description: 'Administrador do cliente - acesso completo às funcionalidades do cliente',
          isSystemRole: false,
          isMobileOnly: false,
          isActive: true
        });
        // Administrador tem TODAS as permissões do sistema
        await storage.setRolePermissions(adminRole.id, Array.from(ALL_PERMISSIONS));
        
        console.log(`✅ Criadas 3 funções específicas para cliente ${newCustomer.name} (Operador: 4 perms, Cliente: 8 perms, Administrador: ${ALL_PERMISSIONS.length} perms)`);
      } catch (roleError) {
        console.error('⚠️ Warning: Failed to create default roles for customer:', roleError);
        // Continue anyway - don't fail customer creation if role creation fails
      }
      
      // Broadcast customer creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'customers',
        data: newCustomer,
        companyId: req.params.companyId
      });
      
      res.status(201).json(newCustomer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      
      // Check for database constraint violations
      if (error instanceof Error) {
        // PostgreSQL error for duplicate subdomain
        if (error.message.includes('duplicate key value violates unique constraint') && 
            error.message.includes('customers_subdomain_unique')) {
          const subdomainMatch = error.message.match(/Key \(subdomain\)=\(([^)]+)\)/);
          const subdomain = subdomainMatch ? subdomainMatch[1] : 'deste cliente';
          return res.status(409).json({ 
            message: `Erro ao criar cliente: o subdomínio "${subdomain}" já existe. Por favor, escolha outro nome para o cliente.`
          });
        }
      }
      
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Erro ao criar cliente. Por favor, tente novamente." });
    }
  });

  app.put("/api/customers/:id", requirePermission('customers_edit'), async (req, res) => {
    try {
      const customer = insertCustomerSchema.partial().parse(req.body);
      const updatedCustomer = await storage.updateCustomer(req.params.id, customer);
      
      // Broadcast customer update to all connected clients
      broadcast({
        type: 'update',
        resource: 'customers',
        data: updatedCustomer,
        id: req.params.id
      });
      
      res.json(updatedCustomer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", requirePermission('customers_delete'), async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      
      // Broadcast customer deletion to all connected clients
      broadcast({
        type: 'delete',
        resource: 'customers',
        id: req.params.id
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Customer branding configuration
  app.put("/api/customers/:id/branding", requirePermission('customers_edit'), async (req, res) => {
    try {
      const { loginLogo, sidebarLogo, sidebarLogoCollapsed, homeLogo, favicon, moduleColors, subdomain } = req.body;
      
      const brandingUpdate: any = {};
      if (loginLogo !== undefined) brandingUpdate.loginLogo = loginLogo;
      if (sidebarLogo !== undefined) brandingUpdate.sidebarLogo = sidebarLogo;
      if (sidebarLogoCollapsed !== undefined) brandingUpdate.sidebarLogoCollapsed = sidebarLogoCollapsed;
      if (homeLogo !== undefined) brandingUpdate.homeLogo = homeLogo;
      if (favicon !== undefined) brandingUpdate.favicon = favicon;
      if (moduleColors !== undefined) brandingUpdate.moduleColors = moduleColors;
      
      // Normalize and validate subdomain if provided
      if (subdomain !== undefined) {
        // Reject empty strings
        if (subdomain === '') {
          return res.status(400).json({ message: 'Subdomínio não pode ser vazio' });
        }
        
        // Normalize subdomain: lowercase, remove accents, replace non-alphanumeric with hyphens
        const normalizedSubdomain = subdomain
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        
        // Validate format
        if (!/^[a-z0-9-]+$/.test(normalizedSubdomain)) {
          return res.status(400).json({ message: 'Subdomínio inválido. Use apenas letras, números e hífens.' });
        }
        
        // Check uniqueness
        const existing = await db
          .select()
          .from(customers)
          .where(and(
            eq(customers.subdomain, normalizedSubdomain),
            ne(customers.id, req.params.id)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          return res.status(400).json({ message: 'Subdomínio já está em uso' });
        }
        
        brandingUpdate.subdomain = normalizedSubdomain;
      }
      
      const updatedCustomer = await storage.updateCustomer(req.params.id, brandingUpdate);
      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer branding:", error);
      res.status(500).json({ message: "Failed to update customer branding" });
    }
  });

  // Upload logo for customer branding
  app.post("/api/customers/:id/upload-logo", requireManageClients, async (req, res) => {
    try {
      const { logoType, imageData, fileName } = req.body;
      
      if (!logoType || !imageData || !fileName) {
        return res.status(400).json({ message: "logoType, imageData, and fileName are required" });
      }
      
      if (!['loginLogo', 'sidebarLogo', 'sidebarLogoCollapsed', 'homeLogo', 'favicon'].includes(logoType)) {
        return res.status(400).json({ message: "Invalid logoType. Must be one of: loginLogo, sidebarLogo, sidebarLogoCollapsed, homeLogo, favicon" });
      }
      
      // Import fs promises
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create customer logos directory if it doesn't exist
      const customerLogosDir = path.join(process.cwd(), 'attached_assets', 'customer_logos');
      await fs.mkdir(customerLogosDir, { recursive: true });
      
      // Generate unique filename
      const ext = path.extname(fileName) || '.png';
      const uniqueFileName = `${req.params.id}_${logoType}_${Date.now()}${ext}`;
      const filePath = path.join(customerLogosDir, uniqueFileName);
      
      // Remove base64 prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      
      // Write file
      await fs.writeFile(filePath, base64Data, 'base64');
      
      // Return relative path for storage
      const relativePath = `/attached_assets/customer_logos/${uniqueFileName}`;
      
      res.json({ 
        success: true, 
        path: relativePath,
        logoType 
      });
    } catch (error) {
      console.error("Error uploading customer logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Public API - Get customer branding by subdomain (no auth required)
  app.get("/api/public/branding/:subdomain", async (req, res) => {
    try {
      const [customer] = await db
        .select({
          name: customers.name,
          subdomain: customers.subdomain,
          loginLogo: customers.loginLogo,
          sidebarLogo: customers.sidebarLogo,
          sidebarLogoCollapsed: customers.sidebarLogoCollapsed,
          homeLogo: customers.homeLogo,
          favicon: customers.favicon,
          moduleColors: customers.moduleColors
        })
        .from(customers)
        .where(eq(customers.subdomain, req.params.subdomain))
        .limit(1);
      
      if (!customer) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json(customer);
    } catch (error) {
      console.error('Error fetching branding:', error);
      res.status(500).json({ message: 'Erro ao buscar configurações' });
    }
  });

  // Public API - Get full customer data by subdomain (no auth required)
  app.get("/api/public/customer-by-subdomain/:subdomain", async (req, res) => {
    try {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.subdomain, req.params.subdomain))
        .limit(1);
      
      if (!customer) {
        return res.status(404).json({ message: 'Cliente não encontrado para este subdomínio' });
      }
      
      // Return complete branding data
      res.json({
        id: customer.id,
        name: customer.name,
        subdomain: customer.subdomain,
        loginLogo: customer.loginLogo,
        sidebarLogo: customer.sidebarLogo,
        sidebarLogoCollapsed: customer.sidebarLogoCollapsed,
        homeLogo: customer.homeLogo,
        favicon: customer.favicon,
        moduleColors: customer.moduleColors,
      });
    } catch (error) {
      console.error('Error fetching customer by subdomain:', error);
      res.status(500).json({ message: 'Erro ao buscar cliente' });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Debug log para diagnosticar problemas de login no APK
      console.log('[LOGIN DEBUG] Origin:', req.get('origin'));
      console.log('[LOGIN DEBUG] User-Agent:', req.get('user-agent'));
      console.log('[LOGIN DEBUG] Body received:', { username: username || '(empty)', hasPassword: !!password });
      
      if (!username || !password) {
        console.log('[LOGIN DEBUG] Missing credentials - username:', !!username, 'password:', !!password);
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Find user by username OR email
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.getUserByEmail(username);
      }
      
      console.log('[LOGIN DEBUG] User found:', !!user, user ? `(id: ${user.id}, authProvider: ${user.authProvider})` : '');
      
      // Always hash even if user not found (prevent timing attacks)
      const dummyHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqR.NvJ8Om';
      const hashToCompare = user?.password || dummyHash;
      const isValidPassword = await bcrypt.compare(password, hashToCompare);
      
      console.log('[LOGIN DEBUG] Password valid:', isValidPassword);
      
      if (!user || !isValidPassword) {
        console.log('[LOGIN DEBUG] FAILED - user found:', !!user, 'password valid:', isValidPassword);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user must use SSO
      if (user.authProvider !== 'local') {
        return res.status(400).json({ message: 'User must sign in with SSO' });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is disabled' });
      }

      // Check if customer is active
      if (user.customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, user.customerId))
          .limit(1);
        
        if (!customer || !customer.isActive) {
          return res.status(403).json({ message: 'Customer account is disabled' });
        }
      }

      // Generate unique session ID for this login
      const sessionId = nanoid();
      
      // Generate secure JWT token with sessionId
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          companyId: user.companyId,
          customerId: user.customerId,
          sessionId: sessionId // Adicionar sessionId para controle de sessão única
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return user data without password
      res.json({
        user: sanitizeUser(user),
        token: token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // In a real application, you might want to invalidate the token here
      // For now, we just return success since logout is handled client-side
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current authenticated user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(404).json({ message: "Not authenticated" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Try JWT first, fallback to old token format for backwards compatibility
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const user = await storage.getUser(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        return res.json({ user: sanitizeUser(user) });
      } catch (jwtError) {
        // Fallback: Parse old token format for backwards compatibility
        const parts = token.split('_');
        if (parts.length >= 2 && parts[0] === 'token') {
          const userId = parts[1];
          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
          return res.json({ user: sanitizeUser(user) });
        }
        return res.status(401).json({ message: "Invalid token" });
      }
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user's customer data (for customer_user to load their own client)
  // This endpoint does NOT require opus permissions - customer can access their own data
  app.get("/api/auth/my-customer", requireAuth, async (req, res) => {
    try {
      if (!req.user?.customerId) {
        return res.status(404).json({ message: "User is not associated with a customer" });
      }
      
      const customer = await storage.getCustomer(req.user.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Get my customer error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get list of customers that the authenticated user is allowed to manage
  // For admin: returns all customers they are linked to via userAllowedCustomers
  // For opus_user non-admin: returns their allowed customers
  // For customer_user admin: returns customers linked via userAllowedCustomers
  // For customer_user non-admin: returns their own customer if set
  app.get("/api/auth/my-customers", requireAuth, async (req, res) => {
    try {
      // Force fresh data - no cache!
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log(`[MY-CUSTOMERS] 📊 Fetching for: ${req.user.id} (${req.user.username}) type: ${req.user.userType} role: ${req.user.role}`);

      // customer_user admin: buscar clientes permitidos via userAllowedCustomers (mesmo que opus_user)
      if (req.user.userType === 'customer_user' && req.user.role === 'admin') {
        const allowed = await storage.getUserAllowedCustomers(req.user.id);
        console.log(`[MY-CUSTOMERS] 📋 customer_user admin found ${allowed.length} links:`, allowed.map(a => a.customerId));
        
        if (allowed.length > 0) {
          const customers = await storage.getCustomersByUser(req.user.id);
          console.log(`[MY-CUSTOMERS] ✅ Returning ${customers.length} managed customers`);
          return res.json(customers);
        }
        
        // Fallback: retornar cliente próprio se não tiver links gerenciados
        if (req.user.customerId) {
          const customer = await storage.getCustomer(req.user.customerId);
          console.log(`[MY-CUSTOMERS] ✅ Fallback: returning own customer`);
          return res.json(customer ? [customer] : []);
        }
        
        return res.json([]);
      }

      // customer_user não-admin: retorna o cliente dele mesmo (customerId)
      if (req.user.userType === 'customer_user' && req.user.customerId) {
        const customer = await storage.getCustomer(req.user.customerId);
        console.log(`[MY-CUSTOMERS] ✅ customer_user returned:`, customer?.name);
        return res.json(customer ? [customer] : []);
      }

      // opus_user admin: retornar TODOS os clientes da empresa
      if (req.user.userType === 'opus_user' && req.user.role === 'admin') {
        const allCustomers = await storage.getCustomersByCompany(req.user.companyId);
        console.log(`[MY-CUSTOMERS] ✅ opus_user admin returning all ${allCustomers.length} company customers`);
        return res.json(allCustomers);
      }

      // opus_user não-admin: buscar clientes permitidos via userAllowedCustomers
      const allowed = await storage.getUserAllowedCustomers(req.user.id);
      console.log(`[MY-CUSTOMERS] 📋 opus_user found ${allowed.length} links:`, allowed.map(a => a.customerId));
      
      if (allowed.length > 0) {
        const customers = await storage.getCustomersByUser(req.user.id);
        console.log(`[MY-CUSTOMERS] ✅ Returning ${customers.length} customers:`, customers.map(c => ({ id: c.id, name: c.name })));
        return res.json(customers);
      }
      
      // Fallback: se opus_user tem customerId definido mas sem links, retornar o cliente dele
      if (req.user.customerId) {
        const customer = await storage.getCustomer(req.user.customerId);
        console.log(`[MY-CUSTOMERS] ✅ Fallback: opus_user with customerId returning:`, customer?.name);
        return res.json(customer ? [customer] : []);
      }
      
      console.log(`[MY-CUSTOMERS] ⚠️ opus_user without allowed customers or customerId`);
      res.json([]);
    } catch (error) {
      console.error("Get my customers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get available modules for the authenticated user
  app.get("/api/auth/available-modules", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = await storage.getUser(decoded.userId);
      } catch (jwtError) {
        // Fallback for old token format
        const parts = token.split('_');
        if (parts.length >= 2 && parts[0] === 'token') {
          const userId = parts[1];
          user = await storage.getUser(userId);
        }
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let availableModules: string[] = [];

      // Separate logic for OPUS users and customer users
      if (user.userType === 'customer_user') {
        // Customer users: get modules from their associated customer
        if (user.customerId) {
          const customer = await storage.getCustomer(user.customerId);
          if (customer) {
            availableModules = customer.modules || [];
          }
        }
      } else {
        // OPUS users: get modules from the user directly
        availableModules = user.modules || [];
      }
      
      res.json({ modules: availableModules });
    } catch (error) {
      console.error("Get available modules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user modules with default module (for mobile module restriction)
  // SECURED: Uses requireAuth middleware to ensure proper authentication
  app.get("/api/auth/user-modules", requireAuth, async (req, res) => {
    try {
      // User is already validated by requireAuth middleware
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      let modules: ('clean' | 'maintenance')[] = [];

      // 🔥 CORRIGIDO: SEMPRE pegar módulos do USUÁRIO, não do cliente
      // Isso garante que as permissões individuais sejam respeitadas
      const fullUser = await storage.getUser(user.id);
      if (fullUser) {
        modules = (fullUser.modules || ['clean']) as ('clean' | 'maintenance')[];
      }
      
      // SEGURANÇA: Garantir que sempre retorne pelo menos 1 módulo
      // Se modules estiver vazio, forçar 'clean' como fallback seguro
      if (modules.length === 0) {
        modules = ['clean'];
      }
      
      // Default to first available module
      const defaultModule = modules[0];
      
      res.json({ 
        modules,
        defaultModule 
      });
    } catch (error) {
      console.error("Get user modules error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === ROLES MANAGEMENT ===
  
  // Endpoint para listar TODAS as permissões disponíveis
  app.get("/api/permissions", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const fullUser = await storage.getUser(req.user.id);
      if (!fullUser) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }

      // opus_user vê TODAS as permissões
      // customer_user vê apenas CLIENT_ALLOWED_PERMISSIONS
      const permissions = fullUser.userType === 'opus_user' 
        ? Array.from(ALL_PERMISSIONS)
        : Array.from(CLIENT_ALLOWED_PERMISSIONS);

      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });
  
  // Listar todas as funções
  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      console.log('[ROLES GET DEBUG] Endpoint chamado, req.user:', req.user?.username || 'undefined');
      
      if (!req.user) {
        console.log('[ROLES GET DEBUG] ❌ req.user é undefined!');
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const isSystemRole = req.query.isSystemRole === 'true';
      console.log('[ROLES GET DEBUG] isSystemRole:', isSystemRole, 'user.role:', req.user.role, 'customerId param:', req.query.customerId);
      const userPermissions = await getUserPermissions(req.user.id);
      
      // Buscar todas as roles
      const allRoles = await storage.getCustomRoles();
      
      // Filtrar por isSystemRole se especificado
      let roles = allRoles;
      if (req.query.isSystemRole === 'false') {
        roles = roles.filter(role => !role.isSystemRole);
      } else if (req.query.isSystemRole === 'true') {
        roles = roles.filter(role => role.isSystemRole === true);
      }
      
      // CRÍTICO: Aplicar isolamento de dados por customerId
      const fullUser = await storage.getUser(req.user.id);
      
      // Caso 1: customer_user SEMPRE vê APENAS as roles do seu cliente (isolamento total)
      if (fullUser?.userType === 'customer_user' && fullUser?.customerId) {
        console.log(`[ROLES FILTER] Customer user ${req.user.username} filtrando por seu customerId: ${fullUser.customerId}`);
        roles = roles.filter(role => role.customerId === fullUser.customerId);
      }
      // Caso 2: Admin OPUS pedindo roles de cliente
      else if (req.user.role === 'admin' && isSystemRole === false) {
        // Se especificar customerId, SEMPRE filtrar por esse cliente (even for admin)
        if (req.query.customerId) {
          console.log(`[ROLES FILTER] Admin ${req.user.username} pedindo roles do cliente: ${req.query.customerId}`);
          roles = roles.filter(role => role.customerId === req.query.customerId);
        } else {
          // Se não especificar customerId, retornar vazio (Admin OPUS deve sempre especificar qual cliente)
          console.log(`[ROLES GET] Admin OPUS ${req.user.username} tentou listar roles SEM especificar customerId - retornando vazio`);
          return res.json([]);
        }
      }
      
      console.log(`[ROLES GET] ✅ User ${req.user.username} (type: ${fullUser?.userType}) listou ${roles.length} ${isSystemRole ? 'roles de sistema' : 'roles de cliente'}`);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Criar nova função
  app.post("/api/roles", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const { permissions, isSystemRole, ...roleData } = req.body;
      
      // Validar se companyId existe (se fornecido)
      if (roleData.companyId) {
        const company = await storage.getCompany(roleData.companyId);
        if (!company) {
          console.error(`[ROLE CREATE ERROR] Company not found: ${roleData.companyId}`);
          return res.status(400).json({ 
            message: "Empresa não encontrada. Por favor, selecione uma empresa válida." 
          });
        }
      }
      
      // Se é role de sistema, não deve ter companyId
      if (isSystemRole && roleData.companyId) {
        delete roleData.companyId;
      }
      
      // Admin OPUS sempre tem acesso total
      if (req.user.role === 'admin') {
        // Adicionar isSystemRole ao roleData
        const roleDataWithSystem = { ...roleData, isSystemRole };
        const role = await storage.createCustomRole(roleDataWithSystem);
        if (permissions?.length) {
          await storage.setRolePermissions(role.id, permissions);
        }
        console.log(`[ROLE CREATED] ✅ Admin OPUS ${req.user.username} criou role: ${role.name} com ${permissions?.length || 0} permissões (isSystemRole: ${isSystemRole})`);
        const fullRole = await storage.getCustomRoleById(role.id);
        
        // Broadcast role creation to all connected clients
        broadcast({
          type: 'create',
          resource: 'roles',
          data: fullRole
        });
        
        return res.status(201).json(fullRole);
      }
      
      // Para não-admin, validar permissão baseado no tipo de role
      const requiredPermission = isSystemRole ? 'system_roles_edit' : 'roles_manage';
      const userPermissions = await getUserPermissions(req.user.id);
      
      if (!userPermissions.includes(requiredPermission)) {
        console.log(`[ROLE CREATE DENIED] User ${req.user.username} sem permissão ${requiredPermission} para criar ${isSystemRole ? 'role de sistema' : 'role de cliente'}`);
        return res.status(403).json({ 
          message: "Você não tem permissão para criar esse tipo de função" 
        });
      }
      
      // FASE 2: Validar permissões por userType
      if (permissions?.length) {
        // Buscar usuário completo para obter userType
        const fullUser = await storage.getUser(req.user.id);
        if (!fullUser) {
          return res.status(401).json({ message: "Usuário não encontrado" });
        }
        
        // Validar se o userType pode criar roles com essas permissões
        const validation = validatePermissionsByUserType(
          fullUser.userType || 'customer_user',
          permissions
        );
        
        if (!validation.valid) {
          console.error(`[ROLE CREATE DENIED] User ${req.user.username} (${fullUser.userType}) tentou criar role com permissões proibidas:`, validation.invalidPermissions);
          return res.status(403).json({ 
            message: "Você não pode criar uma função com essas permissões",
            invalidPermissions: validation.invalidPermissions,
            hint: "Algumas permissões são exclusivas para administradores OPUS"
          });
        }
      }
      
      // Criar a função (incluir isSystemRole)
      const roleDataWithSystem = { ...roleData, isSystemRole };
      const role = await storage.createCustomRole(roleDataWithSystem);
      
      // Adicionar permissões
      if (permissions?.length) {
        await storage.setRolePermissions(role.id, permissions);
      }
      
      console.log(`[ROLE CREATED] ✅ User ${req.user.username} criou role: ${role.name} com ${permissions?.length || 0} permissões (isSystemRole: ${isSystemRole})`);
      
      // Retornar função completa com permissões
      const fullRole = await storage.getCustomRoleById(role.id);
      
      // Broadcast role creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'roles',
        data: fullRole,
        customerId: fullRole?.customerId ?? undefined
      });
      
      res.status(201).json(fullRole);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  // Atualizar função
  app.patch("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const { permissions, ...roleData } = req.body;
      
      // Buscar role existente para verificar se é de sistema
      const existingRole = await storage.getCustomRoleById(req.params.id);
      if (!existingRole) {
        return res.status(404).json({ message: "Função não encontrada" });
      }
      
      // Admin OPUS sempre tem acesso total
      if (req.user.role === 'admin') {
        await storage.updateCustomRole(req.params.id, roleData);
        if (permissions) {
          await storage.setRolePermissions(req.params.id, permissions);
        }
        console.log(`[ROLE UPDATED] ✅ Admin OPUS ${req.user.username} editou role: ${existingRole.name}`);
        const updatedRole = await storage.getCustomRoleById(req.params.id);
        return res.json(updatedRole);
      }
      
      // Para não-admin, validar permissão baseado no tipo de role
      const requiredPermission = existingRole.isSystemRole ? 'system_roles_edit' : 'roles_manage';
      const userPermissions = await getUserPermissions(req.user.id);
      
      if (!userPermissions.includes(requiredPermission)) {
        console.log(`[ROLE UPDATE DENIED] User ${req.user.username} sem permissão ${requiredPermission} para editar ${existingRole.isSystemRole ? 'role de sistema' : 'role de cliente'}`);
        return res.status(403).json({ 
          message: "Você não tem permissão para editar esse tipo de função" 
        });
      }
      
      // FASE 2: Validar permissões por userType
      if (permissions) {
        // Buscar usuário completo para obter userType
        const fullUser = await storage.getUser(req.user.id);
        if (!fullUser) {
          return res.status(401).json({ message: "Usuário não encontrado" });
        }
        
        // Validar se o userType pode editar roles com essas permissões
        const validation = validatePermissionsByUserType(
          fullUser.userType || 'customer_user',
          permissions
        );
        
        if (!validation.valid) {
          console.error(`[ROLE UPDATE DENIED] User ${req.user.username} (${fullUser.userType}) tentou editar role com permissões proibidas:`, validation.invalidPermissions);
          return res.status(403).json({ 
            message: "Você não pode editar uma função com essas permissões",
            invalidPermissions: validation.invalidPermissions,
            hint: "Algumas permissões são exclusivas para administradores OPUS"
          });
        }
      }
      
      // Atualizar dados da função
      const role = await storage.updateCustomRole(req.params.id, roleData);
      
      // Atualizar permissões se fornecidas
      if (permissions) {
        await storage.setRolePermissions(req.params.id, permissions);
      }
      
      console.log(`[ROLE UPDATED] ✅ User ${req.user.username} atualizou role: ${req.params.id}`);
      
      // Retornar função completa atualizada
      const fullRole = await storage.getCustomRoleById(req.params.id);
      
      // Broadcast role update to all connected clients
      broadcast({
        type: 'update',
        resource: 'roles',
        data: fullRole,
        id: req.params.id,
        customerId: fullRole?.customerId ?? undefined
      });
      
      res.json(fullRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Excluir função
  app.delete("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      // Buscar role existente para verificar se é de sistema
      const existingRole = await storage.getCustomRoleById(req.params.id);
      if (!existingRole) {
        return res.status(404).json({ message: "Função não encontrada" });
      }
      
      // Admin OPUS sempre tem acesso total
      if (req.user.role === 'admin') {
        await storage.deleteCustomRole(req.params.id);
        console.log(`[ROLE DELETED] ✅ Admin OPUS ${req.user.username} deletou ${existingRole.isSystemRole ? 'role de sistema' : 'role de cliente'}: ${existingRole.name}`);
        
        // Broadcast role deletion to all connected clients
        broadcast({
          type: 'delete',
          resource: 'roles',
          data: { id: req.params.id },
          customerId: existingRole.customerId ?? undefined
        });
        
        return res.status(204).end();
      }
      
      // Para não-admin, validar permissão baseado no tipo de role
      const requiredPermission = existingRole.isSystemRole ? 'system_roles_delete' : 'roles_manage';
      const userPermissions = await getUserPermissions(req.user.id);
      
      if (!userPermissions.includes(requiredPermission)) {
        console.log(`[ROLE DELETE DENIED] User ${req.user.username} sem permissão ${requiredPermission} para deletar ${existingRole.isSystemRole ? 'role de sistema' : 'role de cliente'}`);
        return res.status(403).json({ 
          message: "Você não tem permissão para deletar esse tipo de função" 
        });
      }
      
      await storage.deleteCustomRole(req.params.id);
      console.log(`[ROLE DELETED] ✅ User ${req.user.username} deletou ${existingRole.isSystemRole ? 'role de sistema' : 'role de cliente'}: ${existingRole.name}`);
      
      // Broadcast role deletion to all connected clients
      broadcast({
        type: 'delete',
        resource: 'roles',
        data: { id: req.params.id },
        customerId: existingRole.customerId ?? undefined
      });
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Inicializar roles de sistema padrão (apenas OPUS)
  app.post("/api/roles/init-system-roles", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      // Apenas opus_user pode inicializar roles de sistema
      const fullUser = await storage.getUser(req.user.id);
      if (!fullUser || fullUser.userType !== 'opus_user') {
        return res.status(403).json({ 
          message: "Apenas administradores OPUS podem inicializar roles de sistema" 
        });
      }
      
      // Verificar se usuário tem permissão system_roles_edit
      const userPermissions = await getUserPermissions(req.user.id);
      if (!userPermissions.includes('system_roles_edit')) {
        return res.status(403).json({ 
          message: "Você não tem permissão para criar roles de sistema" 
        });
      }
      
      // Definir roles de sistema padrão
      const systemRoles = [
        {
          name: 'Administrador',
          description: 'Gerenciamento de usuários e clientes OPUS',
          isSystemRole: true,
          permissions: [
            'dashboard_view',
            'opus_users_view',
            'opus_users_create',
            'opus_users_edit',
            'opus_users_delete',
            'customers_view',
            'customers_create',
            'customers_edit',
            'customers_delete',
            'reports_view',
            'audit_logs_view'
          ]
        },
        {
          name: 'Auditor',
          description: 'Auditoria e relatórios (apenas visualização)',
          isSystemRole: true,
          permissions: [
            'dashboard_view',
            'reports_view',
            'work_orders_view',
            'activities_view',
            'users_view',
            'roles_view'
          ]
        },
        {
          name: 'Operador',
          description: 'Execução de ordens de serviço',
          isSystemRole: true,
          permissions: [
            'dashboard_view',
            'work_orders_view',
            'work_orders_edit',
            'activities_view'
          ]
        },
        {
          name: 'Supervisor Site',
          description: 'Supervisão e gerenciamento de atividades',
          isSystemRole: true,
          permissions: [
            'dashboard_view',
            'reports_view',
            'work_orders_view',
            'work_orders_edit',
            'work_orders_create',
            'activities_view',
            'activities_edit',
            'activities_create',
            'users_view'
          ]
        }
      ];
      
      const created = [];
      const skipped = [];
      
      // Buscar todas as roles existentes
      const existingRoles = await storage.getCustomRoles();
      
      for (const roleData of systemRoles) {
        // Verificar se já existe uma role de sistema com este nome
        const exists = existingRoles.find(
          r => r.isSystemRole && r.name === roleData.name
        );
        
        if (exists) {
          skipped.push(roleData.name);
          continue;
        }
        
        // Criar a role
        const { permissions, ...roleInfo } = roleData;
        const roleWithIds = {
          ...roleInfo,
          id: crypto.randomUUID(),
          companyId: 'a3e33b82-4f75-4f8d-86a2-2d67e61a9812' // OPUS company ID
        };
        const role = await storage.createCustomRole(roleWithIds);
        
        // Adicionar permissões
        if (permissions?.length) {
          await storage.setRolePermissions(role.id, permissions);
        }
        
        created.push(roleData.name);
        console.log(`[SYSTEM ROLE CREATED] ✅ Role de sistema criada: ${roleData.name} com ${permissions.length} permissões`);
      }
      
      res.json({
        message: "Inicialização de roles de sistema concluída",
        created,
        skipped,
        total: systemRoles.length
      });
    } catch (error) {
      console.error("Error initializing system roles:", error);
      res.status(500).json({ message: "Failed to initialize system roles" });
    }
  });

  // Buscar roles de um usuário específico
  app.get("/api/users/:userId/roles", async (req, res) => {
    try {
      const roles = await storage.getUserRoleAssignments(req.params.userId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // Atribuir role a um usuário (novo endpoint mais intuitivo)
  app.post("/api/users/:userId/roles", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const { roleId, customerId } = req.body;
      const targetUserId = req.params.userId;
      
      // FASE 2: Validar se as permissões do role são compatíveis com o userType do usuário alvo
      
      // 1. Buscar o usuário alvo
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // 2. Buscar o role e suas permissões
      const role = await storage.getCustomRoleById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Função não encontrada" });
      }
      
      const rolePermissions = await storage.getRolePermissions(roleId);
      const permissions = rolePermissions.map((rp: any) => rp.permission);
      
      // 3. Validar compatibilidade userType x permissões
      const validation = validatePermissionsByUserType(
        targetUser.userType || 'customer_user',
        permissions
      );
      
      if (!validation.valid) {
        console.error(`[ROLE ASSIGNMENT DENIED] User ${req.user.username} tentou atribuir role "${role.name}" com permissões incompatíveis para usuário ${targetUser.username} (${targetUser.userType})`);
        console.error(`Permissões inválidas:`, validation.invalidPermissions);
        return res.status(403).json({ 
          message: `Esta função não pode ser atribuída a um usuário do tipo ${targetUser.userType === 'opus_user' ? 'OPUS' : 'Cliente'}`,
          invalidPermissions: validation.invalidPermissions,
          hint: targetUser.userType === 'customer_user' 
            ? "Usuários de cliente não podem ter permissões OPUS (gerenciar clientes, usuários OPUS, etc)"
            : "Permissões não compatíveis com o tipo de usuário"
        });
      }
      
      // 4. Criar atribuição
      const assignmentData = {
        id: `ura-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: targetUserId,
        roleId,
        customerId: customerId || null,
      };
      
      const assignment = await storage.createUserRoleAssignment(assignmentData);
      console.log(`[ROLE ASSIGNED] ✅ User ${req.user.username} atribuiu role "${role.name}" para ${targetUser.username}`);
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating user role assignment:", error);
      res.status(500).json({ message: "Failed to create user role assignment" });
    }
  });

  // Atribuir role a um usuário (endpoint antigo mantido para compatibilidade)
  app.post("/api/user-role-assignments", requirePermission('users_edit'), async (req, res) => {
    try {
      const assignmentData = insertUserRoleAssignmentSchema.parse(req.body);
      const assignment = await storage.createUserRoleAssignment(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating user role assignment:", error);
      res.status(500).json({ message: "Failed to create user role assignment" });
    }
  });

  // Remover role de um usuário
  app.delete("/api/users/:userId/roles/:roleId", requirePermission('users_edit'), async (req, res) => {
    try {
      await storage.deleteUserRoleAssignment(req.params.userId, req.params.roleId);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting user role assignment:", error);
      res.status(500).json({ message: "Failed to delete user role assignment" });
    }
  });

  // === CLEANING ACTIVITIES MANAGEMENT ===
  
  // Get cleaning activities by company
  app.get("/api/companies/:companyId/cleaning-activities", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const activities = await storage.getCleaningActivitiesByCompany(req.params.companyId, module);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching cleaning activities:", error);
      res.status(500).json({ message: "Failed to get cleaning activities" });
    }
  });

  // Get single cleaning activity
  app.get("/api/cleaning-activities/:id", async (req, res) => {
    try {
      const activity = await storage.getCleaningActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ message: "Cleaning activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error fetching cleaning activity:", error);
      res.status(500).json({ message: "Failed to get cleaning activity" });
    }
  });

  // Create cleaning activity (SECURE - requires customerId in URL)
  app.post("/api/customers/:customerId/cleaning-activities", requirePermission('schedule_create'), async (req, res) => {
    try {
      // Validate customer exists
      const customerSites = await storage.getSitesByCustomer(req.params.customerId);
      if (customerSites.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const companyId = customerSites[0].companyId;

      // Limpar campos que podem ter valores inválidos
      const cleanedData = { 
        ...req.body,
        customerId: req.params.customerId, // FORCE customerId from URL
        companyId, // Ensure companyId is set
        module: req.body.module || 'clean'
      };
      
      if (cleanedData.checklistTemplateId === "none" || cleanedData.checklistTemplateId === "") {
        cleanedData.checklistTemplateId = null;
      }
      
      // Converter strings vazias em null para campos de hora
      if (cleanedData.startTime === "") {
        cleanedData.startTime = null;
      }
      if (cleanedData.endTime === "") {
        cleanedData.endTime = null;
      }
      
      // Validar dados (schema omite o ID)
      const activityData = insertCleaningActivitySchema.parse(cleanedData);
      
      // Gerar ID único após validação
      const activityWithId = {
        ...activityData,
        id: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      const activity = await storage.createCleaningActivity(activityWithId as any);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating cleaning activity:", error);
      res.status(500).json({ message: "Failed to create cleaning activity" });
    }
  });

  // Update cleaning activity
  app.put("/api/cleaning-activities/:id", async (req, res) => {
    try {
      const activityData = insertCleaningActivitySchema.partial().parse(req.body);
      const activity = await storage.updateCleaningActivity(req.params.id, activityData);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating cleaning activity:", error);
      res.status(500).json({ message: "Failed to update cleaning activity" });
    }
  });

  // Update cleaning activity (PATCH with customer context)
  app.patch("/api/customers/:customerId/cleaning-activities/:id", async (req, res) => {
    try {
      const activityData = insertCleaningActivitySchema.partial().parse(req.body);
      const activity = await storage.updateCleaningActivity(req.params.id, activityData);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating cleaning activity:", error);
      res.status(500).json({ message: "Failed to update cleaning activity" });
    }
  });

  // Delete cleaning activity
  app.delete("/api/cleaning-activities/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteCleaningActivity(req.params.id);
      res.json({ message: "Cleaning activity deleted successfully" });
    } catch (error) {
      console.error("Error deleting cleaning activity:", error);
      res.status(500).json({ message: "Failed to delete cleaning activity" });
    }
  });

  // === MAINTENANCE ACTIVITIES MANAGEMENT ===
  
  // Get maintenance activities by customer
  app.get("/api/customers/:customerId/maintenance-activities", async (req, res) => {
    try {
      const activities = await storage.getMaintenanceActivitiesByCustomer(req.params.customerId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching maintenance activities:", error);
      res.status(500).json({ message: "Failed to get maintenance activities" });
    }
  });

  // Get maintenance activities by company
  app.get("/api/companies/:companyId/maintenance-activities", async (req, res) => {
    try {
      const activities = await storage.getMaintenanceActivitiesByCompany(req.params.companyId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching maintenance activities:", error);
      res.status(500).json({ message: "Failed to get maintenance activities" });
    }
  });

  // Get single maintenance activity
  app.get("/api/maintenance-activities/:id", async (req, res) => {
    try {
      const activity = await storage.getMaintenanceActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ message: "Maintenance activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error fetching maintenance activity:", error);
      res.status(500).json({ message: "Failed to get maintenance activity" });
    }
  });

  // Create maintenance activity
  app.post("/api/maintenance-activities", requirePermission('schedule_create'), async (req, res) => {
    try {
      console.log("[DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      
      const cleanedData = { 
        ...req.body,
        module: 'maintenance',
        customerId: req.body.activeClientId || req.body.customerId // Map activeClientId to customerId
      };
      
      // Remove activeClientId if present (not part of schema)
      delete cleanedData.activeClientId;
      
      if (cleanedData.checklistTemplateId === "none" || cleanedData.checklistTemplateId === "") {
        cleanedData.checklistTemplateId = null;
      }
      
      if (cleanedData.assignedUserId === "none" || cleanedData.assignedUserId === "") {
        cleanedData.assignedUserId = null;
      }
      
      if (cleanedData.slaConfigId === "none" || cleanedData.slaConfigId === "") {
        cleanedData.slaConfigId = null;
      }
      
      if (cleanedData.startTime === "") {
        cleanedData.startTime = null;
      }
      if (cleanedData.endTime === "") {
        cleanedData.endTime = null;
      }
      
      console.log("[DEBUG] Cleaned data:", JSON.stringify(cleanedData, null, 2));
      
      const activityData = insertMaintenanceActivitySchema.parse(cleanedData);
      
      const activityWithId = {
        ...activityData,
        id: `ma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      const activity = await storage.createMaintenanceActivity(activityWithId as any);
      
      // Generate work orders from start date until end of the startDate's month
      // ONLY for this specific activity (not all activities in the company)
      if (activity.isActive && activity.equipmentIds && activity.equipmentIds.length > 0 && activity.startDate) {
        const startDate = new Date(activity.startDate + 'T00:00:00');
        // Calculate end of the month based on startDate, not server's current date
        const endOfStartMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        try {
          await storage.generateMaintenanceWorkOrders(
            activity.companyId,
            startDate,
            endOfStartMonth,
            activity.id // Only generate for this specific activity
          );
          console.log(`[PLAN CREATED] Generated work orders from ${startDate.toISOString()} to ${endOfStartMonth.toISOString()} for activity ${activity.id}`);
        } catch (error) {
          console.error(`[PLAN CREATED] Failed to generate work orders:`, error);
          // Don't fail the request if work order generation fails
        }
      }
      
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[DEBUG] Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating maintenance activity:", error);
      res.status(500).json({ message: "Failed to create maintenance activity" });
    }
  });

  // Update maintenance activity
  app.put("/api/maintenance-activities/:id", async (req, res) => {
    try {
      const activityData = insertMaintenanceActivitySchema.partial().parse(req.body);
      const activity = await storage.updateMaintenanceActivity(req.params.id, activityData);
      
      // Se a atividade foi ativada ou atualizada com equipamentos, gerar O.S. para o mês do startDate
      // ONLY for this specific activity (not all activities in the company)
      if (activity && activity.isActive && activity.equipmentIds && activity.equipmentIds.length > 0 && activity.startDate) {
        const startDate = new Date(activity.startDate + 'T00:00:00');
        // Calculate end of the month based on startDate
        const endOfStartMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        try {
          await storage.generateMaintenanceWorkOrders(
            activity.companyId,
            startDate,
            endOfStartMonth,
            activity.id // Only generate for this specific activity
          );
          console.log(`[PLAN UPDATED] Generated work orders for activity ${activity.id}`);
        } catch (error) {
          console.error(`[PLAN UPDATED] Failed to generate work orders:`, error);
        }
      }
      
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance activity:", error);
      res.status(500).json({ message: "Failed to update maintenance activity" });
    }
  });

  // Delete maintenance activity
  app.delete("/api/maintenance-activities/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenanceActivity(req.params.id);
      res.json({ message: "Maintenance activity deleted successfully" });
    } catch (error) {
      console.error("Error deleting maintenance activity:", error);
      res.status(500).json({ message: "Failed to delete maintenance activity" });
    }
  });

  // === SCHEDULER MANAGEMENT ===
  
  // Generate scheduled work orders from cleaning activities
  app.post("/api/scheduler/generate-work-orders", requirePermission('schedule_create'), async (req, res) => {
    try {
      const { companyId, windowStart, windowEnd } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      // Validar que windowStart e windowEnd foram fornecidos
      if (!windowStart || !windowEnd) {
        return res.status(400).json({ 
          message: "windowStart and windowEnd are required to prevent retroactive work order generation" 
        });
      }
      
      const startDate = new Date(windowStart);
      const endDate = new Date(windowEnd);
      
      // Validar que as datas são válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format for windowStart or windowEnd" });
      }
      
      // Validar que windowEnd >= windowStart
      if (endDate < startDate) {
        return res.status(400).json({ message: "windowEnd must be greater than or equal to windowStart" });
      }
      
      console.log(`[SCHEDULER] Gerando OS para período: ${startDate.toISOString()} até ${endDate.toISOString()}`);
      
      const generatedOrders = await storage.generateScheduledWorkOrders(companyId, startDate, endDate);
      
      console.log(`[SCHEDULER] ✅ ${generatedOrders.length} OS geradas com sucesso`);
      
      res.json({
        message: `Generated ${generatedOrders.length} scheduled work orders`,
        generatedOrders: generatedOrders.length,
        workOrders: generatedOrders,
        period: {
          start: startDate,
          end: endDate
        }
      });
    } catch (error) {
      console.error("Error generating scheduled work orders:", error);
      res.status(500).json({ message: "Failed to generate scheduled work orders" });
    }
  });

  // Generate scheduled work orders from maintenance activities
  app.post("/api/scheduler/generate-maintenance-work-orders", requirePermission('schedule_create'), async (req, res) => {
    try {
      const { companyId, windowStart, windowEnd } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      // Default window: MÊS ATUAL (sistema regenera automaticamente no final de cada mês)
      const now = new Date();
      const startDate = windowStart ? new Date(windowStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      // Gerar OSs apenas até o final do mês atual
      const endDate = windowEnd ? new Date(windowEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      console.log(`[SCHEDULER MAINTENANCE] Gerando OSs de manutenção para período: ${startDate.toISOString()} até ${endDate.toISOString()}`);
      
      const generatedOrders = await storage.generateMaintenanceWorkOrders(companyId, startDate, endDate);
      
      console.log(`[SCHEDULER MAINTENANCE] ✅ ${generatedOrders.length} OSs de manutenção geradas com sucesso`);
      
      res.json({
        message: `Generated ${generatedOrders.length} maintenance work orders`,
        generatedOrders: generatedOrders.length,
        workOrders: generatedOrders,
        period: {
          start: startDate,
          end: endDate
        }
      });
    } catch (error) {
      console.error("Error generating maintenance work orders:", error);
      res.status(500).json({ message: "Failed to generate maintenance work orders" });
    }
  });

  // Monthly regeneration of ALL work orders (cleaning + maintenance) - called automatically on last day of month
  // This generates work orders for the NEXT month (runs on last day of current month)
  app.post("/api/scheduler/regenerate-monthly-maintenance", requirePermission('schedule_create'), async (req, res) => {
    try {
      console.log(`[MONTHLY SCHEDULER] Iniciando regeneração mensal automática de OSs (LIMPEZA + MANUTENÇÃO) para PRÓXIMO MÊS`);
      
      // Get all companies
      const allCompanies = await storage.getCompanies();
      
      let totalCleaningGenerated = 0;
      let totalMaintenanceGenerated = 0;
      
      for (const company of allCompanies) {
        try {
          // Calculate NEXT month window (scheduler runs on last day of current month)
          const now = new Date();
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const startDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
          const endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 23, 59, 59);
          
          console.log(`[MONTHLY SCHEDULER] Gerando OSs para ${company.name} - período: ${startDate.toISOString()} até ${endDate.toISOString()}`);
          
          // Generate CLEANING work orders
          const cleaningOrders = await storage.generateScheduledWorkOrders(company.id, startDate, endDate);
          totalCleaningGenerated += cleaningOrders.length;
          console.log(`[MONTHLY SCHEDULER] ✅ ${cleaningOrders.length} OSs de limpeza geradas para ${company.name}`);
          
          // Generate MAINTENANCE work orders
          const maintenanceOrders = await storage.generateMaintenanceWorkOrders(company.id, startDate, endDate);
          totalMaintenanceGenerated += maintenanceOrders.length;
          console.log(`[MONTHLY SCHEDULER] ✅ ${maintenanceOrders.length} OSs de manutenção geradas para ${company.name}`);
          
        } catch (companyError) {
          console.error(`[MONTHLY SCHEDULER] Erro ao gerar OSs para ${company.name}:`, companyError);
        }
      }
      
      const totalGenerated = totalCleaningGenerated + totalMaintenanceGenerated;
      console.log(`[MONTHLY SCHEDULER] ✅ Total: ${totalCleaningGenerated} OSs de limpeza + ${totalMaintenanceGenerated} OSs de manutenção = ${totalGenerated} OSs geradas para próximo mês`);
      
      res.json({
        message: `Monthly regeneration completed`,
        totalGenerated,
        cleaningGenerated: totalCleaningGenerated,
        maintenanceGenerated: totalMaintenanceGenerated,
        companiesProcessed: allCompanies.length
      });
    } catch (error) {
      console.error("Error in monthly regeneration:", error);
      res.status(500).json({ message: "Failed to regenerate monthly work orders" });
    }
  });

  // === SYSTEM USERS MANAGEMENT ===
  
  // Listar usuários do sistema OPUS (type: opus_user)
  app.get("/api/system-users", requirePermission('opus_users_view'), async (req, res) => {
    try {
      const users = await storage.getOpusUsers();
      
      // Para cada usuário, buscar seus roles customizados, clientes permitidos e remover senha
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const roleAssignments = await storage.getUserRoleAssignments(user.id);
          const allowedCustomers = await storage.getCustomersByUser(user.id);
          const sanitized = sanitizeUser(user);
          return {
            ...sanitized,
            customRoles: roleAssignments,
            allowedCustomers: allowedCustomers
          };
        })
      );
      
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching system users:", error);
      res.status(500).json({ message: "Failed to fetch system users" });
    }
  });

  // Criar novo usuário do sistema OPUS
  app.post("/api/system-users", requirePermission('opus_users_create'), async (req, res) => {
    try {
      const { customRoleId, ...userData } = req.body;
      
      // Validar que customRoleId é obrigatório
      if (!customRoleId) {
        return res.status(400).json({ 
          message: "Função é obrigatória. Todo usuário do sistema deve ter uma função atribuída." 
        });
      }
      
      // Hash password if provided
      let hashedPassword = userData.password;
      if (userData.password && (!userData.authProvider || userData.authProvider === 'local')) {
        hashedPassword = await bcrypt.hash(userData.password, 12);
      }
      
      // Gerar ID único para o usuário
      const userId = `user-${nanoid()}`;
      
      const userDataToInsert = {
        id: userId,
        username: userData.username,
        email: userData.email,
        password: hashedPassword || '',
        name: userData.name,
        role: 'admin' as const, // Default role para sistema
        userType: 'opus_user' as const,
        companyId: 'a3e33b82-4f75-4f8d-86a2-2d67e61a9812', // OPUS Sistemas company ID
        customerId: null,
        authProvider: userData.authProvider || 'local',
        msTenantId: userData.msTenantId || null,
        modules: userData.modules || ['clean'],
        isActive: userData.isActive ?? true,
      };
      
      const user = await storage.createUser(userDataToInsert);
      
      // Atribuir custom role ao usuário (OBRIGATÓRIO)
      await storage.createUserRoleAssignment({
        id: `assignment-${nanoid()}`,
        userId,
        roleId: customRoleId,
        customerId: null,
      });
      
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating system user:", error);
      
      // Check for duplicate username
      if (error?.code === '23505' && error?.constraint === 'users_username_unique') {
        return res.status(400).json({ 
          message: `Username já está em uso. Por favor, escolha outro username.` 
        });
      }
      
      res.status(500).json({ message: "Failed to create system user" });
    }
  });

  // Atualizar usuário do sistema
  app.patch("/api/system-users/:id", requirePermission('opus_users_edit'), async (req, res) => {
    try {
      const { customRoleId, ...userData } = req.body;
      const user = await storage.updateUser(req.params.id, userData);
      
      // Validar que customRoleId é obrigatório quando fornecido ou já atribuído
      if (customRoleId) {
        // Remover atribuições antigas
        const oldAssignments = await storage.getUserRoleAssignments(req.params.id);
        for (const assignment of oldAssignments) {
          await storage.deleteUserRoleAssignment(req.params.id, assignment.roleId);
        }
        // Atribuir nova role
        await storage.createUserRoleAssignment({
          id: `assignment-${nanoid()}`,
          userId: req.params.id,
          roleId: customRoleId,
          customerId: null,
        });
      } else {
        // Se customRoleId não foi fornecido, verificar se usuário já tem uma função
        const currentAssignments = await storage.getUserRoleAssignments(req.params.id);
        if (currentAssignments.length === 0) {
          return res.status(400).json({ 
            message: "Função é obrigatória. Todo usuário do sistema deve ter uma função atribuída." 
          });
        }
      }
      
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error updating system user:", error);
      res.status(500).json({ message: "Failed to update system user" });
    }
  });

  // Alterar status (ativo/inativo) de usuário do sistema
  app.patch("/api/system-users/:id/status", requirePermission('opus_users_edit'), async (req, res) => {
    try {
      const { isActive } = req.body;
      const user = await storage.updateUser(req.params.id, { isActive });
      res.json(user);
    } catch (error) {
      console.error("Error updating system user status:", error);
      res.status(500).json({ message: "Failed to update system user status" });
    }
  });

  // === USER ALLOWED CUSTOMERS ===

  // Buscar clientes permitidos para um usuário
  app.get("/api/system-users/:userId/allowed-customers", requirePermission('opus_users_view'), async (req, res) => {
    try {
      const customers = await storage.getCustomersByUser(req.params.userId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching user allowed customers:", error);
      res.status(500).json({ message: "Failed to fetch allowed customers" });
    }
  });

  // Definir clientes permitidos para um usuário (substitui lista completa)
  app.put("/api/system-users/:userId/allowed-customers", requirePermission('opus_users_edit'), async (req, res) => {
    try {
      const { customerIds } = req.body;
      
      if (!Array.isArray(customerIds)) {
        return res.status(400).json({ message: "customerIds must be an array" });
      }

      await storage.setUserAllowedCustomers(req.params.userId, customerIds);
      
      // Retornar lista atualizada de clientes
      const customers = await storage.getCustomersByUser(req.params.userId);
      res.json(customers);
    } catch (error) {
      console.error("Error updating user allowed customers:", error);
      res.status(500).json({ message: "Failed to update allowed customers" });
    }
  });

  // === USER SITE ASSIGNMENTS ===
  
  // Get sites assigned to a user
  app.get("/api/users/:userId/site-assignments", async (req, res) => {
    try {
      const assignments = await storage.getUserSiteAssignments(req.params.userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user site assignments:", error);
      res.status(500).json({ message: "Failed to fetch user site assignments" });
    }
  });

  // Get users assigned to a site
  app.get("/api/sites/:siteId/users", async (req, res) => {
    try {
      const users = await storage.getUsersBySite(req.params.siteId);
      res.json(sanitizeUsers(users));
    } catch (error) {
      console.error("Error fetching site users:", error);
      res.status(500).json({ message: "Failed to fetch site users" });
    }
  });

  // Assign user to site
  app.post("/api/user-site-assignments", requirePermission('users_edit'), async (req, res) => {
    try {
      const assignment = insertUserSiteAssignmentSchema.parse(req.body);
      const newAssignment = await storage.createUserSiteAssignment(assignment);
      res.status(201).json(newAssignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating user site assignment:", error);
      res.status(500).json({ message: "Failed to create user site assignment" });
    }
  });

  // Remove user from site
  app.delete("/api/users/:userId/sites/:siteId", requirePermission('users_edit'), async (req, res) => {
    try {
      await storage.deleteUserSiteAssignment(req.params.userId, req.params.siteId);
      res.json({ message: "User site assignment removed successfully" });
    } catch (error) {
      console.error("Error removing user site assignment:", error);
      res.status(500).json({ message: "Failed to remove user site assignment" });
    }
  });

  // === PUBLIC REQUEST LOGS (Spam Control) ===
  
  // Check recent public requests for spam control
  app.get("/api/public-requests/check/:ipHash/:qrCodePointId", async (req, res) => {
    try {
      const { ipHash, qrCodePointId } = req.params;
      const hoursWindow = parseInt(req.query.hours as string) || 24;
      const count = await storage.checkRecentPublicRequests(ipHash, qrCodePointId, hoursWindow);
      res.json({ count, allowed: count < 5 }); // Max 5 requests per 24h
    } catch (error) {
      console.error("Error checking public requests:", error);
      res.status(500).json({ message: "Failed to check public requests" });
    }
  });

  // === SITE SHIFTS ===
  
  // Get shifts for a site
  app.get("/api/sites/:siteId/shifts", async (req, res) => {
    try {
      const shifts = await storage.getSiteShifts(req.params.siteId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching site shifts:", error);
      res.status(500).json({ message: "Failed to fetch site shifts" });
    }
  });

  // Create new shift
  app.post("/api/site-shifts", requirePermission('schedule_create'), async (req, res) => {
    try {
      const shift = insertSiteShiftSchema.parse(req.body);
      const newShift = await storage.createSiteShift(shift);
      res.status(201).json(newShift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating site shift:", error);
      res.status(500).json({ message: "Failed to create site shift" });
    }
  });

  // Update shift
  app.put("/api/site-shifts/:id", async (req, res) => {
    try {
      const shift = insertSiteShiftSchema.parse(req.body);
      const updatedShift = await storage.updateSiteShift(req.params.id, shift);
      res.json(updatedShift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating site shift:", error);
      res.status(500).json({ message: "Failed to update site shift" });
    }
  });

  // Delete shift
  app.delete("/api/site-shifts/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteSiteShift(req.params.id);
      res.json({ message: "Site shift deleted successfully" });
    } catch (error) {
      console.error("Error deleting site shift:", error);
      res.status(500).json({ message: "Failed to delete site shift" });
    }
  });

  // === BATHROOM COUNTER LOGS ===
  
  // Get bathroom counter audit logs for a zone
  app.get("/api/zones/:zoneId/bathroom-counter-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getBathroomCounterLogs(req.params.zoneId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching bathroom counter logs:", error);
      res.status(500).json({ message: "Failed to fetch bathroom counter logs" });
    }
  });

  // === COMPANY COUNTERS ===
  
  // Get counter for a company and key
  app.get("/api/companies/:companyId/counters/:key", async (req, res) => {
    try {
      const counter = await storage.getCompanyCounter(req.params.companyId, req.params.key);
      if (!counter) {
        return res.status(404).json({ message: "Counter not found" });
      }
      res.json(counter);
    } catch (error) {
      console.error("Error fetching company counter:", error);
      res.status(500).json({ message: "Failed to fetch company counter" });
    }
  });

  // Create counter
  app.post("/api/company-counters", requirePermission('dashboard_view'), async (req, res) => {
    try {
      const counter = insertCompanyCounterSchema.parse(req.body);
      const newCounter = await storage.createCompanyCounter(counter);
      res.status(201).json(newCounter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating company counter:", error);
      res.status(500).json({ message: "Failed to create company counter" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Equipment Categories (Types) Routes
  // ============================================================================

  // Get equipment categories by company
  app.get("/api/companies/:companyId/equipment-categories", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const categories = await storage.getEquipmentTypesByCompany(req.params.companyId, module);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching equipment categories:", error);
      res.status(500).json({ message: "Failed to fetch equipment categories" });
    }
  });

  // Get single equipment category
  app.get("/api/equipment-categories/:id", async (req, res) => {
    try {
      const category = await storage.getEquipmentType(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Equipment category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching equipment category:", error);
      res.status(500).json({ message: "Failed to fetch equipment category" });
    }
  });

  // Create equipment category
  app.post("/api/equipment-categories", requirePermission('schedule_create'), async (req, res) => {
    try {
      const { companyId, name, description, module, isActive } = req.body;
      
      if (!companyId || !name) {
        return res.status(400).json({ message: "companyId and name are required" });
      }

      const newCategory = await storage.createEquipmentType({
        companyId,
        name,
        description: description || null,
        module: module || 'maintenance',
        isActive: isActive !== false,
      });
      
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating equipment category:", error);
      res.status(500).json({ message: "Failed to create equipment category" });
    }
  });

  // Update equipment category
  app.put("/api/equipment-categories/:id", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const { name, description, module, isActive } = req.body;
      
      const updatedCategory = await storage.updateEquipmentType(req.params.id, {
        name,
        description,
        module,
        isActive,
      });
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Equipment category not found" });
      }
      
      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating equipment category:", error);
      res.status(500).json({ message: "Failed to update equipment category" });
    }
  });

  // Delete equipment category
  app.delete("/api/equipment-categories/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteEquipmentType(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting equipment category:", error);
      res.status(500).json({ message: "Failed to delete equipment category" });
    }
  });

  // Seed default equipment categories for a company
  app.post("/api/companies/:companyId/equipment-categories/seed-defaults", requirePermission('schedule_create'), async (req, res) => {
    try {
      const { companyId } = req.params;
      const module = (req.body.module || 'maintenance') as 'clean' | 'maintenance';
      
      // Check if categories already exist
      const existingCategories = await storage.getEquipmentTypesByCompany(companyId, module);
      if (existingCategories.length > 0) {
        return res.json({ message: "Categories already exist", categories: existingCategories });
      }
      
      // Default categories for maintenance module
      const defaultCategories = [
        { name: "HVAC", description: "Sistemas de aquecimento, ventilação e ar condicionado" },
        { name: "Elétrico", description: "Equipamentos e sistemas elétricos" },
        { name: "Hidráulico", description: "Sistemas de água e encanamento" },
        { name: "Elevadores", description: "Elevadores e equipamentos de transporte vertical" },
        { name: "Segurança", description: "Sistemas de segurança e alarmes" },
        { name: "Incêndio", description: "Sistemas de combate e prevenção de incêndio" },
        { name: "Industrial", description: "Equipamentos industriais e de produção" },
        { name: "TI/Telecom", description: "Equipamentos de tecnologia e telecomunicações" },
        { name: "Outros", description: "Outros equipamentos não categorizados" },
      ];
      
      const createdCategories = [];
      for (const cat of defaultCategories) {
        const newCat = await storage.createEquipmentType({
          companyId,
          name: cat.name,
          description: cat.description,
          module,
          isActive: true,
        });
        createdCategories.push(newCat);
      }
      
      res.status(201).json({ message: "Default categories created", categories: createdCategories });
    } catch (error) {
      console.error("Error seeding default equipment categories:", error);
      res.status(500).json({ message: "Failed to seed default equipment categories" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Equipment Routes
  // ============================================================================

  // Get equipment by customer
  app.get("/api/customers/:customerId/equipment", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const equipment = await storage.getEquipmentByCustomer(req.params.customerId, module);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment by site
  app.get("/api/sites/:siteId/equipment", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const equipment = await storage.getEquipmentBySite(req.params.siteId, module);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment by zone
  app.get("/api/zones/:zoneId/equipment", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const equipment = await storage.getEquipmentByZone(req.params.zoneId, module);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment by multiple zones (query parameter)
  app.get("/api/equipment", async (req, res) => {
    try {
      const zoneIdsParam = req.query.zoneIds as string;
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      
      if (!zoneIdsParam) {
        return res.status(400).json({ message: "zoneIds query parameter is required" });
      }
      
      const zoneIds = zoneIdsParam.split(',').filter(id => id.trim());
      
      if (zoneIds.length === 0) {
        return res.json([]);
      }
      
      // Fetch equipment for all zones and merge
      const equipmentPromises = zoneIds.map(zoneId => 
        storage.getEquipmentByZone(zoneId.trim(), module)
      );
      
      const equipmentArrays = await Promise.all(equipmentPromises);
      const allEquipment = equipmentArrays.flat();
      
      // Remove duplicates by ID
      const uniqueEquipment = Array.from(
        new Map(allEquipment.map(eq => [eq.id, eq])).values()
      );
      
      res.json(uniqueEquipment);
    } catch (error) {
      console.error("Error fetching equipment by zones:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get single equipment
  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const equipment = await storage.getEquipment(req.params.id);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Create equipment
  app.post("/api/equipment", requirePermission('schedule_create'), async (req, res) => {
    try {
      console.log("Creating equipment with data:", req.body);
      const equipment = insertEquipmentSchema.parse(req.body);
      console.log("Validated equipment:", equipment);
      const newEquipment = await storage.createEquipment(equipment);
      
      // Buscar a zone para obter o customerId
      const zone = await storage.getZone(newEquipment.zoneId);
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      // Broadcast equipment creation to all connected clients
      broadcast({
        type: 'create',
        resource: 'equipment',
        data: newEquipment,
        customerId: site?.customerId || undefined,
      });
      
      res.status(201).json(newEquipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Equipment validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      // Check for unique constraint violation on serial number
      if (error instanceof Error && error.message.includes('equipment_serial_number_unique')) {
        return res.status(400).json({ message: "Este número de série já está em uso. Por favor, utilize um número de série único." });
      }
      console.error("Error creating equipment:", error);
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  // Update equipment
  app.put("/api/equipment/:id", async (req, res) => {
    try {
      const equipment = insertEquipmentSchema.partial().parse(req.body);
      const updatedEquipment = await storage.updateEquipment(req.params.id, equipment);
      
      // Buscar a zone para obter o customerId
      const zone = await storage.getZone(updatedEquipment.zoneId);
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      // Broadcast equipment update to all connected clients
      broadcast({
        type: 'update',
        resource: 'equipment',
        data: updatedEquipment,
        customerId: site?.customerId || undefined,
      });
      
      res.json(updatedEquipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      // Check for unique constraint violation on serial number
      if (error instanceof Error && error.message.includes('equipment_serial_number_unique')) {
        return res.status(400).json({ message: "Este número de série já está em uso. Por favor, utilize um número de série único." });
      }
      console.error("Error updating equipment:", error);
      res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  // Delete equipment
  app.delete("/api/equipment/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      // Buscar o equipment ANTES de deletar para ter o zoneId e customerId
      const equipment = await storage.getEquipment(req.params.id);
      const zone = equipment ? await storage.getZone(equipment.zoneId) : null;
      const site = zone ? await storage.getSite(zone.siteId) : null;
      
      await storage.deleteEquipment(req.params.id);
      
      // Broadcast equipment deletion to all connected clients
      if (equipment && site) {
        broadcast({
          type: 'delete',
          resource: 'equipment',
          data: { id: req.params.id },
          customerId: site.customerId || undefined,
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  // Get equipment work order history
  app.get("/api/equipment/:equipmentId/work-orders", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrdersByEquipment(req.params.equipmentId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching equipment work order history:", error);
      res.status(500).json({ message: "Failed to fetch equipment work order history" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Maintenance Checklist Templates Routes
  // ============================================================================

  // Get checklist templates by customer
  app.get("/api/customers/:customerId/maintenance-checklist-templates", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const templates = await storage.getMaintenanceChecklistTemplatesByCustomer(req.params.customerId, module);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching maintenance checklist templates:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist templates" });
    }
  });

  // Get checklist templates by equipment type
  app.get("/api/customers/:customerId/maintenance-checklist-templates/equipment-type/:equipmentType", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const templates = await storage.getMaintenanceChecklistTemplatesByEquipmentType(
        req.params.customerId, 
        req.params.equipmentType,
        module
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching maintenance checklist templates:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist templates" });
    }
  });

  // Get checklist templates by equipment
  app.get("/api/equipment/:equipmentId/maintenance-checklist-templates", async (req, res) => {
    try {
      const templates = await storage.getMaintenanceChecklistTemplatesByEquipment(req.params.equipmentId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching maintenance checklist templates:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist templates" });
    }
  });

  // Get single checklist template
  app.get("/api/maintenance-checklist-templates/:id", async (req, res) => {
    try {
      const template = await storage.getMaintenanceChecklistTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Maintenance checklist template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching maintenance checklist template:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist template" });
    }
  });

  // Create checklist template
  app.post("/api/maintenance-checklist-templates", requirePermission('checklists_create'), async (req, res) => {
    try {
      const template = insertMaintenanceChecklistTemplateSchema.parse(req.body);
      const newTemplate = await storage.createMaintenanceChecklistTemplate(template);
      res.status(201).json(newTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating maintenance checklist template:", error);
      res.status(500).json({ message: "Failed to create maintenance checklist template" });
    }
  });

  // Update checklist template
  app.put("/api/maintenance-checklist-templates/:id", async (req, res) => {
    try {
      const template = insertMaintenanceChecklistTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateMaintenanceChecklistTemplate(req.params.id, template);
      res.json(updatedTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance checklist template:", error);
      res.status(500).json({ message: "Failed to update maintenance checklist template" });
    }
  });

  // Delete checklist template
  app.delete("/api/maintenance-checklist-templates/:id", requirePermission('checklists_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenanceChecklistTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance checklist template:", error);
      res.status(500).json({ message: "Failed to delete maintenance checklist template" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Maintenance Checklist Executions Routes
  // ============================================================================

  // Get executions by equipment
  app.get("/api/equipment/:equipmentId/maintenance-checklist-executions", async (req, res) => {
    try {
      const executions = await storage.getMaintenanceChecklistExecutionsByEquipment(req.params.equipmentId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching maintenance checklist executions:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist executions" });
    }
  });

  // Get executions by work order
  app.get("/api/work-orders/:workOrderId/maintenance-checklist-executions", async (req, res) => {
    try {
      const executions = await storage.getMaintenanceChecklistExecutionsByWorkOrder(req.params.workOrderId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching maintenance checklist executions:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist executions" });
    }
  });

  // Get single execution
  app.get("/api/maintenance-checklist-executions/:id", async (req, res) => {
    try {
      const execution = await storage.getMaintenanceChecklistExecution(req.params.id);
      if (!execution) {
        return res.status(404).json({ message: "Maintenance checklist execution not found" });
      }
      res.json(execution);
    } catch (error) {
      console.error("Error fetching maintenance checklist execution:", error);
      res.status(500).json({ message: "Failed to fetch maintenance checklist execution" });
    }
  });

  // Create execution
  app.post("/api/maintenance-checklist-executions", requirePermission('checklists_create'), async (req, res) => {
    try {
      const execution = insertMaintenanceChecklistExecutionSchema.parse(req.body);
      const newExecution = await storage.createMaintenanceChecklistExecution(execution);
      res.status(201).json(newExecution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating maintenance checklist execution:", error);
      res.status(500).json({ message: "Failed to create maintenance checklist execution" });
    }
  });

  // Update execution
  app.put("/api/maintenance-checklist-executions/:id", async (req, res) => {
    try {
      const execution = insertMaintenanceChecklistExecutionSchema.partial().parse(req.body);
      const updatedExecution = await storage.updateMaintenanceChecklistExecution(req.params.id, execution);
      res.json(updatedExecution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance checklist execution:", error);
      res.status(500).json({ message: "Failed to update maintenance checklist execution" });
    }
  });

  // Delete execution
  app.delete("/api/maintenance-checklist-executions/:id", requirePermission('checklists_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenanceChecklistExecution(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance checklist execution:", error);
      res.status(500).json({ message: "Failed to delete maintenance checklist execution" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Maintenance Plans Routes
  // ============================================================================

  // Get plans by customer
  app.get("/api/customers/:customerId/maintenance-plans", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const plans = await storage.getMaintenancePlansByCustomer(req.params.customerId, module);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching maintenance plans:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plans" });
    }
  });

  // Get single plan
  app.get("/api/maintenance-plans/:id", async (req, res) => {
    try {
      const plan = await storage.getMaintenancePlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Maintenance plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching maintenance plan:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plan" });
    }
  });

  // Create plan
  app.post("/api/maintenance-plans", requirePermission('schedule_create'), async (req, res) => {
    try {
      const plan = insertMaintenancePlanSchema.parse(req.body);
      const newPlan = await storage.createMaintenancePlan(plan);
      res.status(201).json(newPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating maintenance plan:", error);
      res.status(500).json({ message: "Failed to create maintenance plan" });
    }
  });

  // Update plan
  app.put("/api/maintenance-plans/:id", async (req, res) => {
    try {
      const plan = insertMaintenancePlanSchema.partial().parse(req.body);
      const updatedPlan = await storage.updateMaintenancePlan(req.params.id, plan);
      res.json(updatedPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance plan:", error);
      res.status(500).json({ message: "Failed to update maintenance plan" });
    }
  });

  // Delete plan
  app.delete("/api/maintenance-plans/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenancePlan(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance plan:", error);
      res.status(500).json({ message: "Failed to delete maintenance plan" });
    }
  });

  // ============================================================================
  // MAINTENANCE MODULE - Maintenance Plan Equipment Routes
  // ============================================================================

  // Get plan equipments by plan
  app.get("/api/maintenance-plans/:planId/equipments", async (req, res) => {
    try {
      const planEquipments = await storage.getMaintenancePlanEquipmentsByPlan(req.params.planId);
      res.json(planEquipments);
    } catch (error) {
      console.error("Error fetching maintenance plan equipments:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plan equipments" });
    }
  });

  // Get plan equipments by equipment
  app.get("/api/equipment/:equipmentId/maintenance-plans", async (req, res) => {
    try {
      const planEquipments = await storage.getMaintenancePlanEquipmentsByEquipment(req.params.equipmentId);
      res.json(planEquipments);
    } catch (error) {
      console.error("Error fetching maintenance plan equipments:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plan equipments" });
    }
  });

  // Get single plan equipment
  app.get("/api/maintenance-plan-equipments/:id", async (req, res) => {
    try {
      const planEquipment = await storage.getMaintenancePlanEquipment(req.params.id);
      if (!planEquipment) {
        return res.status(404).json({ message: "Maintenance plan equipment not found" });
      }
      res.json(planEquipment);
    } catch (error) {
      console.error("Error fetching maintenance plan equipment:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plan equipment" });
    }
  });

  // Create plan equipment
  app.post("/api/maintenance-plan-equipments", requirePermission('schedule_create'), async (req, res) => {
    try {
      const planEquipment = insertMaintenancePlanEquipmentSchema.parse(req.body);
      const newPlanEquipment = await storage.createMaintenancePlanEquipment(planEquipment);
      res.status(201).json(newPlanEquipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating maintenance plan equipment:", error);
      res.status(500).json({ message: "Failed to create maintenance plan equipment" });
    }
  });

  // Update plan equipment
  app.put("/api/maintenance-plan-equipments/:id", async (req, res) => {
    try {
      const planEquipment = insertMaintenancePlanEquipmentSchema.partial().parse(req.body);
      const updatedPlanEquipment = await storage.updateMaintenancePlanEquipment(req.params.id, planEquipment);
      res.json(updatedPlanEquipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance plan equipment:", error);
      res.status(500).json({ message: "Failed to update maintenance plan equipment" });
    }
  });

  // Delete plan equipment
  app.delete("/api/maintenance-plan-equipments/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenancePlanEquipment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance plan equipment:", error);
      res.status(500).json({ message: "Failed to delete maintenance plan equipment" });
    }
  });

  // ============================================================================
  // PARTS (Estoque de Peças)
  // ============================================================================

  // Get all parts for a customer
  app.get("/api/customers/:customerId/parts", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const parts = await storage.getPartsByCustomer(req.params.customerId, module);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching parts:", error);
      res.status(500).json({ message: "Failed to fetch parts" });
    }
  });

  // Get parts with low stock for a customer
  app.get("/api/customers/:customerId/parts/low-stock", async (req, res) => {
    try {
      const parts = await storage.getPartsWithLowStock(req.params.customerId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching low stock parts:", error);
      res.status(500).json({ message: "Failed to fetch low stock parts" });
    }
  });

  // Get parts with projected quantities (stock - reserved in open work orders)
  app.get("/api/customers/:customerId/parts/with-projections", async (req, res) => {
    try {
      const module = req.query.module as 'clean' | 'maintenance' | undefined;
      const parts = await storage.getPartsByCustomer(req.params.customerId, module);
      
      // Get all work orders for this customer (including maintenance module)
      const workOrders = await storage.getWorkOrdersByCustomer(req.params.customerId, 'maintenance');
      const openWorkOrders = workOrders.filter((wo: any) => 
        wo.status !== 'concluida' && wo.status !== 'cancelada'
      );
      
      // Calculate reserved quantities per part
      const reservedByPart: Record<string, number> = {};
      
      // 1. First, check parts directly associated to work orders (work_order_parts table)
      for (const wo of openWorkOrders) {
        const woParts = await storage.getWorkOrderParts(wo.id);
        for (const woPart of woParts) {
          if (!woPart.stockDeducted) {
            const qty = parseFloat(woPart.quantityUsed || woPart.quantityPlanned);
            reservedByPart[woPart.partId] = (reservedByPart[woPart.partId] || 0) + qty;
          }
        }
      }
      
      // 2. Second, check parts in checklist templates associated to work orders
      // Get all maintenance checklist templates for this customer
      const checklistTemplates = await storage.getMaintenanceChecklistTemplatesByCustomer(req.params.customerId);
      const checklistTemplatesMap: Record<string, any> = {};
      for (const ct of checklistTemplates) {
        checklistTemplatesMap[ct.id] = ct;
      }
      
      // For each open work order with a checklist template, check if items have partId
      for (const wo of openWorkOrders) {
        if (wo.maintenanceChecklistTemplateId) {
          const template = checklistTemplatesMap[wo.maintenanceChecklistTemplateId];
          if (template && template.items && Array.isArray(template.items)) {
            for (const item of template.items) {
              if (item.partId) {
                // Default quantity is 1 per execution if not specified
                const qty = item.partQuantity ? parseFloat(item.partQuantity) : 1;
                reservedByPart[item.partId] = (reservedByPart[item.partId] || 0) + qty;
              }
            }
          }
        }
      }
      
      // Add projected quantity to each part
      const partsWithProjections = parts.map((part: any) => {
        const reserved = reservedByPart[part.id] || 0;
        const currentQty = parseFloat(part.currentQuantity);
        const projectedQty = Math.max(0, currentQty - reserved);
        
        return {
          ...part,
          reservedQuantity: String(reserved),
          projectedQuantity: String(projectedQty),
          openOrdersCount: openWorkOrders.filter((wo: any) => {
            // Count WOs that have this part either directly or via checklist
            if (reservedByPart[part.id] && reservedByPart[part.id] > 0) {
              return true;
            }
            return false;
          }).length
        };
      });
      
      res.json(partsWithProjections);
    } catch (error) {
      console.error("Error fetching parts with projections:", error);
      res.status(500).json({ message: "Failed to fetch parts with projections" });
    }
  });

  // Get parts by equipment type
  app.get("/api/equipment-types/:equipmentTypeId/parts", async (req, res) => {
    try {
      const parts = await storage.getPartsByEquipmentType(req.params.equipmentTypeId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching parts by equipment type:", error);
      res.status(500).json({ message: "Failed to fetch parts" });
    }
  });

  // Get single part
  app.get("/api/parts/:id", async (req, res) => {
    try {
      const part = await storage.getPart(req.params.id);
      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }
      res.json(part);
    } catch (error) {
      console.error("Error fetching part:", error);
      res.status(500).json({ message: "Failed to fetch part" });
    }
  });

  // Create part
  app.post("/api/parts", requirePermission('schedule_create'), async (req, res) => {
    try {
      const part = insertPartSchema.parse(req.body);
      const newPart = await storage.createPart(part);
      broadcast({ type: 'create', resource: 'parts', data: newPart });
      res.status(201).json(newPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating part:", error);
      res.status(500).json({ message: "Failed to create part" });
    }
  });

  // Update part
  app.put("/api/parts/:id", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const part = insertPartSchema.partial().parse(req.body);
      const updatedPart = await storage.updatePart(req.params.id, part);
      broadcast({ type: 'update', resource: 'parts', data: updatedPart });
      res.json(updatedPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating part:", error);
      res.status(500).json({ message: "Failed to update part" });
    }
  });

  // Delete part
  app.delete("/api/parts/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deletePart(req.params.id);
      broadcast({ type: 'delete', resource: 'parts', id: req.params.id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting part:", error);
      res.status(500).json({ message: "Failed to delete part" });
    }
  });

  // Adjust stock (entrada/saida/ajuste)
  app.post("/api/parts/:id/adjust-stock", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const { movementType, quantity, reason } = req.body;
      if (!['entrada', 'saida', 'ajuste'].includes(movementType)) {
        return res.status(400).json({ message: "Invalid movement type" });
      }

      const part = await storage.getPart(req.params.id);
      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      const previousQuantity = parseFloat(part.currentQuantity);
      let newQuantity: number;

      if (movementType === 'entrada') {
        newQuantity = previousQuantity + quantity;
      } else if (movementType === 'saida') {
        newQuantity = Math.max(0, previousQuantity - quantity);
      } else {
        newQuantity = quantity; // ajuste direto
      }

      // Update part stock
      const updatedPart = await storage.updatePart(req.params.id, { 
        currentQuantity: String(newQuantity) 
      });

      // Create movement record
      const movement = insertPartMovementSchema.parse({
        partId: req.params.id,
        movementType,
        quantity: String(quantity),
        previousQuantity: String(previousQuantity),
        newQuantity: String(newQuantity),
        reason: reason || null,
        performedByUserId: req.user?.id
      });
      await storage.createPartMovement(movement);

      broadcast({ type: 'update', resource: 'parts', data: updatedPart });
      res.json(updatedPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error adjusting stock:", error);
      res.status(500).json({ message: "Failed to adjust stock" });
    }
  });

  // Get part movements (history)
  app.get("/api/parts/:id/movements", async (req, res) => {
    try {
      const movements = await storage.getPartMovements(req.params.id);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching part movements:", error);
      res.status(500).json({ message: "Failed to fetch part movements" });
    }
  });

  // Validate stock availability
  app.post("/api/parts/validate-stock", async (req, res) => {
    try {
      const { parts: partsToValidate } = req.body;
      if (!Array.isArray(partsToValidate)) {
        return res.status(400).json({ message: "Parts array is required" });
      }
      const result = await storage.validateStockAvailability(partsToValidate);
      res.json(result);
    } catch (error) {
      console.error("Error validating stock:", error);
      res.status(500).json({ message: "Failed to validate stock" });
    }
  });

  // ============================================================================
  // WORK ORDER PARTS
  // ============================================================================

  // Get parts for a work order
  app.get("/api/work-orders/:workOrderId/parts", async (req, res) => {
    try {
      const parts = await storage.getWorkOrderParts(req.params.workOrderId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching work order parts:", error);
      res.status(500).json({ message: "Failed to fetch work order parts" });
    }
  });

  // Add part to work order
  app.post("/api/work-orders/:workOrderId/parts", requirePermission('schedule_create'), async (req, res) => {
    try {
      const workOrderPart = insertWorkOrderPartSchema.parse({
        ...req.body,
        workOrderId: req.params.workOrderId
      });
      const newWorkOrderPart = await storage.createWorkOrderPart(workOrderPart);
      res.status(201).json(newWorkOrderPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error adding part to work order:", error);
      res.status(500).json({ message: "Failed to add part to work order" });
    }
  });

  // Update work order part
  app.put("/api/work-order-parts/:id", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const workOrderPart = insertWorkOrderPartSchema.partial().parse(req.body);
      const updatedPart = await storage.updateWorkOrderPart(req.params.id, workOrderPart);
      res.json(updatedPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating work order part:", error);
      res.status(500).json({ message: "Failed to update work order part" });
    }
  });

  // Delete work order part
  app.delete("/api/work-order-parts/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteWorkOrderPart(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting work order part:", error);
      res.status(500).json({ message: "Failed to delete work order part" });
    }
  });

  // Deduct stock for work order (when completing)
  app.post("/api/work-orders/:workOrderId/deduct-stock", requirePermission('schedule_edit'), async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      await storage.deductStock(req.params.workOrderId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deducting stock:", error);
      res.status(500).json({ message: "Failed to deduct stock" });
    }
  });

  // ============================================================================
  // MAINTENANCE PLAN PARTS
  // ============================================================================

  // Get parts for a maintenance plan
  app.get("/api/maintenance-plans/:planId/parts", async (req, res) => {
    try {
      const parts = await storage.getMaintenancePlanParts(req.params.planId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching maintenance plan parts:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plan parts" });
    }
  });

  // Add part to maintenance plan
  app.post("/api/maintenance-plans/:planId/parts", requirePermission('schedule_create'), async (req, res) => {
    try {
      const planPart = insertMaintenancePlanPartSchema.parse({
        ...req.body,
        planId: req.params.planId
      });
      const newPlanPart = await storage.createMaintenancePlanPart(planPart);
      res.status(201).json(newPlanPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error adding part to maintenance plan:", error);
      res.status(500).json({ message: "Failed to add part to maintenance plan" });
    }
  });

  // Update maintenance plan part
  app.put("/api/maintenance-plan-parts/:id", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const planPart = insertMaintenancePlanPartSchema.partial().parse(req.body);
      const updatedPart = await storage.updateMaintenancePlanPart(req.params.id, planPart);
      res.json(updatedPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance plan part:", error);
      res.status(500).json({ message: "Failed to update maintenance plan part" });
    }
  });

  // Delete maintenance plan part
  app.delete("/api/maintenance-plan-parts/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenancePlanPart(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance plan part:", error);
      res.status(500).json({ message: "Failed to delete maintenance plan part" });
    }
  });

  // ============================================================================
  // MAINTENANCE ACTIVITY PARTS (Peças em Atividades de Manutenção)
  // ============================================================================

  // Get parts for a maintenance activity
  app.get("/api/maintenance-activities/:activityId/parts", async (req, res) => {
    try {
      const parts = await storage.getMaintenanceActivityParts(req.params.activityId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching maintenance activity parts:", error);
      res.status(500).json({ message: "Failed to fetch maintenance activity parts" });
    }
  });

  // Add part to maintenance activity
  app.post("/api/maintenance-activities/:activityId/parts", requirePermission('schedule_create'), async (req, res) => {
    try {
      const activityPart = insertMaintenanceActivityPartSchema.parse({
        ...req.body,
        activityId: req.params.activityId
      });
      const newActivityPart = await storage.createMaintenanceActivityPart(activityPart);
      broadcast({ type: 'update', resource: 'maintenance_activities', id: req.params.activityId });
      res.status(201).json(newActivityPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error adding part to maintenance activity:", error);
      res.status(500).json({ message: "Failed to add part to maintenance activity" });
    }
  });

  // Update maintenance activity part
  app.put("/api/maintenance-activity-parts/:id", requirePermission('schedule_edit'), async (req, res) => {
    try {
      const activityPart = insertMaintenanceActivityPartSchema.partial().parse(req.body);
      const updatedPart = await storage.updateMaintenanceActivityPart(req.params.id, activityPart);
      res.json(updatedPart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating maintenance activity part:", error);
      res.status(500).json({ message: "Failed to update maintenance activity part" });
    }
  });

  // Delete maintenance activity part
  app.delete("/api/maintenance-activity-parts/:id", requirePermission('schedule_delete'), async (req, res) => {
    try {
      await storage.deleteMaintenanceActivityPart(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting maintenance activity part:", error);
      res.status(500).json({ message: "Failed to delete maintenance activity part" });
    }
  });

  // ============================================================================
  // AI INTEGRATIONS (OPUS Users Only)
  // ============================================================================

  // Get all AI integrations for a company
  app.get("/api/ai-integrations", requireAuth, requireOpusUser, async (req, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "Company ID not found" });
      }
      const integrations = await storage.getAiIntegrations(req.user.companyId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching AI integrations:", error);
      res.status(500).json({ message: "Failed to fetch AI integrations" });
    }
  });

  // Get single AI integration
  app.get("/api/ai-integrations/:id", requireAuth, requireOpusUser, async (req, res) => {
    try {
      const integration = await storage.getAiIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: "AI integration not found" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error fetching AI integration:", error);
      res.status(500).json({ message: "Failed to fetch AI integration" });
    }
  });

  // Get default AI integration
  app.get("/api/ai-integrations/default/:companyId", requireAuth, requireOpusUser, async (req, res) => {
    try {
      const integration = await storage.getDefaultAiIntegration(req.params.companyId);
      if (!integration) {
        return res.status(404).json({ message: "No default AI integration found" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error fetching default AI integration:", error);
      res.status(500).json({ message: "Failed to fetch default AI integration" });
    }
  });

  // Create AI integration
  app.post("/api/ai-integrations", requireAuth, requireOpusUser, async (req, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(400).json({ message: "Company ID not found" });
      }
      if (!req.user?.id) {
        return res.status(400).json({ message: "User ID not found" });
      }
      const integration = insertAiIntegrationSchema.parse({
        ...req.body,
        companyId: req.user.companyId,
        createdBy: req.user.id
      });
      const newIntegration = await storage.createAiIntegration(integration);
      res.status(201).json(newIntegration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating AI integration:", error);
      res.status(500).json({ message: "Failed to create AI integration" });
    }
  });

  // Update AI integration
  app.put("/api/ai-integrations/:id", requireAuth, requireOpusUser, async (req, res) => {
    try {
      const integration = insertAiIntegrationSchema.partial().parse(req.body);
      const updatedIntegration = await storage.updateAiIntegration(req.params.id, integration);
      res.json(updatedIntegration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating AI integration:", error);
      res.status(500).json({ message: "Failed to update AI integration" });
    }
  });

  // Delete AI integration
  app.delete("/api/ai-integrations/:id", requireAuth, requireOpusUser, async (req, res) => {
    try {
      await storage.deleteAiIntegration(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI integration:", error);
      res.status(500).json({ message: "Failed to delete AI integration" });
    }
  });

  // Test AI integration connection
  app.post("/api/ai-integrations/:id/test", requireAuth, requireOpusUser, async (req, res) => {
    try {
      const result = await storage.testAiIntegration(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error testing AI integration:", error);
      res.status(500).json({ message: "Failed to test AI integration" });
    }
  });

  // ===== CHAT ENDPOINTS =====

  // Get active conversation and messages
  app.get("/api/chat/conversation", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { customerId, module } = req.query;
      
      const conversation = await storage.getActiveConversation(
        req.user.id,
        customerId as string,
        module as 'clean' | 'maintenance'
      );
      
      if (!conversation) {
        return res.json(serializeForAI({ conversation: null, messages: [] }));
      }

      const messages = await storage.getConversationMessages(conversation.id);
      res.json(serializeForAI({ conversation, messages }));
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Send message
  app.post("/api/chat/message", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id || !req.user?.companyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { message, module, customerId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      if (!module || !['clean', 'maintenance'].includes(module)) {
        return res.status(400).json({ message: "Valid module is required" });
      }

      // Use customerId from request body (for OPUS users) or from user object (for customer users)
      const effectiveCustomerId = customerId || req.user.customerId || null;

      if (!effectiveCustomerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const result = await storage.processUserMessage(
        req.user.id,
        req.user.companyId,
        effectiveCustomerId,
        module,
        message
      );

      res.json(serializeForAI(result));
    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // ===== TV MODE DASHBOARD ENDPOINTS =====

  // Get TV Mode statistics (work orders and leaderboard)
  app.get("/api/tv-mode/stats", requireAuth, async (req, res) => {
    try {
      const { customerId, module } = req.query;

      console.log("[TV MODE] Request received with params:", { customerId, module });

      if (!customerId || !module) {
        return res.status(400).json({ message: "customerId and module are required" });
      }

      const stats = await storage.getTvModeStats(
        customerId as string,
        module as 'clean' | 'maintenance'
      );

      console.log("[TV MODE] Stats fetched:", JSON.stringify(stats, null, 2));

      res.json(stats);
    } catch (error) {
      console.error("[TV MODE] Error fetching TV mode stats:", error);
      res.status(500).json({ message: "Failed to fetch TV mode statistics" });
    }
  });

  // ===== OFFLINE SYNC ENDPOINTS =====

  // Batch sync endpoint - receives offline data from mobile app
  app.post("/api/sync/batch", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id || !req.user?.customerId) {
        return res.status(401).json({ message: "User not authenticated or missing customer" });
      }

      console.log("[SYNC] Batch sync request received from user:", req.user.id, "customer:", req.user.customerId);
      
      // Validate request body
      const validatedData = syncBatchRequestSchema.parse(req.body);
      
      // SECURITY: Validate that all data belongs to user's customer
      const userCustomerId = req.user.customerId;
      
      // Check all work orders belong to user's customer
      if (validatedData.workOrders) {
        const invalidWOs = validatedData.workOrders.filter(wo => wo.customerId !== userCustomerId);
        if (invalidWOs.length > 0) {
          console.warn("[SYNC] Security violation: User attempted to sync work orders for different customer");
          return res.status(403).json({ 
            message: "Forbidden: Cannot sync data for different customer",
            details: `${invalidWOs.length} work orders rejected`
          });
        }
      }

      // BATCH VALIDATION: Extract all referenced work order IDs
      const referencedWOIds = new Set<string>();
      if (validatedData.checklistExecutions) {
        for (const exec of validatedData.checklistExecutions) {
          if (exec.workOrderId) {
            referencedWOIds.add(exec.workOrderId);
          }
        }
      }
      if (validatedData.attachments) {
        for (const att of validatedData.attachments) {
          if (att.workOrderId) {
            referencedWOIds.add(att.workOrderId);
          }
        }
      }

      // Pre-fetch all referenced work orders in a single query (scoped to customer)
      const validatedWorkOrdersArray = await storage.getWorkOrdersByIds(
        Array.from(referencedWOIds),
        userCustomerId
      );

      // Ensure all referenced work orders exist and belong to user's customer
      if (validatedWorkOrdersArray.length !== referencedWOIds.size) {
        const foundIds = new Set(validatedWorkOrdersArray.map(wo => wo.id));
        const missingIds = Array.from(referencedWOIds).filter(id => !foundIds.has(id));
        
        console.warn("[SYNC] Security violation: Referenced work orders not found or not authorized:", missingIds);
        return res.status(403).json({ 
          message: "Forbidden: Invalid work order references",
          details: `${missingIds.length} work order(s) not found or not authorized`,
          missingIds,
        });
      }

      // Create Map for efficient lookup in storage layer
      const validatedWorkOrders = new Map(
        validatedWorkOrdersArray.map(wo => [wo.id, wo])
      );
      
      // Log sync stats
      const stats = {
        workOrders: validatedData.workOrders?.length || 0,
        checklistExecutions: validatedData.checklistExecutions?.length || 0,
        attachments: validatedData.attachments?.length || 0,
      };
      console.log("[SYNC] Processing batch:", stats);

      // Execute sync with validated work orders map
      const result = await storage.syncBatch(validatedData, userCustomerId, validatedWorkOrders);

      console.log("[SYNC] Batch sync completed:", {
        success: result.success,
        workOrders: result.workOrders.length,
        checklistExecutions: result.checklistExecutions.length,
        attachments: result.attachments.length,
      });

      res.json(result);
    } catch (error) {
      console.error("[SYNC] Batch sync error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid sync data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to sync batch",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
