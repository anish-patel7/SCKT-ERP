import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

// Report filter schema
const FilterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'between']),
  value: z.any(),
});

const ColumnSelectionSchema = z.object({
  field: z.string(),
  label: z.string(),
  visible: z.boolean().default(true),
  width: z.number().optional(),
});

const AggregationSchema = z.object({
  field: z.string(),
  type: z.enum(['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'STDDEV']),
  label: z.string(),
});

const ReportTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  table: z.string(),  // 'sales_orders', 'sales_invoices', etc.
  filters: z.array(FilterConditionSchema).default([]),
  columns: z.array(ColumnSelectionSchema),
  sort_by: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })).default([]),
  grouping: z.array(z.string()).default([]),
  aggregations: z.array(AggregationSchema).default([]),
  scheduled: z.boolean().default(false),
  schedule_cron: z.string().optional(),
  export_format: z.enum(['pdf', 'excel', 'csv']).default('csv'),
  recipients: z.array(z.string().email()).default([]),
});

type ReportTemplate = z.infer<typeof ReportTemplateSchema>;
type FilterCondition = z.infer<typeof FilterConditionSchema>;

export interface ReportData {
  columns: Array<{ field: string; label: string }>;
  rows: Record<string, any>[];
  summary?: {
    total_rows: number;
    aggregations: Record<string, number>;
  };
  execution_time_ms: number;
}

export interface ReportExecution {
  id: string;
  template_id: string;
  executed_by: string;
  result_rows: number;
  execution_time_ms: number;
  executed_at: string;
  file_url?: string;
}

export const customReportingService = {
  /**
   * Create a new report template
   */
  async createTemplate(template: any): Promise<string> {
    const validated = ReportTemplateSchema.parse(template);
    const { data, error } = await supabase
      .from('report_templates')
      .insert([
        {
          ...validated,
          created_by: (await this.getAuthUser()).email,
          config: {
            filters: validated.filters,
            columns: validated.columns,
            sort_by: validated.sort_by,
            grouping: validated.grouping,
            aggregations: validated.aggregations,
          },
        },
      ])
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data.id;
  },

  /**
   * Get all report templates
   */
  async getTemplates(limit: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data || [];
  },

  /**
   * Get single template
   */
  async getTemplate(templateId: string): Promise<any> {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw new Error(`Template not found: ${error.message}`);
    return data;
  },

  /**
   * Update report template
   */
  async updateTemplate(templateId: string, updates: any): Promise<void> {
    const { error } = await supabase
      .from('report_templates')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('id', templateId);

    if (error) throw new Error(`Failed to update template: ${error.message}`);
  },

  /**
   * Delete report template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase.from('report_templates').delete().eq('id', templateId);

    if (error) throw new Error(`Failed to delete template: ${error.message}`);
  },

  /**
   * Execute report and return data
   */
  async executeReport(templateId: string): Promise<ReportData> {
    const template = await this.getTemplate(templateId);
    const startTime = Date.now();

    // Build dynamic query
    let query = supabase.from(template.table).select('*');

    // Apply filters
    if (template.config?.filters && template.config.filters.length > 0) {
      for (const filter of template.config.filters) {
        query = this.applyFilter(query, filter);
      }
    }

    // Execute query
    const { data, error } = await query;
    if (error) throw new Error(`Report execution failed: ${error.message}`);

    const rows = data || [];
    const executionTime = Date.now() - startTime;

    // Calculate aggregations
    let aggregations: Record<string, number> = {};
    if (template.config?.aggregations && template.config.aggregations.length > 0) {
      aggregations = this.calculateAggregations(rows, template.config.aggregations);
    }

    // Log execution
    await this.logExecution({
      template_id: templateId,
      result_rows: rows.length,
      execution_time_ms: executionTime,
    });

    return {
      columns: template.config?.columns || [],
      rows,
      summary: {
        total_rows: rows.length,
        aggregations,
      },
      execution_time_ms: executionTime,
    };
  },

  /**
   * Export report to file
   */
  async exportReport(
    reportData: ReportData,
    format: 'csv' | 'excel' | 'pdf'
  ): Promise<Blob> {
    switch (format) {
      case 'csv':
        return this.exportCSV(reportData);
      case 'excel':
        return this.exportExcel(reportData);
      case 'pdf':
        return this.exportPDF(reportData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  },

  /**
   * Schedule report for recurring execution
   */
  async scheduleReport(
    templateId: string,
    cronExpression: string,
    recipients: string[]
  ): Promise<void> {
    await this.updateTemplate(templateId, {
      scheduled: true,
      schedule_cron: cronExpression,
      recipients,
    });
  },

  /**
   * Get report execution history
   */
  async getExecutionHistory(templateId: string, limit: number = 50): Promise<ReportExecution[]> {
    const { data, error } = await supabase
      .from('report_executions')
      .select('*')
      .eq('template_id', templateId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch execution history: ${error.message}`);
    return (data || []) as ReportExecution[];
  },

  /**
   * Validate report configuration
   */
  async validateConfiguration(config: any): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      ReportTemplateSchema.parse(config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  },

  // Private helper methods

  private applyFilter(query: any, filter: FilterCondition): any {
    switch (filter.operator) {
      case 'eq':
        return query.eq(filter.field, filter.value);
      case 'neq':
        return query.neq(filter.field, filter.value);
      case 'gt':
        return query.gt(filter.field, filter.value);
      case 'gte':
        return query.gte(filter.field, filter.value);
      case 'lt':
        return query.lt(filter.field, filter.value);
      case 'lte':
        return query.lte(filter.field, filter.value);
      case 'in':
        return query.in(filter.field, filter.value);
      case 'contains':
        return query.ilike(filter.field, `%${filter.value}%`);
      default:
        return query;
    }
  },

  private calculateAggregations(
    rows: any[],
    aggregations: any[]
  ): Record<string, number> {
    const results: Record<string, number> = {};

    for (const agg of aggregations) {
      const values = rows.map((r) => r[agg.field]).filter((v) => v != null && !isNaN(v));

      switch (agg.type) {
        case 'SUM':
          results[agg.label] = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'AVG':
          results[agg.label] = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
          break;
        case 'COUNT':
          results[agg.label] = values.length;
          break;
        case 'MIN':
          results[agg.label] = values.length ? Math.min(...values) : 0;
          break;
        case 'MAX':
          results[agg.label] = values.length ? Math.max(...values) : 0;
          break;
        case 'STDDEV':
          results[agg.label] = this.calculateStdDev(values);
          break;
      }
    }

    return results;
  },

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  },

  private exportCSV(reportData: ReportData): Blob {
    const headers = reportData.columns.map((c) => c.label).join(',');
    const rows = reportData.rows.map((row) =>
      reportData.columns.map((col) => {
        const value = row[col.field];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  },

  private exportExcel(reportData: ReportData): Blob {
    // Using a simple CSV export as fallback (Excel plugin would be added separately)
    return this.exportCSV(reportData);
  },

  private exportPDF(reportData: ReportData): Blob {
    // PDF generation would use a library like pdfkit
    // For now, returning CSV as fallback
    return this.exportCSV(reportData);
  },

  private async logExecution(execution: Omit<ReportExecution, 'id' | 'executed_by' | 'executed_at'>) {
    const { error } = await supabase.from('report_executions').insert([
      {
        ...execution,
        executed_by: (await this.getAuthUser()).email,
        executed_at: new Date(),
      },
    ]);

    if (error) {
      console.error('Failed to log report execution:', error);
    }
  },

  private async getAuthUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    return session.user;
  },
};
