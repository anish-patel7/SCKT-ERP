import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';

interface OrderItem {
  line_number: number;
  fabric_quality_name: string;
  design_no?: string;
  qty_metre: number;
  qty_allocated?: number;
  qty_shipped?: number;
  rate_per_metre: number;
  line_total: number;
  remarks?: string;
}

interface OrderItemEditorProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

export function OrderItemEditor({ items, onItemsChange }: OrderItemEditorProps) {
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'qty_metre' || field === 'rate_per_metre') {
      item[field] = value;
      item.line_total = item.qty_metre * item.rate_per_metre;
    } else {
      item[field] = value;
    }

    updated[index] = item;
    onItemsChange(updated);
  };

  const addItem = () => {
    const newLineNumber = Math.max(...items.map((i) => i.line_number), 0) + 1;
    onItemsChange([
      ...items,
      {
        line_number: newLineNumber,
        fabric_quality_name: '',
        design_no: '',
        qty_metre: 0,
        qty_allocated: 0,
        qty_shipped: 0,
        rate_per_metre: 0,
        line_total: 0,
        remarks: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quality Name</TableHead>
              <TableHead>Design No.</TableHead>
              <TableHead>Quantity (m)</TableHead>
              <TableHead>Rate (₹/m)</TableHead>
              <TableHead>Total (₹)</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={item.fabric_quality_name}
                    onChange={(e) => updateItem(index, 'fabric_quality_name', e.target.value)}
                    placeholder="Enter quality"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.design_no || ''}
                    onChange={(e) => updateItem(index, 'design_no', e.target.value)}
                    placeholder="Design"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.qty_metre}
                    onChange={(e) => updateItem(index, 'qty_metre', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.rate_per_metre}
                    onChange={(e) => updateItem(index, 'rate_per_metre', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </TableCell>
                <TableCell className="font-semibold">
                  ₹{item.line_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Input
                    value={item.remarks || ''}
                    onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                    placeholder="Notes"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
