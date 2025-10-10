"use client";
import React from "react";
import { confirmationEmailHtml } from "@/lib/email-templates/confirmation";
import { orderStatusEmailHtml } from "@/lib/email-templates/order-status";
import { passwordResetEmailHtml } from "@/lib/email-templates/password-reset";
import { transactionalEmailHtml } from "@/lib/email-templates/transactional";

export default function EmailTemplatesPage() {
	const templates = [
		{
			id: "confirmation",
			label: "Account verification",
			render: () =>
				confirmationEmailHtml({
					name: "Alex",
					verifyUrl: "https://example.com/verify?token=abc123",
					supportEmail: "support@store.test",
				}),
		},
		{
			id: "password-reset",
			label: "Password reset",
			render: () =>
				passwordResetEmailHtml({
					name: "Alex",
					resetUrl: "https://example.com/reset?token=xyz",
					supportEmail: "support@store.test",
				}),
		},
		{
			id: "order-status",
			label: "Order status update",
			render: () =>
				orderStatusEmailHtml({
					name: "Alex",
					orderId: "1001",
					status: "Shipped",
					items: [
						{ name: "T-shirt", qty: 2, price: "$20" },
						{ name: "Hat", qty: 1, price: "$15" },
					],
					total: "$55",
					supportEmail: "support@store.test",
				}),
		},
		{
			id: "transactional",
			label: "Transactional (custom)",
			render: () =>
				transactionalEmailHtml({
					title: "Welcome to the Store",
					bodyHtml: `<p>Hello <strong>Alex</strong>,</p><p>Thanks for visiting.</p>`,
					supportEmail: "support@store.test",
				}),
		},
	];

	const initial = templates.find((t) => t.id === "confirmation") ? "confirmation" : (templates[0]?.id ?? "");
	const [selected, setSelected] = React.useState<string>(initial);

	const current = templates.find((t) => t.id === selected) || templates[0];
	const html = current ? current.render() : "";

	return (
		<div className="p-6">
			<div className="mb-4 flex gap-4">
				<select
					value={selected}
					onChange={(e) => setSelected(e.target.value)}
					className="border rounded px-3 py-2"
				>
					{templates.map((t) => (
						<option key={t.id} value={t.id}>
							{t.label}
						</option>
					))}
				</select>
			</div>
			<div>
				<iframe
					title="email-preview"
					srcDoc={html}
					style={{ width: "100%", height: "700px", border: "1px solid #e5e7eb" }}
				/>
			</div>
		</div>
	);
}
