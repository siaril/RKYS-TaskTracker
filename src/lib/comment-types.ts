export type CommentDTO = {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  createdAt: string;
  bodyHtml: string;
  canDelete: boolean;
};

export type CommentNode = CommentDTO & {
  replies: CommentDTO[];
};
