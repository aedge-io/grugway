/**
 * Stub types and functions used by README doc tests.
 * These exist solely to make the documentation examples type-check.
 */

import { Ok, type Result, Task } from "aetherway";

// ── Types ──

export type User = {
  name: string;
  email: string;
  isActive: boolean;
};

export type Order = { id: string; total: number };
export type Payment = { id: string; amount: number };
export type Receipt = { orderId: string };
export type Config = { key: string };
export type Data = { payload: string };

export class ValidationError extends Error {}
export class OrderError extends Error {}
export class NotFoundError extends Error {}
export class PaymentError extends Error {}
export class ReceiptError extends Error {}
export class FetchError extends Error {
  constructor(url: string, opts?: ErrorOptions) {
    super(`Fetch failed: ${url}`, opts);
  }
}
export class ApiError extends Error {}
export class MathError extends Error {}
export class TimeoutError extends Error {}
export class EnvError extends Error {}
export class FileError extends Error {}
export class DefaultError extends Error {}
export class PrimaryError extends Error {}
export class ReplicaError extends Error {}
export class CacheError extends Error {}

// ── Stub functions ──

export const id = "user-1";

export function getUserById(_id: string): User | undefined {
  return { name: "Alice", email: "alice@example.com", isActive: true };
}

export function getString(): string | TypeError {
  return "hello";
}

export function riskyDivision(): number {
  return 42;
}

export function validateName(
  name: string,
): Result<string, ValidationError> {
  return Ok(name);
}

export function validateEmail(
  email: string,
): Result<string, ValidationError> {
  return Ok(email);
}

export function validateAge(
  age: number,
): Result<number, ValidationError> {
  return Ok(age);
}

export function loadFromEnv(): Result<Config, EnvError> {
  return Ok({ key: "value" });
}

export function loadFromFile(): Result<Config, FileError> {
  return Ok({ key: "value" });
}

export function loadDefaults(): Result<Config, DefaultError> {
  return Ok({ key: "default" });
}

export const input = { name: "Alice", email: "a@b.com", age: 30 };

export function getOrder(
  _orderId: string,
): Task<Order, NotFoundError> {
  return Task.succeed({ id: "1", total: 100 }) as Task<Order, NotFoundError>;
}

export function validateOrder(
  order: Order,
): Task<Order, ValidationError> {
  return Task.succeed(order) as Task<Order, ValidationError>;
}

export function processPayment(
  _order: Order,
): Task<Payment, PaymentError> {
  return Task.succeed({ id: "p1", amount: 100 }) as Task<
    Payment,
    PaymentError
  >;
}

export function generateReceipt(
  _payment: Payment,
): Task<Receipt, ReceiptError> {
  return Task.succeed({ orderId: "1" }) as Task<Receipt, ReceiptError>;
}

export function logError(_e: unknown): void {}

export function parse(path: string): Result<string, Error> {
  return Ok(path);
}

export function isValid(
  _path: string,
): Result<void, ValidationError> {
  return Ok(undefined as unknown as void);
}

export function isWritable(
  _path: string,
): Result<void, Error> {
  return Ok(undefined as unknown as void);
}

export function writeFile(
  _path: string,
): Result<void, Error> {
  return Ok(undefined as unknown as void);
}

export function fetchUsers(): Task<User[], ApiError> {
  return Task.succeed([]) as Task<User[], ApiError>;
}

export function fetchProducts(): Task<string[], ApiError> {
  return Task.succeed([]) as Task<string[], ApiError>;
}

export function fetchOrders(): Task<Order[], ApiError> {
  return Task.succeed([]) as Task<Order[], ApiError>;
}

export function fetchFromPrimary(): Task<Data, PrimaryError> {
  return Task.succeed({ payload: "" }) as Task<Data, PrimaryError>;
}

export function fetchFromReplica(): Task<Data, ReplicaError> {
  return Task.succeed({ payload: "" }) as Task<Data, ReplicaError>;
}

export function fetchFromCache(): Task<Data, CacheError> {
  return Task.succeed({ payload: "" }) as Task<Data, CacheError>;
}

export const legacyApi = {
  fetch(cb: (err: TimeoutError | null, data?: Data) => void): void {
    cb(null, { payload: "" });
  },
};
