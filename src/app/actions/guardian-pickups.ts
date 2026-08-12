'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getPickupMessage } from '@/lib/messages/pickup-messages';
import { createClient } from '@/lib/supabase/server';

export type GuardianPickupRequest = {
  requestId: string;
  institutionId: number;
  studentId: number;
  studentName: string;
  guardianName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  studentRespondedAt: string | null;
  expiresAt: string | null;
  guardianValidationMethod: 'PIN' | 'MANUAL' | null;
  studentValidationMethod: 'PIN' | 'MANUAL' | null;
  guardianFailedAttempts: number;
  studentFailedAttempts: number;
  maxAttempts: number;
  notificationMessage: string;
};

export type MyPickupPin = {
  requestId: string;
  actorType: 'GUARDIAN' | 'STUDENT';
  pin: string;
  expiresAt: string;
};

type RpcRow = { request_id?: string; message_code?: string; event_id?: number };
type PickupRow = {
  request_id: string;
  institution_id: number;
  student_id: number;
  student_name: string;
  guardian_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  student_responded_at: string | null;
  expires_at: string | null;
  guardian_validation_method: 'PIN' | 'MANUAL' | null;
  student_validation_method: 'PIN' | 'MANUAL' | null;
  guardian_failed_attempts: number;
  student_failed_attempts: number;
  max_attempts: number;
  notification_message: string;
};

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}

function redirectWithPickupMessage(path: '/dashboard' | '/guard', code?: string | null): never {
  redirect(`${path}?message=${encodeURIComponent(getPickupMessage(code))}`);
}

function refreshPickupViews() {
  revalidatePath('/dashboard');
  revalidatePath('/guard');
  revalidatePath('/authentications');
}

async function executePickupRpc(
  functionName: string,
  params: Record<string, unknown>,
): Promise<RpcRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, params);
  const result = firstRow(data as RpcRow | RpcRow[] | null);
  if (error || !result) {
    console.error('guardian_pickup_rpc_error', { functionName, code: error?.code, message: error?.message });
    return { message_code: 'PICKUP_FAILED' };
  }
  return result;
}

export async function listGuardianPickupRequests(): Promise<GuardianPickupRequest[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_guardian_pickup_requests');
  if (error) {
    console.error('guardian_pickup_list_error', { code: error.code, message: error.message });
    return [];
  }
  return ((data ?? []) as PickupRow[]).map((row) => ({
    requestId: row.request_id,
    institutionId: row.institution_id,
    studentId: row.student_id,
    studentName: row.student_name,
    guardianName: row.guardian_name,
    status: row.expires_at && new Date(row.expires_at).getTime() <= Date.now()
      && ['PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(row.status)
      ? 'EXPIRED'
      : row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    studentRespondedAt: row.student_responded_at,
    expiresAt: row.expires_at,
    guardianValidationMethod: row.guardian_validation_method,
    studentValidationMethod: row.student_validation_method,
    guardianFailedAttempts: row.guardian_failed_attempts,
    studentFailedAttempts: row.student_failed_attempts,
    maxAttempts: row.max_attempts,
    notificationMessage: row.notification_message,
  }));
}

export async function listMyPickupPins(requestIds: string[]): Promise<MyPickupPin[]> {
  await requireUser();
  const supabase = await createClient();
  const results = await Promise.all(requestIds.map(async (requestId) => {
    const { data } = await supabase.rpc('get_my_guardian_pickup_pin', { p_request_id: requestId });
    const row = firstRow(data as { request_id: string; actor_type: 'GUARDIAN' | 'STUDENT'; pin: string; expires_at: string }[] | null);
    return row ? {
      requestId: row.request_id,
      actorType: row.actor_type,
      pin: row.pin,
      expiresAt: row.expires_at,
    } : null;
  }));
  return results.filter((item): item is MyPickupPin => Boolean(item));
}

export async function createGuardianPickupRequestFromForm(formData: FormData) {
  const studentId = Number(formData.get('student_id'));
  if (!Number.isInteger(studentId) || studentId <= 0) redirectWithPickupMessage('/dashboard', 'PICKUP_NOT_ALLOWED');
  const result = await executePickupRpc('create_guardian_pickup_request', { p_student_id: studentId });
  refreshPickupViews();
  redirectWithPickupMessage('/dashboard', result.message_code);
}

export async function respondGuardianPickupRequestFromForm(formData: FormData) {
  const requestId = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const result = await executePickupRpc('respond_guardian_pickup_request', {
    p_request_id: requestId,
    p_accept: decision === 'ACCEPT',
  });
  refreshPickupViews();
  redirectWithPickupMessage('/dashboard', result.message_code);
}

export async function cancelGuardianPickupRequestFromForm(formData: FormData) {
  const result = await executePickupRpc('cancel_guardian_pickup_request', {
    p_request_id: String(formData.get('request_id') ?? ''),
  });
  refreshPickupViews();
  redirectWithPickupMessage('/dashboard', result.message_code);
}

export async function validateGuardianPickupPinFromForm(formData: FormData) {
  const result = await executePickupRpc('validate_guardian_pickup_pin', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_actor_type: String(formData.get('actor_type') ?? ''),
    p_pin: String(formData.get('pin') ?? '').trim(),
  });
  refreshPickupViews();
  redirectWithPickupMessage('/guard', result.message_code);
}

export async function manuallyValidateGuardianPickupActorFromForm(formData: FormData) {
  const result = await executePickupRpc('manually_validate_guardian_pickup_actor', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_actor_type: String(formData.get('actor_type') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim(),
    p_note: String(formData.get('note') ?? '').trim(),
  });
  refreshPickupViews();
  redirectWithPickupMessage('/guard', result.message_code);
}

export async function confirmGuardianPickupFromForm(formData: FormData) {
  const result = await executePickupRpc('confirm_guardian_pickup', {
    p_request_id: String(formData.get('request_id') ?? ''),
  });
  refreshPickupViews();
  redirectWithPickupMessage('/guard', result.message_code);
}

export async function rejectGuardianPickupAtGateFromForm(formData: FormData) {
  const result = await executePickupRpc('reject_guardian_pickup_at_gate', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim(),
    p_note: String(formData.get('note') ?? '').trim(),
  });
  refreshPickupViews();
  redirectWithPickupMessage('/guard', result.message_code);
}
