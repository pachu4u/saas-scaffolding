'use client';

import { useState } from 'react';

import { InviteModal } from '@/components/modals/invite-modal';

interface InviteButtonProps {
  tenantSlug: string;
}

export function InviteButton({ tenantSlug }: InviteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + Invite member
      </button>
      {open && (
        <InviteModal
          tenantSlug={tenantSlug}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
