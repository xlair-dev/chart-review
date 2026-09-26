"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const workspaces = [
	{ href: "/viewer", label: "譜面ビューワー" },
	{ href: "/feedback", label: "フィードバック会" },
];

export function WorkspaceTabs() {
	const pathname = usePathname();

	return (
		<nav aria-label="ワークスペース" className="mt-5 border-b border-slate-200">
			<div className="flex gap-6">
				{workspaces.map((workspace) => {
					const isActive = pathname.startsWith(workspace.href);
					return (
						<Link
							aria-current={isActive ? "page" : undefined}
							className={`border-b-2 px-1 pb-3 text-sm font-medium ${isActive ? "border-sky-700 text-sky-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
							href={workspace.href}
							key={workspace.href}
						>
							{workspace.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
