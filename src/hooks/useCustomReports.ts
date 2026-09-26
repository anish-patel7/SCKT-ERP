import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customReportingService } from '@/services/customReporting';

export function useReportTemplates(limit: number = 100) {
  return useQuery({
    queryKey: ['report_templates', limit],
    queryFn: () => customReportingService.getTemplates(limit),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useReportTemplate(templateId: string) {
  return useQuery({
    queryKey: ['report_template', templateId],
    queryFn: () => customReportingService.getTemplate(templateId),
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: any) => customReportingService.createTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_templates'] });
    },
  });
}

export function useUpdateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, updates }: { templateId: string; updates: any }) =>
      customReportingService.updateTemplate(templateId, updates),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['report_template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['report_templates'] });
    },
  });
}

export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => customReportingService.deleteTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_templates'] });
    },
  });
}

export function useExecuteReport(templateId: string) {
  return useMutation({
    mutationFn: () => customReportingService.executeReport(templateId),
    retry: false,
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: ({
      reportData,
      format,
    }: {
      reportData: any;
      format: 'csv' | 'excel' | 'pdf';
    }) => customReportingService.exportReport(reportData, format),
  });
}

export function useScheduleReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      cronExpression,
      recipients,
    }: {
      templateId: string;
      cronExpression: string;
      recipients: string[];
    }) => customReportingService.scheduleReport(templateId, cronExpression, recipients),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['report_template', templateId] });
    },
  });
}

export function useReportExecutionHistory(templateId: string, limit: number = 50) {
  return useQuery({
    queryKey: ['report_executions', templateId, limit],
    queryFn: () => customReportingService.getExecutionHistory(templateId, limit),
    enabled: !!templateId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useValidateReportConfiguration() {
  return useMutation({
    mutationFn: (config: any) => customReportingService.validateConfiguration(config),
  });
}
