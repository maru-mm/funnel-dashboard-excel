/**
 * Gemini Computer Use — REST API client.
 *
 * Il modello Computer Use analizza screenshot del browser e restituisce
 * azioni UI (click_at, type_text_at, scroll, ecc.) con coordinate normalizzate
 * su una griglia 0-999 che vengono poi denormalizzate alle dimensioni reali dello schermo.
 *
 * Modello: gemini-2.5-computer-use-preview-10-2025
 * Ref: https://ai.google.dev/gemini-api/docs/computer-use
 */

// =====================================================
// CONSTANTS
// =====================================================

export const COMPUTER_USE_MODEL = 'gemini-2.5-computer-use-preview-10-2025';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GRID_SIZE = 1000; // Coordinate normalizzate 0-999

/** Dimensioni raccomandate dalla documentazione Google */
export const RECOMMENDED_SCREEN_WIDTH = 1440;
export const RECOMMENDED_SCREEN_HEIGHT = 900;

// =====================================================
// TYPES
// =====================================================

export interface CUContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
    parts?: { inlineData: { mimeType: string; data: string } }[];
  };
}

export interface CUContent {
  role: 'user' | 'model';
  parts: CUContentPart[];
}

export interface CUSafetyDecision {
  explanation: string;
  decision: 'require_confirmation' | 'allowed' | string;
}

export interface CUAction {
  name: string;
  args: Record<string, unknown>;
  safetyDecision?: CUSafetyDecision;
}

export interface CUModelResponse {
  /** Testo di reasoning/pensiero del modello */
  text?: string;
  /** Azioni UI suggerite dal modello */
  actions: CUAction[];
  /** Content completo del modello (da aggiungere alla history) */
  modelContent: CUContent;
  /** Flag: il modello ha terminato (nessuna azione, solo testo) */
  isTaskComplete: boolean;
}

// =====================================================
// COORDINATE DENORMALIZATION
// =====================================================

/** Converte coordinata X normalizzata (0-999) in pixel reali */
export function denormalizeX(x: number, screenWidth: number): number {
  return Math.round((x / GRID_SIZE) * screenWidth);
}

/** Converte coordinata Y normalizzata (0-999) in pixel reali */
export function denormalizeY(y: number, screenHeight: number): number {
  return Math.round((y / GRID_SIZE) * screenHeight);
}

// =====================================================
// API CALL
// =====================================================

/**
 * Chiama il modello Gemini Computer Use con la conversation history completa.
 * Ritorna le azioni suggerite e il content del modello da aggiungere alla history.
 */
export async function callComputerUse(
  apiKey: string,
  contents: CUContent[],
  excludedActions?: string[],
): Promise<CUModelResponse> {
  const url = `${API_BASE}/models/${COMPUTER_USE_MODEL}:generateContent?key=${apiKey}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computerUseConfig: Record<string, any> = {
    environment: 'ENVIRONMENT_BROWSER',
  };
  if (excludedActions?.length) {
    computerUseConfig.excluded_predefined_functions = excludedActions;
  }

  const body = {
    contents,
    tools: [
      {
        computerUse: computerUseConfig,
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Computer Use API ${response.status}: ${errText.slice(0, 500)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any;
  const candidate = data.candidates?.[0];

  if (!candidate?.content?.parts) {
    throw new Error('Gemini Computer Use: nessun candidate nella risposta');
  }

  const modelContent: CUContent = {
    role: 'model',
    parts: candidate.content.parts,
  };

  // Parsa le parti della risposta
  let text = '';
  const actions: CUAction[] = [];

  for (const part of candidate.content.parts) {
    if (part.text) {
      text += part.text + '\n';
    }
    if (part.functionCall) {
      const { name, args } = part.functionCall;

      // Estrai safety_decision dagli args (se presente)
      let safetyDecision: CUSafetyDecision | undefined;
      const cleanArgs = { ...args };
      if (cleanArgs.safety_decision) {
        safetyDecision = cleanArgs.safety_decision as CUSafetyDecision;
        delete cleanArgs.safety_decision;
      }

      actions.push({ name, args: cleanArgs, safetyDecision });
    }
  }

  const isTaskComplete = actions.length === 0 && text.trim().length > 0;

  return {
    text: text.trim() || undefined,
    actions,
    modelContent,
    isTaskComplete,
  };
}

// =====================================================
// FUNCTION RESPONSE BUILDERS
// =====================================================

/**
 * Crea un ContentPart di tipo functionResponse con screenshot allegato.
 * Formato richiesto dal Computer Use per il feedback dopo l'esecuzione.
 */
export function buildFunctionResponsePart(
  actionName: string,
  currentUrl: string,
  screenshotBase64: string,
  screenshotMimeType: string = 'image/jpeg',
  extraFields?: Record<string, unknown>,
): CUContentPart {
  return {
    functionResponse: {
      name: actionName,
      response: { url: currentUrl, ...extraFields },
      parts: [
        {
          inlineData: {
            mimeType: screenshotMimeType,
            data: screenshotBase64,
          },
        },
      ],
    },
  };
}

/**
 * Crea il Content "user" con tutte le function responses per un turn.
 * Ogni azione eseguita genera una functionResponse con lo screenshot post-azione.
 */
export function buildFunctionResponseContent(
  results: { actionName: string; error?: string; safetyAcknowledged?: boolean }[],
  currentUrl: string,
  screenshotBase64: string,
  screenshotMimeType: string = 'image/jpeg',
): CUContent {
  const parts: CUContentPart[] = results.map((r) => {
    const extra: Record<string, unknown> = {};
    if (r.error) extra.error = r.error;
    if (r.safetyAcknowledged) extra.safety_acknowledgement = 'true';
    return buildFunctionResponsePart(
      r.actionName,
      currentUrl,
      screenshotBase64,
      screenshotMimeType,
      extra,
    );
  });

  return { role: 'user', parts };
}

// =====================================================
// CONVERSATION WINDOW MANAGEMENT
// =====================================================

/**
 * Gestione sliding window della conversation history.
 * Rimuove gli screenshot dalle function response piu' vecchie
 * per evitare di superare i limiti di token/payload.
 *
 * Mantiene gli screenshot solo degli ultimi `keepScreenshots` turn.
 */
export function trimConversationHistory(
  contents: CUContent[],
  keepScreenshots: number = 15,
): void {
  // Conta quanti user turn con functionResponse ci sono
  let frTurnCount = 0;
  const frTurnIndices: number[] = [];

  for (let i = contents.length - 1; i >= 0; i--) {
    const content = contents[i];
    if (content.role === 'user') {
      const hasFR = content.parts.some((p) => p.functionResponse);
      if (hasFR) {
        frTurnCount++;
        frTurnIndices.push(i);
      }
    }
  }

  // Se abbiamo piu' turn con screenshot del limite, rimuovi quelli vecchi
  if (frTurnCount > keepScreenshots) {
    const toStrip = frTurnIndices.slice(keepScreenshots); // indici dei turn vecchi
    for (const idx of toStrip) {
      const content = contents[idx];
      for (const part of content.parts) {
        if (part.functionResponse?.parts) {
          // Rimuovi inline_data (screenshot) ma mantieni il resto
          part.functionResponse.parts = [];
        }
      }
    }
  }
}

// =====================================================
// INITIAL CONTENT BUILDER
// =====================================================

/**
 * Crea il content iniziale per l'agent loop:
 * prompt di sistema + screenshot iniziale della pagina.
 */
export function buildInitialContent(
  prompt: string,
  screenshotBase64: string,
  screenshotMimeType: string = 'image/jpeg',
): CUContent {
  return {
    role: 'user',
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType: screenshotMimeType,
          data: screenshotBase64,
        },
      },
    ],
  };
}
