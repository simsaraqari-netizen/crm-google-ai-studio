import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/property_model.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/favorites_provider.dart';
import '../widgets/comments_section.dart';

class PropertyDetailsScreen extends ConsumerWidget {
  final Property property;

  const PropertyDetailsScreen({super.key, required this.property});

  void _launchURL(String? urlString) async {
    if (urlString == null || urlString.isEmpty) return;
    final url = Uri.parse(urlString);
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);
    final isFavorite = favorites.contains(property.id);

    return Scaffold(
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 250.0,
              pinned: true,
              flexibleSpace: FlexibleSpaceBar(
                title: Text(
                  property.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    shadows: [Shadow(color: Colors.black45, blurRadius: 10)],
                  ),
                ),
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (property.images.isNotEmpty)
                      PageView.builder(
                        itemCount: property.images.length,
                        itemBuilder: (context, index) {
                          return CachedNetworkImage(
                            imageUrl: property.images[index],
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(color: Colors.grey.shade300),
                            errorWidget: (context, url, error) => const Icon(Icons.error),
                          );
                        },
                      )
                    else
                      Container(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                        child: const Icon(Icons.apartment, size: 80, color: Colors.white),
                      ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Colors.black87, Colors.transparent],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
                onPressed: () => context.pop(),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        if (property.price != null)
                          Text(
                            '${property.price} د.ك',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                    const SizedBox(height: 24),
                    const Text('الموقع', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.location_on, color: Colors.grey),
                      ),
                      title: Text('${property.governorate}، ${property.area}'),
                      trailing: property.location != null && property.location!.isNotEmpty
                          ? IconButton(
                              icon: Icon(Icons.map, color: Theme.of(context).colorScheme.primary),
                              onPressed: () => _launchURL(property.location),
                            )
                          : null,
                    ),
                    const Divider(height: 32),
                    const Text('التفاصيل', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(
                      property.description.isNotEmpty ? property.description : 'لا توجد تفاصيل إضافية لهذا العقار.',
                      style: const TextStyle(fontSize: 16, height: 1.5),
                    ),
                    const Divider(height: 32),
                    const Text('التعليقات', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    CommentsSection(propertyId: property.id),
                    const SizedBox(height: 100), // Padding for floating action buttons
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  // TODO: Contact logic
                },
                icon: const Icon(Icons.phone),
                label: const Text('تواصل'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
            const SizedBox(width: 16),
            FloatingActionButton(
              onPressed: () {
                ref.read(favoritesProvider.notifier).toggleFavorite(property.id);
              },
              backgroundColor: isFavorite ? Colors.red.shade50 : Colors.white,
              foregroundColor: isFavorite ? Colors.red : Colors.grey,
              child: Icon(isFavorite ? Icons.favorite : Icons.favorite_border),
            ),
          ],
        ),
      ),
    );
  }
}
