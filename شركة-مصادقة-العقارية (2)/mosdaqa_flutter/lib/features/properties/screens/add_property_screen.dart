import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';

class AddPropertyScreen extends ConsumerStatefulWidget {
  const AddPropertyScreen({super.key});

  @override
  ConsumerState<AddPropertyScreen> createState() => _AddPropertyScreenState();
}

class _AddPropertyScreenState extends ConsumerState<AddPropertyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  final _governorateController = TextEditingController();
  final _areaController = TextEditingController();
  final _locationController = TextEditingController();

  String _selectedPurpose = 'للبيع';
  String _selectedType = 'سكني';
  bool _isLoading = false;
  final List<XFile> _selectedImages = [];

  final List<String> purposes = ['للبيع', 'للإيجار', 'للبدل'];
  final List<String> types = ['سكني', 'تجاري', 'استثماري', 'صناعي', 'زراعي', 'شاليه'];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _governorateController.dispose();
    _areaController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final ImagePicker picker = ImagePicker();
    final List<XFile> images = await picker.pickMultiImage();
    if (images.isNotEmpty) {
      setState(() {
        _selectedImages.addAll(images);
      });
    }
  }

  void _submitForm() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);
      
      try {
        final supabase = Supabase.instance.client;
        final List<String> uploadedImagesUrls = [];
        
        // 1. Upload Images
        if (_selectedImages.isNotEmpty) {
          final propertiesBucket = supabase.storage.from('properties');
          
          for (int i = 0; i < _selectedImages.length; i++) {
            final file = File(_selectedImages[i].path);
            final fileExt = file.path.split('.').last;
            final fileName = '${DateTime.now().millisecondsSinceEpoch}_$i.$fileExt';
            final filePath = 'uploads/$fileName';
            
            await propertiesBucket.upload(filePath, file);
            final publicUrl = propertiesBucket.getPublicUrl(filePath);
            uploadedImagesUrls.add(publicUrl);
          }
        }
        
        // 2. Insert into database
        await supabase.from('properties').insert({
          'name': _titleController.text,
          'description': _descriptionController.text,
          'price': double.tryParse(_priceController.text) ?? 0.0,
          'governorate': _governorateController.text,
          'area': _areaController.text,
          'type': _selectedType,
          'purpose': _selectedPurpose,
          'location': _locationController.text,
          'status': 'pending',
          'is_sold': false,
          'images': uploadedImagesUrls,
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('تمت إضافة العقار بنجاح!')),
          );
          context.pop();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('حدث خطأ: $e')),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('إضافة عقار جديد'),
        centerTitle: true,
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'عنوان العقار',
                  prefixIcon: Icon(Icons.title),
                ),
                validator: (value) => value!.isEmpty ? 'مطلوب' : null,
              ),
              const SizedBox(height: 16),
              
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedPurpose,
                      decoration: const InputDecoration(labelText: 'الغرض'),
                      items: purposes.map((String purpose) {
                        return DropdownMenuItem(value: purpose, child: Text(purpose));
                      }).toList(),
                      onChanged: (val) => setState(() => _selectedPurpose = val!),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedType,
                      decoration: const InputDecoration(labelText: 'نوع العقار'),
                      items: types.map((String type) {
                        return DropdownMenuItem(value: type, child: Text(type));
                      }).toList(),
                      onChanged: (val) => setState(() => _selectedType = val!),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _priceController,
                decoration: const InputDecoration(
                  labelText: 'السعر (د.ك)',
                  prefixIcon: Icon(Icons.attach_money),
                ),
                keyboardType: TextInputType.number,
                validator: (value) => value!.isEmpty ? 'مطلوب' : null,
              ),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _governorateController,
                      decoration: const InputDecoration(
                        labelText: 'المحافظة',
                        prefixIcon: Icon(Icons.map),
                      ),
                      validator: (value) => value!.isEmpty ? 'مطلوب' : null,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextFormField(
                      controller: _areaController,
                      decoration: const InputDecoration(
                        labelText: 'المنطقة',
                        prefixIcon: Icon(Icons.location_city),
                      ),
                      validator: (value) => value!.isEmpty ? 'مطلوب' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  labelText: 'التفاصيل',
                  alignLabelWithHint: true,
                ),
                maxLines: 4,
                validator: (value) => value!.isEmpty ? 'مطلوب' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _locationController,
                decoration: const InputDecoration(
                  labelText: 'رابط خرائط جوجل (Google Maps URL)',
                  prefixIcon: Icon(Icons.link),
                ),
              ),
              const SizedBox(height: 24),
              
              // Images section
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  children: [
                    if (_selectedImages.isEmpty) ...[
                      const Icon(Icons.photo_library, size: 48, color: Colors.grey),
                      const SizedBox(height: 8),
                      const Text('صور العقار (اختياري)'),
                    ] else ...[
                      SizedBox(
                        height: 100,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _selectedImages.length,
                          itemBuilder: (context, index) {
                            return Stack(
                              children: [
                                Container(
                                  width: 100,
                                  margin: const EdgeInsets.only(left: 8),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    image: DecorationImage(
                                      image: FileImage(File(_selectedImages[index].path)),
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  left: 12,
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _selectedImages.removeAt(index);
                                      });
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(2),
                                      decoration: const BoxDecoration(
                                        color: Colors.red,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close, size: 16, color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _pickImages,
                      icon: const Icon(Icons.add_a_photo),
                      label: Text(_selectedImages.isEmpty ? 'إضافة صور' : 'إضافة المزيد'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              ElevatedButton(
                onPressed: _isLoading ? null : _submitForm,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading 
                    ? const CircularProgressIndicator() 
                    : const Text('حفظ العقار', style: TextStyle(fontSize: 18)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
