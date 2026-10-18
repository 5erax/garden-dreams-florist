export function bouquetSpecification(product, variantId = null) {
  const variant = product.variants?.find(row => row.id === variantId);
  if (variant?.specification?.trim()) return variant.specification.trim();
  if (variantId == null && product.specification?.trim()) return product.specification.trim();
  return `${variant ? `Cỡ ${variant.size_name}. ` : ''}Thành phần theo mục Trong bó hoa. Độ nở và hoa phối thay đổi theo mùa; cửa hàng trao đổi trước khi thay đổi mẫu. Giấy gói và ruy băng hoàn thiện theo tông bó hoa.`;
}
