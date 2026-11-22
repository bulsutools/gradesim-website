<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
</script>

<Seo
	title="Terms of use, ALAB GradeSim"
	description="Terms for using the ALAB GradeSim web app and browser extension. Calculations are estimates and the tool isn't affiliated with BulSU."
	path="/terms/"
/>

<div class="wrap">
	<PageHead title="Terms of use">Last updated November 13, 2026</PageHead>

	<article class="prose">
		<h2>Agreement</h2>
		<p>By using the ALAB GradeSim web app or installing the extension, you agree to these terms. If you don't agree, please don't use them.</p>

		<h2>What ALAB GradeSim does</h2>
		<p>
			The web app computes your GWA, honor targets and a course plan from grades you import or enter, entirely in your browser.
			The extension reads grade information shown on ALAB SMS pages you visit and stores it on your device. Neither is an official
			BulSU or ALAB SMS service.
		</p>

		<h2>Estimates, not records</h2>
		<p>
			GWA figures, honor simulations, offerings and graduation terms are estimates. Formulas, cutoffs and curriculum data may
			be incomplete or out of date. Verify important academic decisions with your college secretary or the Office of the
			University Registrar.
		</p>

		<h2>Your data</h2>
		<p>
			Your grades are saved in your browser and you're responsible for them. Clearing your browser data or using Clear my data
			removes them, and we can't recover them for you. Export a backup if you want a copy.
		</p>
		<p>A checklist fix that you send to BulSU Tools becomes a public issue on GitHub, so don't put personal details in its note.</p>

		<h2>Acceptable use</h2>
		<ul>
			<li>Use ALAB GradeSim for your own academic planning.</li>
			<li>Don't tamper with ALAB SMS or try to collect data beyond normal browsing.</li>
			<li>Don't redistribute modified builds in a way that misrepresents the project.</li>
			<li>Keep personal grades out of curriculum files you contribute on GitHub.</li>
		</ul>

		<h2>No warranty</h2>
		<p>
			The web app and the extension are provided as is, without warranties of any kind. The authors aren't liable for academic
			decisions made from their output.
		</p>

		<h2>BulSU and ALAB SMS</h2>
		<p>
			ALAB SMS is operated by BulSU. ALAB GradeSim isn't affiliated with or endorsed by Bulacan State University.
			BulSU marks belong to Bulacan State University. Follow the ALAB SMS terms of use when you access your
			account.
		</p>

		<h2>Open source license</h2>
		<p>The project is distributed under the MIT License in its repository. Forks and contributions are welcome under that license and the project guidelines.</p>

		<h2>Changes</h2>
		<p>These terms may change. Continuing to use ALAB GradeSim after a change means you accept the revised terms.</p>

		<h2>Contact</h2>
		<p>
			For questions about these terms, open an issue on
			<a href="https://github.com/bulsutools/gradesim-website/issues" rel="noopener" target="_blank">GitHub</a>.
		</p>
	</article>
</div>
