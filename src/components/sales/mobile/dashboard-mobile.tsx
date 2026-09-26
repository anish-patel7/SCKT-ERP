import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useLocaleFormatting } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, TrendingUp, Users, Package, DollarSign } from 'lucide-react';

interface MetricProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down';
    percent: number;
  };
}

function MetricCard({ label, value, subtext, icon, trend }: MetricProps) {
  return (
    <Card className="p-4 bg-white border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-600 mb-1">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <TrendingUp
            className={`w-3 h-3 ${trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}
            style={{ transform: trend.direction === 'down' ? 'rotate(180deg)' : 'none' }}
          />
          <span className={`text-xs font-semibold ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend.percent}%
          </span>
        </div>
      )}
    </Card>
  );
}

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, badge, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border border-gray-200 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            {badge && (
              <Badge variant="secondary" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-gray-200 p-4">
          {children}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface OrderStatus {
  status: string;
  count: number;
  percentage: number;
}

interface SalesMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingOrders: number;
  ordersByStatus: OrderStatus[];
  topCustomers: Array<{ name: string; revenue: number; orders: number }>;
  recentOrders: Array<{ orderNo: string; customer: string; amount: number; status: string }>;
}

export function DashboardMobile({ metrics }: { metrics: SalesMetrics }) {
  const { t } = useLanguage();
  const { formatCurrency, formatNumber } = useLocaleFormatting();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold">{t('analytics.dashboard') || 'Dashboard'}</h1>
        <p className="text-xs text-gray-600 mt-1">
          {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Main Metrics Grid */}
      <div className="space-y-3 p-4">
        <MetricCard
          label={t('analytics.total_orders') || 'Total Orders'}
          value={metrics.totalOrders}
          icon={<Package className="w-5 h-5" />}
          trend={{ direction: 'up', percent: 12 }}
        />

        <MetricCard
          label={t('analytics.total_revenue') || 'Total Revenue'}
          value={formatCurrency(metrics.totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
          trend={{ direction: 'up', percent: 8 }}
        />

        <MetricCard
          label={t('analytics.average_order_value') || 'Avg Order Value'}
          value={formatCurrency(metrics.averageOrderValue)}
          icon={<TrendingUp className="w-5 h-5" />}
        />

        <MetricCard
          label={t('analytics.pending_orders') || 'Pending Orders'}
          value={metrics.pendingOrders}
          subtext={t('sales.status_allocated') || 'Awaiting shipment'}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-3 px-4 pb-4">
        {/* Orders by Status */}
        <CollapsibleSection
          title={t('sales.status') || 'Status Overview'}
          badge={metrics.ordersByStatus.length.toString()}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {metrics.ordersByStatus.map((status, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{status.status}</span>
                  <span className="text-xs font-bold">{status.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${status.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{status.percentage.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Top Customers */}
        <CollapsibleSection
          title={t('sales.customer') || 'Top Customers'}
          badge={metrics.topCustomers.length.toString()}
          defaultOpen={false}
        >
          <div className="space-y-3">
            {metrics.topCustomers.map((customer, index) => (
              <div
                key={index}
                className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold">{customer.name}</p>
                  <p className="text-xs text-gray-600">
                    {customer.orders} {t('sales.orders') || 'orders'}
                  </p>
                </div>
                <p className="text-sm font-bold text-right">{formatCurrency(customer.revenue)}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Recent Orders */}
        <CollapsibleSection
          title={t('sales.orders') || 'Recent Orders'}
          badge={metrics.recentOrders.length.toString()}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {metrics.recentOrders.map((order, index) => (
              <Card key={index} className="p-3 bg-gray-50 border-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{order.orderNo}</p>
                    <p className="text-xs text-gray-600">{order.customer}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-right text-blue-600">
                  {formatCurrency(order.amount)}
                </p>
              </Card>
            ))}
          </div>
        </CollapsibleSection>

        {/* Performance Metrics */}
        <CollapsibleSection
          title={t('analytics.fulfillment_performance') || 'Performance'}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{t('analytics.fulfillment_performance') || 'On-Time Delivery'}</span>
                <span className="text-xs font-bold">94%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{t('analytics.payment_patterns') || 'Payment Collection'}</span>
                <span className="text-xs font-bold">87%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{t('sales.customer') || 'Customer Satisfaction'}</span>
                <span className="text-xs font-bold">91%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '91%' }} />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
