"use strict";

function validCatalog(catalog) {
  if (!catalog || catalog.schema_version !== "1.0" || !catalog.store ||
      typeof catalog.store.id !== "string" || typeof catalog.store.name !== "string" ||
      !Array.isArray(catalog.categories) || !Array.isArray(catalog.products) ||
      catalog.products.length === 0) return false;
  try {
    new Intl.NumberFormat(catalog.store.locale, { style: "currency", currency: catalog.store.currency }).format(1);
  } catch (error) {
    return false;
  }
  const categories = catalog.categories.map(category => category && category.id);
  if (!catalog.categories.every(category => category && typeof category.id === "string" &&
      typeof category.name === "string") || new Set(categories).size !== categories.length) return false;
  const ids = catalog.products.map(product => product && product.id);
  return new Set(ids).size === ids.length && catalog.products.every(product =>
    product && typeof product.id === "string" && product.id.length > 0 &&
    typeof product.name === "string" && categories.includes(product.category) &&
    Number.isFinite(product.price) && product.price >= 0 &&
    Number.isSafeInteger(Math.round(product.price * 100)) && Array.isArray(product.teaching_roles)
  );
}

async function loadCatalog() {
  for (const url of SHOP_CONFIG.catalogUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const catalog = await response.json();
      if (validCatalog(catalog)) return catalog;
    } catch (error) {
      // The shop carries a local copy if the shared catalog is unavailable.
    }
  }
  return null;
}

function categoryName(catalog, id) {
  const category = catalog.categories.find(entry => entry.id === id);
  return category ? category.name : id;
}

function formatMoney(value, currency, locale = "es-ES") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
