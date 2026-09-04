/**
 * IBM watsonx.ai Server Configuration & Environment Verification.
 *
 * CRITICAL SECURITY GUARANTEE:
 * This module and its exports must NEVER be imported or used in client components
 * ("use client"). All watsonx operations must execute in server-side API routes,
 * server actions, or backend background jobs only.
 */

if (typeof window !== "undefined") {
  throw new Error("SECURITY VIOLATION: IBM watsonx service cannot be executed in browser/client-side context.");
}

export interface WatsonxConfig {
  apiKey: string;
  projectId: string;
  url: string;
  version: string;
  defaultModelId: string;
}

export function getWatsonxConfig(): WatsonxConfig {
  const apiKey = process.env.WATSONX_API_KEY?.trim();
  const projectId = process.env.WATSONX_PROJECT_ID?.trim();
  const url = (process.env.WATSONX_URL?.trim() || "https://us-south.ml.cloud.ibm.com").replace(/\/+$/, "");
  const version = process.env.WATSONX_VERSION?.trim() || "2023-05-29";
  const defaultModelId = process.env.WATSONX_MODEL_ID?.trim() || "ibm/granite-3-8b-instruct";

  if (!apiKey) {
    throw new Error(
      "[watsonx.ai Error] Missing WATSONX_API_KEY environment variable. Ensure it is defined in your root .env file."
    );
  }

  if (!projectId) {
    throw new Error(
      "[watsonx.ai Error] Missing WATSONX_PROJECT_ID environment variable. Ensure it is defined in your root .env file."
    );
  }

  return {
    apiKey,
    projectId,
    url,
    version,
    defaultModelId,
  };
}
