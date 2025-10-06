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

function mapStripeProduct(p: Stripe.Product, price: Stripe.Price | null): YnsProduct {
	const currency = (price?.currency || env.STRIPE_CURRENCY || "usd").toUpperCase();
	const unitAmount = price?.unit_amount ?? 0;
	const images = p.images && p.images.length > 0 ? p.images : [];
	const slug = (p.metadata.slug as string) || slugify(p.name) || p.id;
	const stockMeta =
		p.metadata.stock !== undefined && p.metadata.stock !== null && p.metadata.stock !== ""
			? Number.parseInt(p.metadata.stock, 10)
			: undefined;
	const categorySlug = p.metadata.category ? slugify(p.metadata.category) : undefined;

	const product: YnsProduct = {
		id: p.id,
		name: p.name,
		images,
		slug,
		summary: (p.description || null) as string | null,
		price: unitAmount, // minor units
		currency,
		stock: Number.isFinite(stockMeta) ? stockMeta : undefined,
		variants: [
			{
				id: price?.id || p.id,
				price: unitAmount,
				currency,
			},
		],
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
		const products = await stripe.products.list({ active: true, limit: 100 });
		for (const p of products.data) {
			const pSlug = (p.metadata.slug as string) || slugify(p.name) || p.id;
			if (pSlug === slug || p.id === slug) {
				const price = await getDefaultPrice(p);
				return mapStripeProduct(p, price);
			}
		}
		return null;
	}

	async product_browse({
		first = 50,
		category,
	}: {
		first?: number;
		category?: string;
	}): Promise<BrowseResult<Product>> {
		const all: Product[] = [];
		const products = await stripe.products.list({ active: true, limit: first });
		for (const p of products.data) {
			const price = await getDefaultPrice(p);
			const mapped = mapStripeProduct(p, price);
			if (category) {
				if (mapped.category?.slug === slugify(category)) {
					all.push(mapped);
				}
			} else {
				all.push(mapped);
			}
		}
		return { data: all };
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
