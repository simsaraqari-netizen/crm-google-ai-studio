import { useState } from 'react';

export const useConfirmationModals = () => {
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; property_id: string | null }>({
    isOpen: false,
    property_id: null
  });
  const [commentDeleteConfirm, setCommentDeleteConfirm] = useState<{ isOpen: boolean; commentId: string | null; property_id: string | null }>({
    isOpen: false,
    commentId: null,
    property_id: null
  });
  const [userActionConfirm, setUserActionConfirm] = useState<{ 
    isOpen: boolean; 
    user_id: string | null; 
    action: 'delete' | 'bulk-delete' | 'approve' | 'reject' | 'change-role' | null;
    extraData?: any;
  }>({
    isOpen: false,
    user_id: null,
    action: null
  });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState(false);
  const [companyActionConfirm, setCompanyActionConfirm] = useState<{
    isOpen: boolean;
    company_id: string | null;
    companyName: string | null;
  }>({
    isOpen: false,
    company_id: null,
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
