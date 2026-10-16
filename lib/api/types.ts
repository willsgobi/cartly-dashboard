import type { paths } from "./generated/schema";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiPath<Method extends HttpMethod> = {
  [Path in keyof paths]: Lowercase<Method> extends keyof paths[Path]
    ? NonNullable<paths[Path][Lowercase<Method>]> extends never
      ? never
      : Path
    : never;
}[keyof paths];

type Operation<
  Method extends HttpMethod,
  Path extends ApiPath<Method>,
> = NonNullable<paths[Path][Lowercase<Method> & keyof paths[Path]]>;

type ParametersAt<Op, Location extends string> = Op extends {
  parameters: infer Parameters;
}
  ? Location extends keyof Parameters
    ? NonNullable<Parameters[Location]>
    : never
  : never;

type ParameterOption<Key extends string, Value> = [Value] extends [never]
  ? { [Name in Key]?: never }
  : Partial<Value> extends Value
    ? { [Name in Key]?: Value }
    : { [Name in Key]: Value };

type JsonContent<Value> = Value extends {
  content: { "application/json": infer Body };
}
  ? Body
  : never;

type RequestBody<Op> = Op extends { requestBody?: infer Body }
  ? JsonContent<NonNullable<Body>>
  : never;

type BodyOption<Op> = [RequestBody<Op>] extends [never]
  ? { body?: never }
  : Op extends { requestBody: unknown }
    ? { body: RequestBody<Op> }
    : { body?: RequestBody<Op> };

type SuccessResponse<Op> = Op extends { responses: infer Responses }
  ? {
      [Status in keyof Responses]: `${Status & (number | string)}` extends `2${string}`
        ? Responses[Status]
        : never;
    }[keyof Responses]
  : never;

type ResponseContent<Response> = Response extends {
  content: { "application/json": infer Body };
}
  ? Body
  : undefined;

export type ApiSuccessBody<
  Method extends HttpMethod,
  Path extends ApiPath<Method>,
> = ResponseContent<SuccessResponse<Operation<Method, Path>>>;

export type ResponseDecoder<Value> = (value: unknown) => Value;

export type ApiRequestOptions<
  Method extends HttpMethod,
  Path extends ApiPath<Method>,
> = {
  token?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
} & ParameterOption<"pathParams", ParametersAt<Operation<Method, Path>, "path">>
  & ParameterOption<"query", ParametersAt<Operation<Method, Path>, "query">>
  & BodyOption<Operation<Method, Path>>;
