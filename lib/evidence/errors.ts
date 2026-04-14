export class EvidenceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EvidenceError";
    this.status = status;
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof EvidenceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected evidence error.";
}
