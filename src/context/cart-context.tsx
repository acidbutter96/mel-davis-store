"use client";

import {
	createContext,
	type ReactNode,
	startTransition,
	useContext,
	useEffect,
	useOptimistic,
	useState,
} from "react";
import { addToCartAction, removeFromCartAction, updateCartItemAction } from "@/actions/cart-actions";
import type { Cart, ProductInfo } from "@/lib/commerce-types";

type CartAction =
	| { type: "ADD_ITEM"; variantId: string; quantity: number; product?: ProductInfo }
	| { type: "UPDATE_ITEM"; variantId: string; quantity: number }
	| { type: "REMOVE_ITEM"; variantId: string }
	| { type: "SYNC_CART"; cart: Cart | null };

interface CartContextType {
	cart: Cart | null;
	isCartOpen: boolean;
	itemCount: number;
	openCart: () => void;
	closeCart: () => void;
	optimisticAdd: (variantId: string, quantity: number, product?: ProductInfo) => Promise<void>;
	optimisticUpdate: (variantId: string, quantity: number) => Promise<void>;
	optimisticRemove: (variantId: string) => Promise<void>;
	cartReady: boolean;
}

function cartReducer(state: Cart | null, action: CartAction): Cart | null {
	switch (action.type) {
		case "ADD_ITEM": {
			if (!state) {
				return {
					id: "optimistic",
					items: [
						{
							id: action.variantId,
							productId: action.variantId,
							variantId: action.variantId,
							quantity: action.quantity,
							price: 0,
							product: action.product,
						},
					],
					total: 0,
					currency: "USD",
				};
			}

			const existingItemIndex = state.items.findIndex(
				(item) => (item.variantId || item.productId) === action.variantId,
			);

			if (existingItemIndex >= 0) {
				const existingItem = state.items[existingItemIndex];
				if (existingItem) {
					const updatedItems = [...state.items];
					updatedItems[existingItemIndex] = {
						...existingItem,
						quantity: existingItem.quantity + action.quantity,
					};
					return {
						...state,
						items: updatedItems,
					};
				}
			}

			return {
				...state,
				items: [
					...state.items,
					{
						id: action.variantId,
						productId: action.variantId,
						variantId: action.variantId,
						quantity: action.quantity,
						price: 0,
						product: action.product,
					},
				],
			};
		}

		case "UPDATE_ITEM": {
			if (!state) return state;

			if (action.quantity <= 0) {
				return {
					...state,
					items: state.items.filter((item) => (item.variantId || item.productId) !== action.variantId),
				};
			}

			const updatedItems = state.items.map((item) => {
				if ((item.variantId || item.productId) === action.variantId) {
					return { ...item, quantity: action.quantity };
				}
				return item;
			});

			return {
				...state,
				items: updatedItems,
			};
		}

		case "REMOVE_ITEM": {
			if (!state) return state;

			return {
				...state,
				items: state.items.filter((item) => (item.variantId || item.productId) !== action.variantId),
			};
		}

		case "SYNC_CART": {
			return action.cart;
		}

		default:
			return state;
	}
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const [actualCart, setActualCart] = useState<Cart | null>(null);
	const [optimisticCart, setOptimisticCart] = useOptimistic(actualCart, cartReducer);
	const [isCartOpen, setIsCartOpen] = useState(false);
	const [cartReady, setCartReady] = useState(false);

	// Calculate item count from optimistic cart
	const itemCount = optimisticCart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

	// Helper to fetch cart via API (reads go through GET endpoint to ensure fresh data)
	async function fetchCart(): Promise<Cart | null> {
		try {
			const res = await fetch("/api/cart", { method: "GET", cache: "no-store" });
			if (!res.ok) return null;
			const data = (await res.json()) as { cart: Cart | null };
			return data.cart;
		} catch (e) {
			console.error("Failed to fetch cart", e);
			return null;
		}
	}

	// Load initial cart
	useEffect(() => {
		fetchCart()
			.then((cart) => {
				startTransition(() => {
					setActualCart(cart);
				});
			})
			.finally(() => {
				setCartReady(true);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync optimistic cart with actual cart when it changes
	useEffect(() => {
		if (actualCart === optimisticCart) return;
		startTransition(() => {
			setOptimisticCart({ type: "SYNC_CART", cart: actualCart });
		});
	}, [actualCart, optimisticCart, setOptimisticCart]);

	const openCart = () => setIsCartOpen(true);
	const closeCart = () => setIsCartOpen(false);

	const optimisticAdd = async (variantId: string, quantity = 1, product?: ProductInfo) => {
		startTransition(() => {
			setOptimisticCart({ type: "ADD_ITEM", variantId, quantity, product });
			setIsCartOpen(true);
		});
		try {
			const updatedCart = await addToCartAction(variantId, quantity);
			setActualCart(updatedCart);
			// Force a fresh fetch (enrichment + migration) from API
			const refreshed = await fetchCart();
			if (refreshed) setActualCart(refreshed);
		} catch (error) {
			console.error("Failed to add to cart:", error);
			throw error;
		}
	};

	const optimisticUpdate = async (variantId: string, quantity: number) => {
		startTransition(() => {
			setOptimisticCart({ type: "UPDATE_ITEM", variantId, quantity });
		});

		try {
			// Perform server action
			const updatedCart = await updateCartItemAction(variantId, quantity);
			setActualCart(updatedCart);
		} catch (error) {
			// Rollback will happen automatically via useEffect
			console.error("Failed to update cart item:", error);
			throw error;
		}
	};

	const optimisticRemove = async (variantId: string) => {
		startTransition(() => {
			setOptimisticCart({ type: "REMOVE_ITEM", variantId });
		});

		try {
			// Perform server action
			const updatedCart = await removeFromCartAction(variantId);
			setActualCart(updatedCart);
		} catch (error) {
			// Rollback will happen automatically via useEffect
			console.error("Failed to remove from cart:", error);
			throw error;
		}
	};

	return (
		<CartContext.Provider
			value={{
				cart: optimisticCart,
				isCartOpen,
				itemCount,
				openCart,
				closeCart,
				optimisticAdd,
				optimisticUpdate,
				optimisticRemove,
				cartReady,
			}}
		>
			{children}
		</CartContext.Provider>
	);
}

export function useCart() {
	const context = useContext(CartContext);
	if (!context) {
		throw new Error("useCart must be used within a CartProvider");
	}
	return context;
}
