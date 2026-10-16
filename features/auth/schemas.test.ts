import { describe, expect, it } from "vitest";
import { activationSchema, registerFormSchema, registerRequestSchema, resendSchema } from "./schemas";

const valid = { name: "Pessoa de teste", email: "test@example.com", password: "x", confirmPassword: "x" };

describe("registration and activation validation", () => {
  it.each(["name", "email", "password", "confirmPassword"])("requires %s", (field) => {
    expect(registerFormSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });
  it("rejects a blank name and an invalid email", () => {
    expect(registerFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...valid, email: "invalid" }).success).toBe(false);
  });
  it("requires confirmation to match exactly without inventing password rules", () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
    expect(registerFormSchema.safeParse({ ...valid, confirmPassword: "different" }).success).toBe(false);
    expect(registerFormSchema.parse({ ...valid, password: " x ", confirmPassword: " x " }).password).toBe(" x ");
  });
  it("strips confirmation/extra fields and normalizes only name/email", () => {
    expect(registerRequestSchema.parse({ ...valid, name: " Pessoa ", email: " test@example.com ", extra: "ignored" }))
      .toEqual({ name: "Pessoa", email: "test@example.com", password: "x" });
  });
  it.each(["", "1234567", "123456789", "abcdefgh", "1234 678", "１２３４５６７８", 12345678])("rejects invalid OTP %j", (otp) => {
    expect(activationSchema.safeParse({ email: valid.email, otp }).success).toBe(false);
  });
  it("keeps leading zeros and accepts exactly eight numeric characters", () => {
    expect(activationSchema.parse({ email: valid.email, otp: "00001234" }).otp).toBe("00001234");
  });
  it("resend requires only a valid email", () => {
    expect(resendSchema.parse({ email: valid.email })).toEqual({ email: valid.email });
    expect(resendSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});
