import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/ui/theme';

type Name = React.ComponentProps<typeof Ionicons>['name'];

const icon =
  (active: Name, inactive: Name) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => <Ionicons name={focused ? active : inactive} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 4 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time', 'time-outline') }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: icon('heart', 'heart-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
