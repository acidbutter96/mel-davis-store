"use client";

import { Plus } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/shadcn/button";

interface AddToCartProps {
	variantId: string;
	quantity?: number;
	className?: string;
	children?: React.ReactNode;
	onSuccess?: () => void;
}

export function AddToCart({ variantId, quantity = 1, className = "", children, onSuccess }: AddToCartProps) {
	const { openCart, optimisticAdd } = useCart();

	const handleAddToCart = async () => {
		try {
			await optimisticAdd(variantId, quantity);
			onSuccess?.();
			openCart(); // Open cart sidebar after adding item
		} catch (error) {
			// Error is already logged in context, could show error toast here
		}
	};

	return (
		<Button
			onClick={handleAddToCart}
			type="button"
			size="lg"
			className={cn("gap-2 h-auto px-6 py-3 text-base font-semibold", className)}
		>
			<Plus className="h-4 w-4" />
			{children || "Add to Cart"}
		</Button>
	);
}
