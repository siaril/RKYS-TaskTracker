// One mentionable person in the @-autocomplete (a project member).
export type MentionItem = {
  id: string;
  label: string; // display name (falls back to email)
  image: string | null;
};
