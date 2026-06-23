export type CommentDTO = {
  id: string;
  authorName: string;
  authorImage: string | null;
  createdAt: string;
  bodyHtml: string;
  canDelete: boolean;
};
