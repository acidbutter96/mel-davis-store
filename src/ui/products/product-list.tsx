import Image from "next/image";
import { getLocale } from "@/i18n/server";
import type { Product } from "@/lib/commerce-types";
import { deslugify, formatMoney } from "@/lib/utils";
import { JsonLd, mappedProductsToJsonLd } from "@/ui/json-ld";
import { YnsLink } from "@/ui/yns-link";

export const ProductList = async ({ products }: { products: Product[] }) => {
	const locale = await getLocale();

	return (
		<>
			<ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{products.map((product, idx) => {
					return (
						<li key={product.id} className="group">
							<YnsLink href={`/product/${product.slug}`}>
								<article className="overflow-hidden bg-white">
									{product.images[0] && (
										<div className="rounded-lg aspect-square w-full overflow-hidden bg-neutral-100">
											<Image
												className="group-hover:rotate hover-perspective w-full bg-neutral-100 object-cover object-center transition-opacity group-hover:opacity-75"
												src={product.images[0]}
												width={768}
												height={768}
												loading={idx < 3 ? "eager" : "lazy"}
												priority={idx < 3}
												sizes="(max-width: 1024x) 100vw, (max-width: 1280px) 50vw, 700px"
												alt=""
											/>
										</div>
									)}
									<div className="p-2">
										<h2 className="text-xl font-medium text-neutral-700">{product.name}</h2>
										<footer className="text-base font-normal text-neutral-900">
											{typeof product.price === "number" && (
												<p>
													{formatMoney({
														amount: product.price,
														currency: product.currency,
														locale,
													})}
												</p>
											)}
											{product.variants && product.variants.length > 1 && (
												<ul className="mt-2 flex flex-wrap gap-2 text-sm text-neutral-500">
													{product.variants.map((variant, index) => {
														const label = variant.label ? deslugify(variant.label) : `Option ${index + 1}`;
														return (
															<li
																key={variant.id}
																className="rounded-full border border-neutral-200 px-2 py-0.5"
															>
																{label}
															</li>
														);
													})}
												</ul>
											)}
										</footer>
									</div>
								</article>
							</YnsLink>
						</li>
					);
				})}
			</ul>
			<JsonLd jsonLd={mappedProductsToJsonLd(products)} />
		</>
	);
};
