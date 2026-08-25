export type Lang = 'en' | 'id';

import { en } from './en';
import { id } from './id';

export const dictionaries: Record<Lang, typeof en> = { en, id };
export type { Dict } from './en';
