'use client';

import { useState } from 'react';

import { CreateConnectedAppModal } from '@/components/modals/create-connected-app-modal';

export function CreateConnectedAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + Connect an app
      </button>
      {open && (
        <CreateConnectedAppModal
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
