<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/Seo.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { BOOKMARKLET } from '#lib/bookmarklet.ts';

	let copied = $state<boolean | 'failed'>(false);

	async function copyBookmarklet() {
		copied = await navigator.clipboard.writeText(BOOKMARKLET).then(
			() => true,
			() => 'failed' as const
		);
	}
</script>

<Seo
	title="Install the ALAB GradeSim extension"
	description="Get the free ALAB GradeSim extension for Chrome, Firefox or Edge. It reads your grades when you open ALAB SMS and keeps them on your device."
	path="/install/"
/>

<div class="wrap">
	<PageHead title="Get the extension">
		The extension reads your grades when you open ALAB SMS. It's free and open source, and it keeps everything on your device.
	</PageHead>

	<p class="muted">The ALAB GradeSim extension isn't in the stores yet. Until it is, enter your grades by hand on
		<a href={resolve('/')}>GradeSim</a> or use the phone bookmark below.</p>

	<section class="prose steps">
		<h2>After installing</h2>
		<ol>
			<li>Log in to <a href="https://alabsms.bulsu.edu.ph" rel="noopener" target="_blank">ALAB SMS</a>.</li>
			<li>Open your grades. The extension saves them in your browser.</li>
			<li>Come back to <a href={resolve('/')}>GradeSim</a>. Your grades load after you choose Import from the extension once.</li>
		</ol>
	</section>

	<section class="prose steps">
		<h2 id="phone">On a phone</h2>
		<p>
			On phones, use a bookmark that opens GradeSim with your grades. It works in any mobile browser.
		</p>
		<ol>
			<li>
				<button class="btn" type="button" onclick={copyBookmarklet}>{copied === true ? 'Copied' : 'Copy the bookmark'}</button>
				{#if copied === 'failed'}<span role="alert">Your browser blocked the copy. Allow clipboard access for this site, then try again.</span>{/if}
			</li>
			<li>Bookmark any page, edit the bookmark, name it gradesim and paste what you copied as its address.</li>
			<li>
				Log in to <a href="https://alabsms.bulsu.edu.ph" rel="noopener" target="_blank">ALAB SMS</a>, type gradesim in the address bar and tap the
				bookmark. GradeSim opens with your grades.
			</li>
		</ol>
	</section>
</div>

<style>
	.steps {
		margin-top: 8px;
	}

	.steps ol {
		padding-left: 1.25rem;
	}

	.steps li + li {
		margin-top: 0.4rem;
	}
</style>
