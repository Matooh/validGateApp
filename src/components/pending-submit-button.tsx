'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type PendingSubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  className: string;
  disabled?: boolean;
  name?: string;
  value?: string;
};

export function PendingSubmitButton({
  children,
  pendingLabel,
  className,
  disabled = false,
  name,
  value,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
