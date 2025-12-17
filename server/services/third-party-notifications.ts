import { storage } from '../storage';
import crypto from 'crypto';

export type ThirdPartyNotificationType = 
  | 'MAINTENANCE_PLAN_APPROVED'
  | 'MAINTENANCE_PLAN_REJECTED'
  | 'WORK_ORDER_ASSIGNED_TO_TEAM'
  | 'WORK_ORDER_ASSIGNED_TO_OPERATOR'
  | 'WORK_ORDER_OVERDUE';

interface NotificationPayload {
  type: ThirdPartyNotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export class ThirdPartyNotificationService {
  
  async notifyTeamLeaders(thirdPartyCompanyId: string, payload: NotificationPayload): Promise<void> {
    try {
      const users = await storage.getUsers();
      const teamLeaders = users.filter(u => 
        u.thirdPartyCompanyId === thirdPartyCompanyId && 
        (u.thirdPartyRole === 'third_party_manager' || u.thirdPartyRole === 'third_party_team_leader') &&
        u.isActive
      );

      await Promise.all(teamLeaders.map(leader => 
        this.createNotification(leader.id, payload)
      ));

      console.log(`[THIRD-PARTY-NOTIFICATION] Sent ${payload.type} to ${teamLeaders.length} team leaders of company ${thirdPartyCompanyId}`);
    } catch (error) {
      console.error('[THIRD-PARTY-NOTIFICATION] Error notifying team leaders:', error);
    }
  }

  async notifyOperator(operatorId: string, payload: NotificationPayload): Promise<void> {
    try {
      await this.createNotification(operatorId, payload);
      console.log(`[THIRD-PARTY-NOTIFICATION] Sent ${payload.type} to operator ${operatorId}`);
    } catch (error) {
      console.error('[THIRD-PARTY-NOTIFICATION] Error notifying operator:', error);
    }
  }

  async notifyTeamOperators(thirdPartyCompanyId: string, payload: NotificationPayload): Promise<void> {
    try {
      const users = await storage.getUsers();
      const operators = users.filter(u => 
        u.thirdPartyCompanyId === thirdPartyCompanyId && 
        u.thirdPartyRole === 'third_party_operator' &&
        u.isActive
      );

      await Promise.all(operators.map(op => 
        this.createNotification(op.id, payload)
      ));

      console.log(`[THIRD-PARTY-NOTIFICATION] Sent ${payload.type} to ${operators.length} operators of company ${thirdPartyCompanyId}`);
    } catch (error) {
      console.error('[THIRD-PARTY-NOTIFICATION] Error notifying team operators:', error);
    }
  }

  private async createNotification(userId: string, payload: NotificationPayload): Promise<void> {
    const notification = await storage.createNotification({
      id: crypto.randomUUID(),
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data || null,
    });

    await this.sendPushNotification(userId, payload);
  }

  private async sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.pushToken || !user.pushEnabled) {
        return;
      }

      const message = {
        to: user.pushToken,
        sound: 'default',
        title: payload.title,
        body: payload.message,
        data: payload.data || {},
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error('[PUSH] Failed to send push notification:', await response.text());
      } else {
        console.log(`[PUSH] Sent push notification to user ${userId}`);
      }
    } catch (error) {
      console.error('[PUSH] Error sending push notification:', error);
    }
  }

  async onMaintenancePlanApproved(planId: string, planName: string, thirdPartyCompanyId: string): Promise<void> {
    await this.notifyTeamLeaders(thirdPartyCompanyId, {
      type: 'MAINTENANCE_PLAN_APPROVED',
      title: 'Plano de Manutenção Aprovado',
      message: `O plano "${planName}" foi aprovado e está ativo.`,
      data: { maintenancePlanId: planId },
    });
  }

  async onMaintenancePlanRejected(planId: string, planName: string, thirdPartyCompanyId: string, reason?: string): Promise<void> {
    await this.notifyTeamLeaders(thirdPartyCompanyId, {
      type: 'MAINTENANCE_PLAN_REJECTED',
      title: 'Plano de Manutenção Rejeitado',
      message: reason ? `O plano "${planName}" foi rejeitado: ${reason}` : `O plano "${planName}" foi rejeitado.`,
      data: { maintenancePlanId: planId, reason },
    });
  }

  async onWorkOrderAssignedToTeam(
    workOrderId: string, 
    workOrderCode: string, 
    thirdPartyCompanyId: string,
    operatorId?: string
  ): Promise<void> {
    await this.notifyTeamLeaders(thirdPartyCompanyId, {
      type: 'WORK_ORDER_ASSIGNED_TO_TEAM',
      title: 'Nova OS Atribuída à Equipe',
      message: `A ordem de serviço ${workOrderCode} foi atribuída à sua equipe.`,
      data: { workOrderId, workOrderCode },
    });

    await this.notifyTeamOperators(thirdPartyCompanyId, {
      type: 'WORK_ORDER_ASSIGNED_TO_TEAM',
      title: 'Nova OS para a Equipe',
      message: `A ordem de serviço ${workOrderCode} foi atribuída à equipe.`,
      data: { workOrderId, workOrderCode },
    });

    if (operatorId) {
      await this.notifyOperator(operatorId, {
        type: 'WORK_ORDER_ASSIGNED_TO_OPERATOR',
        title: 'OS Atribuída a Você',
        message: `A ordem de serviço ${workOrderCode} foi atribuída diretamente a você.`,
        data: { workOrderId, workOrderCode },
      });
    }
  }

  async onWorkOrderAssignedToOperator(
    workOrderId: string,
    workOrderCode: string,
    operatorId: string
  ): Promise<void> {
    await this.notifyOperator(operatorId, {
      type: 'WORK_ORDER_ASSIGNED_TO_OPERATOR',
      title: 'OS Atribuída a Você',
      message: `A ordem de serviço ${workOrderCode} foi atribuída diretamente a você.`,
      data: { workOrderId, workOrderCode },
    });
  }

  async onWorkOrderOverdue(
    workOrderId: string,
    workOrderCode: string,
    thirdPartyCompanyId: string
  ): Promise<void> {
    await this.notifyTeamLeaders(thirdPartyCompanyId, {
      type: 'WORK_ORDER_OVERDUE',
      title: 'OS em Atraso',
      message: `A ordem de serviço ${workOrderCode} está em atraso e requer atenção imediata.`,
      data: { workOrderId, workOrderCode },
    });
  }
}

export const thirdPartyNotificationService = new ThirdPartyNotificationService();
