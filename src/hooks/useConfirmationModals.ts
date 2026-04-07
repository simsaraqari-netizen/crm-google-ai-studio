import { useState } from 'react';

export const useConfirmationModals = () => {
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; propertyId: string | null }>({
    isOpen: false,
    propertyId: null
  });
  const [commentDeleteConfirm, setCommentDeleteConfirm] = useState<{ isOpen: boolean; commentId: string | null; propertyId: string | null }>({
    isOpen: false,
    commentId: null,
    propertyId: null
  });
  const [userActionConfirm, setUserActionConfirm] = useState<{ 
    isOpen: boolean; 
    userId: string | null; 
    action: 'delete' | 'bulk-delete' | 'approve' | 'reject' | 'change-role' | null;
    extraData?: any;
  }>({
    isOpen: false,
    userId: null,
    action: null
  });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState(false);
  const [companyActionConfirm, setCompanyActionConfirm] = useState<{
    isOpen: boolean;
    companyId: string | null;
    companyName: string | null;
  }>({
    isOpen: false,
    companyId: null,
    companyName: null
  });

  return {
    deleteConfirm, setDeleteConfirm,
    commentDeleteConfirm, setCommentDeleteConfirm,
    userActionConfirm, setUserActionConfirm,
    accountDeleteConfirm, setAccountDeleteConfirm,
    companyActionConfirm, setCompanyActionConfirm
  };
};
