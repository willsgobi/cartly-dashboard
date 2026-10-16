export type ApiErrorKind =
  | "http"
  | "network"
  | "aborted"
  | "invalid-response"
  | "configuration"
  | "request";

const httpMessages: Readonly<Record<number, string>> = {
  400: "Não foi possível processar os dados enviados.",
  401: "Autenticação necessária para continuar.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "O recurso solicitado não foi encontrado.",
  409: "Não foi possível concluir a ação devido a um conflito nos dados.",
  500: "O servidor não conseguiu concluir a solicitação. Tente novamente.",
};

const messages: Record<ApiErrorKind, string> = {
  http: "Não foi possível concluir a solicitação.",
  network: "Não foi possível conectar ao servidor. Tente novamente.",
  aborted: "A solicitação foi cancelada.",
  "invalid-response": "O servidor retornou uma resposta inválida. Tente novamente.",
  configuration: "Não foi possível configurar a conexão com o servidor.",
  request: "Não foi possível preparar a solicitação.",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  /** Untrusted diagnostic data; never display directly or log automatically. */
  readonly details: unknown;

  constructor(
    kind: ApiErrorKind,
    options: { status?: number; details?: unknown } = {},
  ) {
    super(
      kind === "http" && options.status !== undefined
        ? (httpMessages[options.status] ?? messages.http)
        : messages[kind],
    );
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.details = options.details;
  }
}
