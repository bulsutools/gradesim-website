<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<footer class="site-footer">
	<div class="wrap">
		<nav aria-label="Footer">
			<a href={resolve('about/')}>About</a>
			<a href={resolve('install/')}>Get the extension</a>
			<a href={resolve('privacy/')}>Privacy</a>
			<a href={resolve('terms/')}>Terms</a>
			<a href="https://github.com/bulsutools/gradesim-website" rel="noopener" target="_blank">GitHub</a>
			<a href="https://github.com/bulsutools/gradesim-website/discussions/categories/q-a" rel="noopener" target="_blank">Ask a question</a>
		</nav>
		<p>A student project by <a href="https://github.com/bulsutools" rel="noopener" target="_blank">BulSU Tools</a>. It isn't an official BulSU website.</p>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: 48px;
		padding: 20px 0 32px;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--muted);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-bottom: 8px;
	}

	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		color: var(--body);
	}
</style>
