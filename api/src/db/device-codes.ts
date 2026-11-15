import type { Env } from '../types';
import { first, run, runOnce } from './sql';

export interface DeviceCode {
  user_id: string | null;
  issued: number;
  expires_at: number;
}

export const insertDeviceCode = (env: Env, deviceCodeHash: string, userCode: string, expiresAt: number) =>
  run(
    env,
    'INSERT INTO device_codes (device_code_hash, user_code, expires_at) VALUES (?, ?, ?)',
    deviceCodeHash,
    userCode,
    expiresAt,
  );

export const getDeviceCode = (env: Env, deviceCodeHash: string) =>
  first<DeviceCode>(
    env,
    'SELECT user_id, issued, expires_at FROM device_codes WHERE device_code_hash = ?',
    deviceCodeHash,
  );

/** Marks the code's token as handed out. False if it already was (so a token is only issued once). */
export const markDeviceCodeIssued = (env: Env, deviceCodeHash: string) =>
  runOnce(env, 'UPDATE device_codes SET issued = 1 WHERE device_code_hash = ? AND issued = 0', deviceCodeHash);

/** Attaches a user to an unexpired, unapproved code. False if the code is invalid, expired or already used. */
export const approveDeviceCode = (env: Env, userCode: string, userId: string, now: number) =>
  runOnce(
    env,
    'UPDATE device_codes SET user_id = ? WHERE user_code = ? AND user_id IS NULL AND expires_at > ?',
    userId,
    userCode,
    now,
  );
