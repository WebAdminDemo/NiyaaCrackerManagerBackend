export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (message, details) =>
  new HttpError(400, message, details);
export const notFound = (message) => new HttpError(404, message);
