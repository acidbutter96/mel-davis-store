"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/context/cart-context";
import { login } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/ui/shadcn/password-input";

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [state, action] = useActionState(login, {});
	const searchParams = useSearchParams();
	const router = useRouter();
	const next = searchParams.get("next");
	const [mode, setMode] = useState<"login" | "register">("login");
	const [pending, startTransition] = useTransition();
	const [registerError, setRegisterError] = useState<string | null>(null);
	const { cart, cartReady } = useCart();

	// handle client-side registration submission
	async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setRegisterError(null);
		const formEl = e.currentTarget as HTMLFormElement;
		const form = new FormData(formEl);
		const rawEntries = Array.from(form.entries()) as [string, string][];
		const base: Record<string, unknown> = {};
		const address: Record<string, string> = {};
		for (const [key, value] of rawEntries) {
			if (key.startsWith("$ACTION")) continue;
			if (key.startsWith("address.")) {
				const subKey = key.slice("address.".length);
				if (value.trim() !== "") address[subKey] = value.trim();
			} else {
				base[key] = value;
			}
		}
		const email = String(base.email || "")
			.trim()
			.toLowerCase();
		const password = String(base.password || "");
		const name = String(base.name || "").trim();
		if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			setRegisterError("Enter a valid email");
			return;
		}
		if (!name) {
			setRegisterError("Enter your name");
			return;
		}
		if (password.length < 6) {
			setRegisterError("Password must be at least 6 characters");
			return;
		}
		try {
			const avail = await fetch("/api/auth/email-available", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			if (avail.ok) {
				const data = (await avail.json()) as { available?: boolean };
				if (!data.available) {
					setRegisterError("Email already registered");
					return;
				}
			}
		} catch {}

		if (Object.keys(address).length > 0) base.address = address;

		// Wait briefly for cartReady (context hydration) if not ready yet
		if (!cartReady) {
			const started = Date.now();
			while (!cartReady && Date.now() - started < 300) {
				// eslint-disable-next-line no-await-in-loop
				await new Promise((r) => setTimeout(r, 30));
			}
		}
		let effectiveCart = cart;
		if (effectiveCart && effectiveCart.items.length > 0) {
			console.debug("[register] using context cart", effectiveCart.items.length);
		} else {
			try {
				const guestRes = await fetch("/api/cart", { method: "GET", cache: "no-store" });
				if (guestRes.ok) {
					const guestData = (await guestRes.json()) as {
						cart?: { items?: { productId: string; variantId: string; quantity: number }[] };
					};
					if (guestData.cart?.items?.length) {
						effectiveCart = guestData.cart as typeof effectiveCart;
						console.debug("[register] using fallback guest cart", guestData.cart.items?.length || 0);
					}
				}
			} catch (err) {
				console.debug("[register] guest cart fetch failed", err);
			}
		}
		if (effectiveCart && effectiveCart.items.length > 0) {
			(base as Record<string, unknown>).cart = {
				items: effectiveCart.items.map((i) => ({
					productId: i.productId,
					variantId: i.variantId,
					quantity: i.quantity,
				})),
			};
		} else {
			console.debug("[register] no cart items to send");
		}
		const payload = { ...base, email };
		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				if (res.status === 409) {
					setRegisterError("Email already registered");
				} else if (res.status === 400) {
					setRegisterError("Invalid data. Please check the fields.");
				} else {
					setRegisterError("Failed to register. Please try again.");
				}
				return;
			}
			if (next === "checkout") {
				startTransition(async () => {
					const c = await fetch("/api/checkout/session", { method: "POST" });
					if (c.ok) {
						const data = (await c.json()) as { url?: string };
						if (data.url) {
							window.location.href = data.url;
							return;
						}
					}
					router.push("/checkout");
				});
				return;
			}
			router.push("/");
		} catch (err) {
			console.error("register failed", err);
			setRegisterError("Unexpected error. Please try again.");
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">{mode === "login" ? "Login" : "Create account"}</CardTitle>
					<CardDescription>
						{mode === "login" ? "Enter your credentials" : "Fill in the details to create your account"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{mode === "login" ? (
						<form action={action}>
							{cart && cart.items.length > 0 && (
								<input
									type="hidden"
									name="cart"
									value={JSON.stringify({
										items: cart.items.map((i) => ({
											productId: i.productId,
											variantId: i.variantId,
											quantity: i.quantity,
										})),
									})}
								/>
							)}
							<div className="grid gap-6">
								{state?.error && (
									<p className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2 border border-destructive/30">
										{state.error}
									</p>
								)}
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input name="email" type="email" placeholder="m@example.com" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password">Password</Label>
									<PasswordInput name="password" required />
								</div>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Signing in..." : "Login"}
								</Button>
							</div>
						</form>
					) : (
						<form onSubmit={handleRegister}>
							<div className="grid gap-4">
								{registerError && (
									<p className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2 border border-destructive/30">
										{registerError}
									</p>
								)}
								<div className="grid gap-2">
									<Label htmlFor="name">Name</Label>
									<Input name="name" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input name="email" type="email" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password">Password</Label>
									<PasswordInput name="password" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="phone">Phone</Label>
									<Input name="phone" placeholder="(11) 99999-0000" />
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="grid gap-2">
										<Label htmlFor="line1">Address</Label>
										<Input name="address.line1" placeholder="Street" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="line2">Line 2</Label>
										<Input name="address.line2" placeholder="Apt" />
									</div>
								</div>
								<div className="grid grid-cols-3 gap-2">
									<div className="grid gap-2">
										<Label htmlFor="city">City</Label>
										<Input name="address.city" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="state">State</Label>
										<Input name="address.state" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="postalCode">Postal code</Label>
										<Input name="address.postalCode" />
									</div>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="country">Country (ISO2)</Label>
									<Input name="address.country" placeholder="BR" />
								</div>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Submitting..." : "Create account"}
								</Button>
							</div>
						</form>
					)}
					<div className="mt-4 text-center text-sm">
						{mode === "login" ? (
							<button type="button" className="underline" onClick={() => setMode("register")}>
								Don't have an account? Sign up
							</button>
						) : (
							<button type="button" className="underline" onClick={() => setMode("login")}>
								Already have an account? Sign in
							</button>
						)}
					</div>
				</CardContent>
			</Card>
			<div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary  ">
				By clicking continue, you agree to our <a href="/terms">Terms of Service</a> and{" "}
				<a href="/privacy">Privacy Policy</a>.
			</div>
		</div>
	);
}
