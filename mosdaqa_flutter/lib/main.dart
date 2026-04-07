import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';

import 'core/theme/app_theme.dart';
import 'core/routing/app_router.dart';

const supabaseUrl = 'https://ixtwffjepcnfjehzpiyf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4dHdmZmplcGNuZmplaHpwaXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDY0NTUsImV4cCI6MjA5MDcyMjQ1NX0.SW9D-2AVUfb3DgfdifHYqr5D_0zqfnDBNlVShKfwEJ4';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseKey,
  );

  runApp(
    const ProviderScope(
      child: MosdaqaApp(),
    ),
  );
}

class MosdaqaApp extends StatelessWidget {
  const MosdaqaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Mosdaqa Real Estate',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: appRouter,
    );
  }
}
