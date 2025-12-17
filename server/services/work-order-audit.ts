import { storage } from "../storage";
import { nanoid } from "nanoid";
import type { WorkOrderAuditAction, User, WorkOrder, Customer } from "@shared/schema";

interface AuditContext {
  user?: User | null;
  ipAddress?: string;
  userAgent?: string;
  source?: 'web' | 'mobile' | 'api' | 'system';
}

interface AuditLogParams {
  workOrderId: string;
  action: WorkOrderAuditAction;
  previousValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  description?: string;
  context: AuditContext;
}

class WorkOrderAuditService {
  async log(params: AuditLogParams): Promise<void> {
    const { workOrderId, action, previousValue, newValue, description, context } = params;
    
    try {
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        console.error(`[AUDIT] Work order ${workOrderId} not found`);
        return;
      }

      let customer: Customer | undefined;
      if (workOrder.customerId) {
        customer = await storage.getCustomer(workOrder.customerId);
      }

      let thirdPartyCompanyName: string | undefined;
      if (workOrder.thirdPartyCompanyId) {
        const thirdPartyCompany = await storage.getThirdPartyCompany(workOrder.thirdPartyCompanyId);
        thirdPartyCompanyName = thirdPartyCompany?.name;
      }

      await storage.createWorkOrderAuditLog({
        id: nanoid(),
        workOrderId,
        action,
        userId: context.user?.id ?? null,
        userType: context.user?.userType ?? null,
        userName: context.user?.name ?? 'Sistema',
        customerId: workOrder.customerId ?? null,
        customerName: customer?.name ?? null,
        thirdPartyCompanyId: workOrder.thirdPartyCompanyId ?? null,
        thirdPartyCompanyName: thirdPartyCompanyName ?? null,
        previousValue: previousValue ?? null,
        newValue: newValue ?? null,
        description: description ?? this.getDefaultDescription(action),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        source: context.source ?? 'web',
      });

      console.log(`[AUDIT] ${action} logged for work order ${workOrderId} by ${context.user?.name ?? 'Sistema'}`);
    } catch (error) {
      console.error(`[AUDIT] Failed to log ${action} for work order ${workOrderId}:`, error);
    }
  }

  async logCreation(workOrderId: string, workOrder: Partial<WorkOrder>, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'CREATED',
      newValue: this.sanitizeWorkOrder(workOrder),
      description: `Ordem de serviço #${workOrder.number} criada`,
      context,
    });
  }

  async logUpdate(workOrderId: string, previousValue: Partial<WorkOrder>, newValue: Partial<WorkOrder>, context: AuditContext): Promise<void> {
    const changes = this.getChanges(previousValue, newValue);
    if (Object.keys(changes.changed).length === 0) return;

    await this.log({
      workOrderId,
      action: 'UPDATED',
      previousValue: changes.previous,
      newValue: changes.changed,
      description: `Campos alterados: ${Object.keys(changes.changed).join(', ')}`,
      context,
    });
  }

  async logStatusChange(workOrderId: string, previousStatus: string, newStatus: string, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'STATUS_CHANGED',
      previousValue: { status: previousStatus },
      newValue: { status: newStatus },
      description: `Status alterado de "${this.translateStatus(previousStatus)}" para "${this.translateStatus(newStatus)}"`,
      context,
    });
  }

  async logAssignment(workOrderId: string, assignedTo: { userId?: string; userName?: string; thirdPartyId?: string; thirdPartyName?: string }, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'ASSIGNED',
      newValue: assignedTo,
      description: assignedTo.userName 
        ? `Atribuída ao operador ${assignedTo.userName}`
        : assignedTo.thirdPartyName 
          ? `Atribuída ao terceiro ${assignedTo.thirdPartyName}`
          : 'Atribuição realizada',
      context,
    });
  }

  async logExecutionStarted(workOrderId: string, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'EXECUTION_STARTED',
      newValue: { startedAt: new Date().toISOString() },
      description: 'Execução iniciada',
      context,
    });
  }

  async logExecutionPaused(workOrderId: string, reason?: string, context?: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'EXECUTION_PAUSED',
      newValue: { pausedAt: new Date().toISOString(), reason },
      description: reason ? `Execução pausada: ${reason}` : 'Execução pausada',
      context: context ?? { source: 'system' },
    });
  }

  async logExecutionResumed(workOrderId: string, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'EXECUTION_RESUMED',
      newValue: { resumedAt: new Date().toISOString() },
      description: 'Execução retomada',
      context,
    });
  }

  async logCompleted(workOrderId: string, completionData: Record<string, any>, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'COMPLETED',
      newValue: { completedAt: new Date().toISOString(), ...completionData },
      description: 'Ordem de serviço concluída',
      context,
    });
  }

  async logEvaluated(workOrderId: string, evaluation: { rating?: number; comment?: string; evaluatorType: string }, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'EVALUATED',
      newValue: evaluation,
      description: evaluation.rating 
        ? `Avaliada com nota ${evaluation.rating}/10` 
        : 'Avaliação registrada',
      context,
    });
  }

  async logCommented(workOrderId: string, comment: { text: string; isReopenRequest?: boolean }, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'COMMENTED',
      newValue: { comment: comment.text.substring(0, 200), isReopenRequest: comment.isReopenRequest },
      description: comment.isReopenRequest 
        ? 'Solicitação de reabertura enviada' 
        : 'Comentário adicionado',
      context,
    });
  }

  async logReopened(workOrderId: string, reason: string, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'REOPENED',
      newValue: { reason, reopenedAt: new Date().toISOString() },
      description: `Ordem de serviço reaberta: ${reason.substring(0, 100)}`,
      context,
    });
  }

  async logCancelled(workOrderId: string, reason?: string, context?: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'CANCELLED',
      newValue: { cancelledAt: new Date().toISOString(), reason },
      description: reason ? `Cancelada: ${reason}` : 'Ordem de serviço cancelada',
      context: context ?? { source: 'system' },
    });
  }

  async logApproved(workOrderId: string, approvalType: string, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'APPROVED',
      newValue: { approvalType, approvedAt: new Date().toISOString() },
      description: `Aprovação: ${approvalType}`,
      context,
    });
  }

  async logRejected(workOrderId: string, rejectionType: string, reason?: string, context?: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'REJECTED',
      newValue: { rejectionType, reason, rejectedAt: new Date().toISOString() },
      description: reason ? `Recusado (${rejectionType}): ${reason}` : `Recusado: ${rejectionType}`,
      context: context ?? { source: 'system' },
    });
  }

  async logAttachmentAdded(workOrderId: string, attachmentInfo: { filename?: string; type?: string }, context: AuditContext): Promise<void> {
    await this.log({
      workOrderId,
      action: 'ATTACHMENT_ADDED',
      newValue: attachmentInfo,
      description: attachmentInfo.filename 
        ? `Anexo adicionado: ${attachmentInfo.filename}` 
        : 'Anexo adicionado',
      context,
    });
  }

  private getDefaultDescription(action: WorkOrderAuditAction): string {
    const descriptions: Record<WorkOrderAuditAction, string> = {
      'CREATED': 'Ordem de serviço criada',
      'UPDATED': 'Ordem de serviço atualizada',
      'STATUS_CHANGED': 'Status alterado',
      'ASSIGNED': 'Atribuição realizada',
      'APPROVED': 'Aprovado',
      'REJECTED': 'Recusado',
      'EXECUTION_STARTED': 'Execução iniciada',
      'EXECUTION_PAUSED': 'Execução pausada',
      'EXECUTION_RESUMED': 'Execução retomada',
      'COMPLETED': 'Concluído',
      'EVALUATED': 'Avaliado',
      'COMMENTED': 'Comentário adicionado',
      'ATTACHMENT_ADDED': 'Anexo adicionado',
      'REOPENED': 'Reaberto',
      'CANCELLED': 'Cancelado',
    };
    return descriptions[action] || action;
  }

  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'aberta': 'Aberta',
      'em_execucao': 'Em Execução',
      'pausada': 'Pausada',
      'vencida': 'Vencida',
      'concluida': 'Concluída',
      'cancelada': 'Cancelada',
    };
    return translations[status] || status;
  }

  private sanitizeWorkOrder(wo: Partial<WorkOrder>): Record<string, any> {
    const { ...safe } = wo;
    return safe as Record<string, any>;
  }

  private getChanges(previous: Partial<WorkOrder>, current: Partial<WorkOrder>): { previous: Record<string, any>; changed: Record<string, any> } {
    const changed: Record<string, any> = {};
    const previousValues: Record<string, any> = {};

    const keysToCheck = Object.keys(current) as (keyof WorkOrder)[];
    for (const key of keysToCheck) {
      if (key === 'updatedAt') continue;
      
      const prevVal = previous[key];
      const currVal = current[key];
      
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        changed[key] = currVal;
        previousValues[key] = prevVal;
      }
    }

    return { previous: previousValues, changed };
  }
}

export const workOrderAuditService = new WorkOrderAuditService();
