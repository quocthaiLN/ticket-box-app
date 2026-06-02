export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  request_id?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
};

export class ApiError extends Error {
  constructor(public problem: Omit<ProblemDetails, "request_id">) {
    super(problem.detail);
  }
}

export function problem(details: ProblemDetails): ProblemDetails {
  return details;
}
