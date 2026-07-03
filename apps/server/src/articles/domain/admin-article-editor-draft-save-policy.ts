function shouldAcceptAdminArticleEditorDraftSave(input: {
  existingSavedAt: Date;
  incomingSavedAt: Date;
}) {
  return input.incomingSavedAt >= input.existingSavedAt;
}

export { shouldAcceptAdminArticleEditorDraftSave };
