// 스타일 타일 — 개발 중에만 여는 페이지 (디자인 통일 3단계, vanitas-design.md 8장).
// 빌드(배포)에서는 404. 공개 전 점검에서 폴더째 지워도 된다.
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
	if (!dev) error(404);
}
