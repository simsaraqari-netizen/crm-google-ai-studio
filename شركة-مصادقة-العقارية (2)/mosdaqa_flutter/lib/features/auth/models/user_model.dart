class AppUser {
  final String id;
  final String email;
  final String? displayName;
  final String role; // super_admin, admin, employee, pending, rejected
  final String? companyId;
  final String? phone;

  AppUser({
    required this.id,
    required this.email,
    this.displayName,
    required this.role,
    this.companyId,
    this.phone,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      email: json['email'] as String,
      displayName: json['display_name'] as String?,
      role: json['role'] as String? ?? 'pending',
      companyId: json['company_id'] as String?,
      phone: json['phone'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'display_name': displayName,
      'role': role,
      'company_id': companyId,
      'phone': phone,
    };
  }
}
