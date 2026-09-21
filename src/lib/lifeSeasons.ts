export type LifeSeasonReason =
  | 'sick'
  | 'new_baby'
  | 'deployed'
  | 'travelling'
  | 'bereavement'
  | 'other';

export const LIFE_SEASON_REASONS: { key: LifeSeasonReason; label: string }[] = [
  { key: 'sick', label: 'Sick / Medical' },
  { key: 'new_baby', label: 'New baby' },
  { key: 'deployed', label: 'Deployed' },
  { key: 'travelling', label: 'Travelling / away' },
  { key: 'bereavement', label: 'Bereavement' },
  { key: 'other', label: 'Other' },
];

export function lifeSeasonLabel(reason: string | null | undefined): string {
  return LIFE_SEASON_REASONS.find((r) => r.key === reason)?.label ?? 'Paused';
}

export type LifeSeason = {
  id: string;
  organization_id: string;
  contact_id: string;
  reason: string;
  note: string | null;
  started_on: string;
  ended_on: string | null;
  end_reason: string | null;
  frozen_score: number | null;
  frozen_level: string | null;
  frozen_breakdown: unknown;
  created_by_user_id: string | null;
  ended_by_user_id: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
};
