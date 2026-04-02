import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/comment_model.dart';

final commentsProvider = StateNotifierProvider.family<CommentsNotifier, AsyncValue<List<Comment>>, String>((ref, propertyId) {
  return CommentsNotifier(propertyId);
});

class CommentsNotifier extends StateNotifier<AsyncValue<List<Comment>>> {
  final String propertyId;
  CommentsNotifier(this.propertyId) : super(const AsyncValue.loading()) {
    _fetchComments();
  }

  final supabase = Supabase.instance.client;

  Future<void> _fetchComments() async {
    try {
      final response = await supabase
          .from('comments')
          .select()
          .eq('property_id', propertyId)
          .order('created_at', ascending: false);
      
      final comments = (response as List).map((e) => Comment.fromJson(e)).toList();
      state = AsyncValue.data(comments);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addComment(String text, {String? imageUrl}) async {
    final user = supabase.auth.currentUser;
    if (user == null) throw Exception('يجب تسجيل الدخول لإضافة تعليق');

    try {
      final newComment = await supabase.from('comments').insert({
        'property_id': propertyId,
        'user_id': user.id,
        'text': text,
        'image_url': imageUrl,
      }).select().single();

      final comment = Comment.fromJson(newComment);
      if (state is AsyncData) {
        state = AsyncValue.data([comment, ...state.value!]);
      }
    } catch (e) {
      rethrow;
    }
  }
}
