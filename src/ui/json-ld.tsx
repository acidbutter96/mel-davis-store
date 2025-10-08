import type { ItemList, Product, Thing, WebSite, WithContext } from "schema-dts";
import type Stripe from "stripe";
import type { Product as CommerceProduct } from "@/lib/commerce-types";

export const JsonLd = <T extends Thing>({ jsonLd }: { jsonLd: WithContext<T> }) => {
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
};

export const mappedProductToJsonLd = (product: CommerceProduct): WithContext<Product> => {
	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name: product.name,
		image: product.images[0],
		description: product.summary ?? undefined,
		sku: product.id,
		offers: {
			"@type": "Offer",
			price: product.price.toString(),
			priceCurrency: product.currency,
			availability:
				product.stock === undefined || product.stock === null
					? undefined // omit availability when unknown
					: product.stock === 0
						? "https://schema.org/OutOfStock"
						: "https://schema.org/InStock",
		},
	};
};

export const mappedProductsToJsonLd = (products: readonly CommerceProduct[]): WithContext<ItemList> => {
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		itemListElement: products.map(mappedProductToJsonLd),
	};
};

export const accountToWebsiteJsonLd = ({
	account,
	logoUrl,
}: {
	account: Stripe.Account | null | undefined;
	logoUrl: string | null | undefined;
}): WithContext<WebSite> => {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: account?.business_profile?.name ?? "Mel Davis",
		url: account?.business_profile?.url ?? "https://yournextstore.com",
		mainEntityOfPage: {
			"@type": "WebPage",
			url: account?.business_profile?.url ?? "https://yournextstore.com",
		},
		...(logoUrl && {
			image: {
				"@type": "ImageObject",
				url: logoUrl,
			},
		}),
		publisher: {
			"@type": "Organization",
			name: account?.business_profile?.name ?? "Mel Davis",
			url: account?.business_profile?.url ?? "https://yournextstore.com",
		},
	};
};
