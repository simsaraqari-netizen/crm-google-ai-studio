class Property {
  final String id;
  final String name;
  final String description;
  final String governorate;
  final String area;
  final String type;
  final String purpose;
  final double? price;
  final String? location;
  final String status;
  final bool isSold;
  final List<String> images;

  Property({
    required this.id,
    required this.name,
    required this.description,
    required this.governorate,
    required this.area,
    required this.type,
    required this.purpose,
    this.price,
    this.location,
    required this.status,
    required this.isSold,
    this.images = const [],
  });

  factory Property.fromJson(Map<String, dynamic> json) {
    return Property(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      governorate: json['governorate'] as String,
      area: json['area'] as String,
      type: json['type'] as String,
      purpose: json['purpose'] as String,
      price: json['price'] != null ? double.parse(json['price'].toString()) : null,
      location: json['location'] as String?,
      status: json['status'] as String? ?? 'pending',
      isSold: json['is_sold'] as bool? ?? false,
      images: json['images'] != null ? List<String>.from(json['images']) : [],
    );
  }
}
