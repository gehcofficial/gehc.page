import { useMediaSlots } from './useMediaSlots';
import type { LandingMedia } from '../config/media';

export function useLandingMedia(): LandingMedia {
  return useMediaSlots().landing;
}
