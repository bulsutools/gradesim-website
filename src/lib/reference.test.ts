// Seeded random cases, each checked against a plain reference written from the rule and not from the code.
import { expect, test } from 'vitest';
import { UPLB_PROGRAMS } from './curriculum.ts';
import { calculateGWA, honorFor, lightSems, parseAMISData, type GradesData } from './grades.ts';
import { compute, DEFAULT_PLANNER_OPTIONS, modelFor, type PlannerOptions } from './planner.ts';
import { gwaOutlook } from './requirements.ts';
import { scheduleEarliest, type PlanCourse, type ScheduleOptions, type ScheduleResult, type Sem } from './scheduler.ts';

const CASES = 1000;
type Rand = () => number;

function seeded(seed: number): Rand {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rand, list: readonly T[]) => list[int(r, 0, list.length - 1)];
const some = <T>(r: Rand, list: readonly T[], chance: number) => list.filter(() => r() < chance);
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Runs one case per seed. A failure names the seed that reproduces it. */
function agree(name: string, first: number, one: (r: Rand) => string | null | undefined) {
	const bad: string[] = [];
	for (let seed = first; seed < first + CASES; seed++) {
		const why = one(seeded(seed));
		if (why) bad.push(`seed ${seed}: ${why}`);
	}
	console.log(`${name}: ${CASES - bad.length} of ${CASES} agree`);
	expect(bad).toEqual([]);
}

/* ---------- Grades ---------- */

const CODES = ['CMSC 12', 'CMSC 21', 'MATH 27', 'CHEM 18', 'ENG 13', 'STAT 101', 'PEd 101', 'CMSC 190', 'HK 11', 'HK 12', 'PE 2', 'NSTP 1'];
const GRADES = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '4.00', '5.00', 'INC', 'DRP', 'S', 'U', 'W', 'P', 'DFG'];

type Row = { id: string; term: string; code: string; units: number; grade: string };

function record(r: Rand) {
	const rows: Row[] = [];
	for (let s = 0, sems = int(r, 1, 10); s < sems; s++) {
		const term = `1${21 + Math.floor(s / 3)}${(s % 3) + 1}`;
		const codes = [...CODES].sort(() => r() - 0.5).slice(0, s % 3 === 2 ? int(r, 0, 2) : int(r, 1, 8));
		codes.forEach((code, i) => rows.push({ id: `${term}-${i}`, term, code, units: pick(r, [0, 1, 2, 3, 3, 3, 4, 5]), grade: pick(r, GRADES) }));
	}
	const data: GradesData = { student_grades: {} };
	rows.forEach((row) => {
		(data.student_grades[row.term] ??= { values: [] }).values.push({
			id: row.id,
			course: { course_code: row.code, title: row.code },
			unit_taken: row.units,
			grade: row.grade
		});
	});
	return { rows, data, left: new Set(some(r, rows, 0.1).map((row) => row.id)) };
}

const academic = (row: Row) => !/^(NSTP|HK|PE) /.test(row.code);

function refGwa(rows: Row[], left: Set<string>) {
	let points = 0;
	let units = 0;
	let passed = 0;
	for (const row of rows) {
		let grade = Number(row.grade);
		if (row.code === 'CMSC 190' && row.grade === 'S') {
			const final = rows.filter((o) => o.code === 'CMSC 190' && Number(o.grade) <= 3).at(-1);
			if (final) grade = Number(final.grade);
		}
		if (!academic(row) || !(grade >= 1) || !row.units || left.has(row.id)) continue;
		points += grade * row.units;
		units += row.units;
		if (grade <= 3) passed += row.units;
	}
	return { gwa: units ? points / units : 0, units, passed };
}

test('GWA matches the reference on random grade records', () => {
	agree('GWA', 1000, (r) => {
		const { rows, data, left } = record(r);
		const got = calculateGWA(parseAMISData(data), left);
		const want = refGwa(rows, left);
		if (!near(got.gwa, want.gwa) || got.totalUnits !== want.units || got.passedUnits !== want.passed)
			return `${got.gwa} over ${got.totalUnits} units (${got.passedUnits} passed), reference ${want.gwa} over ${want.units} (${want.passed})`;
	});
});

function refHonor(gwa: number) {
	if (gwa <= 0) return null;
	if (gwa <= 1.2) return 'summa';
	if (gwa <= 1.45) return 'magna';
	if (gwa <= 1.75) return 'cum';
	return null;
}

function refLightSems(rows: Row[]) {
	const load = new Map<string, number>();
	for (const row of rows) {
		if (row.term.endsWith('3') || !academic(row) || row.grade === 'DRP' || row.grade === 'W') continue;
		load.set(row.term, (load.get(row.term) ?? 0) + row.units);
	}
	return [...load].slice(0, -1).filter(([, units]) => units < 15).map(([term]) => term);
}

test('Latin honors and light sems match the reference on random grade records', () => {
	agree('Latin honors', 2000, (r) => {
		const { rows, data } = record(r);
		const courses = parseAMISData(data);
		const { gwa, totalUnits } = calculateGWA(courses);
		const honor = honorFor(gwa, totalUnits)?.key ?? null;
		if (honor !== refHonor(refGwa(rows, new Set()).gwa)) return `honor ${honor}, reference ${refHonor(refGwa(rows, new Set()).gwa)}`;
		const light = lightSems(courses).map((s) => s.label);
		const want = refLightSems(rows).map((term) => courses.find((c) => c.termKey === term)!.termLabel);
		if (light.join() !== want.join()) return `light sems ${light.join(', ')}, reference ${want.join(', ')}`;
	});
});

test('the target outlook matches a simulation of the units left', () => {
	agree('Target', 3000, (r) => {
		const units = int(r, 0, 160);
		const gwa = units ? int(r, 10000, 50000) / 10000 : 0;
		const left = int(r, 0, 160);
		const target = pick(r, [1.2, 1.45, 1.75, 2, int(r, 100, 300) / 100]);
		const finish = (grade: number) => (units + left ? (gwa * units + grade * left) / (units + left) : 0);
		let status = 'reachable';
		if (!left) status = gwa <= target ? 'any-pass' : 'out-of-reach';
		else if (finish(1) > target + 1e-9) status = 'out-of-reach';
		else if (finish(3) <= target) status = 'any-pass';
		const got = gwaOutlook(gwa, units, left, target);
		if (got.status !== status) return `status ${got.status}, reference ${status}`;
		if (!near(got.ceiling, finish(1))) return `ceiling ${got.ceiling}, reference ${finish(1)}`;
		if ((got.bestHonor?.[0].split(' ')[0].toLowerCase() ?? null) !== refHonor(finish(1))) return `best honor ${got.bestHonor?.[0]}`;
		if (status === 'reachable' && !near(finish(got.required!), target)) return `needing ${got.required} lands on ${finish(got.required!)}`;
	});
});

/* ---------- Scheduler ---------- */

const SEMS: Sem[] = ['1', '2', 'midyear'];
const DIGIT = { '1': 1, '2': 2, midyear: 3 } as const;
const CAPS = { '1': 18, '2': 18, midyear: 6 };
const free = (code: string) => /^(NSTP|HK|PE) /.test(code);
const load = (c: PlanCourse) => (free(c.code) ? 0 : c.units);
const semOf = (o: ScheduleOptions, t: number) => SEMS[(SEMS.indexOf(o.startSem ?? '1') + t) % 3];
const capOf = (o: ScheduleOptions, t: number) => (o.termCaps?.[t] ?? o.unitCaps?.[semOf(o, t)] ?? CAPS[semOf(o, t)]) - (o.reserved?.[t] ?? 0);
const groups = (c: PlanCourse) => c.pre ?? (c.prereqs ?? []).map((p) => [p]);

function runsIn(c: PlanCourse, sem: Sem) {
	const seen = (c.offered ?? {}) as Record<number, unknown>;
	if (seen[1] || seen[2] || seen[3]) return !!seen[DIGIT[sem]];
	const listed = String(c.catalogSem ?? '').toLowerCase().split(/[\s,]+/);
	if (listed.some((x) => x[0] === '1' || x[0] === '2')) return sem !== 'midyear' && listed.some((x) => x[0] === String(DIGIT[sem]));
	return c.sem ? c.sem === sem : sem !== 'midyear';
}
const allowed = (c: PlanCourse, o: ScheduleOptions, t: number) => {
	const sem = semOf(o, t);
	if (!runsIn(c, sem) && !c.petition) return false;
	return !(sem === 'midyear' && o.useMidyear === false && c.sem !== 'midyear' && (runsIn(c, '1') || runsIn(c, '2')));
};

/** Counts every rule a plan breaks. */
function violations(o: ScheduleOptions, res: ScheduleResult) {
	const v = { overload: 0, prerequisite: 0, corequisite: 0, offering: 0, tooEarly: 0, standing: 0, twice: 0, lost: 0 };
	const by = new Map(o.courses.map((c) => [c.code, c]));
	const passed = new Set(o.passed ?? []);
	const term = new Map<string, number>();
	for (const p of res.plan)
		for (const code of p.courses) {
			if (term.has(code) || passed.has(code)) v.twice++;
			term.set(code, p.termIndex);
		}
	v.lost = o.courses.filter((c) => c.code !== 'Elective' && !passed.has(c.code) && !term.has(c.code) && !res.unschedulable.includes(c.code)).length;
	const total = o.totalUnits || sum(o.courses.map(load));
	let done = sum(o.courses.filter((c) => passed.has(c.code)).map(load));
	for (const p of res.plan) {
		const t = p.termIndex;
		const taken = p.courses.map((code) => by.get(code)!);
		const before = (code: string) => passed.has(code) || (term.get(code) ?? Infinity) < t;
		if (sum(taken.map(load)) > capOf(o, t)) v.overload++;
		for (const c of taken) {
			for (const group of groups(c)) {
				const known = group.filter((code) => by.has(code) || passed.has(code));
				if (known.length && !known.some(before)) v.prerequisite++;
			}
			for (const code of c.co ?? []) if (by.has(code) && code !== c.code && !before(code) && term.get(code) !== t) v.corequisite++;
			if (!allowed(c, o, t)) v.offering++;
			if ((o.notBefore?.[c.code] ?? 0) > t || o.skip?.has(t)) v.tooEarly++;
			if (c.standing && done < (c.standing === 'senior' ? 0.75 : 0.5) * total) v.standing++;
		}
		done += sum(taken.map(load));
	}
	return v;
}
const broken = (v: ReturnType<typeof violations>) => Object.entries(v).filter(([, n]) => n).map(([rule, n]) => `${n} ${rule}`).join(', ');

function curriculum(r: Rand, n: number, extras = false): PlanCourse[] {
	const courses: PlanCourse[] = Array.from({ length: n }, (_, i) => {
		const earlier = Array.from({ length: i }, (_, j) => `CRS ${j + 1}`);
		return {
			code: `CRS ${i + 1}`,
			title: '',
			units: pick(r, [1, 2, 3, 3, 3, 4, 5]),
			year: 1 + Math.floor(i / 6),
			sem: pick(r, ['1', '1', '1', '2', '2', '2', 'midyear'] as Sem[]),
			offered: r() < 0.6 ? { 1: r() < 0.7, 2: r() < 0.7, 3: r() < 0.2 } : null,
			pre: i && r() < 0.6 ? Array.from({ length: int(r, 1, 2) }, () => [...new Set([pick(r, earlier), pick(r, earlier)])]) : [],
			co: extras && i && r() < 0.1 ? [pick(r, earlier)] : [],
			standing: extras && i > n / 2 && r() < 0.1 ? pick(r, ['junior', 'senior'] as const) : null
		};
	});
	if (extras) for (const code of ['HK 11', 'HK 12', 'NSTP 1', 'NSTP 2']) courses.push({ code, title: '', units: code[0] === 'H' ? 2 : 3, year: 1, sem: pick(r, ['1', '2'] as Sem[]) });
	return courses;
}

function options(r: Rand, courses: PlanCourse[], extras = false): ScheduleOptions {
	const o: ScheduleOptions = {
		courses,
		passed: some(r, courses, 0.15).map((c) => c.code),
		unitCaps: { '1': pick(r, [9, 12, 15, 18, 21]), '2': pick(r, [9, 12, 15, 18, 21]), midyear: pick(r, [6, 9]) },
		startSem: pick(r, SEMS),
		useMidyear: r() < 0.5
	};
	if (!extras) return o;
	return {
		...o,
		notBefore: Object.fromEntries(some(r, courses, 0.1).map((c) => [c.code, int(r, 1, 6)])),
		reserved: Object.fromEntries([0, 1, 2].filter(() => r() < 0.3).map((t) => [t, int(r, 1, 6)])),
		termCaps: r() < 0.3 ? { [int(r, 0, 5)]: pick(r, [18, 21, 24]) } : undefined,
		skip: r() < 0.3 ? new Set([int(r, 0, 4)]) : undefined
	};
}

/** The earliest last term over every legal plan, by trying every set of courses in every term. */
function optimum(o: ScheduleOptions) {
	const { courses } = o;
	const passed = new Set(o.passed ?? []);
	const all = (1 << courses.length) - 1;
	const at = new Map(courses.map((c, i) => [c.code, i]));
	let reached = new Set([sum(courses.map((c, i) => (passed.has(c.code) ? 1 << i : 0)))]);
	if (reached.has(all)) return -1;
	for (let t = 0; t < 30; t++) {
		const next = new Set(reached);
		for (const done of reached) {
			const ready = courses
				.map((c, i) => i)
				.filter((i) => !(done & (1 << i)) && allowed(courses[i], o, t))
				.filter((i) => groups(courses[i]).every((g) => g.some((code) => done & (1 << at.get(code)!))));
			for (let take = 1; take < 1 << ready.length; take++) {
				const chosen = ready.filter((_, k) => take & (1 << k));
				if (sum(chosen.map((i) => courses[i].units)) <= capOf(o, t)) next.add(done | sum(chosen.map((i) => 1 << i)));
			}
		}
		if (next.has(all)) return t;
		reached = next;
	}
	return Infinity;
}

/** Each term takes what's ready, in checklist order, with no look ahead. */
function baseline(o: ScheduleOptions) {
	const term = new Map<string, number>((o.passed ? [...o.passed] : []).map((code) => [code, -1]));
	let last = -1;
	for (let t = 0; t < 60 && term.size < o.courses.length; t++) {
		let room = capOf(o, t);
		for (const c of o.courses) {
			if (term.has(c.code) || c.units > room || !allowed(c, o, t)) continue;
			if (!groups(c).every((g) => g.some((code) => (term.get(code) ?? Infinity) < t))) continue;
			term.set(c.code, (last = t));
			room -= c.units;
		}
	}
	return term.size < o.courses.length ? Infinity : last;
}

test('the scheduler breaks no rule and is checked against the true earliest plan on small curricula', () => {
	let late = 0;
	agree('Scheduler, small curricula', 4000, (r) => {
		const o = options(r, curriculum(r, int(r, 3, 7)));
		const res = scheduleEarliest(o);
		const best = optimum(o);
		const got = res.unschedulable.length ? Infinity : res.gradTermIndex;
		if (broken(violations(o, res))) return broken(violations(o, res));
		if (got < best) return `graduates in term ${got}, before the earliest legal term ${best}`;
		if (got > best) late++;
	});
	console.log(`Scheduler, small curricula: ${CASES - late} of ${CASES} plans are the earliest possible`);
});

test('the scheduler breaks no rule on large curricula with corequisites, standing, pins and a sem off', () => {
	agree('Scheduler, large curricula', 5000, (r) => {
		const o = options(r, curriculum(r, int(r, 20, 50), true), true);
		return broken(violations(o, scheduleEarliest(o)));
	});
});

test('the scheduler is compared with a plain baseline on three sizes of random curricula', () => {
	const rows = [8, 20, 40].map((n, slice) => {
		const row = { courses: n, sooner: 0, same: 0, later: 0 };
		for (let seed = 6000 + slice * CASES; seed < 6000 + (slice + 1) * CASES; seed++) {
			const r = seeded(seed);
			const o = options(r, curriculum(r, n));
			const res = scheduleEarliest(o);
			const got = res.unschedulable.length ? Infinity : res.gradTermIndex;
			const plain = baseline(o);
			row[got < plain ? 'sooner' : got > plain ? 'later' : 'same']++;
		}
		return row;
	});
	console.table(rows);
	rows.forEach((row) => expect(row.sooner + row.same + row.later).toBe(CASES));
}, 30_000);

test('blank plans of every program break no rule, and only the checklist load goes over 18 units', () => {
	const settings: [string, Partial<PlannerOptions>][] = [
		['18 units', {}],
		['18 units and midyear', { midyear: true }],
		['checklist load', { cap: 'checklist' }]
	];
	const rows = settings.map(([name, patch]) => {
		const row = { setting: name, plans: 0, brokenRules: 0, semsOver18: 0, unplaced: 0, meanSems: 0 };
		for (const code of Object.keys(UPLB_PROGRAMS)) {
			const model = modelFor(code);
			if (!model) continue;
			const input = { gradesData: null, substitutions: {}, customCourseStatus: {}, plannerPins: {}, plannerPetitions: {}, whatif: null };
			const { result, runOpts } = compute(model, { ...input, plannerOptions: { ...DEFAULT_PLANNER_OPTIONS, ...patch } }, new Date('2026-11-18')).now;
			const by = new Map(runOpts.courses.map((c) => [c.code, c]));
			row.plans++;
			row.brokenRules += sum(Object.values(violations(runOpts, result)));
			row.semsOver18 += result.plan.filter((p) => p.sem !== 'midyear' && sum(p.courses.map((c) => load(by.get(c)!))) > 18).length;
			row.unplaced += result.unschedulable.length;
			row.meanSems += result.plan.length;
		}
		row.meanSems = Math.round((row.meanSems / row.plans) * 100) / 100;
		return row;
	});
	console.table(rows);
	rows.forEach((row) => expect([row.setting, row.brokenRules, row.unplaced]).toEqual([row.setting, 0, 0]));
	expect(rows[0].semsOver18 + rows[1].semsOver18).toBe(0);
}, 30_000);
