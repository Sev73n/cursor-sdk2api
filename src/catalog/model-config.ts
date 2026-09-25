export interface CatalogSnippetModel {
  id: string;
  variants?: Array<{
    isDefault?: boolean;
    params?: Array<{ id: string; value: string }>;
  }>;
}

export function catalogConfigSnippet(model: CatalogSnippetModel): string {
  const variant = chosenVariant(model.variants);
  const params = variant?.params ?? [];
  const body: { model: string; cursor_model_params?: Array<{ id: string; value: string }> } = {
    model: model.id,
  };
  if (params.length > 0) {
    body.cursor_model_params = params.map((item) => ({ id: item.id, value: item.value }));
  }
  return JSON.stringify(body, null, 2);
}

function chosenVariant(
  variants: CatalogSnippetModel["variants"],
): { isDefault?: boolean; params?: Array<{ id: string; value: string }> } | undefined {
  if (!variants?.length) return undefined;
  return variants.find((variant) => variant.isDefault) ?? (variants.length === 1 ? variants[0] : undefined);
}
