"use client";

import { useEffect, useId, useRef } from "react";

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
	const descriptionId = useId();
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const element = dialog.current;
		if (!element) return;
		if (open && !element.open) element.showModal();
		if (!open && element.open) element.close();
	}, [open]);

	return (
		<dialog
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
			className="m-auto w-full max-w-md bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/50"
			onCancel={(event) => {
				event.preventDefault();
				onCancel();
			}}
			ref={dialog}
			role="alertdialog"
		>
			<section className="rounded-2xl bg-white p-6 shadow-xl">
				<h2 className="text-lg font-semibold" id={titleId}>
					{title}
				</h2>
				<p className="mt-3 text-sm leading-6 text-slate-600" id={descriptionId}>
					{description}
				</p>
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
		</dialog>
	);
}
