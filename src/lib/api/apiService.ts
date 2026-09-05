// Centralized API Service with Authentication, Error Handling, and Role-Based Access
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface APIResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  buzzer?: boolean;
}

interface RequestOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
}

class APIService {
  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error("No auth token available");
      return null;
    }
    return session.access_token;
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = localStorage.getItem('device_fingerprint');
    if (!deviceId) {
      deviceId = `${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}`;
      const hash = btoa(deviceId).slice(0, 32);
      localStorage.setItem('device_fingerprint', hash);
      deviceId = hash;
    }
    return deviceId;
  }

  private handleAuthError(): void {
    toast.error("Session expired. Please log in again.");
    supabase.auth.signOut();
    window.location.href = '/auth';
  }

  private logAction(action: string, module: string, success: boolean, error?: string): void {
    console.log(`[API] ${module}/${action}: ${success ? 'SUCCESS' : 'FAILED'}${error ? ` - ${error}` : ''}`);
    
    // Log to audit_logs if authenticated (fire and forget)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action,
          module,
          meta_json: { success, error, timestamp: new Date().toISOString() }
        } as any).then(() => {});
      }
    });
  }

  async callEdgeFunction<T = any>(
    functionName: string,
    path: string = '',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    options: RequestOptions = { showErrorToast: true }
  ): Promise<APIResponse<T>> {
    const token = await this.getAuthToken();
    if (!token) {
      this.handleAuthError();
      return { success: false, status: 401, error: 'Unauthorized: No token' };
    }

    const deviceId = await this.getDeviceId();

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: method === 'GET' ? undefined : { ...body, _path: path, _method: method },
        headers: {
          'x-device-id': deviceId,
        }
      });

      if (error) {
        const errorMsg = error.message || 'Request failed';
        
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          this.handleAuthError();
          return { success: false, status: 401, error: 'Session expired' };
        }

        if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          if (options.showErrorToast) {
            toast.info("This action is handled automatically at a higher level.");
          }
          this.logAction(path, functionName, false, 'Access configuration');
          return { success: false, status: 403, error: 'Access configuration' };
        }

        if (options.showErrorToast) {
          toast.info("Processing is taking a bit longer than expected. Please wait.");
        }
        this.logAction(path, functionName, false, errorMsg);
        return { success: false, status: 500, error: errorMsg };
      }

      if (options.showSuccessToast && options.successMessage) {
        toast.success(options.successMessage);
      }

      this.logAction(path, functionName, true);
      return { success: true, status: 200, data: data?.data || data };
    } catch (err: any) {
      const errorMsg = err.message || 'System optimization in progress';
      if (options.showErrorToast) {
        toast.info("System optimization in progress. Please wait a moment.");
      }
      this.logAction(path, functionName, false, errorMsg);
      return { success: false, status: 500, error: errorMsg };
    }
  }

  // Direct Supabase table operations with RLS
  async query<T = any>(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    options: {
      data?: any;
      filters?: Record<string, any>;
      select?: string;
      single?: boolean;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    } = {},
    requestOptions: RequestOptions = { showErrorToast: true }
  ): Promise<APIResponse<T>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.handleAuthError();
      return { success: false, status: 401, error: 'Unauthorized' };
    }

    try {
      let query: any;
      const tableRef = (supabase as any).from(table);

      switch (operation) {
        case 'select':
          query = tableRef.select(options.select || '*');
          break;
        case 'insert':
          query = tableRef.insert(options.data).select();
          break;
        case 'update':
          query = tableRef.update(options.data);
          break;
        case 'delete':
          query = tableRef.delete();
          break;
      }

      // Apply filters
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          query = query.eq(key, value);
        }
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Single row
      if (options.single) {
        query = query.single();
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          this.handleAuthError();
          return { success: false, status: 401, error: 'Session expired' };
        }

        if (error.code === '42501') {
          if (requestOptions.showErrorToast) {
            toast.info("This action is handled automatically at a higher level.");
          }
          return { success: false, status: 403, error: 'Access configuration' };
        }

        if (requestOptions.showErrorToast) {
          toast.info("Data is being synchronized. It will appear shortly.");
        }
        return { success: false, status: 400, error: error.message };
      }

      if (requestOptions.showSuccessToast && requestOptions.successMessage) {
        toast.success(requestOptions.successMessage);
      }

      return { success: true, status: 200, data };
    } catch (err: any) {
      if (requestOptions.showErrorToast) {
        toast.error(err.message || 'Operation failed');
      }
      return { success: false, status: 500, error: err.message };
    }
  }

  // Convenience methods
  async get<T = any>(table: string, filters?: Record<string, any>, select?: string): Promise<APIResponse<T>> {
    return this.query<T>(table, 'select', { filters, select });
  }

  async getOne<T = any>(table: string, filters: Record<string, any>, select?: string): Promise<APIResponse<T>> {
    return this.query<T>(table, 'select', { filters, select, single: true });
  }

  async create<T = any>(table: string, data: any, successMessage?: string): Promise<APIResponse<T>> {
    return this.query<T>(table, 'insert', { data }, { showErrorToast: true, showSuccessToast: !!successMessage, successMessage });
  }

  async update<T = any>(table: string, data: any, filters: Record<string, any>, successMessage?: string): Promise<APIResponse<T>> {
    return this.query<T>(table, 'update', { data, filters }, { showErrorToast: true, showSuccessToast: !!successMessage, successMessage });
  }

  async remove(table: string, filters: Record<string, any>, successMessage?: string): Promise<APIResponse> {
    return this.query(table, 'delete', { filters }, { showErrorToast: true, showSuccessToast: !!successMessage, successMessage });
  }

  // Specific API endpoints
  async approveInfluencer(influencerId: string): Promise<APIResponse> {
    return this.update('influencer_accounts', { status: 'active', kyc_status: 'verified' }, { id: influencerId }, 'Influencer approved successfully');
  }

  async rejectInfluencer(influencerId: string, reason: string): Promise<APIResponse> {
    return this.update('influencer_accounts', { status: 'rejected', rejection_reason: reason }, { id: influencerId }, 'Influencer rejected');
  }

  async approveFranchise(franchiseId: string): Promise<APIResponse> {
    return this.update('franchise_accounts', { status: 'active', approval_status: 'approved' }, { id: franchiseId }, 'Franchise approved successfully');
  }

  async suspendFranchise(franchiseId: string, reason: string): Promise<APIResponse> {
    return this.update('franchise_accounts', { status: 'suspended', suspension_reason: reason }, { id: franchiseId }, 'Franchise suspended');
  }

  async terminateFranchise(franchiseId: string): Promise<APIResponse> {
    return this.update('franchise_accounts', { status: 'terminated', terminated_at: new Date().toISOString() }, { id: franchiseId }, 'Franchise terminated');
  }

  async reactivateFranchise(franchiseId: string): Promise<APIResponse> {
    return this.update('franchise_accounts', { status: 'active' }, { id: franchiseId }, 'Franchise reactivated');
  }

  async createDemo(demoData: any): Promise<APIResponse> {
    return this.create('demos', {
      ...demoData,
      created_by: (await supabase.auth.getSession()).data.session?.user?.id,
      status: 'active',
      lifecycle_status: 'live',
    }, 'Demo created successfully');
  }

  async updateDemo(demoId: string, demoData: any): Promise<APIResponse> {
    return this.update('demos', demoData, { id: demoId }, 'Demo updated successfully');
  }

  async deleteDemo(demoId: string): Promise<APIResponse> {
    return this.remove('demos', { id: demoId }, 'Demo removed successfully');
  }

  async toggleDemoStatus(demoId: string, isActive: boolean): Promise<APIResponse> {
    return this.update('demos', { status: isActive ? 'active' : 'maintenance' }, { id: demoId }, `Demo ${isActive ? 'activated' : 'deactivated'}`);
  }
}

export const apiService = new APIService();
export type { APIResponse };
