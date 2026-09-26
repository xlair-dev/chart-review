"use client";

import { useId } from "react";

export function ConfirmationDialog({
	open,
	title,
	description,
	confirmLabel,
	isPending = false,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	isPending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const titleId = useId();
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
			<section
				aria-labelledby={titleId}
				aria-modal="true"
				className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
				role="alertdialog"
			>
				<h2 className="text-lg font-semibold" id={titleId}>
					{title}
				</h2>
				<p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
				<div className="mt-6 flex justify-end gap-3">
					<button
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
						disabled={isPending}
						onClick={onCancel}
						type="button"
					>
						キャンセル
					</button>
					<button
						className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
						disabled={isPending}
						onClick={onConfirm}
						type="button"
					>
						{isPending ? "処理中…" : confirmLabel}
					</button>
				</div>
			</section>
		</div>
	);
}
