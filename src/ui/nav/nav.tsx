import { UserIcon } from "lucide-react";
import { CartIcon } from "@/components/cart-icon";
import { auth } from "@/lib/auth";
import { NavMenu } from "@/ui/nav/nav-menu";
import { SearchNav } from "@/ui/nav/search-nav";
import { SeoH1 } from "@/ui/seo-h1";
import { YnsLink } from "@/ui/yns-link";

export const Nav = async () => {
	const session = await auth();
	return (
		<header className="z-50 py-4 sticky top-0 bg-white/90 backdrop-blur-xs nav-border-reveal">
			<div className="mx-auto flex max-w-7xl items-center gap-2 px-4 flex-row sm:px-6 lg:px-8">
				<YnsLink href="/">
					<SeoH1 className="-mt-0.5 whitespace-nowrap text-xl font-bold">Mel Davis</SeoH1>
				</YnsLink>

				<div className="max-w-full flex shrink w-auto sm:mr-auto overflow-auto max-sm:order-2">
					<NavMenu />
				</div>
				<div className="mr-3 ml-auto sm:ml-0">
					<SearchNav />
				</div>
				<CartIcon />
				{session?.user.role === "admin" && (
					<YnsLink href="/admin" className="mr-2 text-sm font-medium hover:underline">
						Admin
					</YnsLink>
				)}
				<YnsLink href={session ? "/user" : "/login"}>
					<UserIcon className="hover:text-neutral-500" />
				</YnsLink>
			</div>
		</header>
	);
};
