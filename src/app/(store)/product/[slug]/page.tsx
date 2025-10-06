// import { ProductModel3D } from "@/app/(store)/product/[slug]/product-model3d";

import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next/types";
import { Suspense } from "react";
import { ProductImageModal } from "@/app/(store)/product/[slug]/product-image-modal";
import { AddToCart } from "@/components/add-to-cart";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { publicUrl } from "@/env.mjs";
import { getLocale, getTranslations } from "@/i18n/server";
import { commerce } from "@/lib/commerce-stripe";
import type { YnsProduct } from "@/lib/commerce-types";
import { deslugify, formatMoney, formatProductName, slugify } from "@/lib/utils";
import { JsonLd, mappedProductToJsonLd } from "@/ui/json-ld";
import { Markdown } from "@/ui/markdown";
import { MainProductImage } from "@/ui/products/main-product-image";
import { YnsLink } from "@/ui/yns-link";

export const generateMetadata = async (props: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ variant?: string }>;
}): Promise<Metadata> => {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const product = await commerce.product.get({ slug: params.slug });

	if (!product) {
		return notFound();
	}

	const t = await getTranslations("/product.metadata");
	const ynsProduct = product as YnsProduct;
	const variants = ynsProduct.variants ?? [];
	const variantParam = searchParams.variant?.toLowerCase();
	const selectedVariant =
		variants.find((variant) => {
			if (!variantParam) return false;
			const identifiers = [variant.slug, variant.id, variant.label]
				.filter((value): value is string => Boolean(value))
				.map((value) => value.toLowerCase());
			if (variant.label) identifiers.push(slugify(variant.label).toLowerCase());
			return identifiers.includes(variantParam);
		}) ?? variants[0];

	const productName = formatProductName(product.name, selectedVariant?.label ?? undefined);
	const description = selectedVariant?.description ?? product.summary ?? undefined;
	const canonical = new URL(`${publicUrl}/product/${params.slug}`);
	const variantSlug = selectedVariant?.slug;
	if (variantSlug) {
		canonical.searchParams.set("variant", variantSlug);
	}

	return {
		title: t("title", { productName }),
		description,
		alternates: { canonical },
	} satisfies Metadata;
};

export default async function SingleProductPage(props: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ variant?: string; image?: string }>;
}) {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const product = await commerce.product.get({ slug: params.slug });
	if (!product) {
		return notFound();
	}

	const t = await getTranslations("/product.page");
	const locale = await getLocale();

	// Cast to YnsProduct to access YNS-specific fields
	const ynsProduct = product as YnsProduct;
	const variants = ynsProduct.variants ?? [];
	const variantParam = searchParams.variant?.toLowerCase();
	const selectedVariant =
		variants.find((variant) => {
			if (!variantParam) return false;
			const identifiers = [variant.slug, variant.id, variant.label]
				.filter((value): value is string => Boolean(value))
				.map((value) => value.toLowerCase());
			if (variant.label) identifiers.push(slugify(variant.label).toLowerCase());
			return identifiers.includes(variantParam);
		}) ?? variants[0];

	const category = ynsProduct.category?.slug;
	const images =
		selectedVariant?.images && selectedVariant.images.length > 0 ? selectedVariant.images : product.images;
	const description = selectedVariant?.description ?? product.summary ?? "";
	const displayPrice = selectedVariant?.price ?? product.price;
	const displayCurrency = selectedVariant?.currency ?? product.currency;
	const displayStock = typeof selectedVariant?.stock === "number" ? selectedVariant?.stock : product.stock;
	const isOutOfStock = displayStock === 0;
	const selectedVariantId = selectedVariant?.id ?? ynsProduct.variants[0]?.id ?? product.id;

	return (
		<article className="pb-12">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink asChild className="inline-flex min-h-12 min-w-12 items-center justify-center">
							<YnsLink href="/products">{t("allProducts")}</YnsLink>
						</BreadcrumbLink>
					</BreadcrumbItem>
					{category && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink className="inline-flex min-h-12 min-w-12 items-center justify-center" asChild>
									<YnsLink href={`/category/${category}`}>{deslugify(category)}</YnsLink>
								</BreadcrumbLink>
							</BreadcrumbItem>
						</>
					)}
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{product.name}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="mt-4 grid gap-4 lg:grid-cols-12">
				<div className="lg:col-span-5 lg:col-start-8">
					<h1 className="text-3xl font-bold leading-none tracking-tight text-foreground">
						{selectedVariant?.label ? formatProductName(product.name, selectedVariant.label) : product.name}
					</h1>
					<p className="mt-2 text-2xl font-medium leading-none tracking-tight text-foreground/70">
						{formatMoney({
							amount: displayPrice,
							currency: displayCurrency,
							locale,
						})}
					</p>
					<div className="mt-2">{isOutOfStock && <div>Out of stock</div>}</div>
				</div>

				<div className="lg:col-span-7 lg:row-span-3 lg:row-start-1">
					<h2 className="sr-only">{t("imagesTitle")}</h2>

					<div className="grid gap-4 lg:grid-cols-3 [&>*:first-child]:col-span-3">
						{images.map((image, idx) => {
							const params = new URLSearchParams({
								image: idx.toString(),
							});
							return (
								<YnsLink key={idx} href={`?${params}`} scroll={false}>
									{idx === 0 ? (
										<MainProductImage
											key={image}
											className="w-full rounded-lg bg-neutral-100 object-cover object-center transition-opacity"
											src={image}
											loading="eager"
											priority
											alt=""
										/>
									) : (
										<Image
											key={image}
											className="w-full rounded-lg bg-neutral-100 object-cover object-center transition-opacity"
											src={image}
											width={700 / 3}
											height={700 / 3}
											sizes="(max-width: 1024x) 33vw, (max-width: 1280px) 20vw, 225px"
											loading="eager"
											priority
											alt=""
										/>
									)}
								</YnsLink>
							);
						})}
					</div>
				</div>

				<div className="grid gap-8 lg:col-span-5">
					{variants.length > 1 && (
						<section>
							<h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
								{t("variantTitle")}
							</h2>
							<div className="flex flex-wrap gap-2">
								{variants.map((variant) => {
									const currentSlug = variant.slug ?? (variant.label ? slugify(variant.label) : variant.id);
									const isActive = selectedVariant?.id === variant.id;
									const href = currentSlug ? `?variant=${currentSlug}` : `?variant=${variant.id}`;
									const label = variant.label ? deslugify(variant.label) : deslugify(currentSlug);
									return (
										<YnsLink
											key={variant.id}
											href={href}
											scroll={false}
											className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${isActive ? "bg-black text-white border-black" : "border-neutral-200 text-neutral-700 hover:bg-neutral-100"}`}
										>
											{label}
										</YnsLink>
									);
								})}
							</div>
						</section>
					)}
					<section>
						<h2 className="sr-only">{t("descriptionTitle")}</h2>
						<div className="prose text-secondary-foreground">
							<Markdown source={description} />
						</div>
					</section>

					<AddToCart
						variantId={selectedVariantId}
						className={isOutOfStock ? "opacity-50 cursor-not-allowed" : ""}
					>
						{isOutOfStock ? "Out of Stock" : "Add to Cart"}
					</AddToCart>
				</div>
			</div>

			<Suspense>
				<SimilarProducts id={selectedVariant?.productId ?? product.id} />
			</Suspense>

			<Suspense>
				<ProductImageModal images={images} />
			</Suspense>

			<JsonLd jsonLd={mappedProductToJsonLd(product)} />
		</article>
	);
}

async function SimilarProducts({ id }: { id: string }) {
	// TODO: Implement similar products functionality
	return null;
}
