import { storage } from '../storage';
import { workOrderAuditService } from './work-order-audit';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CleanupResult {
  cancelledWorkOrders: number;
  deactivatedUsers: number;
  thirdPartyCompanyId?: string;
  customerId?: string;
}

export class ThirdPartyCleanupService {
  
  async deactivateThirdPartyCompany(
    thirdPartyCompanyId: string,
    performedBy: { id: string; name: string; userType: string },
    reason: string
  ): Promise<CleanupResult> {
    console.log(`[THIRD_PARTY_CLEANUP] Starting deactivation of company ${thirdPartyCompanyId}`);
    
    const company = await storage.getThirdPartyCompany(thirdPartyCompanyId);
    if (!company) {
      throw new Error(`Third party company ${thirdPartyCompanyId} not found`);
    }
    
    const result = await this.cleanupThirdPartyCompany(
      thirdPartyCompanyId,
      performedBy,
      `Empresa terceira desativada: ${reason}`
    );
    
    await storage.updateThirdPartyCompany(thirdPartyCompanyId, {
      status: 'inactive',
    });
    
    console.log(`[THIRD_PARTY_CLEANUP] Company ${thirdPartyCompanyId} deactivated. Cancelled ${result.cancelledWorkOrders} WOs, deactivated ${result.deactivatedUsers} users`);
    
    return {
      cancelledWorkOrders: result.cancelledWorkOrders,
      deactivatedUsers: result.deactivatedUsers,
      thirdPartyCompanyId,
      customerId: company.customerId,
    };
  }
  
  async deactivateThirdPartyModule(
    customerId: string,
    performedBy: { id: string; name: string; userType: string },
    reason: string
  ): Promise<CleanupResult> {
    console.log(`[THIRD_PARTY_CLEANUP] Disabling third-party module for customer ${customerId}`);
    
    const companies = await storage.getThirdPartyCompaniesByCustomer(customerId);
    
    let totalCancelledWOs = 0;
    let totalDeactivatedUsers = 0;
    
    for (const company of companies) {
      const result = await this.cleanupThirdPartyCompany(
        company.id,
        performedBy,
        `Módulo de terceiros desabilitado para o cliente: ${reason}`
      );
      totalCancelledWOs += result.cancelledWorkOrders;
      totalDeactivatedUsers += result.deactivatedUsers;
      
      if (company.status === 'active') {
        await storage.updateThirdPartyCompany(company.id, { status: 'inactive' });
      }
    }
    
    await storage.updateCustomer(customerId, {
      thirdPartyEnabled: false,
    });
    
    console.log(`[THIRD_PARTY_CLEANUP] Module disabled for customer ${customerId}. Total: ${totalCancelledWOs} WOs cancelled, ${totalDeactivatedUsers} users deactivated`);
    
    return {
      cancelledWorkOrders: totalCancelledWOs,
      deactivatedUsers: totalDeactivatedUsers,
      customerId,
    };
  }
  
  private async cleanupThirdPartyCompany(
    thirdPartyCompanyId: string,
    performedBy: { id: string; name: string; userType: string },
    reason: string
  ): Promise<{ cancelledWorkOrders: number; deactivatedUsers: number }> {
    const openWorkOrders = await storage.getOpenWorkOrdersByThirdParty(thirdPartyCompanyId);
    
    for (const wo of openWorkOrders) {
      await workOrderAuditService.logStatusChanged(
        wo.id,
        wo.status || 'pendente',
        'cancelada',
        `Terceiro desativado: ${reason}`,
        {
          user: { id: performedBy.id, name: performedBy.name },
          ipAddress: 'system',
          userAgent: 'ThirdPartyCleanupService',
          source: 'system',
        }
      );
    }
    
    const cancelledCount = await storage.cancelWorkOrdersByThirdParty(
      thirdPartyCompanyId,
      reason
    );
    
    const deactivatedUsers = await this.deactivateThirdPartyUsers(thirdPartyCompanyId);
    
    return {
      cancelledWorkOrders: cancelledCount,
      deactivatedUsers,
    };
  }
  
  private async deactivateThirdPartyUsers(thirdPartyCompanyId: string): Promise<number> {
    const result = await db.update(users)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.thirdPartyCompanyId, thirdPartyCompanyId))
      .returning({ id: users.id });
    
    console.log(`[THIRD_PARTY_CLEANUP] Deactivated ${result.length} users from company ${thirdPartyCompanyId}`);
    return result.length;
  }
  
  async reactivateThirdPartyCompany(thirdPartyCompanyId: string): Promise<void> {
    console.log(`[THIRD_PARTY_CLEANUP] Reactivating company ${thirdPartyCompanyId}`);
    
    await storage.updateThirdPartyCompany(thirdPartyCompanyId, {
      status: 'active',
    });
    
    console.log(`[THIRD_PARTY_CLEANUP] Company ${thirdPartyCompanyId} reactivated`);
  }
}

export const thirdPartyCleanupService = new ThirdPartyCleanupService();
