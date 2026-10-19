import React from 'react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

// Security: Database and internal credentials are never configured via client UI
export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = () => {
  return null;
};
