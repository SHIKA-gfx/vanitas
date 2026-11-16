import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Cloudflare Pages 배포 (공개 준비 6번). 빌드 결과는 .svelte-kit/cloudflare
			adapter: adapter(),

			// 새 판 감지 (docs/008 3장): 열린 탭이 10분마다 _app/version.json을 보고, 바뀌었으면
			// $app/state의 updated.current가 true가 된다 → UpdateBar가 새로 고침을 권한다.
			// 판 이름은 기본값(빌드 시각) — 관리자 데이터 저장으로 다시 배포해도 새 판이다
			version: { pollInterval: 10 * 60 * 1000 }
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
			urlPatterns: [
				{
					pattern: '/:path(.*)?',
					localized: [
						['ko', '/ko/:path(.*)?'],
						['ja', '/ja/:path(.*)?']
					]
				}
			]
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
