import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, Set<String>>((ref) {
  return FavoritesNotifier();
});

class FavoritesNotifier extends StateNotifier<Set<String>> {
  FavoritesNotifier() : super({}) {
    _fetchFavorites();
  }

  final supabase = Supabase.instance.client;

  Future<void> _fetchFavorites() async {
    final user = supabase.auth.currentUser;
    if (user == null) return;

    try {
      final response = await supabase
          .from('favorites')
          .select('property_id')
          .eq('user_id', user.id);
      
      final favs = (response as List).map((e) => e['property_id'].toString()).toSet();
      state = favs;
    } catch (e) {
      // Ignored for now
    }
  }

  Future<void> toggleFavorite(String propertyId) async {
    final user = supabase.auth.currentUser;
    if (user == null) return; // Must be logged in

    final isFav = state.contains(propertyId);
    try {
      if (isFav) {
        state = {...state}..remove(propertyId); // Optimistic UI
        await supabase
            .from('favorites')
            .delete()
            .match({'property_id': propertyId, 'user_id': user.id});
      } else {
        state = {...state, propertyId}; // Optimistic UI
        await supabase
            .from('favorites')
            .insert({'property_id': propertyId, 'user_id': user.id});
      }
    } catch (e) {
      // Revert on error
      if (isFav) {
        state = {...state, propertyId};
      } else {
        state = {...state}..remove(propertyId);
      }
    }
  }
}
