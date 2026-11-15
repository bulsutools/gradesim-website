<script lang="ts">
	import { tick } from 'svelte';
	import { app, download } from '#lib/app.svelte.ts';
	import { groupGWA, termKeyToAbs } from '#lib/grades.ts';
	import { parseImport } from '#lib/importers.ts';
	import { UPLB_CATALOG } from '#lib/catalog.ts';
	import { getProgramDataQuality, isNonGwaCourseCode, UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import {
		absLabel,
		buildColumns,
		cardFacts,
		columnFacts,
		compute,
		DEFAULT_PLANNER_OPTIONS,
		exportModel,
		makePlanFile,
		markConflict,
		modelFor,
		offeringLabel,
		optionEffect,
		planTrack,
		restricted,
		STATUS,
		summary,
		termsLate,
		termsText,
		unitsText,
		today,
		whatIfMessage,
		type Card,
		type Column,
		type PlannerInput,
	} from '#lib/planner.ts';
	import { fixIssue, fixText, type ChecklistFix } from '#lib/fix.ts';
	import { preGroups } from '#lib/scheduler.ts';
	import { buildPlannerSheets, writeXlsx } from '#lib/xlsx.ts';
	import FixForm from './FixForm.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Notice from './Notice.svelte';
	import StatusLabel from './StatusLabel.svelte';
	import './planner.css';

	const model = $derived(modelFor(app.s.selectedProgram, planTrack(app.program, app.grades, app.s.track), app.specialization, app.fixes));
	const quality = $derived(getProgramDataQuality(app.s.selectedProgram));
	const options = $derived(app.s.plannerOptions ?? DEFAULT_PLANNER_OPTIONS);
	const input = $derived<PlannerInput>({
		gradesData: app.grades,
		substitutions: app.s.substitutions,
		customCourseStatus: app.s.customCourseStatus,
		plannerPins: app.s.plannerPins,
		plannerPetitions: app.s.plannerPetitions,
		plannerOptions: options,
		whatif: app.whatif
	});
	const view = $derived(model ? compute(model, input) : null);
	const layout = $derived(view ? buildColumns(view) : null);
	const sum = $derived(view ? summary(view) : null);
	let selected = $state<string | null>(null);
	let status = $state('');
	let notice = $state<{ text: string; bad: boolean } | null>(null);
	let menu: HTMLDetailsElement | undefined = $state();
	let planInput: HTMLInputElement | undefined = $state();
	let sheetEl: HTMLDivElement | undefined = $state();
	// The course whose fix form is open, or 'add' for a missing course.
	let fixing = $state<string | null>(null);
	let acted = $state<string | null>(null);

	function saveFix(fix: ChecklistFix) {
		app.setFix(fix);
		fixing = null;
		if (fix.kind === 'remove') selected = null;
		status = `${fix.code} ${fixText(fix)}. Your plan now uses this.`;
	}

	async function sendFixes() {
		const program = app.program.code;
		const fixes = app.fixes.filter((f) => !f.sent);
		let ok = false;
		try {
			const res = await fetch('/api/fix/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ program, fixes }) });
			ok = res.ok;
		} catch {
			/* offline or no function: fall back to GitHub */
		}
		if (ok) {
			app.setFixes(app.fixes.map((f) => ({ ...f, sent: true })));
			notice = { text: 'Sent. A maintainer will review your fixes. Thank you.', bad: false };
		} else {
			const issue = fixIssue(program, fixes);
			window.open(`https://github.com/uplbtools/gradesim/issues/new?${new URLSearchParams(issue)}`, '_blank', 'noopener');
			notice = { text: 'GitHub opened in a new tab with your fixes filled in. Submit the issue there to send them.', bad: false };
		}
	}

	const chain = $derived.by(() => {
		if (!selected || !model) return null;
		return new Set([selected, ...model.graph.ancestors(selected), ...model.graph.descendants(selected)]);
	});

	const wiResult = $derived(app.whatif && view ? whatIfMessage(view) : '');

	// Academic years, each with its terms. Named courses come first, then the GE, HK, NSTP and elective slots.
	const years = $derived.by(() => {
		if (!view || !layout || !model) return [];
		const slot = (card: Card) => (model.byCode.get(card.code)!.genericRequirement ? 1 : 0);
		const out: { label: string; terms: { column: Column; f: ReturnType<typeof columnFacts>; name: string; sem?: number; gwa: number; cards: Card[]; failed: number }[] }[] = [];
		layout.list.forEach((column) => {
			const f = columnFacts(column, view);
			const dated = Number.isFinite(column.abs) && column.abs >= 0;
			const label = dated ? f.sub : f.name;
			if (out.at(-1)?.label !== label) out.push({ label, terms: [] });
			out.at(-1)!.terms.push({
				column,
				f,
				name: dated ? f.name : f.sub,
				sem: dated ? column.abs % 3 : undefined,
				gwa: f.isPast ? groupGWA(app.courses.filter((c) => termKeyToAbs(c.termKey) === column.abs), app.excluded).gwa : 0,
				cards: [...column.cards].sort((a, b) => slot(a) - slot(b) || a.code.localeCompare(b.code, undefined, { numeric: true })),
				failed: column.cards.filter((c) => c.status === 'failed' && !c.hypothetical).length
			});
		});
		return out;
	});
	const isDone = (t: (typeof years)[number]['terms'][number]) => t.f.isPast && t.f.tag !== 'Now';
	const split = (done: boolean) => years.map((y) => ({ ...y, terms: y.terms.filter((t) => isDone(t) === done) })).filter((y) => y.terms.length);
	const ahead = $derived(split(false));
	const past = $derived(split(true));
	const spare = $derived(view?.now.result.spare ?? []);
	const pastLine = $derived.by(() => {
		const terms = past.flatMap((y) => y.terms);
		const dated = terms.filter((t) => t.sem !== undefined);
		const mids = dated.filter((t) => t.sem === 2).length;
		const units = terms.reduce((n, t) => n + t.cards.filter((c) => c.status === 'passed' && !isNonGwaCourseCode(c.code)).reduce((u, c) => u + (Number(model?.byCode.get(c.code)?.units) || 0), 0), 0);
		return `${termsText(dated.length - mids)}${mids ? ` and ${mids} midyear${mids === 1 ? '' : 's'}` : ''} done, ${unitsText(units)} passed`;
	});

	async function focusCard(code: string) {
		await tick();
		const el = sheetEl?.querySelector<HTMLElement>(`.pl-row[data-primary][data-code="${CSS.escape(code)}"]`);
		for (let d = el?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
		el?.scrollIntoView({ block: 'nearest' });
		el?.focus({ preventScroll: true });
	}

	function select(code: string) {
		selected = selected === code ? null : code;
		if (selected && model) status = `${code} selected. ${model.graph.blocking[code] || 0} courses depend on it.`;
	}

	function goto(code: string) {
		selected = code;
		focusCard(code);
	}

	function setOptions(patch: Partial<typeof options>) {
		app.s.plannerOptions = { ...options, ...patch };
	}

	let menuOpen = $state(false);
	const CAPS = [[18, '18 units'], [21, '21 units'], ['checklist', "the checklist's load"]] as const;
	const effects = $derived.by(() => {
		if (!menuOpen || !view) return null;
		const v = view;
		const caps = CAPS.filter(([cap]) => cap !== options.cap)
			.map(([cap, label]) => [label, optionEffect(v, { cap })] as const)
			.filter(([, text]) => text.startsWith("you'd"))
			.map(([label, text]) => `With ${label}, ${text}`);
		return {
			cap: caps.join(' ') || 'Your graduation sem is the same at any load.',
			midyear: optionEffect(v, { midyear: !options.midyear }),
			midyear9: optionEffect(v, { midyear9: !options.midyear9 })
		};
	});
	const petitions = $derived(Object.keys(app.s.plannerPetitions));

	function act(name: 'passed' | 'failed' | 'clear' | 'later' | 'unpin', code: string) {
		if (!view) return;
		if (name === 'passed' || name === 'failed') {
			const next = { ...app.s.customCourseStatus };
			if (name === view.info[code].auto) delete next[code];
			else next[code] = name;
			app.s.customCourseStatus = next;
			status = `${code} marked ${name}`;
		} else if (name === 'clear') {
			const next = { ...app.s.customCourseStatus };
			delete next[code];
			app.s.customCourseStatus = next;
		} else if (name === 'later') {
			const t = view.now.result.assignedTerm[code];
			app.s.plannerPins = { ...app.s.plannerPins, [code]: view.startAbs + t + 1 };
		} else {
			const next = { ...app.s.plannerPins };
			delete next[code];
			app.s.plannerPins = next;
		}
		acted = code;
		focusCard(code);
	}

	function togglePetition(code: string, on: boolean) {
		const next = { ...app.s.plannerPetitions };
		if (on) next[code] = true;
		else delete next[code];
		app.s.plannerPetitions = next;
	}

	function clearWhatif() {
		app.whatif = null;
	}

	function closeMenu() {
		if (menu) menu.open = false;
	}

	function autoPlan() {
		app.s.plannerPins = {};
		closeMenu();
		status = 'Plan recomputed from scratch.';
	}

	function resetPlan() {
		closeMenu();
		if (!confirm('Reset the plan? This clears courses you marked passed or failed, courses you moved, and petitions. Your grades stay.')) return;
		app.s.customCourseStatus = {};
		app.s.plannerPins = {};
		app.s.plannerPetitions = {};
		clearWhatif();
	}

	function savePlan() {
		closeMenu();
		const plan = makePlanFile(app.s.selectedProgram, input);
		download(`gradesim-plan-${app.s.selectedProgram}-${today()}.json`, new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
		status = 'Plan saved as a file.';
	}

	async function loadPlan(file: File) {
		closeMenu();
		const r = parseImport(await file.text());
		if (r.kind !== 'plan') {
			notice = { text: r.kind === 'error' ? r.message : 'That file has grades, not a plan. Load it from the Grades tab.', bad: true };
			return;
		}
		if (r.plan.program !== app.s.selectedProgram) {
			const name = UPLB_PROGRAMS[r.plan.program].name;
			if (!confirm(`This plan is for ${name}. Switch to ${name} and load it? Your current marks and moves are replaced.`)) return;
		}
		app.applyPlan(r.plan);
		const saved = new Date(r.plan.savedAt);
		notice = { text: `Loaded the plan saved ${Number.isNaN(saved.getTime()) ? 'earlier' : saved.toLocaleDateString('en-CA')}.`, bad: false };
	}

	function printPlan() {
		closeMenu();
		selected = null;
		sheetEl?.querySelectorAll('details').forEach((d) => (d.open = true));
		window.print();
	}

	function exportXlsx() {
		closeMenu();
		if (!view || !layout) return;
		const bytes = writeXlsx(buildPlannerSheets(exportModel(view, layout.list, layout.primary)));
		download(`gradesim-plan-${app.s.selectedProgram}-${today()}.xlsx`, new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
		status = 'Excel file downloaded.';
	}

	function onWindowClick(e: MouseEvent) {
		if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (menu?.open) menu.open = false;
		else if (selected) {
			const code = selected;
			selected = null;
			focusCard(code);
		}
	}

</script>

<svelte:window onclick={onWindowClick} onkeydown={onKey} />

{#snippet detail(code: string)}
	{#if view && model}
		{@const c = model.byCode.get(code)!}
		{@const i = view.info[code]}
		{@const card = layout?.primary[code]}
		{@const t = view.now.result.assignedTerm[code]}
		{@const slip = c.genericRequirement === 'elective' && view.slips[code] > 0 ? undefined : view.slips[code]}
		{@const blocking = model.graph.blocking[code] || 0}
		{@const delay = model.graph.delay[code] || 1}
		{@const deps = model.graph.edges.filter((e) => e.from === code).map((e) => e.to)}
		{@const past = i.tries.length > 0}
		{@const fix = app.fixes.find((f) => f.code === code)}
		{@const off = c.offered as Record<number, number> | null | undefined}
		{@const passBlock = i.status !== 'passed' && markConflict(view, code, 'passed')}
		{@const failBlock = i.status !== 'failed' && markConflict(view, code, 'failed')}
		<aside class="pl-detail" aria-label="Details for {code}">
			<div class="pl-detail-head">
				<div>
					<p class="pl-detail-code">{c.code} <StatusLabel status={card ? card.status : i.status === 'failed' ? 'failed' : 'planned'} label={card?.waitingOn ? `Waiting on ${card.waitingOn}` : undefined} /></p>
					<p class="pl-detail-title">{c.title}</p>
				</div>
				<button type="button" class="pl-close" aria-label="Close details" onclick={() => select(code)}><Icon name="x" /></button>
			</div>
			<p class="pl-muted">
				{`${unitsText(c.units)}, offered ${offeringLabel(c).toLowerCase()}${off && !c.fixed ? ` (${off[1] ?? 0} of 4 first sems, ${off[2] ?? 0} of 3 second sems, ${off[3] ?? 0} of 2 midyears seen)` : ''}.${t !== undefined ? ` Planned for ${absLabel(view.startAbs + t)}.` : ''}`}
			</p>
			{#if i.status !== 'passed' && (blocking || delay > 1 || slip !== undefined)}
				<ul class="pl-metrics">
					{#if blocking}<li><strong>{blocking}</strong> {blocking === 1 ? 'course needs' : 'courses need'} this first.</li>{/if}
					{#if slip !== undefined}
						{#if slip > 0}
							<li class="bad"><strong>Take this on time.</strong> A sem later moves your graduation by {slip === Infinity ? 'more than the plan can show' : termsText(termsLate(view, view.now.result.gradTermIndex, view.now.result.gradTermIndex + slip))}.</li>
						{:else}
							<li>You can take this a sem later and still graduate on time.</li>
						{/if}
					{/if}
				</ul>
			{/if}
			{#if c.options}
				<h4>Take one of these</h4>
				<ul class="pl-reqs">
					{#each c.options as o (o)}
						<li><strong>{o}</strong> {UPLB_CATALOG[o]?.title.replace(/\.$/, '') ?? ''}{view.passed.has(o) ? ', passed' : ''}</li>
					{/each}
				</ul>
			{/if}
			<h4>Requires</h4>
			{#if preGroups(c).length || c.co?.length || c.standing || c.coi || c.note}
				<ul class="pl-reqs">
					{#each preGroups(c) as g, gi (gi)}
						<li>{@render group(g)}</li>
					{/each}
					{#each c.co || [] as x (x)}
						<li>Take with {@render group([x])} (corequisite)</li>
					{/each}
					{#if c.standing}<li>This needs {c.standing} standing, which GradeSim counts as {c.standing === 'senior' ? '75' : '50'}% of your units.</li>{/if}
					{#if c.coi}<li>Consent of instructor (COI) also works</li>{/if}
					{#if c.note}<li class="pl-muted">AMIS says {c.note}</li>{/if}
				</ul>
			{:else}
				<p class="pl-muted">No prerequisites.</p>
			{/if}
			{#if deps.length}
				<h4>Unlocks</h4>
				<p class="pl-deps">{#each deps as d (d)}{@render group([d])}{/each}</p>
			{/if}
			<div class="pl-actions">
				{#if i.status !== 'passed' && !passBlock}<button type="button" class="btn btn-secondary" onclick={() => act('passed', code)}><Icon name="check" />Mark passed</button>{/if}
				{#if i.status !== 'failed' && !failBlock}<button type="button" class="btn btn-secondary" onclick={() => act('failed', code)}><Icon name="x" />{past || i.status === 'inprogress' ? 'Mark failed' : 'Mark failed (what-if)'}</button>{/if}
				{#if i.override}<button type="button" class="textbtn" onclick={() => act('clear', code)}>Use {past ? 'my grades' : 'the plan'} again</button>{/if}
				{#if t !== undefined}<button type="button" class="textbtn" onclick={() => act('later', code)}>Can't get a slot</button>{/if}
				{#if app.s.plannerPins[code] != null}<button type="button" class="textbtn" onclick={() => act('unpin', code)}>Back to earliest</button>{/if}
			</div>
			{#if failBlock}<p class="pl-muted">{failBlock.code} is passed, so {code} can't be marked failed.</p>{/if}
			{#if passBlock}<p class="pl-muted">{passBlock.pre} is failed, so {code} can't be marked passed.</p>{/if}
			{#if acted === code && sum}<p><strong>{sum.headline}.{sum.deltaText ? ` ${sum.deltaText}.` : ''}</strong></p>{/if}
			{#if restricted(c) && i.status !== 'passed'}
				<label class="pl-petition">
					<input type="checkbox" checked={!!app.s.plannerPetitions[code]} onchange={(e) => togglePetition(code, e.currentTarget.checked)} />
					<span>Plan on a petition<small>A petition needs about 10 students and approval from the department, the college and OVCAA.</small></span>
				</label>
			{/if}
			{#if fixing === code}
				<FixForm course={c} onsave={saveFix} oncancel={() => (fixing = null)} />
			{:else if fix}
				<p class="pl-muted">
					Your fix is in your plan{fix.sent ? ' and was sent' : ''}.
					{#if !fix.sent}<button type="button" class="textbtn" onclick={sendFixes}>Send to UPLB Tools</button>{/if}
					<button type="button" class="textbtn" onclick={() => (fixing = code)}>Change it</button>
				</p>
			{:else if !c.genericRequirement}
				<p class="pl-muted">Is something wrong here? <button type="button" class="textbtn" onclick={() => (fixing = code)}>Fix this course</button></p>
			{/if}
		</aside>
	{/if}
{/snippet}

{#snippet group(codes: string[])}
	{#each codes as code, k (code)}
		{@const inList = model?.byCode.has(code)}
		{@const st = view?.passed.has(code) ? 'passed' : view?.failures.some((f) => f.code === code) ? 'failed' : inList ? 'todo' : 'outside'}
		{#if k > 0}<span class="pl-or"> or </span>{/if}
		{#if inList}
			<button type="button" class="pl-link st-{st}" onclick={() => goto(code)}><Icon name={st === 'passed' ? 'check' : st === 'failed' ? 'x' : 'planned'} size={14} />{code}</button>
		{:else}
			<span class="pl-link st-{st}" title="Not in your checklist"><Icon name="planned" size={14} />{code}</span>
		{/if}
	{/each}
{/snippet}

{#snippet yearList(list: typeof years)}
	{#if view && layout && model}
	{#each list as year (year.label)}
		<section class="pl-year" aria-label={year.label}>
			<h3>{year.label}</h3>
			{#each year.terms as term (term.column.abs)}
						{@const f = term.f}
						<details class="pl-term" class:past={f.isPast} data-sem={term.sem} open={!f.isPast || f.tag === 'Now' || term.failed > 0}>
							<summary>
								<Icon name="chevron" size={16} />
								<span class="pl-term-name">{term.name}</span>
								{#if f.tag === 'Next' || f.tag === 'Now'}<span class="pl-term-tag">{f.tag === 'Next' ? 'next' : 'now'}</span>{/if}
								<span class="pl-term-facts">
									{#if term.failed}<span class="bad">{term.failed} failed</span>{/if}
									{#if term.gwa}<span>GWA {term.gwa.toFixed(4)}</span>{/if}
									{#if f.future && !f.isMid && f.units > 18}<span class="warn">heavy</span>{/if}
									<span class:warn={f.loud}>{#if f.loud}<Icon name="alert" size={13} />{/if}{f.cap ? `${f.units} of ${f.cap} units` : unitsText(f.units)}</span>
								</span>
							</summary>
							{#if f.warn}<p class="pl-term-warn">{f.warn}</p>{/if}
							<ul class="pl-rows" class:nograde={!term.cards.some((c) => c.grade)}>
								{#each term.cards as card (card)}
									{@const c = model.byCode.get(card.code)!}
									{@const facts = cardFacts(card, view)}
									{@const isPrimary = layout.primary[card.code] === card}
									{@const word = card.status === 'passed' || card.status === 'planned' || card.status === 'ready' ? '' : facts.statusLabel}
									<li>
										<button
											type="button"
											class="pl-row st-{card.status}"
											class:history={card.history || card.hypothetical}
											class:generic={!!c.genericRequirement}
											class:chain={chain?.has(card.code) && !(selected === card.code && isPrimary)}
											class:dim={chain && !chain.has(card.code)}
											data-code={card.code}
											data-primary={isPrimary ? '1' : undefined}
											aria-pressed={selected === card.code && isPrimary}
											aria-label="{c.code}, {c.title}. {facts.statusLabel}{facts.crit ? ', take on time' : ''}. {unitsText(Number(c.units) || 0)}{card.grade ? `, grade ${card.grade}` : ''}.{card.waitingOn ? ` Waiting on ${card.waitingOn}.` : ''}"
											onclick={() => select(card.code)}
										>
											<span class="pl-mark"><Icon name={STATUS[card.status][0] as IconName} size={16} /></span>
											<span class="pl-code">{c.code}</span>
											<span class="pl-title">{c.title}</span>
											<span class="pl-row-note" class:warn={facts.note?.warn}>
												{[facts.note?.text ?? word, card.pinned ? 'Moved by you' : '', facts.crit ? 'Take on time' : ''].filter(Boolean).join(', ')}
											</span>
											<span class="pl-row-units">{c.units}</span>
											<span class="pl-row-grade">{card.grade ?? ''}</span>
										</button>
										{#if isPrimary && selected === card.code}{@render detail(card.code)}{/if}
									</li>
								{:else}
									<li class="pl-empty">Nothing offered that fits</li>
								{/each}
							</ul>
							{#if f.tag === 'Next' && spare.length}
								<details class="pl-term pl-also">
									<summary><Icon name="chevron" size={16} />You can also take {spare.length} other course{spare.length === 1 ? '' : 's'}</summary>
									<p class="pl-muted">Their prerequisites are done, so swap one in if a section is full.</p>
									<ul class="pl-rows nograde">
										{#each spare as code (code)}
											{@const c = model.byCode.get(code)!}
											<li>
												<button type="button" class="pl-row" class:generic={!!c.genericRequirement} data-also={code} onclick={() => goto(code)}>
													<span class="pl-mark"><Icon name="ready" size={16} /></span>
													<span class="pl-code">{c.code}</span>
													<span class="pl-title">{c.title}</span>
													<span class="pl-row-note">Planned for {absLabel(view.startAbs + view.now.result.assignedTerm[code])}</span>
													<span class="pl-row-units">{c.units}</span>
												</button>
											</li>
										{/each}
									</ul>
								</details>
							{/if}
						</details>
			{/each}
		</section>
	{/each}
	{/if}
{/snippet}

{#if !view || !layout || !sum || !model}
	<Notice>The planner doesn't have a checklist for this program yet.</Notice>
{:else}
	<div class="planner">
		{#if notice}
			<Notice tone={notice.bad ? 'bad' : 'ok'} live>{notice.text}</Notice>
		{/if}
		{#if !quality.confident}
			<Notice tone="warn"><strong>Treat this plan as a rough guide.</strong> {quality.reasons.join(' ')}</Notice>
		{/if}

		<section class="pl-summary" aria-live="polite">
			<p class="pl-print-only">{app.program.name}</p>
			<h2 class="pl-grad" data-testid="grad-term">
				<span>{sum.headline}</span>
				{#if sum.deltaText}<span class="pl-delta" class:ok={sum.deltaOk}><Icon name={sum.deltaOk ? 'check' : 'alert'} />{sum.deltaText}</span>{/if}
			</h2>
			<p class="pl-sub">{sum.sub}</p>
			{#if sum.costs.length || view.conflicts.length}
				<ul class="pl-costs">
					{#each sum.costs as c (c.code)}
						<li class:bad={c.cost > 0}>
							<Icon name={c.cost > 0 ? 'x' : 'check'} size={16} />
							<span><strong>{c.code}</strong> {c.source === 'whatif' ? 'in the what-if' : c.past ? 'failed' : 'marked failed'}, {c.cost > 0 ? `${termsText(c.cost)} later` : 'no delay'}</span>
						</li>
					{/each}
					{#each view.conflicts as c (c.code + c.pre)}
						<li class="bad">
							<Icon name="alert" size={16} />
							<span><strong>{c.code}</strong> is passed, so its prerequisite {c.pre} can't be failed. Check the mark on {c.pre}.</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="pl-controls">
			<details class="pl-menu" bind:this={menu} ontoggle={(e) => (menuOpen = e.currentTarget.open)}>
				<summary class="btn btn-secondary">Plan settings<Icon name="chevron" /></summary>
				<div class="pl-menu-pop">
					<button type="button" class="pl-menu-item" onclick={autoPlan}>Auto-plan again<small>Drops courses you pushed later</small></button>
					<label class="pl-menu-item">
						Max load per sem
						<select class="select" value={String(options.cap)} onchange={(e) => setOptions({ cap: Number(e.currentTarget.value) || 'checklist' })}>
							<option value="18">18 units</option>
							<option value="21">21 units (with lab courses)</option>
							<option value="checklist">The checklist's load</option>
						</select>
						{#if effects}<small>{effects.cap}</small>{/if}
					</label>
					<label class="pl-menu-item">
						Min load per sem
						<select class="select" value={String(options.minLoad || 0)} onchange={(e) => setOptions({ minLoad: Number(e.currentTarget.value) })}>
							<option value="0">No minimum</option>
							<option value="12">12 units</option>
							<option value="15">15 units</option>
							<option value="18">18 units</option>
						</select>
						<small>GradeSim marks a sem under this, for a scholarship that needs a full load.</small>
					</label>
					{#if app.program.specializations}
						<label class="pl-menu-item">
							Specialization
							<select class="select" value={app.specialization ?? ''} onchange={(e) => app.setSpecialization(e.currentTarget.value)}>
								<option value="">Not chosen yet</option>
								{#each Object.entries(app.program.specializations) as [key, s] (key)}
									<option value={key}>{s.name}</option>
								{/each}
							</select>
						</label>
					{/if}
					<label class="pl-menu-item pl-check"><input type="checkbox" checked={options.midyear} onchange={(e) => setOptions({ midyear: e.currentTarget.checked })} /> <span>Take classes in midyear{#if effects}<small>With this {options.midyear ? 'off' : 'on'}, {effects.midyear}</small>{/if}</span></label>
					<label class="pl-menu-item pl-check"><input type="checkbox" checked={options.midyear9} onchange={(e) => setOptions({ midyear9: e.currentTarget.checked })} /> <span>Midyear up to 9 units (Dean's approval){#if effects && options.midyear}<small>With this {options.midyear9 ? 'off' : 'on'}, {effects.midyear9}</small>{/if}</span></label>
					{#if petitions.length}
						<button type="button" class="pl-menu-item" onclick={() => (app.s.plannerPetitions = {})}>Clear petitions<small>{petitions.join(', ')} {petitions.length === 1 ? 'goes' : 'go'} back to the sems AMIS offers {petitions.length === 1 ? 'it' : 'them'}</small></button>
					{/if}
					<button type="button" class="pl-menu-item" onclick={savePlan}>Save plan<small>Download your marks, moves and settings as a file</small></button>
					<button type="button" class="pl-menu-item" onclick={() => planInput?.click()}>Load plan<small>Restore a plan file you saved earlier</small></button>
					<button type="button" class="pl-menu-item" onclick={exportXlsx}>Export to Excel<small>A color-coded sheet with one column per sem</small></button>
					<button type="button" class="pl-menu-item" onclick={printPlan}>Print<small>Every sem on paper, like the official checklist</small></button>
					<button type="button" class="pl-menu-item pl-danger" onclick={resetPlan}>Reset plan<small>Clears marks, moves and petitions</small></button>
				</div>
			</details>
			<input
				bind:this={planInput}
				type="file"
				accept=".json,application/json"
				hidden
				onchange={(e) => {
					const f = e.currentTarget.files?.[0];
					e.currentTarget.value = '';
					if (f) loadPlan(f);
				}}
			/>
		</section>

		<p class="pl-result" aria-live="polite">{#if wiResult}{wiResult} <button class="textbtn" type="button" onclick={clearWhatif}>Clear</button>{/if}</p>

		{#if app.fixes.length}
			<section class="pl-fixes" aria-label="Your fixes to this checklist">
				<h3>Your fixes to this checklist</h3>
				<ul>
					{#each app.fixes as f (f.code)}
						<li>
							<span><strong>{f.code}</strong> {fixText(f)}{f.sent ? ' (sent)' : ''}</span>
							<button type="button" class="textbtn" onclick={() => app.setFixes(app.fixes.filter((x) => x !== f))}>Undo</button>
						</li>
					{/each}
				</ul>
				<p class="pl-muted">Your plan already uses these. Sending them lets UPLB Tools fix the checklist for everyone. Only the fixes are sent, never your grades.</p>
				<div class="pl-actions">
					{#if app.fixes.some((f) => !f.sent)}<button type="button" class="btn btn-secondary" onclick={sendFixes}><Icon name="upload" />Send to UPLB Tools</button>{/if}
				</div>
			</section>
		{/if}

		<div class="pl-sheet" data-testid="planner-sheet" bind:this={sheetEl}>
			{@render yearList(ahead)}
			{#if past.length}
				<details class="pl-term pl-past">
					<summary><Icon name="chevron" size={16} />{pastLine}</summary>
					{@render yearList(past)}
				</details>
			{/if}
		</div>

		<p class="pl-muted pl-how">GradeSim puts each course in the earliest sem its prerequisites and AMIS offerings allow.</p>

		<div class="pl-fixes pl-add">
			{#if fixing === 'add'}
				<FixForm onsave={saveFix} oncancel={() => (fixing = null)} />
			{:else}
				<button type="button" class="textbtn" onclick={() => (fixing = 'add')}>Add a course the checklist is missing</button>
			{/if}
		</div>

		<span class="visually-hidden" aria-live="polite">{status}</span>
	</div>
{/if}
