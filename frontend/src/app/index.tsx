import { View, ActivityIndicator } from 'react-native';
import { Brand } from '@/constants/theme';

// Bu dosya yalnızca root "/" rotasını karşılamak için var.
// Gerçek yönlendirme _layout.tsx içindeki AuthGuard tarafından yapılır:
//   → Oturum yok  : /(auth)/login
//   → Oturum var  : /(app)/dashboard
export default function Index() {
    return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={Brand.primary} />
        </View>
    );
}
