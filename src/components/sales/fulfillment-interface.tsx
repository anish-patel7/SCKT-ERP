import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFulfillment, useUpdateFulfillmentItem, useShipFulfillment } from '@/hooks/useFulfillment';
import { Package, Truck, MapPin } from 'lucide-react';

interface FulfillmentInterfaceProps {
  fulfillmentId: string;
}

export function FulfillmentInterface({ fulfillmentId }: FulfillmentInterfaceProps) {
  const { toast } = useToast();
  const { data: fulfillment, isLoading } = useFulfillment(fulfillmentId);
  const updateItem = useUpdateFulfillmentItem();
  const shipFulfillment = useShipFulfillment();
  const [selectedTab, setSelectedTab] = useState<'pick' | 'pack' | 'ship'>('pick');
  const [trackingNo, setTrackingNo] = useState('');
  const [carrier, setCarrier] = useState('');

  if (isLoading) {
    return <div className="text-center py-8">Loading fulfillment details...</div>;
  }

  if (!fulfillment) {
    return <div className="text-center py-8">Fulfillment not found</div>;
  }

  const handleItemUpdate = async (itemId: string, type: 'pick' | 'pack' | 'ship', qty: number) => {
    try {
      await updateItem.mutateAsync({
        itemId,
        status: type === 'pick' ? 'PICKING' : type === 'pack' ? 'PACKED' : 'SHIPPED',
        qty,
      });
      toast.success(`Item ${type} quantity updated`);
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const handleShip = async () => {
    if (!trackingNo || !carrier) {
      toast.error('Please enter tracking number and carrier');
      return;
    }

    try {
      await shipFulfillment.mutateAsync({
        fulfillmentId,
        trackingNumber: trackingNo,
        carrier,
      });
      toast.success('Fulfillment shipped successfully');
      setTrackingNo('');
      setCarrier('');
    } catch (error) {
      toast.error('Failed to ship fulfillment');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Pick List: {fulfillment.pick_list_no}</span>
            <Badge>{fulfillment.fulfillment_status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Created Date</p>
              <p className="font-semibold">{new Date(fulfillment.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Item Count</p>
              <p className="font-semibold">{fulfillment.item_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b">
        <Button
          variant={selectedTab === 'pick' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('pick')}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Picking
        </Button>
        <Button
          variant={selectedTab === 'pack' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('pack')}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Packing
        </Button>
        <Button
          variant={selectedTab === 'ship' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('ship')}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          Shipping
        </Button>
      </div>

      {(selectedTab === 'pick' || selectedTab === 'pack') && (
        <div className="space-y-4">
          {/* TODO: Fetch items from sales_fulfillment_items table based on fulfillment_id */}
          <p className="text-sm text-muted-foreground">Items to be loaded from fulfillment_items table</p>
        </div>
      )}

      {selectedTab === 'ship' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input
                  id="tracking"
                  placeholder="Enter tracking number"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  placeholder="e.g., FedEx, DHL"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleShip}
              disabled={shipFulfillment.isPending}
              className="gap-2"
            >
              <Truck className="h-4 w-4" />
              {shipFulfillment.isPending ? 'Shipping...' : 'Mark as Shipped'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
