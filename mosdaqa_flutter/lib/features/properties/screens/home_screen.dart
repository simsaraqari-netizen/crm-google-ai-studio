import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/property_provider.dart';
import '../widgets/search_filter_bar.dart';
import '../../auth/providers/auth_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final propertiesAsync = ref.watch(propertiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('العقارات', style: TextStyle(fontFamily: 'serif')),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              ref.read(authProvider.notifier).logout();
              context.go('/login');
            },
          ),
        ],
      ),
      drawer: _buildDrawer(context, ref),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          children: [
            const SearchFilterBar(),
            Expanded(
              child: propertiesAsync.when(
                data: (properties) {
                  if (properties.isEmpty) {
                    return const Center(
                      child: Text('لا توجد عقارات مضافة بعد'),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: properties.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 16),
                    itemBuilder: (context, index) {
                      final property = properties[index];
                      return _PropertyCardProxy(property: property);
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stack) => Center(
                  child: Text('حدث خطأ في تحميل البيانات\n$error'),
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Navigate to add property screen
          context.push('/add-property');
        },
        icon: const Icon(Icons.add),
        label: const Text('إضافة عقار'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget? _buildDrawer(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(authProvider);

    return Drawer(
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
              ),
              child: const Center(
                child: Text(
                  'شركة مصادقة العقارية',
                  style: TextStyle(color: Colors.white, fontSize: 24, fontFamily: 'serif'),
                ),
              ),
            ),
            userAsync.when(
              data: (user) {
                if (user == null) return const SizedBox.shrink();
                
                final bool isAdmin = user.role == 'admin' || user.role == 'super_admin';
                return Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.person),
                      title: Text(user.displayName ?? user.email),
                      subtitle: Text(user.role),
                    ),
                    const Divider(),
                    if (isAdmin)
                      ListTile(
                        leading: const Icon(Icons.admin_panel_settings),
                        title: const Text('لوحة التحكم'),
                        onTap: () {
                          Navigator.pop(context); // close drawer
                          context.push('/admin');
                        },
                      ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

// Temporary card widget, we will move this to a separate file later
class _PropertyCardProxy extends StatelessWidget {
  final property;
  const _PropertyCardProxy({required this.property});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                property.name,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  property.type,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 16, color: Colors.grey),
              const SizedBox(width: 4),
              Text('${property.governorate}، ${property.area}', style: const TextStyle(color: Colors.grey)),
            ],
          ),
          if (property.price != null) ...[
            const SizedBox(height: 12),
            Text(
              '${property.price} د.ك',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ]
        ],
      ),
    );
  }
}
