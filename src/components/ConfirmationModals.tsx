import React from 'react';
import { ConfirmModal } from './ConfirmModal';

export const ConfirmationModals = ({
  deleteConfirm,
  setDeleteConfirm,
  commentDeleteConfirm,
  setCommentDeleteConfirm,
  userActionConfirm,
  setUserActionConfirm,
  accountDeleteConfirm,
  setAccountDeleteConfirm,
  companyActionConfirm,
  setCompanyActionConfirm,
  confirmDelete,
  confirmCommentDelete,
  confirmUserAction,
  confirmAccountDelete,
  confirmCompanyDelete
}: any) => {
  return (
    <>
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, property_id: null })}
        title="تأكيد الحذف"
        message="هل أنت متأكد من رغبتك في حذف هذا العقار نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="تأكيد الحذف"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
      <ConfirmModal
        isOpen={commentDeleteConfirm.isOpen}
        onConfirm={confirmCommentDelete}
        onCancel={() => setCommentDeleteConfirm({ isOpen: false, commentId: null, property_id: null })}
        title="تأكيد حذف التعليق"
        message="هل أنت متأكد من حذف هذا التعليق؟"
        confirmText="تأكيد الحذف"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
      <ConfirmModal
        isOpen={userActionConfirm.isOpen}
        onConfirm={confirmUserAction}
        onCancel={() => setUserActionConfirm({ isOpen: false, user_id: null, action: null })}
        title={
          userActionConfirm.action === 'approve' ? "تأكيد الموافقة" :
          userActionConfirm.action === 'reject' ? "تأكيد الرفض" :
          userActionConfirm.action === 'change-role' ? "تغيير الصلاحية" :
          "تأكيد الحذف"
        }
        message={
          userActionConfirm.action === 'bulk-delete' ? "⚠️ تحذير: هل أنت متأكد من حذف جميع الحسابات المسجلة؟ سيتم مسح صلاحياتهم وبياناتهم من قاعدة البيانات." :
          userActionConfirm.action === 'approve' ? `هل أنت متأكد من الموافقة على الموظف ${userActionConfirm.extraData?.full_name || ''}؟` :
          userActionConfirm.action === 'reject' ? `هل أنت متأكد من رفض الموظف ${userActionConfirm.extraData?.full_name || ''}؟` :
          userActionConfirm.action === 'change-role' ? `هل أنت متأكد من تغيير صلاحية ${userActionConfirm.extraData?.full_name} إلى ${userActionConfirm.extraData?.newRole === 'admin' ? 'ادمن الشركة' : 'موظف'}؟` :
          `هل أنت متأكد من رغبتك في حذف ${userActionConfirm.extraData?.full_name || 'هذا الموظف'} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
        }
        confirmText={
          userActionConfirm.action === 'approve' ? "تأكيد الموافقة" :
          userActionConfirm.action === 'reject' ? "تأكيد الرفض" :
          userActionConfirm.action === 'change-role' ? "تغيير الصلاحية" :
          "تأكيد الحذف"
        }
        confirmColor={
          userActionConfirm.action === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" :
          userActionConfirm.action === 'reject' ? "bg-red-600 hover:bg-red-700" :
          userActionConfirm.action === 'change-role' ? "bg-blue-600 hover:bg-blue-700" :
          "bg-red-600 hover:bg-red-700"
        }
      />
      <ConfirmModal
        isOpen={accountDeleteConfirm}
        onConfirm={confirmAccountDelete}
        onCancel={() => setAccountDeleteConfirm(false)}
        title="تأكيد حذف الحساب"
        message="هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ سيتم حذف جميع بياناتك الشخصية ولا يمكن التراجع عن هذه الخطوة."
        confirmText="حذف الحساب"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
      <ConfirmModal
        isOpen={companyActionConfirm.isOpen}
        onConfirm={confirmCompanyDelete}
        onCancel={() => setCompanyActionConfirm({ isOpen: false, company_id: null, companyName: null })}
        title="تأكيد حذف الشركة"
        message={`هل أنت متأكد من حذف حساب الشركة ${companyActionConfirm.companyName} عموماً؟ سيؤدي ذلك لحذف الشركة وجميع الموظفين والعقارات التابعة لها نهائياً. لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="تأكيد الحذف"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </>
  );
};
