/**
 * IBM watsonx.ai Backend Client & Service Layer.
 *
 * Exposes a single, unified client for invoking watsonx.ai foundation models
 * (e.g. IBM Granite, Llama 3, Mistral) securely from server-side handlers.
 */
import { getWatsonxConfig, WatsonxConfig } from "./config";

interface IamTokenCache {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedToken: IamTokenCache | null = null;

/**
 * Exchanges IBM Cloud API Key for an IAM OAuth Bearer Token.
 * Automatically caches token and refreshes before expiration (default token lifetime is 1 hour).
 */
async function getIamBearerToken(apiKey: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const tokenUrl = "https://iam.cloud.ibm.com/identity/token";
  const params = new URLSearchParams();
  params.append("grant_type", "urn:ibm:params:oauth:grant-type:apikey");
  params.append("apikey", apiKey);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `[watsonx.ai] Failed to retrieve IAM token (HTTP ${response.status}): ${errBody}`
    );
  }

  const data = await response.json();
  const token = data.access_token as string;
  const expiresInSeconds = typeof data.expires_in === "number" ? data.expires_in : 3600;

  cachedToken = {
    token,
    expiresAt: now + expiresInSeconds * 1000,
  };

  return token;
}

export interface WatsonxGenerateOptions {
  modelId?: string;
  maxNewTokens?: number;
  minNewTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export interface WatsonxGenerateResponse {
  generatedText: string;
  inputTokenCount?: number;
  generatedTokenCount?: number;
  stopReason?: string;
  raw: any;
}

export interface WatsonxChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface WatsonxChatOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface WatsonxChatResponse {
  content: string;
  finishReason?: string;
  raw: any;
}

/**
 * Core IBM watsonx.ai Client Instance.
 */
export class WatsonxClient {
  private config: WatsonxConfig;

  constructor(customConfig?: Partial<WatsonxConfig>) {
    const baseConfig = getWatsonxConfig();
    this.config = { ...baseConfig, ...customConfig };
  }

  /**
   * Generates text completions using watsonx Foundation Models.
   *
   * @param prompt The prompt string to feed to the model
   * @param options Optional model and inference hyperparameters
   */
  async generateText(
    prompt: string,
    options: WatsonxGenerateOptions = {}
  ): Promise<WatsonxGenerateResponse> {
    const token = await getIamBearerToken(this.config.apiKey);
    const endpoint = `${this.config.url}/ml/v1/text/generation?version=${this.config.version}`;

    const modelId = options.modelId || this.config.defaultModelId;
    const payload = {
      input: prompt,
      model_id: modelId,
      project_id: this.config.projectId,
      parameters: {
        decoding_method: options.temperature && options.temperature > 0 ? "sample" : "greedy",
        max_new_tokens: options.maxNewTokens ?? 500,
        min_new_tokens: options.minNewTokens ?? 1,
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        repetition_penalty: options.repetitionPenalty ?? 1.05,
        stop_sequences: options.stopSequences,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(
        `[watsonx.ai] Text generation failed (HTTP ${response.status}): ${errBody}`
      );
    }

    const data = await response.json();
    const result = data.results?.[0];

    return {
      generatedText: result?.generated_text || "",
      inputTokenCount: result?.input_token_count,
      generatedTokenCount: result?.generated_token_count,
      stopReason: result?.stop_reason,
      raw: data,
    };
  }

  /**
   * Generates conversational chat responses using watsonx Chat API (where supported by model).
   */
  async generateChat(
    messages: WatsonxChatMessage[],
    options: WatsonxChatOptions = {}
  ): Promise<WatsonxChatResponse> {
    const token = await getIamBearerToken(this.config.apiKey);
    const endpoint = `${this.config.url}/ml/v1/text/chat?version=${this.config.version}`;

    const modelId = options.modelId || this.config.defaultModelId;
    const payload = {
      model_id: modelId,
      project_id: this.config.projectId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens ?? 600,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 1.0,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Fall back to prompt formatting via generateText if chat endpoint is not available for this model
      return this.fallbackChatViaPrompt(messages, options);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || "",
      finishReason: choice?.finish_reason,
      raw: data,
    };
  }

  /**
   * Prompt formatting fallback when running standard text generation models with chat formats.
   */
  private async fallbackChatViaPrompt(
    messages: WatsonxChatMessage[],
    options: WatsonxChatOptions
  ): Promise<WatsonxChatResponse> {
    const prompt = messages
      .map((m) => {
        if (m.role === "system") return `[System]: ${m.content}\n`;
        if (m.role === "user") return `[User]: ${m.content}\n`;
        return `[Assistant]: ${m.content}\n`;
      })
      .join("") + `[Assistant]:`;

    const res = await this.generateText(prompt, {
      modelId: options.modelId,
      maxNewTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      stopSequences: ["[User]:", "[System]:"],
    });

    return {
      content: res.generatedText.trim(),
      finishReason: res.stopReason,
      raw: res.raw,
    };
  }
}

/**
 * Singleton instance of the WatsonxClient for server-side consumption.
 */
let clientInstance: WatsonxClient | null = null;

export function getWatsonxClient(): WatsonxClient {
  if (!clientInstance) {
    clientInstance = new WatsonxClient();
  }
  return clientInstance;
}

/**
 * Direct shorthand function to call watsonx text generation.
 */
export async function callWatsonx(
  prompt: string,
  options?: WatsonxGenerateOptions
): Promise<string> {
  const client = getWatsonxClient();
  const response = await client.generateText(prompt, options);
  return response.generatedText;
}
