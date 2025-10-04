"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/ui/shadcn/password-input";

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
	const [_state, action] = useActionState(login, {});
	const searchParams = useSearchParams();
	const router = useRouter();
	const next = searchParams.get("next");
	const [mode, setMode] = useState<"login" | "register">("login");
	const [pending, startTransition] = useTransition();

	// handle client-side registration submission
	async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const payload = Object.fromEntries(form.entries());
		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				// TODO: surface errors nicely
				return;
			}
			// após registrar, se next=checkout iniciar checkout
			if (next === "checkout") {
				startTransition(async () => {
					const c = await fetch("/api/checkout/session", { method: "POST" });
					if (c.ok) {
						const data = await c.json();
						if (data.url) window.location.href = data.url;
					} else {
						router.push("/");
					}
				});
				return;
			}
			router.push("/");
		} catch (err) {
			console.error("register failed", err);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">{mode === "login" ? "Login" : "Criar conta"}</CardTitle>
					<CardDescription>
						{mode === "login" ? "Entre com suas credenciais" : "Preencha os dados para criar sua conta"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{mode === "login" ? (
						<form action={action}>
							<div className="grid gap-6">
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input name="email" type="email" placeholder="m@example.com" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password">Password</Label>
									<PasswordInput name="password" required />
								</div>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Entrando..." : "Login"}
								</Button>
							</div>
						</form>
					) : (
						<form onSubmit={handleRegister}>
							<div className="grid gap-4">
								<div className="grid gap-2">
									<Label htmlFor="name">Nome</Label>
									<Input name="name" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input name="email" type="email" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password">Senha</Label>
									<PasswordInput name="password" required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="phone">Telefone</Label>
									<Input name="phone" placeholder="(11) 99999-0000" />
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="grid gap-2">
										<Label htmlFor="line1">Endereço</Label>
										<Input name="address.line1" placeholder="Rua / Av" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="line2">Compl.</Label>
										<Input name="address.line2" placeholder="Apto" />
									</div>
								</div>
								<div className="grid grid-cols-3 gap-2">
									<div className="grid gap-2">
										<Label htmlFor="city">Cidade</Label>
										<Input name="address.city" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="state">Estado</Label>
										<Input name="address.state" />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="postalCode">CEP</Label>
										<Input name="address.postalCode" />
									</div>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="country">País (ISO2)</Label>
									<Input name="address.country" placeholder="BR" />
								</div>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Enviando..." : "Criar conta"}
								</Button>
							</div>
						</form>
					)}
					<div className="mt-4 text-center text-sm">
						{mode === "login" ? (
							<button type="button" className="underline" onClick={() => setMode("register")}>
								Não tem conta? Cadastre-se
							</button>
						) : (
							<button type="button" className="underline" onClick={() => setMode("login")}>
								Já possui conta? Entrar
							</button>
						)}
					</div>
				</CardContent>
			</Card>
			<div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary  ">
				By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
				<a href="#">Privacy Policy</a>.
			</div>
		</div>
	);
}
