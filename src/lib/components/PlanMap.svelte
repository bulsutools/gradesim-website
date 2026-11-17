<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cardFacts, columnFacts, isCritical, STATUS, unitsText, type Card, type Column, type View } from '#lib/planner.ts';
	import { routeEdges, type Rect } from '#lib/route-edges.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		view,
		columns,
		primary,
		selected,
		onselect,
		detail,
		compact = false
	}: {
		view: View;
		columns: Column[];
		primary: Record<string, Card>;
		selected: string | null;
		onselect: (code: string) => void;
		detail: Snippet<[string]>;
		compact?: boolean;
	} = $props();

	const COL_GAP = $derived(compact ? 10 : 40);
	const ROW_GAP = $derived(compact ? 4 : 14);
	// More sems than the page width holds, so the compact map takes the window's width.
	const bleed = $derived(compact && columns.length > 11);

	let grid: HTMLDivElement | undefined = $state();
	let scroller: HTMLDivElement | undefined = $state();

	// Open on the sem before the next one, with older sems a scroll away.
	$effect(() => {
		const start = grid?.querySelector<HTMLElement>('[data-start]');
		const before = start?.previousElementSibling as HTMLElement | null;
		if (scroller && before) scroller.scrollLeft = before.offsetLeft;
	});
	// Keep the picked course in view once the details panel narrows the map.
	$effect(() => {
		const code = selected;
		if (!code || !grid) return;
		const frame = requestAnimationFrame(() =>
			grid?.querySelector<HTMLElement>(`.pm-card[data-primary][data-code="${CSS.escape(code)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
		);
		return () => cancelAnimationFrame(frame);
	});
	let paths = $state<{ d: string; kind: string }[]>([]);
	let size = $state({ w: 0, h: 0 });

	const model = $derived(view.model);
	const chain = $derived.by(() => {
		if (!selected) return null;
		const anc = model.graph.ancestors(selected);
		const desc = model.graph.descendants(selected);
		return { anc, desc, all: new Set([selected, ...anc, ...desc]) };
	});

	// The selected course's chain, or every prerequisite still ahead.
	$effect(() => {
		const g = grid;
		const ch = chain;
		const focus = selected;
		void columns;
		void compact;
		if (!g) return;
		const frame = requestAnimationFrame(() => {
			const box = g.getBoundingClientRect();
			size = { w: g.scrollWidth, h: g.scrollHeight };
			const rect = (code: string): Rect | null => {
				const el = g.querySelector<HTMLElement>(`.pm-card[data-primary][data-code="${CSS.escape(code)}"]`);
				if (!el) return null;
				const r = el.getBoundingClientRect();
				return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
			};
			const drawn: { kind: string; from: Rect; to: Rect }[] = [];
			model.graph.edges.forEach(({ from, to }) => {
				let kind = '';
				if (ch) {
					const up = (to === focus || ch.anc.has(to)) && ch.anc.has(from);
					const down = (from === focus || ch.desc.has(from)) && ch.desc.has(to);
					if (up || down) kind = 'chain';
				} else if (!view.passed.has(from)) kind = isCritical(from, view) && isCritical(to, view) ? 'chain' : 'crit';
				if (!kind) return;
				const a = rect(from);
				const b = rect(to);
				if (a && b && a.x + a.w < b.x) drawn.push({ kind, from: a, to: b });
			});
			paths = routeEdges(drawn, { colGap: COL_GAP, rowGap: ROW_GAP }).map(({ d }, i) => ({ d, kind: drawn[i].kind }));
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

{#snippet tag(t: string)}{#if t === 'Now' || t === 'Next'}<span class="pm-tag">{t === 'Now' ? 'now' : 'next'}</span>{/if}{/snippet}
<div class="pm-wrap" class:bleed class:open={selected && model.byCode.has(selected)}>
<div class="pm-scroll" bind:this={scroller}>
	<svg class="pm-arrows" width={size.w} height={size.h} aria-hidden="true">
		<defs>
			<marker id="pm-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" /></marker>
		</defs>
		{#each paths as p, k (k)}<path class="pm-edge {p.kind}" d={p.d} marker-end="url(#pm-head)" />{/each}
	</svg>
	<div class="pm-grid" class:compact data-testid="planner-map" bind:this={grid} style="--gap: {COL_GAP}px; --row: {ROW_GAP}px">
		{#each columns as column (column.abs)}
			{@const f = columnFacts(column, view)}
			<section class="pm-col" class:past={f.isPast && f.tag !== 'Now'} data-start={column.abs === view.startAbs ? '' : undefined} aria-label="{f.name} {f.sub}">
				<header>
					<span class="pm-name">{f.name}{#if !compact}{@render tag(f.tag)}{/if}</span>
					<span class="pm-sub">{f.sub}<span class="pm-units"><span class:warn={f.loud}>{f.off ? 'Off' : unitsText(f.units)}</span>{#if compact}{@render tag(f.tag)}{/if}</span></span>
				</header>
				{#each column.cards as card (card)}
					{@const c = model.byCode.get(card.code)!}
					{@const facts = cardFacts(card, view)}
					{@const isPrimary = primary[card.code] === card}
					<button
						type="button"
						class="pm-card st-{card.status}"
						class:history={card.history || card.hypothetical}
						class:crit={facts.crit && !chain}
						class:focus={selected === card.code && isPrimary}
						class:dim={chain && !chain.all.has(card.code)}
						data-code={card.code}
						data-primary={isPrimary ? '1' : undefined}
						aria-pressed={selected === card.code && isPrimary}
						title={compact ? c.title : undefined}
						aria-label="{c.code}, {c.title}. {facts.statusLabel}{facts.crit ? ', take on time' : ''}. {unitsText(Number(c.units) || 0)}{card.grade ? `, grade ${card.grade}` : ''}."
						onclick={() => onselect(card.code)}
					>
						<span class="pm-top"><Icon name={STATUS[card.status][0] as IconName} size={compact ? 12 : 14} /><span class="pm-code">{c.code}</span>{#if card.grade}<span class="pm-grade">{card.grade}</span>{/if}</span>
						<span class="pm-title">{c.title}</span>
					</button>
				{/each}
			</section>
		{/each}
	</div>
</div>
{#if selected && model.byCode.has(selected)}<div class="pm-side">{@render detail(selected)}</div>{/if}
</div>

<style>
	.pm-wrap {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		align-items: start;
		margin-bottom: 16px;
	}

	.pm-wrap.open {
		grid-template-columns: minmax(0, 1fr) 340px;
	}

	.pm-wrap.bleed {
		margin-inline: calc((100% - 100vw) / 2 + 32px);
	}

	.pm-side {
		position: sticky;
		top: 76px;
		max-height: calc(100vh - 92px);
		overflow-y: auto;
	}

	.pm-side :global(.pl-detail) {
		margin: 0;
	}

	.pm-scroll {
		position: relative;
		overflow-x: auto;
		padding-bottom: 8px;
	}

	.pm-arrows {
		position: absolute;
		inset: 0 auto auto 0;
		pointer-events: none;
		z-index: 1;
		overflow: visible;
	}

	.pm-grid {
		display: flex;
		align-items: flex-start;
		gap: var(--gap);
		width: max-content;
		padding: 4px 2px;
	}

	.pm-col {
		display: flex;
		flex-direction: column;
		gap: var(--row);
		width: 148px;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 2px 8px;
		border-bottom: 2px solid var(--brand-line);
	}

	.past header {
		border-bottom-color: var(--border);
	}

	.pm-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		color: var(--ink);
	}

	.pm-tag {
		padding: 0 6px;
		border-radius: var(--radius-pill);
		background: var(--brand);
		color: var(--on-brand);
		font-size: 0.8125rem;
		font-weight: 650;
	}

	.pm-sub {
		display: flex;
		justify-content: space-between;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.pm-sub .warn {
		color: var(--warn);
	}

	.pm-card {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 2px;
		height: 62px;
		padding: 7px 9px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		color: var(--body);
		font: inherit;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		transition: opacity var(--transition-fast), box-shadow var(--transition-fast);
	}

	.pm-card:hover {
		box-shadow: var(--shadow-sm);
	}

	.pm-card:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}

	.pm-top {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.pm-code {
		font-weight: 700;
		color: var(--ink);
		white-space: nowrap;
	}

	.pm-grade {
		margin-left: auto;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	.pm-title {
		font-size: 0.8125rem;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.st-passed .pm-top :global(.icon) { color: var(--ok); }
	.st-inprogress .pm-top :global(.icon) { color: var(--info); }
	.st-failed, .st-retake { border-color: var(--bad); }
	.st-failed .pm-top :global(.icon), .st-retake .pm-top :global(.icon) { color: var(--bad); }
	.st-retake { border-style: dashed; }
	.st-ready .pm-top :global(.icon) { color: var(--brand); }
	.st-locked { border-style: dashed; background: var(--bg-card); }

	.history {
		opacity: 0.6;
	}

	.crit {
		border-color: var(--brand);
	}

	.dim {
		opacity: 0.4;
	}

	.pm-card.focus {
		box-shadow: 0 0 0 3px var(--brand);
	}

	.compact.pm-grid {
		width: auto;
	}

	.compact .pm-col {
		flex: 1 0 88px;
		min-width: 0;
		max-width: 148px;
	}

	.compact header {
		gap: 0;
		padding-bottom: 6px;
	}

	.compact .pm-name {
		font-size: 0.9375rem;
		white-space: nowrap;
	}

	.compact .pm-tag {
		padding: 0 5px;
	}

	.compact .pm-sub {
		flex-direction: column;
		gap: 0;
	}

	.pm-units {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}

	.compact .pm-card {
		justify-content: center;
		height: 28px;
		padding: 3px 5px;
	}

	.compact .pm-top {
		gap: 4px;
	}

	.compact .pm-code {
		overflow: hidden;
		font-size: 0.8125rem;
		text-overflow: ellipsis;
	}

	.compact .pm-grade,
	.compact .pm-title {
		display: none;
	}

	.pm-edge {
		fill: none;
		stroke: var(--brand);
	}

	.pm-edge.crit {
		stroke-width: 1.25;
		opacity: 0.5;
	}

	.pm-edge.chain {
		stroke-width: 2;
	}

	marker path {
		fill: var(--brand);
	}
</style>
