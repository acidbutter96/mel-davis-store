"use client";
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

	const [mode, setMode] = useState<"login" | "register" | "pending">("login");
	const [pending] = useTransition();
	const [registerError, setRegisterError] = useState<string | null>(null);
	const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
	// showForgot was replaced by recoveryMode
	const [recoveryMode, setRecoveryMode] = useState(false);
	const [forgotStatus, setForgotStatus] = useState<string | null>(null);
	const { cart } = useCart();

	async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setRegisterError(null);
		const form = new FormData(e.currentTarget as HTMLFormElement);
		const body = Object.fromEntries(form.entries()) as Record<string, string>;
		const email = String(body.email || "")
			.trim()
			.toLowerCase();
		const password = String(body.password || "");
		const name = String(body.name || "").trim();
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
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (res.ok) {
				setRegisteredEmail(email);
				setMode("pending");
				return;
			}
			const data = (await res.json()) as unknown as { error?: string };
			setRegisterError(data?.error || "Failed to register");
		} catch (err) {
			setRegisterError("Unexpected error");
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
					{mode === "login" && !recoveryMode && (
						<>
							<form action={action}>
								{cart && cart.items.length > 0 && (
									<input type="hidden" name="cart" value={JSON.stringify({ items: cart.items })} />
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
							<div className="mt-2 text-right">
								<button type="button" className="underline text-sm" onClick={() => setRecoveryMode(true)}>
									Forgot your password?
								</button>
							</div>
						</>
					)}

					{mode === "login" && recoveryMode && (
						<div>
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									setForgotStatus(null);
									const form = new FormData(e.currentTarget as HTMLFormElement);
									const email = String(form.get("email") || "")
										.trim()
										.toLowerCase();
									if (!email) {
										setForgotStatus("Enter your email");
										return;
									}
									try {
										const res = await fetch("/api/auth/forgot-password", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ email }),
										});
										if (res.ok) setForgotStatus("Recovery email sent if the address exists");
										else setForgotStatus("Failed to send recovery email");
									} catch (err) {
										setForgotStatus("Unexpected error");
									}
								}}
							>
								<div className="grid gap-2">
									<Label htmlFor="forgot-email">Email</Label>
									<Input id="forgot-email" name="email" type="email" />
									<div className="flex gap-2">
										<Button type="submit" className="flex-1">
											Send recovery email
										</Button>
										<Button
											type="button"
											variant="ghost"
											onClick={() => {
												setRecoveryMode(false);
												setForgotStatus(null);
											}}
										>
											Back to login
										</Button>
									</div>
									{forgotStatus && <p className="text-sm mt-2">{forgotStatus}</p>}
								</div>
							</form>
						</div>
					)}
					{mode === "register" && (
						<form onSubmit={handleRegister}>
							<div className="grid gap-4">
								{registerError ? (
									<p className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2 border border-destructive/30">
										{registerError}
									</p>
								) : null}
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
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Submitting..." : "Create account"}
								</Button>
							</div>
						</form>
					)}
					{mode === "pending" && (
						<div className="space-y-4">
							<h3 className="text-lg font-semibold">Registration pending</h3>
							<p>Check your email to confirm your registration and complete payment.</p>
							<p className="text-sm text-muted-foreground">We sent the confirmation to {registeredEmail}</p>
						</div>
					)}
					{mode !== "pending" && (
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
					)}
				</CardContent>
			</Card>
			<div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary  ">
				By clicking continue, you agree to our <a href="/terms">Terms of Service</a> and{" "}
				<a href="/privacy">Privacy Policy</a>.
			</div>
		</div>
	);
}
