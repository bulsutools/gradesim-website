<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
</script>

<Seo
	title="Privacy policy, ALAB GradeSim"
	description="How ALAB GradeSim handles your data. Grades stay in your browser, in the web app's local storage or the extension's storage. Your grades are never uploaded."
	path="/privacy/"
/>

<div class="wrap">
	<PageHead title="Privacy policy">Last updated November 21, 2026</PageHead>

	<article class="prose">
		<h2>What ALAB GradeSim is</h2>
		<p>
			ALAB GradeSim is a free web app at gradesim.bulsu.tools and a companion browser extension. Both help BulSU students compute
			their GWA, simulate Latin honor targets and plan their remaining terms. They are open source projects maintained by
			student volunteers under BulSU Tools, and they aren't an official BulSU product.
		</p>

		<h2>Your grades stay in your browser</h2>
		<p>
			<strong>The web app saves your grades, settings and plan in your browser’s local storage on this device.</strong> It does
			not send your grades, GWA or plan to any server. All computation happens in your browser.
		</p>
		<ul>
			<li>No account or sign-up.</li>
			<li>No analytics, tracking or advertising scripts in the app.</li>
			<li>No cloud sync. Clearing your browser data, or using Clear my data on the Grades tab, removes what was saved.</li>
			<li>Backups and plan files you export are saved as files on your device, and you decide where they go.</li>
		</ul>

		<h2>Checklist fixes you choose to send</h2>
		<p>
			When a course in the planner is wrong, you can fix it for your own plan. The fix is saved in your browser like
			everything else. If you press Send to BulSU Tools, the app sends the program code, your course fixes and your optional
			note, and nothing else. They are posted as a public issue on the GradeSim GitHub repository so that maintainers can
			review them. Your grades, GWA and plan are never part of it.
		</p>
		<p>
			When GradeSim doesn't know which courses count for a major slot, Tell us what you took opens a short form in the
			planner. When you press Send, the app sends your program, your specialization, your year level, the course codes
			you picked, how you know they count and your contact if you gave one to a Google Form that BulSU Tools owns. It
			carries no grades, and nothing is sent unless you press Send.
		</p>
		<p>
			Plan sections in Room TBA opens Room TBA's planner in a new tab. The link carries the course codes for that sem and
			your program code, so Room TBA can look up their sections. It carries no grades.
		</p>

		<h2>The extension</h2>
		<p>
			The extension reads the grades ALAB SMS already shows you when you open it while logged in, and keeps them in the
			extension’s storage on your device. It doesn't send your ALAB SMS credentials, grades or GWA anywhere. It only runs on ALAB SMS
			pages and, so that it can hand your grades to this web app when you ask, on gradesim.bulsu.tools.
		</p>
		<p>
			When you choose Import from the extension, or open this page from the extension, it passes your grades directly to this page inside your
			browser. After that, this page asks the extension for newer grades each time you open it. They don't travel over the
			network.
		</p>
		<p>
			The extension also reads which classes ALAB SMS lists you as enlisted in, and keeps each one's course code, section and
			type. See my classes in Room TBA opens Room TBA's planner in a new tab with those and your program code in the link.
			It carries no grades.
		</p>

		<h2>Hosting</h2>
		<p>
			The site is hosted on Cloudflare Pages. Cloudflare may log standard request details such as IP address, browser and
			time of visit for security and delivery. Those logs never contain your grades, because your grades aren't
			sent with any request. After the first visit the app can run offline from your browser’s cache.
		</p>

		<h2>Browser store listings</h2>
		<p>
			When you install the extension from a browser add-on store, that platform may collect
			installation and usage statistics under its own privacy policy. We only see aggregate install counts.
		</p>

		<h2>Open source</h2>
		<p>
			The source code for the web app and the extension is public on GitHub, so you can check how data is handled.
			Curriculum contributions in the repository never include anyone’s grades.
		</p>

		<h2>Children</h2>
		<p>ALAB GradeSim is meant for BulSU students and isn't directed at children under 13.</p>

		<h2>Changes</h2>
		<p>We will update this policy if the app or the extension changes how data is handled. The date above shows the latest revision.</p>

		<h2>Contact</h2>
		<p>
			For questions about this policy, open an issue on
			<a href="https://github.com/bulsutools/gradesim-website/issues" rel="noopener" target="_blank">GitHub</a>. Issues are public, so
			never paste your grades or ALAB SMS details there.
		</p>
	</article>
</div>
