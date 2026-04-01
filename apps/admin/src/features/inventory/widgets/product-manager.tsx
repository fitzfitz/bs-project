import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useProducts, type Product } from "../api/use-products";
import { useCreateProduct, useUpdateProduct, useDeleteProduct } from "../api/use-product-crud";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/features/auth/store";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  costPrice: z.number().min(0, "Cost must be ≥ 0"),
  sellPrice: z.number().min(0, "Sell must be ≥ 0"),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const defaultFormValues: ProductFormValues = {
  name: "",
  sku: "",
  costPrice: 0,
  sellPrice: 0,
  description: "",
  isActive: true,
};

function toPayload(values: ProductFormValues) {
  const description = values.description?.trim();
  return {
    name: values.name.trim(),
    sku: values.sku.trim(),
    costPrice: values.costPrice,
    sellPrice: values.sellPrice,
    ...(description ? { description } : {}),
    isActive: values.isActive,
  };
}

export function ProductManager() {
  const org = useSessionStore((s) => s.user?.organization);
  const { data: envelope, isLoading, error } = useProducts(undefined, { limit: 100, page: 1 });
  const items = (envelope?.data ?? []) as Product[];

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      form.reset({
        name: editing.name,
        sku: editing.sku,
        costPrice: editing.costPrice,
        sellPrice: editing.sellPrice,
        description: editing.description ?? "",
        isActive: editing.isActive,
      });
    } else {
      form.reset(defaultFormValues);
    }
  }, [formOpen, editing, form]);

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditing(null);
      createProduct.reset();
      updateProduct.reset();
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setFormOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = toPayload(values);
    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
      setFormOpen(false);
      setEditing(null);
    } catch {
      /* mutation error surfaced below */
    }
  });

  const mutationError = createProduct.error ?? updateProduct.error;
  const isSaving = createProduct.isPending || updateProduct.isPending;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      /* surfaced in dialog */
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">Loading products…</p>;
  }
  if (error) {
    return <p className="text-destructive py-8 text-center">{error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Products</h2>
        <Button type="button" onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Create product
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No products yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(row);
                    }
                  }}
                  tabIndex={0}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs">{row.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.costPrice, org?.currency, org?.locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.sellPrice, org?.currency, org?.locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "default" : "secondary"} className="font-normal">
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${row.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${row.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: row.id, name: row.name });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton={!isSaving}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update catalog details for this product." : "Add a product to your organization catalog."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pm-name">Name</Label>
              <Input id="pm-name" {...form.register("name")} disabled={isSaving} className={cn(form.formState.errors.name && "border-destructive")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pm-sku">SKU</Label>
              <Input id="pm-sku" {...form.register("sku")} disabled={isSaving} className={cn(form.formState.errors.sku && "border-destructive")} />
              {form.formState.errors.sku && (
                <p className="text-sm text-destructive">{form.formState.errors.sku.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pm-cost">Cost ({org?.currency || "IDR"})</Label>
                <Input id="pm-cost" type="number" min={0} step="1" {...form.register("costPrice", { valueAsNumber: true })} disabled={isSaving} />
                {form.formState.errors.costPrice && (
                  <p className="text-sm text-destructive">{form.formState.errors.costPrice.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pm-sell">Sell ({org?.currency || "IDR"})</Label>
                <Input id="pm-sell" type="number" min={0} step="1" {...form.register("sellPrice", { valueAsNumber: true })} disabled={isSaving} />
                {form.formState.errors.sellPrice && (
                  <p className="text-sm text-destructive">{form.formState.errors.sellPrice.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pm-desc">Description</Label>
              <Textarea id="pm-desc" rows={3} {...form.register("description")} disabled={isSaving} placeholder="Optional" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="pm-active" className="text-base">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">Inactive products are hidden from default listings.</p>
              </div>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="pm-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSaving}
                  />
                )}
              />
            </div>
            {mutationError && <p className="text-sm text-destructive">{mutationError.message}</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleFormOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={!deleteProduct.isPending}>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This cannot be undone. Remove <span className="font-medium text-foreground">{deleteTarget?.name}</span> from
              the catalog?
            </DialogDescription>
          </DialogHeader>
          {deleteProduct.error && <p className="text-sm text-destructive">{deleteProduct.error.message}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteProduct.isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteProduct.isPending}>
              {deleteProduct.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
