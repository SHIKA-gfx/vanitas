/**
 * 스토리 길잡이 데이터 (docs/008 6장). 빌드 때 DB에서 내려받은 data/ko/story.json — 검사는 validate.py check_story.
 * 스토리 화면에서만 가져온다 (다른 화면 번들에 넣지 않게 src/lib/data/index.ts와 따로 둔다)
 */
import storyJson from '../../../data/ko/story.json';
import type { StoryDoc } from './types';

export const storyDoc: StoryDoc = storyJson as unknown as StoryDoc;
