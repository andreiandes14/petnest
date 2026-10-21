export function productCategoryLabel(category?: string) {
  return category === "food" ? "Food" : category === "supplies" ? "Supplies" : "Uncategorized";
}

export function filterSupplyProducts<T extends { productCategory?: string }>(products: T[], filter: string): T[] {
  return filter === "food" || filter === "supplies"
    ? products.filter(product => product.productCategory === filter)
    : products;
}
