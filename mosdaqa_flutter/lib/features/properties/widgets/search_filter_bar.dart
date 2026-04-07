import 'package:flutter/material.dart';

class SearchFilterBar extends StatelessWidget {
  const SearchFilterBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Colors.white,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'ابحث عن عقار، منطقة...',
                    prefixIcon: const Icon(Icons.search),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    filled: true,
                    fillColor: Colors.grey.shade100,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  icon: const Icon(Icons.tune, color: Colors.white),
                  onPressed: () {
                    // TODO: Open advanced filters bottom sheet
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Horizontal scroll options
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip(context, 'الكل', true),
                _buildFilterChip(context, 'للبيع', false),
                _buildFilterChip(context, 'للإيجار', false),
                _buildFilterChip(context, 'سكني', false),
                _buildFilterChip(context, 'تجاري', false),
                _buildFilterChip(context, 'أراضي', false),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildFilterChip(BuildContext context, String label, bool isSelected) {
    final primary = Theme.of(context).colorScheme.primary;
    
    return Container(
      margin: const EdgeInsets.only(left: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (bool selected) {
          // TODO: handle sort/filter selection
        },
        backgroundColor: Colors.white,
        selectedColor: primary.withOpacity(0.1),
        checkmarkColor: primary,
        labelStyle: TextStyle(
          color: isSelected ? primary : Colors.grey.shade700,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isSelected ? primary : Colors.grey.shade300,
          ),
        ),
      ),
    );
  }
}
