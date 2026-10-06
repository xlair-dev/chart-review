const urlPattern = /https?:\/\/[^\s<>"']+/gi;
const trailingPunctuation = /[.,!?;:。、「」『』）)\]}]+$/;

export function CommentBody({ text }: { text: string }) {
	const parts: React.ReactNode[] = [];
	let offset = 0;
	for (const match of text.matchAll(urlPattern)) {
		const url = match[0];
		const start = match.index;
		if (start === undefined) continue;
		let linkedUrl = url;
		while (trailingPunctuation.test(linkedUrl))
			linkedUrl = linkedUrl.slice(0, -1);
		if (!linkedUrl) continue;
		parts.push(text.slice(offset, start));
		parts.push(
			<a
				className="break-all text-sky-700 underline underline-offset-2 hover:text-sky-900"
				href={linkedUrl}
				key={`${start}-${linkedUrl}`}
				rel="noopener noreferrer"
				target="_blank"
				onClick={(event) => event.stopPropagation()}
			>
				{linkedUrl}
			</a>,
		);
		parts.push(url.slice(linkedUrl.length));
		offset = start + url.length;
	}
	parts.push(text.slice(offset));
	return <>{parts}</>;
}
