import Link from "next/link";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

export function FeedbackBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
	return (
		<nav aria-label="パンくずリスト" className="mt-3 text-sm">
			<ol className="flex flex-wrap items-center gap-2 text-slate-500">
				{items.map((item, index) => (
					<li
						className="flex items-center gap-2"
						key={`${item.href ?? "current"}-${item.label}`}
					>
						{index > 0 && (
							<span aria-hidden="true" className="text-slate-400">
								/
							</span>
						)}
						{item.href ? (
							<Link
								className="rounded px-1 text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:bg-sky-50 hover:text-sky-700 hover:decoration-sky-500"
								href={item.href}
							>
								{item.label}
							</Link>
						) : (
							<span aria-current="page" className="font-medium text-sky-700">
								{item.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
