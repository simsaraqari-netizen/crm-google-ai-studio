class Comment {
  final String id;
  final String propertyId;
  final String userId;
  final String text;
  final String? imageUrl;
  final DateTime createdAt;

  Comment({
    required this.id,
    required this.propertyId,
    required this.userId,
    required this.text,
    this.imageUrl,
    required this.createdAt,
  });

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['id'].toString(),
      propertyId: json['property_id'].toString(),
      userId: json['user_id'].toString(),
      text: json['text'] as String,
      imageUrl: json['image_url'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
