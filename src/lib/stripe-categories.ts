import { StripeCommerce } from "@/lib/commerce-stripe";
import { slugify } from "@/lib/utils";
import StoreConfig from "@/store.config";

interface CachedCategories {
	at: number;
	data: { name: string; slug: string }[];
}

const formatName = (value: string) =>
	value
		.toLowerCase()
		.replace(/-/g, " ")
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

declare global {
	// eslint-disable-next-line no-var
	var __stripeCategoriesCache: CachedCategories | undefined;
}

const readCache = (): { name: string; slug: string }[] | null => {
	const cached = globalThis.__stripeCategoriesCache;
	if (!cached) return null;
	if (Date.now() - cached.at > CACHE_TTL_MS) return null;
	const needsFormat = cached.data.some((c) => /-|[A-Z]{2,}|^[a-z]/.test(c.name));
	if (needsFormat) {
		const formatted = cached.data.map((c) => ({ ...c, name: formatName(c.name) }));
		writeCache(formatted);
		return formatted;
	}
	return cached.data;
};

const writeCache = (data: { name: string; slug: string }[]) => {
	globalThis.__stripeCategoriesCache = { at: Date.now(), data };
};

export async function getStripeCategories(): Promise<{ name: string; slug: string }[]> {
	const cached = readCache();
	if (cached) return cached;

	try {
		const browse = await new StripeCommerce().product_browse({ first: 100 });
		const products = browse.data || [];

		const map = new Map<string, { name: string; slug: string }>();

		for (const p of products) {
			const rawName = p.category?.name?.trim();
			if (!rawName) continue;
			const slug = slugify(rawName);
			if (!map.has(slug)) {
				map.set(slug, { name: rawName, slug });
			}
		}

		let categories = Array.from(map.values());

		if (categories.length === 0) {
			categories = StoreConfig.categories.map((c) => ({ name: c.name, slug: c.slug }));
		}

		categories = categories.map((c) => ({ ...c, name: formatName(c.name) }));

		categories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

		writeCache(categories);
		return categories;
	} catch (err) {
		return StoreConfig.categories.map((c) => ({ name: formatName(c.name), slug: c.slug }));
	}
}

export default getStripeCategories;
