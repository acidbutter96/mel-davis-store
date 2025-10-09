import { YnsLink } from "@/ui/yns-link";

export default function ForbiddenPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 text-center">
			<h1 className="text-3xl font-bold mb-4">Access denied</h1>
			<p className="text-neutral-700 mb-6">You do not have permission to view this page.</p>
			<YnsLink href="/" className="text-blue-600 underline">
				Go back home
			</YnsLink>
		</main>
	);
}
