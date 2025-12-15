import { db } from '../db';
import { workOrders, thirdPartyCompanies, users } from '@shared/schema';
import { eq, and, sql, gte, lte, inArray, isNotNull } from 'drizzle-orm';

export interface SLAMetrics {
  total: number;
  onTime: number;
  late: number;
  pending: number;
  slaPercentage: number;
  avgResponseTimeMinutes: number | null;
  avgCompletionTimeMinutes: number | null;
}

export interface ThirdPartySLAReport {
  companyId: string;
  companyName: string;
  metrics: SLAMetrics;
}

export interface TeamSLAReport {
  teamId: string;
  metrics: SLAMetrics;
}

export interface OperatorSLAReport {
  operatorId: string;
  operatorName: string;
  metrics: SLAMetrics;
}

function calculateSLAPercentage(onTime: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((onTime / total) * 10000) / 100;
}

function calculateAvgMinutes(totalMinutes: number | null, count: number): number | null {
  if (!totalMinutes || count === 0) return null;
  return Math.round(totalMinutes / count);
}

export async function getCustomerGeneralSLA(
  customerId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<SLAMetrics> {
  const conditions = [
    eq(workOrders.customerId, customerId),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) conditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(workOrders.createdAt, endDate));
  if (module) conditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...conditions));
  
  const stats = result[0];
  
  const pendingResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(workOrders)
    .where(and(
      eq(workOrders.customerId, customerId),
      inArray(workOrders.status, ['aberta', 'em_execucao', 'pausada']),
      module ? eq(workOrders.module, module as any) : undefined
    ));
  
  return {
    total: stats.total || 0,
    onTime: stats.onTime || 0,
    late: stats.late || 0,
    pending: pendingResult[0]?.count || 0,
    slaPercentage: calculateSLAPercentage(stats.onTime || 0, stats.total || 0),
    avgResponseTimeMinutes: calculateAvgMinutes(stats.avgResponseMinutes, stats.total || 0),
    avgCompletionTimeMinutes: calculateAvgMinutes(stats.avgCompletionMinutes, stats.total || 0)
  };
}

export async function getCustomerSLAByThirdParty(
  customerId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<ThirdPartySLAReport[]> {
  const conditions = [
    eq(workOrders.customerId, customerId),
    eq(workOrders.executedByType, 'THIRD_PARTY'),
    isNotNull(workOrders.thirdPartyCompanyId),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) conditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(workOrders.createdAt, endDate));
  if (module) conditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      companyId: workOrders.thirdPartyCompanyId,
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...conditions))
    .groupBy(workOrders.thirdPartyCompanyId);
  
  const companyIds = result.map(r => r.companyId).filter(Boolean) as string[];
  
  const companies = companyIds.length > 0 
    ? await db.select({ id: thirdPartyCompanies.id, name: thirdPartyCompanies.name })
        .from(thirdPartyCompanies)
        .where(inArray(thirdPartyCompanies.id, companyIds))
    : [];
  
  const companyMap = new Map(companies.map(c => [c.id, c.name]));
  
  return result.map(row => ({
    companyId: row.companyId!,
    companyName: companyMap.get(row.companyId!) || 'Empresa Desconhecida',
    metrics: {
      total: row.total || 0,
      onTime: row.onTime || 0,
      late: row.late || 0,
      pending: 0,
      slaPercentage: calculateSLAPercentage(row.onTime || 0, row.total || 0),
      avgResponseTimeMinutes: calculateAvgMinutes(row.avgResponseMinutes, row.total || 0),
      avgCompletionTimeMinutes: calculateAvgMinutes(row.avgCompletionMinutes, row.total || 0)
    }
  }));
}

export async function getCustomerInternalVsThirdPartySLA(
  customerId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<{ internal: SLAMetrics; thirdParty: SLAMetrics }> {
  const baseConditions = [
    eq(workOrders.customerId, customerId),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) baseConditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) baseConditions.push(lte(workOrders.createdAt, endDate));
  if (module) baseConditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      executedByType: workOrders.executedByType,
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...baseConditions))
    .groupBy(workOrders.executedByType);
  
  const internalRow = result.find(r => r.executedByType === 'INTERNAL' || r.executedByType === null);
  const thirdPartyRow = result.find(r => r.executedByType === 'THIRD_PARTY');
  
  const toMetrics = (row: any): SLAMetrics => ({
    total: row?.total || 0,
    onTime: row?.onTime || 0,
    late: row?.late || 0,
    pending: 0,
    slaPercentage: calculateSLAPercentage(row?.onTime || 0, row?.total || 0),
    avgResponseTimeMinutes: calculateAvgMinutes(row?.avgResponseMinutes, row?.total || 0),
    avgCompletionTimeMinutes: calculateAvgMinutes(row?.avgCompletionMinutes, row?.total || 0)
  });
  
  return {
    internal: toMetrics(internalRow),
    thirdParty: toMetrics(thirdPartyRow)
  };
}

export async function getThirdPartyGeneralSLA(
  thirdPartyCompanyId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<SLAMetrics> {
  const conditions = [
    eq(workOrders.thirdPartyCompanyId, thirdPartyCompanyId),
    eq(workOrders.executedByType, 'THIRD_PARTY'),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) conditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(workOrders.createdAt, endDate));
  if (module) conditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...conditions));
  
  const stats = result[0];
  
  const pendingResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(workOrders)
    .where(and(
      eq(workOrders.thirdPartyCompanyId, thirdPartyCompanyId),
      eq(workOrders.executedByType, 'THIRD_PARTY'),
      inArray(workOrders.status, ['aberta', 'em_execucao', 'pausada'])
    ));
  
  return {
    total: stats.total || 0,
    onTime: stats.onTime || 0,
    late: stats.late || 0,
    pending: pendingResult[0]?.count || 0,
    slaPercentage: calculateSLAPercentage(stats.onTime || 0, stats.total || 0),
    avgResponseTimeMinutes: calculateAvgMinutes(stats.avgResponseMinutes, stats.total || 0),
    avgCompletionTimeMinutes: calculateAvgMinutes(stats.avgCompletionMinutes, stats.total || 0)
  };
}

export async function getThirdPartySLAByTeam(
  thirdPartyCompanyId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<TeamSLAReport[]> {
  const conditions = [
    eq(workOrders.thirdPartyCompanyId, thirdPartyCompanyId),
    eq(workOrders.executedByType, 'THIRD_PARTY'),
    isNotNull(workOrders.thirdPartyTeamId),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) conditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(workOrders.createdAt, endDate));
  if (module) conditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      teamId: workOrders.thirdPartyTeamId,
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...conditions))
    .groupBy(workOrders.thirdPartyTeamId);
  
  return result.map(row => ({
    teamId: row.teamId!,
    metrics: {
      total: row.total || 0,
      onTime: row.onTime || 0,
      late: row.late || 0,
      pending: 0,
      slaPercentage: calculateSLAPercentage(row.onTime || 0, row.total || 0),
      avgResponseTimeMinutes: calculateAvgMinutes(row.avgResponseMinutes, row.total || 0),
      avgCompletionTimeMinutes: calculateAvgMinutes(row.avgCompletionMinutes, row.total || 0)
    }
  }));
}

export async function getThirdPartySLAByOperator(
  thirdPartyCompanyId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
): Promise<OperatorSLAReport[]> {
  const conditions = [
    eq(workOrders.thirdPartyCompanyId, thirdPartyCompanyId),
    eq(workOrders.executedByType, 'THIRD_PARTY'),
    isNotNull(workOrders.thirdPartyOperatorId),
    inArray(workOrders.status, ['concluida', 'vencida'])
  ];
  
  if (startDate) conditions.push(gte(workOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(workOrders.createdAt, endDate));
  if (module) conditions.push(eq(workOrders.module, module as any));
  
  const result = await db
    .select({
      operatorId: workOrders.thirdPartyOperatorId,
      total: sql<number>`COUNT(*)::int`,
      onTime: sql<number>`COUNT(*) FILTER (WHERE status = 'concluida' AND (due_date IS NULL OR completed_at <= due_date))::int`,
      late: sql<number>`COUNT(*) FILTER (WHERE status = 'vencida' OR (status = 'concluida' AND due_date IS NOT NULL AND completed_at > due_date))::int`,
      avgResponseMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) FILTER (WHERE started_at IS NOT NULL)`,
      avgCompletionMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)`
    })
    .from(workOrders)
    .where(and(...conditions))
    .groupBy(workOrders.thirdPartyOperatorId);
  
  const operatorIds = result.map(r => r.operatorId).filter(Boolean) as string[];
  
  const operators = operatorIds.length > 0
    ? await db.select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, operatorIds))
    : [];
  
  const operatorMap = new Map(operators.map(o => [o.id, o.name]));
  
  return result.map(row => ({
    operatorId: row.operatorId!,
    operatorName: operatorMap.get(row.operatorId!) || 'Operador Desconhecido',
    metrics: {
      total: row.total || 0,
      onTime: row.onTime || 0,
      late: row.late || 0,
      pending: 0,
      slaPercentage: calculateSLAPercentage(row.onTime || 0, row.total || 0),
      avgResponseTimeMinutes: calculateAvgMinutes(row.avgResponseMinutes, row.total || 0),
      avgCompletionTimeMinutes: calculateAvgMinutes(row.avgCompletionMinutes, row.total || 0)
    }
  }));
}

export async function getThirdPartyDashboardSummary(
  thirdPartyCompanyId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
) {
  const [generalSLA, byTeam, byOperator] = await Promise.all([
    getThirdPartyGeneralSLA(thirdPartyCompanyId, startDate, endDate, module),
    getThirdPartySLAByTeam(thirdPartyCompanyId, startDate, endDate, module),
    getThirdPartySLAByOperator(thirdPartyCompanyId, startDate, endDate, module)
  ]);
  
  return {
    general: generalSLA,
    byTeam,
    byOperator,
    generatedAt: new Date().toISOString()
  };
}

export async function getCustomerThirdPartyDashboardSummary(
  customerId: string,
  startDate?: Date,
  endDate?: Date,
  module?: string
) {
  const [generalSLA, internalVsThirdParty, byThirdParty] = await Promise.all([
    getCustomerGeneralSLA(customerId, startDate, endDate, module),
    getCustomerInternalVsThirdPartySLA(customerId, startDate, endDate, module),
    getCustomerSLAByThirdParty(customerId, startDate, endDate, module)
  ]);
  
  return {
    general: generalSLA,
    comparison: internalVsThirdParty,
    byThirdParty,
    generatedAt: new Date().toISOString()
  };
}
