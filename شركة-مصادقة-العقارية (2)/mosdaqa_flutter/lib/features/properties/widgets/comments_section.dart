import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/comments_provider.dart';

class CommentsSection extends ConsumerStatefulWidget {
  final String propertyId;
  const CommentsSection({super.key, required this.propertyId});

  @override
  ConsumerState<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<CommentsSection> {
  final _commentController = TextEditingController();
  bool _isSubmitting = false;

  void _submitComment() async {
    if (_commentController.text.trim().isEmpty) return;

    setState(() => _isSubmitting = true);
    try {
      await ref.read(commentsProvider(widget.propertyId).notifier).addComment(_commentController.text);
      _commentController.clear();
      FocusScope.of(context).unfocus();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('خطأ: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(commentsProvider(widget.propertyId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Input row
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _commentController,
                decoration: const InputDecoration(
                  hintText: 'اكتب تعليقاً...',
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            _isSubmitting
                ? const CircularProgressIndicator()
                : IconButton(
                    icon: const Icon(Icons.send),
                    color: Theme.of(context).colorScheme.primary,
                    onPressed: _submitComment,
                  ),
          ],
        ),
        const SizedBox(height: 16),
        // List
        commentsAsync.when(
          data: (comments) {
            if (comments.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('لا توجد تعليقات بعد. كن أول من يعلق!'),
              );
            }
            return ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: comments.length,
              separatorBuilder: (_, __) => const Divider(),
              itemBuilder: (context, index) {
                final comment = comments[index];
                return ListTile(
                  leading: CircleAvatar(
                    child: Text(comment.userId.substring(0, 2)), // Temporary fallback avatar
                  ),
                  title: const Text('مستخدم'), // Placeholder for user display name
                  subtitle: Text(comment.text),
                  trailing: Text(
                    '${comment.createdAt.day}/${comment.createdAt.month}',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('خطأ في تحميل التعليقات: $e', style: const TextStyle(color: Colors.red)),
        ),
      ],
    );
  }
}
