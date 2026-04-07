import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_model.dart';
import 'auth_provider.dart';

final adminProvider = StateNotifierProvider<AdminNotifier, AsyncValue<List<AppUser>>>((ref) {
  final authState = ref.watch(authProvider);
  return AdminNotifier(authState.value);
});

class AdminNotifier extends StateNotifier<AsyncValue<List<AppUser>>> {
  final AppUser? currentUser;
  AdminNotifier(this.currentUser) : super(const AsyncValue.loading()) {
    if (currentUser != null && (currentUser!.role == 'admin' || currentUser!.role == 'super_admin')) {
      _startUsersStream();
    } else {
      state = const AsyncValue.data([]);
    }
  }

  final _supabase = Supabase.instance.client;

  void _startUsersStream() {
    var query = _supabase.from('user_profiles').stream(primaryKey: ['id']);

    // Admin only sees users from their own company
    if (currentUser!.role == 'admin') {
      query = query.eq('company_id', currentUser!.companyId ?? '');
    }

    query.listen((data) {
      final users = data.map((json) => AppUser.fromJson(json)).toList();
      state = AsyncValue.data(users);
    }, onError: (e, st) {
      state = AsyncValue.error(e, st);
    });
  }

  Future<void> updateUserRole(String userId, String newRole) async {
    try {
      await _supabase
          .from('user_profiles')
          .update({'role': newRole})
          .eq('id', userId);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> approveUser(String userId, String companyId) async {
    try {
      await _supabase
          .from('user_profiles')
          .update({
            'role': 'employee',
            'company_id': companyId,
          })
          .eq('id', userId);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
