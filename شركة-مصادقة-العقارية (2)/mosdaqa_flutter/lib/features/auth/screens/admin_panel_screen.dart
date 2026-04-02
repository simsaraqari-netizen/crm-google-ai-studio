import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/admin_provider.dart';
import '../providers/auth_provider.dart';
import '../models/user_model.dart';

class AdminPanelScreen extends ConsumerStatefulWidget {
  const AdminPanelScreen({super.key});

  @override
  ConsumerState<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends ConsumerState<AdminPanelScreen> {
  String _selectedRole = 'pending';

  @override
  Widget build(BuildContext context) {
    final adminAsync = ref.watch(adminProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة التحكم', style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'pending', label: Text('معلق')),
                  ButtonSegment(value: 'employee', label: Text('موظفين')),
                  ButtonSegment(value: 'admin', label: Text('إداريين')),
                  ButtonSegment(value: 'rejected', label: Text('مرفوضين')),
                ],
                selected: {_selectedRole},
                onSelectionChanged: (Set<String> newSelection) {
                  setState(() {
                    _selectedRole = newSelection.first;
                  });
                },
              ),
            ),
            Expanded(
              child: adminAsync.when(
                data: (users) {
                  final filteredUsers = users.where((u) => u.role == _selectedRole).toList();

                  if (filteredUsers.isEmpty) {
                    return const Center(child: Text('لا يوجد مستخدمين في هذا القسم.'));
                  }

                  return ListView.builder(
                    itemCount: filteredUsers.length,
                    itemBuilder: (context, index) {
                      final user = filteredUsers[index];
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                            child: const Icon(Icons.person),
                          ),
                          title: Text(user.displayName ?? user.email),
                          subtitle: Text(user.email),
                          trailing: _buildActionButtons(user, ref),
                        ),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('خطأ: $e', style: const TextStyle(color: Colors.red))),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(AppUser user, WidgetRef ref) {
    if (user.role == 'pending') {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.check_circle, color: Colors.green),
            onPressed: () {
              final admin = ref.read(authProvider).value;
              if (admin?.companyId != null) {
                ref.read(adminProvider.notifier).approveUser(user.id, admin!.companyId!);
              } else {
                // If super admin has no company, we might need to catch this or assign default
                ref.read(adminProvider.notifier).updateUserRole(user.id, 'employee');
              }
            },
            tooltip: 'قبول وتعيين كموظف',
          ),
          IconButton(
            icon: const Icon(Icons.cancel, color: Colors.red),
            onPressed: () => ref.read(adminProvider.notifier).updateUserRole(user.id, 'rejected'),
            tooltip: 'رفض',
          ),
        ],
      );
    } else if (user.role == 'employee') {
      return PopupMenuButton<String>(
        onSelected: (value) => ref.read(adminProvider.notifier).updateUserRole(user.id, value),
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'admin', child: Text('ترقية إلى مدير')),
          const PopupMenuItem(value: 'rejected', child: Text('تعطيل/رفض')),
        ],
      );
    } else if (user.role == 'admin') {
      return PopupMenuButton<String>(
        onSelected: (value) => ref.read(adminProvider.notifier).updateUserRole(user.id, value),
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'employee', child: Text('تخفيض إلى موظف')),
        ],
      );
    } else if (user.role == 'rejected') {
      return IconButton(
        icon: const Icon(Icons.restore, color: Colors.orange),
        onPressed: () => ref.read(adminProvider.notifier).updateUserRole(user.id, 'pending'),
        tooltip: 'إعادة إلى قائمة الانتظار',
      );
    }
    return const SizedBox.shrink();
  }
}
