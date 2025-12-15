import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { thirdPartyCompanies, sites, zones, equipment } from '@shared/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import { SessionUser, ThirdPartyRole } from './auth';

export interface ThirdPartyContext {
  companyId: string;
  customerId: string;
  allowedSites: string[];
  allowedZones: string[];
  assetVisibilityMode: 'ALL' | 'CONTRACT_ONLY';
  role: ThirdPartyRole;
}

declare global {
  namespace Express {
    interface Request {
      thirdPartyContext?: ThirdPartyContext;
    }
  }
}

export async function loadThirdPartyContext(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  
  if (!user || user.userType !== 'third_party_user' || !user.thirdPartyCompanyId) {
    return next();
  }
  
  try {
    const [company] = await db
      .select()
      .from(thirdPartyCompanies)
      .where(eq(thirdPartyCompanies.id, user.thirdPartyCompanyId))
      .limit(1);
    
    if (!company) {
      console.error(`[THIRD_PARTY_ISOLATION] Empresa não encontrada: ${user.thirdPartyCompanyId}`);
      return res.status(403).json({
        error: 'Empresa de terceiro não encontrada',
        message: 'Sua empresa de terceiros não foi encontrada no sistema.',
        code: 'THIRD_PARTY_COMPANY_NOT_FOUND'
      });
    }
    
    if (company.status !== 'active') {
      console.warn(`[THIRD_PARTY_ISOLATION] Empresa inativa: ${company.id} (${company.name})`);
      return res.status(403).json({
        error: 'Empresa inativa',
        message: 'Sua empresa de terceiros está inativa. Entre em contato com o administrador.',
        code: 'THIRD_PARTY_COMPANY_INACTIVE'
      });
    }
    
    req.thirdPartyContext = {
      companyId: company.id,
      customerId: company.customerId,
      allowedSites: company.allowedSites || [],
      allowedZones: company.allowedZones || [],
      assetVisibilityMode: company.assetVisibilityMode as 'ALL' | 'CONTRACT_ONLY',
      role: user.thirdPartyRole as ThirdPartyRole
    };
    
    console.log(`[THIRD_PARTY_ISOLATION] ✅ Contexto carregado para ${user.name}:`, {
      company: company.name,
      sites: req.thirdPartyContext.allowedSites.length,
      zones: req.thirdPartyContext.allowedZones.length,
      assetMode: req.thirdPartyContext.assetVisibilityMode
    });
    
    next();
  } catch (error) {
    console.error('[THIRD_PARTY_ISOLATION] Erro ao carregar contexto:', error);
    return res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao carregar configurações de terceiro.'
    });
  }
}

export function validateThirdPartyCustomerAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const ctx = req.thirdPartyContext;
  
  if (!user || user.userType !== 'third_party_user') {
    return next();
  }
  
  if (!ctx) {
    return res.status(403).json({
      error: 'Contexto não carregado',
      message: 'O contexto de terceiro não foi carregado corretamente.',
      code: 'THIRD_PARTY_CONTEXT_MISSING'
    });
  }
  
  const requestedCustomerId = req.params.customerId || req.body.customerId || req.query.customerId;
  
  if (requestedCustomerId && requestedCustomerId !== ctx.customerId) {
    console.warn(`[THIRD_PARTY_ISOLATION] ❌ Tentativa de acesso a cliente não autorizado:`, {
      userId: user.id,
      userName: user.name,
      requestedCustomer: requestedCustomerId,
      allowedCustomer: ctx.customerId
    });
    
    return res.status(403).json({
      error: 'Acesso negado',
      message: 'Você não tem permissão para acessar dados deste cliente.',
      code: 'CUSTOMER_ACCESS_DENIED'
    });
  }
  
  next();
}

export function validateThirdPartySiteAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const ctx = req.thirdPartyContext;
  
  if (!user || user.userType !== 'third_party_user') {
    return next();
  }
  
  if (!ctx) {
    return res.status(403).json({
      error: 'Contexto não carregado',
      code: 'THIRD_PARTY_CONTEXT_MISSING'
    });
  }
  
  if (ctx.allowedSites.length === 0) {
    return next();
  }
  
  const requestedSiteId = req.params.siteId || req.body.siteId || req.query.siteId;
  
  if (requestedSiteId && !ctx.allowedSites.includes(requestedSiteId)) {
    console.warn(`[THIRD_PARTY_ISOLATION] ❌ Tentativa de acesso a site não autorizado:`, {
      userId: user.id,
      userName: user.name,
      requestedSite: requestedSiteId,
      allowedSites: ctx.allowedSites
    });
    
    return res.status(403).json({
      error: 'Acesso negado',
      message: 'Você não tem permissão para acessar este local.',
      code: 'SITE_ACCESS_DENIED'
    });
  }
  
  next();
}

export function validateThirdPartyZoneAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  const ctx = req.thirdPartyContext;
  
  if (!user || user.userType !== 'third_party_user') {
    return next();
  }
  
  if (!ctx) {
    return res.status(403).json({
      error: 'Contexto não carregado',
      code: 'THIRD_PARTY_CONTEXT_MISSING'
    });
  }
  
  if (ctx.allowedZones.length === 0) {
    return next();
  }
  
  const requestedZoneId = req.params.zoneId || req.body.zoneId || req.query.zoneId;
  
  if (requestedZoneId && !ctx.allowedZones.includes(requestedZoneId)) {
    console.warn(`[THIRD_PARTY_ISOLATION] ❌ Tentativa de acesso a zona não autorizada:`, {
      userId: user.id,
      userName: user.name,
      requestedZone: requestedZoneId,
      allowedZones: ctx.allowedZones
    });
    
    return res.status(403).json({
      error: 'Acesso negado',
      message: 'Você não tem permissão para acessar esta zona.',
      code: 'ZONE_ACCESS_DENIED'
    });
  }
  
  next();
}

export async function getFilteredSitesForThirdParty(
  customerId: string,
  ctx: ThirdPartyContext | undefined,
  module?: string
): Promise<any[]> {
  let query = db
    .select()
    .from(sites)
    .where(
      and(
        eq(sites.customerId, customerId),
        eq(sites.isActive, true),
        module ? eq(sites.module, module as any) : undefined
      )
    );
  
  const allSites = await query;
  
  if (!ctx || ctx.allowedSites.length === 0) {
    return allSites;
  }
  
  return allSites.filter(site => ctx.allowedSites.includes(site.id));
}

export async function getFilteredZonesForThirdParty(
  customerId: string,
  ctx: ThirdPartyContext | undefined,
  siteId?: string,
  module?: string
): Promise<any[]> {
  const filteredSites = await getFilteredSitesForThirdParty(customerId, ctx, module);
  const allowedSiteIds = filteredSites.map(s => s.id);
  
  if (allowedSiteIds.length === 0) {
    return [];
  }
  
  let allZones = await db
    .select()
    .from(zones)
    .where(
      and(
        inArray(zones.siteId, allowedSiteIds),
        eq(zones.isActive, true),
        siteId ? eq(zones.siteId, siteId) : undefined
      )
    );
  
  if (!ctx || ctx.allowedZones.length === 0) {
    return allZones;
  }
  
  return allZones.filter(zone => ctx.allowedZones.includes(zone.id));
}

export async function getFilteredEquipmentForThirdParty(
  customerId: string,
  ctx: ThirdPartyContext | undefined,
  siteId?: string,
  zoneId?: string
): Promise<any[]> {
  const filteredZones = await getFilteredZonesForThirdParty(customerId, ctx, siteId);
  const allowedZoneIds = filteredZones.map(z => z.id);
  
  if (allowedZoneIds.length === 0) {
    return [];
  }
  
  let allEquipment = await db
    .select()
    .from(equipment)
    .where(
      and(
        inArray(equipment.zoneId, allowedZoneIds),
        eq(equipment.isActive, true),
        zoneId ? eq(equipment.zoneId, zoneId) : undefined
      )
    );
  
  if (!ctx) {
    return allEquipment;
  }
  
  if (ctx.assetVisibilityMode === 'ALL') {
    return allEquipment;
  }
  
  return allEquipment.filter(eq => {
    const contractedIds = (eq as any).contractedThirdPartyIds as string[] | null;
    if (!contractedIds || contractedIds.length === 0) {
      return false;
    }
    return contractedIds.includes(ctx.companyId);
  });
}

export function canAccessSite(ctx: ThirdPartyContext | undefined, siteId: string): boolean {
  if (!ctx) return true;
  if (ctx.allowedSites.length === 0) return true;
  return ctx.allowedSites.includes(siteId);
}

export function canAccessZone(ctx: ThirdPartyContext | undefined, zoneId: string): boolean {
  if (!ctx) return true;
  if (ctx.allowedZones.length === 0) return true;
  return ctx.allowedZones.includes(zoneId);
}

export function canAccessEquipment(
  ctx: ThirdPartyContext | undefined,
  equipmentContractedIds: string[] | null
): boolean {
  if (!ctx) return true;
  
  if (ctx.assetVisibilityMode === 'ALL') {
    return true;
  }
  
  if (!equipmentContractedIds || equipmentContractedIds.length === 0) {
    return false;
  }
  
  return equipmentContractedIds.includes(ctx.companyId);
}

export async function validateThirdPartyDataAccess(
  user: SessionUser,
  ctx: ThirdPartyContext | undefined,
  resource: {
    customerId?: string;
    siteId?: string;
    zoneId?: string;
    equipmentContractedIds?: string[] | null;
  }
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.userType !== 'third_party_user') {
    return { allowed: true };
  }
  
  if (!ctx) {
    return { allowed: false, reason: 'Contexto de terceiro não carregado' };
  }
  
  if (resource.customerId && resource.customerId !== ctx.customerId) {
    return { allowed: false, reason: 'Cliente não autorizado' };
  }
  
  if (resource.siteId && !canAccessSite(ctx, resource.siteId)) {
    return { allowed: false, reason: 'Local não autorizado' };
  }
  
  if (resource.zoneId && !canAccessZone(ctx, resource.zoneId)) {
    return { allowed: false, reason: 'Zona não autorizada' };
  }
  
  if (resource.equipmentContractedIds !== undefined) {
    if (!canAccessEquipment(ctx, resource.equipmentContractedIds)) {
      return { allowed: false, reason: 'Ativo não autorizado (fora do contrato)' };
    }
  }
  
  return { allowed: true };
}

export function applyThirdPartyIsolation() {
  return [loadThirdPartyContext, validateThirdPartyCustomerAccess];
}

export function applyFullThirdPartyIsolation() {
  return [
    loadThirdPartyContext,
    validateThirdPartyCustomerAccess,
    validateThirdPartySiteAccess,
    validateThirdPartyZoneAccess
  ];
}
