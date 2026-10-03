// 백업 링크 — 저장된 입력 전체를 주소 한 덩어리로 (순수 함수).
// 로그인 없이 다른 기기·브라우저로 입력을 옮기는 용도. 결과 공유 링크(share.ts)와는 목적이 다르다:
//   공유 링크  계산기 하나 + 관련 공유 값, 열면 "공유 보기" (내 값은 그대로)
//   백업 링크  세 계산기 전체 + 공유 값, 열면 "이 기기로 불러올까요?" (확인 후 통째로 바꿈)
//
// 형식: backup=<판><방식><내용>
//   판   '1'  (저장 형식이 바뀌면 올린다)
//   방식 'z'  JSON을 deflate-raw로 압축한 뒤 base64url  — 대부분의 브라우저
//        'j'  JSON을 그대로 base64url                  — 압축을 못 쓰는 브라우저
// 내용은 저장소의 저장 파일(persist.ts)과 같다. 읽을 때도 같은 검사를 거친다.

import { parseSaveFile, type SaveFile } from './persist';

export const BACKUP_PARAM = 'backup';
const FORMAT = '1';

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
	const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
	return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () =>
	typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodeBackup(file: SaveFile): Promise<string> {
	const json = new TextEncoder().encode(JSON.stringify(file));
	if (canCompress()) {
		return FORMAT + 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
	}
	return FORMAT + 'j' + toBase64Url(json);
}

/** 읽을 수 없으면 null (판이 다르거나, 깨졌거나, 압축을 풀 수 없는 브라우저) */
export async function decodeBackup(text: string): Promise<SaveFile | null> {
	if (text.length < 3 || text[0] !== FORMAT) return null;
	try {
		const body = fromBase64Url(text.slice(2));
		let json: Uint8Array;
		if (text[1] === 'z') {
			if (!canCompress()) return null;
			json = await pipe(body, new DecompressionStream('deflate-raw'));
		} else if (text[1] === 'j') {
			json = body;
		} else {
			return null;
		}
		const raw = new TextDecoder().decode(json);
		const file = parseSaveFile(raw);
		// parseSaveFile은 실패하면 빈 파일을 준다 — 원래 내용이 있었는데 비었다면 읽지 못한 것
		return Object.keys(file.sections).length === 0 && raw.length > 40 ? null : file;
	} catch {
		return null;
	}
}
