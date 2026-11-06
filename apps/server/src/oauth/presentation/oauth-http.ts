import { HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { OAuthError } from "../domain/oauth";

function noStore(response: Response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}

function bearerToken(request: Request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.authorization ?? "");
  if (!match) throw new OAuthError("invalid_token", "A valid Bearer access token is required.");
  return match[1];
}

function oauthHttpError(error: unknown) {
  if (error instanceof OAuthError) {
    return new HttpException({ error: error.code, error_description: error.message }, 400);
  }
  return error;
}

function bearerHttpError(error: unknown, response: Response) {
  if (!(error instanceof OAuthError)) return error;
  const insufficient = error.code === "insufficient_scope";
  const code = insufficient ? "insufficient_scope" : "invalid_token";
  response.setHeader("WWW-Authenticate", `Bearer error="${code}"`);
  return new HttpException(
    {
      error: code,
      error_description: insufficient
        ? "The token does not grant this operation."
        : "A valid administrator access token is required.",
    },
    insufficient ? 403 : 401,
  );
}

export { noStore, bearerToken, oauthHttpError, bearerHttpError };
