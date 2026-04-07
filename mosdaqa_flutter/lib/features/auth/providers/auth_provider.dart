import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_model.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<AppUser?>>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AsyncValue<AppUser?>> {
  AuthNotifier() : super(const AsyncValue.loading()) {
    _init();
  }

  final _supabase = Supabase.instance.client;
  StreamSubscription<List<Map<String, dynamic>>>? _profileSubscription;

  Future<void> _init() async {
    final session = _supabase.auth.currentSession;
    if (session != null) {
      _startProfileListener(session.user.id);
    } else {
      state = const AsyncValue.data(null);
    }

    _supabase.auth.onAuthStateChange.listen((data) async {
      final event = data.event;
      if (event == AuthChangeEvent.signedIn || event == AuthChangeEvent.tokenRefreshed) {
        if (data.session != null) {
          _startProfileListener(data.session!.user.id);
        }
      } else if (event == AuthChangeEvent.signedOut) {
        _profileSubscription?.cancel();
        state = const AsyncValue.data(null);
      }
    });
  }

  void _startProfileListener(String userId) {
    _profileSubscription?.cancel();
    
    // Listen to changes in the user_profiles table for this user
    _profileSubscription = _supabase
        .from('user_profiles')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .listen((data) {
          if (data.isNotEmpty) {
            state = AsyncValue.data(AppUser.fromJson(data.first));
          } else {
            // Fallback to fetch once if stream is empty but user exists in auth
            _fetchProfile(userId);
          }
        }, onError: (e, st) {
          state = AsyncValue.error(e, st);
        });
  }

  Future<void> _fetchProfile(String userId) async {
    try {
      final response = await _supabase.from('user_profiles').select().eq('id', userId).maybeSingle();
      if (response != null) {
        state = AsyncValue.data(AppUser.fromJson(response));
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      await _supabase.auth.signInWithPassword(email: email, password: password);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> logout() async {
    _profileSubscription?.cancel();
    await _supabase.auth.signOut();
  }

  @override
  void dispose() {
    _profileSubscription?.cancel();
    super.dispose();
  }
}
