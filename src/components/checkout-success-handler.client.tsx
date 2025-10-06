"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { finalizeCheckoutCleanup, recordSuccessfulCheckout } from "@/actions/order-actions";
import { useCart } from "@/context/cart-context";

type CheckoutStatus =
	| "success"
	| "processing"
	| "requires_payment_method"
	| "failed"
	| "open"
	| "expired"
	| "cancel"
	| "missing_session"
	| "stripe_not_configured"
	| "error"
	| "unknown";

const successLikeStatuses: CheckoutStatus[] = ["success", "processing"];

export function CheckoutSuccessHandler() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { closeCart } = useCart();
	const [ran, setRan] = useState(false);

	useEffect(() => {
		const statusParam = searchParams.get("checkout");
		const sessionId = searchParams.get("session_id");
		if (ran || !statusParam) return;
		setRan(true);
		const status = normalizeStatus(statusParam);
		const message = statusMessages[status];
		(async () => {
			try {
				if (successLikeStatuses.includes(status)) {
					const res = await finalizeCheckoutCleanup();
					if ("ok" in res) {
						closeCart();
						if (sessionId) {
							try {
								await recordSuccessfulCheckout(sessionId);
							} catch (e) {
								console.warn("Falha ao registrar compra localmente", e);
							}
						}
					}
				}
				showToast(message);
			} catch (e) {
				console.error("Failed to cleanup after checkout", e);
				showToast(statusMessages.error);
			} finally {
				// Remove o parâmetro da URL
				const sp = new URLSearchParams(Array.from(searchParams.entries()));
				sp.delete("checkout");
				sp.delete("session_id");
				const newQs = sp.toString();
				router.replace(newQs ? `/?${newQs}` : "/");
			}
		})();
	}, [searchParams, router, ran, closeCart]);

	return null;
}

function normalizeStatus(raw: string): CheckoutStatus {
	const value = raw.toLowerCase();
	switch (value) {
		case "success":
		case "processing":
		case "requires_payment_method":
		case "failed":
		case "open":
		case "expired":
		case "cancel":
		case "missing_session":
		case "stripe_not_configured":
		case "error":
		case "unknown":
			return value;
		default:
			return "unknown";
	}
}

const statusMessages: Record<
	CheckoutStatus | "error",
	{ type: "success" | "error" | "info" | "warning"; title: string; description?: string }
> = {
	success: {
		type: "success",
		title: "Pagamento confirmado",
		description: "Obrigado pela sua compra!",
	},
	processing: {
		type: "info",
		title: "Pagamento em processamento",
		description: "Assim que o banco confirmar, atualizaremos o status da sua compra.",
	},
	requires_payment_method: {
		type: "error",
		title: "Pagamento não autorizado",
		description: "Revise seus dados de pagamento ou utilize outro método.",
	},
	failed: {
		type: "error",
		title: "Pagamento não concluído",
		description: "Nada foi cobrado e o carrinho continua disponível.",
	},
	open: {
		type: "info",
		title: "Checkout ainda aberto",
		description: "Finalize o pagamento para concluir o pedido.",
	},
	expired: {
		type: "warning",
		title: "Sessão expirada",
		description: "Reinicie o checkout para tentar novamente.",
	},
	cancel: {
		type: "warning",
		title: "Checkout cancelado",
		description: "Seus itens continuam no carrinho caso queira tentar outra vez.",
	},
	missing_session: {
		type: "error",
		title: "Sessão de checkout não encontrada",
		description: "Tente iniciar um novo checkout.",
	},
	stripe_not_configured: {
		type: "error",
		title: "Stripe não configurado",
		description: "Verifique as variáveis de ambiente do servidor.",
	},
	error: {
		type: "error",
		title: "Erro ao validar pagamento",
		description: "Tente novamente ou contate o suporte se persistir.",
	},
	unknown: {
		type: "info",
		title: "Status de checkout desconhecido",
		description: "Estamos investigando. Caso necessário, tente novamente.",
	},
};

function showToast(message: {
	type: "success" | "error" | "info" | "warning";
	title: string;
	description?: string;
}) {
	switch (message.type) {
		case "success":
			toast.success(message.title, { description: message.description });
			break;
		case "error":
			toast.error(message.title, { description: message.description });
			break;
		case "warning":
			toast.warning(message.title, { description: message.description });
			break;
		case "info":
		default:
			toast(message.title, { description: message.description });
	}
}
