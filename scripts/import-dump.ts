import { db } from "../server/db.js";
import {
  companies,
  customers,
  sites,
  zones,
  users,
  cleaningActivities,
  checklistTemplates,
  workOrders,
  qrCodePoints,
  customRoles,
  rolePermissions,
  userRoleAssignments,
  services,
  serviceCategories,
  serviceTypes
} from "../shared/schema.js";
import fs from "fs";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// Helper to safely parse JSON
function parseJSON(value: any): any {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

// Parse SQL dump file to extract INSERT data
function parseSQLDump(filename: string): Map<string, any[]> {
  const content = fs.readFileSync(filename, 'utf-8');
  const tables = new Map<string, any[]>();
  
  // Regular expression to match COPY statements and their data
  const copyRegex = /COPY public\.(\w+) \((.*?)\) FROM stdin;([\s\S]*?)\\\.$/gm;
  
  let match;
  while ((match = copyRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(', ').map(c => c.replace(/"/g, ''));
    const dataBlock = match[3].trim();
    
    if (!dataBlock) continue;
    
    const rows = dataBlock.split('\n').map(line => {
      const values = line.split('\t');
      const row: any = {};
      columns.forEach((col, idx) => {
        const value = values[idx];
        row[col] = value === '\\N' ? null : value;
      });
      return row;
    });
    
    tables.set(tableName, rows);
  }
  
  return tables;
}

async function importDump() {
  console.log('📦 Iniciando importação do dump...\n');
  
  const dumpFile = 'attached_assets/facilities_dump (1)_1762832184833.sql';
  const tables = parseSQLDump(dumpFile);
  
  console.log('✅ Tabelas encontradas:', Array.from(tables.keys()).join(', '));
  console.log('');
  
  // First import all companies from dump
  const companiesData = tables.get('companies') || [];
  console.log(`\n🏢 Importando ${companiesData.length} empresas...`);
  
  for (const company of companiesData) {
    const exists = await db.query.companies.findFirst({
      where: (companies, { eq }) => eq(companies.id, company.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Empresa ${company.name} já existe`);
      continue;
    }
    
    await db.insert(companies).values({
      id: company.id,
      name: company.name,
      cnpj: company.cnpj || null,
      email: company.email || null,
      phone: company.phone || null,
      address: company.address || null,
      isActive: company.is_active === 't',
    });
    
    console.log(`  ✅ Empresa importada: ${company.name}`);
  }
  
  // Import Customers
  const customersData = tables.get('customers') || [];
  console.log(`\n📋 Importando ${customersData.length} clientes...`);
  
  for (const customer of customersData) {
    // Skip existing customers
    const exists = await db.query.customers.findFirst({
      where: (customers, { eq }) => eq(customers.id, customer.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Cliente ${customer.name} já existe`);
      continue;
    }
    
    await db.insert(customers).values({
      id: customer.id,
      companyId: 'company-admin-default',
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
      document: customer.document || null,
      address: customer.address || null,
      city: customer.city || null,
      state: customer.state || null,
      zipCode: customer.zip_code || null,
      contactPerson: customer.contact_person || null,
      notes: customer.notes || null,
      modules: ['clean'], // Default module
      isActive: customer.is_active === 't',
    });
    
    console.log(`  ✅ Cliente importado: ${customer.name}`);
  }
  
  // Import Sites
  const sitesData = tables.get('sites') || [];
  console.log(`\n🏭 Importando ${sitesData.length} locais...`);
  
  for (const site of sitesData) {
    const exists = await db.query.sites.findFirst({
      where: (sites, { eq }) => eq(sites.id, site.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Local ${site.name} já existe`);
      continue;
    }
    
    await db.insert(sites).values({
      id: site.id,
      companyId: 'company-admin-default',
      customerId: site.customer_id || null,
      module: 'clean',
      name: site.name,
      address: site.address || null,
      description: site.description || null,
      floorPlanImageUrl: site.floor_plan_image_url || null,
      isActive: site.is_active === 't',
    });
    
    console.log(`  ✅ Local importado: ${site.name}`);
  }
  
  // Import Zones
  const zonesData = tables.get('zones') || [];
  console.log(`\n📍 Importando ${zonesData.length} zonas...`);
  
  for (const zone of zonesData) {
    const exists = await db.query.zones.findFirst({
      where: (zones, { eq }) => eq(zones.id, zone.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Zona ${zone.name} já existe`);
      continue;
    }
    
    await db.insert(zones).values({
      id: zone.id,
      siteId: zone.site_id,
      module: 'clean',
      name: zone.name,
      description: zone.description || null,
      areaM2: zone.area_m2 || null,
      capacity: zone.capacity ? parseInt(zone.capacity) : null,
      category: zone.category || null,
      isActive: zone.is_active === 't',
    });
    
    console.log(`  ✅ Zona importada: ${zone.name}`);
  }
  
  // Import Users
  const usersData = tables.get('users') || [];
  console.log(`\n👥 Importando ${usersData.length} usuários...`);
  
  for (const user of usersData) {
    const exists = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, user.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Usuário ${user.name} já existe`);
      continue;
    }
    
    await db.insert(users).values({
      id: user.id,
      companyId: user.company_id || 'company-admin-default',
      customerId: user.customer_id || null,
      username: user.username,
      email: user.email,
      password: user.password, // Already hashed
      name: user.name,
      role: user.role as any,
      userType: user.user_type as any,
      authProvider: 'local',
      modules: ['clean'],
      isActive: user.is_active === 't',
    });
    
    console.log(`  ✅ Usuário importado: ${user.name}`);
  }
  
  // Import Service Types
  const serviceTypesData = tables.get('service_types') || [];
  console.log(`\n🔧 Importando ${serviceTypesData.length} tipos de serviço...`);
  
  for (const serviceType of serviceTypesData) {
    const exists = await db.query.serviceTypes.findFirst({
      where: (serviceTypes, { eq }) => eq(serviceTypes.id, serviceType.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Tipo ${serviceType.name} já existe`);
      continue;
    }
    
    await db.insert(serviceTypes).values({
      id: serviceType.id,
      companyId: 'company-admin-default',
      customerId: serviceType.customer_id,
      name: serviceType.name,
      description: serviceType.description || null,
      code: serviceType.code,
      module: 'clean',
      isActive: serviceType.is_active === 't',
    });
    
    console.log(`  ✅ Tipo importado: ${serviceType.name}`);
  }
  
  // Import Service Categories
  const serviceCategoriesData = tables.get('service_categories') || [];
  console.log(`\n📂 Importando ${serviceCategoriesData.length} categorias de serviço...`);
  
  for (const category of serviceCategoriesData) {
    const exists = await db.query.serviceCategories.findFirst({
      where: (serviceCategories, { eq }) => eq(serviceCategories.id, category.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Categoria ${category.name} já existe`);
      continue;
    }
    
    await db.insert(serviceCategories).values({
      id: category.id,
      typeId: category.type_id || null,
      name: category.name,
      description: category.description || null,
      code: category.code,
      module: 'clean',
      customerId: category.customer_id || null,
      isActive: category.is_active === 't',
    });
    
    console.log(`  ✅ Categoria importada: ${category.name}`);
  }
  
  // Import Services
  const servicesData = tables.get('services') || [];
  console.log(`\n⚙️  Importando ${servicesData.length} serviços...`);
  
  for (const service of servicesData) {
    const exists = await db.query.services.findFirst({
      where: (services, { eq }) => eq(services.id, service.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Serviço ${service.name} já existe`);
      continue;
    }
    
    await db.insert(services).values({
      id: service.id,
      name: service.name,
      description: service.description || null,
      estimatedDurationMinutes: service.estimated_duration_minutes ? parseInt(service.estimated_duration_minutes) : null,
      priority: service.priority as any || 'media',
      requirements: service.requirements || null,
      module: 'clean',
      customerId: service.customer_id || null,
      categoryId: service.category_id || null,
      typeId: service.type_id || null,
      isActive: service.is_active === 't',
    });
    
    console.log(`  ✅ Serviço importado: ${service.name}`);
  }
  
  // Import Checklist Templates
  const checklistTemplatesData = tables.get('checklist_templates') || [];
  console.log(`\n📝 Importando ${checklistTemplatesData.length} templates de checklist...`);
  
  for (const template of checklistTemplatesData) {
    const exists = await db.query.checklistTemplates.findFirst({
      where: (checklistTemplates, { eq }) => eq(checklistTemplates.id, template.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Template ${template.name} já existe`);
      continue;
    }
    
    // Parse items safely
    let items = [];
    try {
      items = typeof template.items === 'string' ? JSON.parse(template.items) : template.items;
    } catch (e) {
      console.log(`  ⚠️  Template ${template.name} tem JSON inválido, usando array vazio`);
      items = [];
    }
    
    await db.insert(checklistTemplates).values({
      id: template.id,
      companyId: 'company-admin-default',
      serviceId: template.service_id || null,
      siteId: template.site_id || null,
      name: template.name,
      description: template.description || null,
      items,
      module: 'clean',
      zoneId: template.zone_id || null,
    });
    
    console.log(`  ✅ Template importado: ${template.name}`);
  }
  
  // Import Cleaning Activities
  const cleaningActivitiesData = tables.get('cleaning_activities') || [];
  console.log(`\n🧹 Importando ${cleaningActivitiesData.length} atividades de limpeza...`);
  
  for (const activity of cleaningActivitiesData) {
    const exists = await db.query.cleaningActivities.findFirst({
      where: (cleaningActivities, { eq }) => eq(cleaningActivities.id, activity.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  Atividade ${activity.name} já existe`);
      continue;
    }
    
    // Parse frequency config safely
    let frequencyConfig = null;
    try {
      frequencyConfig = typeof activity.frequency_config === 'string' 
        ? JSON.parse(activity.frequency_config) 
        : activity.frequency_config;
    } catch (e) {
      console.log(`  ⚠️  Atividade ${activity.name} tem frequencyConfig inválido`);
      frequencyConfig = {};
    }
    
    // Get customer_id from site
    let customerId = null;
    if (activity.site_id) {
      const site = await db.query.sites.findFirst({
        where: (sites, { eq }) => eq(sites.id, activity.site_id)
      });
      customerId = site?.customerId || null;
    }
    
    await db.insert(cleaningActivities).values({
      id: activity.id,
      companyId: 'company-admin-default',
      customerId,
      serviceId: activity.service_id || null,
      siteId: activity.site_id || null,
      zoneId: activity.zone_id || null,
      name: activity.name,
      description: activity.description || null,
      frequency: activity.frequency as any,
      frequencyConfig,
      module: 'clean',
      checklistTemplateId: activity.checklist_template_id || null,
      slaConfigId: activity.sla_config_id || null,
      isActive: activity.is_active === 't',
      startTime: activity.start_time || null,
      endTime: activity.end_time || null,
    });
    
    console.log(`  ✅ Atividade importada: ${activity.name}`);
  }
  
  // Import QR Code Points
  const qrCodePointsData = tables.get('qr_code_points') || [];
  console.log(`\n🔲 Importando ${qrCodePointsData.length} pontos de QR Code...`);
  
  for (const qrPoint of qrCodePointsData) {
    const exists = await db.query.qrCodePoints.findFirst({
      where: (qrCodePoints, { eq }) => eq(qrCodePoints.id, qrPoint.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  QR ${qrPoint.name} já existe`);
      continue;
    }
    
    await db.insert(qrCodePoints).values({
      id: qrPoint.id,
      zoneId: qrPoint.zone_id || null,
      serviceId: qrPoint.service_id || null,
      code: qrPoint.code,
      type: qrPoint.type as any,
      name: qrPoint.name,
      description: qrPoint.description || null,
      sizeCm: qrPoint.size_cm ? parseInt(qrPoint.size_cm) : 5,
      module: 'clean',
      isActive: qrPoint.is_active === 't',
    });
    
    console.log(`  ✅ QR Code importado: ${qrPoint.name}`);
  }
  
  // Import Work Orders
  const workOrdersData = tables.get('work_orders') || [];
  console.log(`\n📋 Importando ${workOrdersData.length} ordens de serviço...`);
  
  let imported = 0;
  for (const wo of workOrdersData) {
    const exists = await db.query.workOrders.findFirst({
      where: (workOrders, { eq }) => eq(workOrders.id, wo.id)
    });
    
    if (exists) {
      console.log(`  ⏭️  OS #${wo.number} já existe`);
      continue;
    }
    
    // Find customer ID from zone or site
    let customerId = null;
    if (wo.zone_id) {
      const zone = await db.query.zones.findFirst({
        where: (zones, { eq }) => eq(zones.id, wo.zone_id)
      });
      if (zone) {
        const site = await db.query.sites.findFirst({
          where: (sites, { eq }) => eq(sites.id, zone.siteId!)
        });
        customerId = site?.customerId || null;
      }
    }
    
    await db.insert(workOrders).values({
      id: wo.id,
      number: parseInt(wo.number),
      companyId: 'company-admin-default',
      customerId,
      module: 'clean',
      zoneId: wo.zone_id || null,
      serviceId: wo.service_id || null,
      cleaningActivityId: wo.cleaning_activity_id || null,
      checklistTemplateId: wo.checklist_template_id || null,
      type: wo.type as any,
      status: wo.status as any,
      priority: wo.priority as any,
      title: wo.title,
      description: wo.description || null,
      assignedUserId: wo.assigned_user_id || null,
      origin: wo.origin || null,
      qrCodePointId: wo.qr_code_point_id || null,
      requesterName: wo.requester_name || null,
      requesterContact: wo.requester_contact || null,
      scheduledDate: wo.scheduled_date ? new Date(wo.scheduled_date) : null,
      dueDate: wo.due_date ? new Date(wo.due_date) : null,
      scheduledStartAt: wo.scheduled_start_at ? new Date(wo.scheduled_start_at) : null,
      scheduledEndAt: wo.scheduled_end_at ? new Date(wo.scheduled_end_at) : null,
      startedAt: wo.started_at ? new Date(wo.started_at) : null,
      completedAt: wo.completed_at ? new Date(wo.completed_at) : null,
      estimatedHours: wo.estimated_hours || null,
      slaStartMinutes: wo.sla_start_minutes ? parseInt(wo.sla_start_minutes) : null,
      slaCompleteMinutes: wo.sla_complete_minutes ? parseInt(wo.sla_complete_minutes) : null,
      observations: wo.observations || null,
      checklistData: wo.checklist_data ? parseJSON(wo.checklist_data) : null,
      attachments: wo.attachments ? parseJSON(wo.attachments) : null,
      customerRating: wo.customer_rating ? parseInt(wo.customer_rating) : null,
      customerRatingComment: wo.customer_rating_comment || null,
      ratedAt: wo.rated_at ? new Date(wo.rated_at) : null,
      ratedBy: wo.rated_by || null,
    });
    
    imported++;
    if (imported % 10 === 0) {
      console.log(`  ✅ ${imported}/${workOrdersData.length} OSs importadas...`);
    }
  }
  
  console.log(`  ✅ Total de ${imported} OSs importadas`);
  
  console.log('\n✅ Importação concluída com sucesso!');
}

// Run import
importDump().catch(console.error);
