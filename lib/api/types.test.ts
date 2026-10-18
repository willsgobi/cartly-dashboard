import { expectTypeOf, it } from "vitest";
import type { ApiClient } from "./client";
import type { components } from "./generated/schema";
import type { ApiPath, ApiRequestOptions, ApiSuccessBody } from "./types";

it("keeps generated required, optional, nullable and ambiguous fields", () => {
  expectTypeOf<components["schemas"]["SafeUserResponseDto"]["lockedAt"]>().toEqualTypeOf<string | null>();
  expectTypeOf<components["schemas"]["CreateProductDto"]["price"]>()
    .toEqualTypeOf<Record<string, never> | null | undefined>();
  expectTypeOf<components["schemas"]["ProductVariantResponseDto"]["price"]>().toEqualTypeOf<number | null>();
  expectTypeOf<components["schemas"]["ProductResponseDto"]["images"]>()
    .toEqualTypeOf<components["schemas"]["ProductImageResponseDto"][] | undefined>();
  expectTypeOf<components["schemas"]["ProductResponseDto"]["description"]>().toEqualTypeOf<string>();
  expectTypeOf<components["schemas"]["UpdateCompanyAddressDto"]>().not.toHaveProperty("number");
  expectTypeOf<components["schemas"]["UpdateProductDto"]>().toExtend<{ companyId: string }>();
  expectTypeOf<ApiSuccessBody<"DELETE", "/companies/{companyId}/categories/{categoryId}">>().toBeUndefined();
  expectTypeOf<ApiSuccessBody<"DELETE", "/products/{productId}">>().toBeUnknown();
  expectTypeOf<ApiPath<"GET">>().extract<"/companies">().toEqualTypeOf<"/companies">();
  expectTypeOf<ApiPath<"PATCH">>().extract<"/products/{productId}/variants/{variantId}">().toEqualTypeOf<"/products/{productId}/variants/{variantId}">();
});

// Compiled by tsc, never invoked; no HTTP calls or session flows are implemented.
export function checkContractConstraints(client: ApiClient) {
  // F10's explicit runtime compatibility override accepts numeric product prices only here.
  client.request("POST", "/products", { body: { name: "Name", type: "NORMAL", companyId: "c", categoryId: "d", price: 12.5 } });
  client.request("PATCH", "/products/{productId}", { pathParams: { productId: "p" }, body: { companyId: "c", price: null } });
  client.request("POST", "/products", { body: { name: "Name", type: "VARIANT_WITH_PRICE", companyId: "c", categoryId: "d", price: null, variants: [{ name: "P", price: 30 }] } });
  client.request("POST", "/products/{productId}/variants", { pathParams: { productId: "p" }, query: { companyId: "c" }, body: { name: "P", price: 30 } });
  // @ts-expect-error Variant deletion has no body, unlike product soft deletion.
  client.request("DELETE", "/products/{productId}/variants/{variantId}", { pathParams: { productId: "p", variantId: "v" }, query: { companyId: "c" }, body: { companyId: "c" } });
  // @ts-expect-error Compatibility must not accept object-valued monetary input.
  client.request("PATCH", "/products/{productId}", { pathParams: { productId: "p" }, body: { companyId: "c", price: {} } });
  // @ts-expect-error There is no GET category detail operation.
  client.request("GET", "/companies/{companyId}/categories/{categoryId}", { pathParams: { companyId: "c", categoryId: "d" } });
  // @ts-expect-error Company-scoped product queries require companyId.
  client.request("GET", "/products", {});
  // @ts-expect-error Product deletion requires a JSON body with companyId.
  client.request("DELETE", "/products/{productId}", { pathParams: { productId: "p" } });
  // @ts-expect-error Product update requires companyId even for a partial change.
  client.request("PATCH", "/products/{productId}", { pathParams: { productId: "p" }, body: { name: "Name" } });
  // @ts-expect-error GET requests cannot have JSON request bodies.
  client.request("GET", "/companies", { body: {} });
  // @ts-expect-error No undocumented pagination parameters.
  client.request("GET", "/companies", { query: { page: 1 } });
  client.request("PATCH", "/products/{productId}/variants/{variantId}", { pathParams: { productId: "p", variantId: "v" }, query: { companyId: "c" }, body: { name: "New", price: 45 } });
  // @ts-expect-error The corrected contract no longer permits the duplicated route.
  client.request("PATCH", "/products/{productId}/variants/{productId}/variants/{variantId}", { pathParams: { productId: "p", variantId: "v" }, query: { companyId: "c" }, body: {} });
  // @ts-expect-error Decoders must return the documented response shape.
  client.request("GET", "/companies", { decode: () => ({ invented: true }) });
  // @ts-expect-error Path parameters must be supplied.
  const missingPath: ApiRequestOptions<"GET", "/companies/{companyId}"> = {};
  void missingPath;
  // @ts-expect-error Price is not documented as a number in this schema.
  const price: components["schemas"]["CreateProductDto"]["price"] = 12.5;
  void price;
}
