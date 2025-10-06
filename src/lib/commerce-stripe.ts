import Stripe from "stripe";
import { env } from "@/env.mjs";
import type {
	BrowseResult,
	Cart,
	Product,
	ProductInfo,
	ProductVariant,
	YnsProduct,
} from "@/lib/commerce-types";
import { slugify } from "@/lib/utils";

const carts = new Map<string, Cart>();

// Helper to ensure we have a Stripe client.
const stripe = new Stripe(env.STRIPE_SECRET_KEY || "", {
	// Use the version already installed's types (check stripe package types for allowed literal)
	// If type mismatch occurs, remove apiVersion to default to account setting.
	apiVersion: undefined,
});

const toUpperCurrency = (currency?: string | null) =>
	(currency || env.STRIPE_CURRENCY || "usd").toUpperCase();

const parseStock = (value: string | null | undefined): number | undefined => {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const getVariantLabel = (product: Stripe.Product): string | undefined => {
	const raw = product.metadata.variant;
	if (!raw || typeof raw !== "string") return undefined;
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const getVariantSlug = (label?: string | null) => (label ? slugify(label) : null);

const getVariantOrder = (product: Stripe.Product): number => {
	const candidates = [product.metadata.variant_order, product.metadata.variantOrder, product.metadata.order];
	for (const candidate of candidates) {
		if (!candidate) continue;
		const parsed = Number.parseFloat(candidate);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return Number.MAX_SAFE_INTEGER;
};

const escapeSearchValue = (value: string) => value.replace(/['\\]/g, "\\$&");

function mapStripeProduct(p: Stripe.Product, price: Stripe.Price | null): YnsProduct {
	const currency = toUpperCurrency(price?.currency);
	const unitAmount = price?.unit_amount ?? 0;
	const images = p.images && p.images.length > 0 ? p.images : [];
	const slug = (p.metadata.slug as string) || slugify(p.name) || p.id;
	const stock = parseStock(p.metadata.stock);
	const categorySlug = p.metadata.category ? slugify(p.metadata.category) : undefined;
	const variantLabel = getVariantLabel(p);
	const variantSlug = getVariantSlug(variantLabel ?? undefined);

	const variant: ProductVariant = {
		id: price?.id || p.id,
		price: unitAmount,
		currency,
		label: variantLabel ?? null,
		slug: variantSlug,
		productId: p.id,
		description: (p.description || null) as string | null,
		images,
		stock: stock ?? null,
	};

	const product: YnsProduct = {
		id: p.id,
		name: p.name,
		images,
		slug,
		summary: (p.description || null) as string | null,
		price: unitAmount, // minor units
		currency,
		stock,
		variants: [variant],
		category: categorySlug ? { slug: categorySlug, name: p.metadata.category } : null,
	};
	return product;
}

async function getDefaultPrice(product: Stripe.Product): Promise<Stripe.Price | null> {
	if (product.default_price && typeof product.default_price === "string") {
		return stripe.prices.retrieve(product.default_price);
	}
	if (typeof product.default_price === "object" && product.default_price) {
		return product.default_price as Stripe.Price;
	}
	const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
	return prices.data[0] || null;
}

export class StripeCommerce {
	async product_get({ slug }: { slug: string }): Promise<Product | null> {
		const bySlug = await this.fetchProductsBySlug(slug);
		if (bySlug.length > 0) {
			return this.aggregateProducts(bySlug);
		}

		try {
			const product = await stripe.products.retrieve(slug, { expand: ["default_price"] });
			return this.aggregateProducts([product]);
		} catch (error) {
			if ((error as { statusCode?: number }).statusCode === 404) {
				return null;
			}
			throw error;
		}
	}

	async product_browse({
		first = 50,
		category,
	}: {
		first?: number;
		category?: string;
	}): Promise<BrowseResult<Product>> {
		const results: Product[] = [];
		const rawProducts = await this.fetchProductsForBrowse(first, category);
		const groups = this.groupProductsBySlug(rawProducts);
		for (const group of groups) {
			const aggregated = await this.aggregateProducts(group.products);
			if (category) {
				const expectedCategory = slugify(category);
				if (aggregated.category?.slug !== expectedCategory) {
					continue;
				}
			}
			results.push(aggregated);
			if (results.length >= first) {
				break;
			}
		}
		return { data: results };
	}

	private async fetchProductsBySlug(slug: string): Promise<Stripe.Product[]> {
		const query = `active:'true' AND metadata['slug']:'${escapeSearchValue(slug)}'`;
		try {
			const search = stripe.products.search({
				query,
				limit: 100,
				expand: ["data.default_price"],
			});
			const results = await search.autoPagingToArray({ limit: 100 });
			return results;
		} catch (error) {
			// Search may not be available on all Stripe plans; fall back to list filtering.
			const list = await stripe.products.list({ active: true, limit: 100 });
			return list.data.filter((product) => {
				const productSlug = (product.metadata.slug as string) || slugify(product.name) || product.id;
				return productSlug === slug;
			});
		}
	}

	private async fetchProductsForBrowse(first: number, category?: string): Promise<Stripe.Product[]> {
		const limit = Math.min(Math.max(first * 5, first), 100);
		const queryParts = ["active:'true'"];
		if (category) {
			queryParts.push(`metadata['category']:'${escapeSearchValue(category)}'`);
		}
		const query = queryParts.join(" AND ");
		try {
			const search = stripe.products.search({
				query,
				limit,
				expand: ["data.default_price"],
			});
			const results = await search.autoPagingToArray({ limit });
			return results;
		} catch {
			const list = stripe.products.list({ active: true, limit });
			const results = await list.autoPagingToArray({ limit });
			if (!category) {
				return results;
			}
			return results.filter((product) => {
				const productCategory = product.metadata.category ? slugify(product.metadata.category) : undefined;
				return productCategory === slugify(category);
			});
		}
	}

	private groupProductsBySlug(products: Stripe.Product[]) {
		const groups = new Map<string, { slug: string; products: Stripe.Product[] }>();
		for (const product of products) {
			const slug = (product.metadata.slug as string) || slugify(product.name) || product.id;
			let entry = groups.get(slug);
			if (!entry) {
				entry = { slug, products: [] };
				groups.set(slug, entry);
			}
			entry.products.push(product);
		}
		return Array.from(groups.values());
	}

	private async aggregateProducts(products: Stripe.Product[]): Promise<YnsProduct> {
		const enriched = await Promise.all(
			products.map(async (product) => {
				const price = await getDefaultPrice(product);
				const mapped = mapStripeProduct(product, price);
				return { mapped, product };
			}),
		);

		enriched.sort((a, b) => {
			const orderDiff = getVariantOrder(a.product) - getVariantOrder(b.product);
			if (orderDiff !== 0) return orderDiff;
			const labelA = a.mapped.variants[0]?.label ?? "";
			const labelB = b.mapped.variants[0]?.label ?? "";
			return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
		});

		const base = enriched[0]?.mapped;
		if (!base) {
			throw new Error("Cannot aggregate empty product group");
		}

		const variants = enriched
			.map((entry) => entry.mapped.variants[0])
			.filter((variant): variant is ProductVariant => Boolean(variant));
		if (variants.length > 0) {
			base.variants = variants;
			const primary = variants[0]!;
			base.price = primary.price;
			base.currency = primary.currency;
			if (primary.description) {
				base.summary = primary.description;
			}
			if (primary.images && primary.images.length > 0) {
				base.images = primary.images;
			}
			if (typeof primary.stock === "number") {
				base.stock = primary.stock;
			}
		}

		return base;
	}

	private ensureCart(cartId?: string, currency = env.STRIPE_CURRENCY || "USD"): Cart {
		if (cartId && carts.has(cartId)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return carts.get(cartId)!;
		}
		const id = cartId || `cart_${Math.random().toString(36).slice(2)}`;
		const cart: Cart = { id, items: [], total: 0, currency };
		carts.set(id, cart);
		return cart;
	}

	cart_get({ cartId }: { cartId: string }): Cart | null {
		return carts.get(cartId) || null;
	}

	async cart_add({
		cartId,
		variantId,
		quantity,
	}: {
		cartId?: string;
		variantId: string;
		quantity: number;
	}): Promise<Cart> {
		const cart = this.ensureCart(cartId);
		const { product, variant } = await this.lookupVariant(variantId);
		const existing = cart.items.find((i) => i.variantId === variantId);
		if (existing) {
			existing.quantity += quantity;
		} else {
			cart.items.push({
				id: variantId,
				productId: product.id,
				variantId,
				quantity,
				price: variant.price,
				product: this.toProductInfo(product),
			});
		}
		this.recalculate(cart);
		return cart;
	}

	async cart_update({
		cartId,
		variantId,
		quantity,
	}: {
		cartId: string;
		variantId: string;
		quantity: number;
	}): Promise<Cart> {
		const cart = this.ensureCart(cartId);
		if (quantity <= 0) {
			cart.items = cart.items.filter((i) => i.variantId !== variantId);
		} else {
			const line = cart.items.find((i) => i.variantId === variantId);
			if (!line) {
				return this.cart_add({ cartId, variantId, quantity });
			}
			line.quantity = quantity;
		}
		this.recalculate(cart);
		return cart;
	}

	async cart_remove({ cartId, variantId }: { cartId: string; variantId: string }): Promise<Cart> {
		const cart = this.ensureCart(cartId);
		cart.items = cart.items.filter((i) => i.variantId !== variantId);
		this.recalculate(cart);
		return cart;
	}

	async cart_clear({ cartId }: { cartId: string }): Promise<void> {
		carts.delete(cartId);
	}

	private recalculate(cart: Cart) {
		cart.total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
	}

	private toProductInfo(p: Product): ProductInfo {
		return { id: p.id, name: p.name, images: p.images, summary: p.summary };
	}

	async lookupVariant(variantOrProductId: string): Promise<{ product: Product; variant: ProductVariant }> {
		// We treat variant id as either a Price id or Product id; attempt price first.
		try {
			const price = await stripe.prices.retrieve(variantOrProductId);
			if (price && typeof price.product === "string") {
				const prod = await stripe.products.retrieve(price.product);
				const mapped = mapStripeProduct(prod, price);
				return { product: mapped, variant: mapped.variants[0]! };
			}
		} catch {
			// ignore and try as product
		}
		// Fallback: treat as product id
		try {
			const prod = await stripe.products.retrieve(variantOrProductId);
			const price = await getDefaultPrice(prod);
			const mapped = mapStripeProduct(prod, price);
			return { product: mapped, variant: mapped.variants[0]! };
		} catch (err) {
			throw new Error(`Variant or product not found: ${variantOrProductId}: ${(err as Error).message}`);
		}
	}
}

// Provide an API surface similar to previous commerce object to minimize refactors.
export const commerce = {
	product: {
		get: (args: { slug: string }) => new StripeCommerce().product_get(args),
		browse: (args: { first?: number; category?: string }) => new StripeCommerce().product_browse(args),
	},
	variant: {
		resolve: (args: { id: string }) => new StripeCommerce().lookupVariant(args.id),
	},
	cart: {
		get: (args: { cartId: string }) => new StripeCommerce().cart_get(args),
		add: (args: { cartId?: string; variantId: string; quantity: number }) =>
			new StripeCommerce().cart_add(args),
		update: (args: { cartId: string; variantId: string; quantity: number }) =>
			new StripeCommerce().cart_update(args),
		remove: (args: { cartId: string; variantId: string }) => new StripeCommerce().cart_remove(args),
		clear: (args: { cartId: string }) => new StripeCommerce().cart_clear(args),
	},
};

export type { Cart, Product, YnsProduct } from "@/lib/commerce-types";

export default commerce;
