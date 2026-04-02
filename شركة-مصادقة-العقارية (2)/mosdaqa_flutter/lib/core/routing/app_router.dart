import 'package:go_router/go_router.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/properties/screens/home_screen.dart';
import '../../features/properties/screens/add_property_screen.dart';
import '../../features/properties/screens/property_details_screen.dart';
import '../../features/properties/models/property_model.dart';

import '../../features/auth/screens/admin_panel_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminPanelScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/add-property',
      builder: (context, state) => const AddPropertyScreen(),
    ),
    GoRoute(
      path: '/property-details',
      builder: (context, state) {
        final property = state.extra as Property;
        return PropertyDetailsScreen(property: property);
      },
    ),
  ],
);
