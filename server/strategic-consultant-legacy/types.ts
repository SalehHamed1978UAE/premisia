export interface ResearchStreamSink {
  emitContext(inputPreview: string): void;
  emitQuery(query: string, purpose: string, queryType: string): void;
  emitSynthesis(block: string, message: string): void;
  emitProgress(message: string, progress: number): void;
  emitComplete(data: any): void;
  emitError(error: string): void;
}
