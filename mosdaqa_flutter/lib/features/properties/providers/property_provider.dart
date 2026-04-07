import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/property_model.dart';

final propertiesProvider = FutureProvider<List<Property>>((ref) async {
  final supabase = Supabase.instance.client;
  
  // NOTE: In the future, implement pagination here using .range()
  final response = await supabase
      .from('properties')
      .select()
      .order('created_at', ascending: false)
      .limit(20);
      
  return (response as List<dynamic>)
      .map((json) => Property.fromJson(json as Map<String, dynamic>))
      .toList();
});
