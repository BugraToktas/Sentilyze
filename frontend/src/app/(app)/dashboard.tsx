import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/use-auth';
import { Brand } from '@/constants/theme';

// Dashboard şimdilik iskelet — bir sonraki adımda analiz arayüzü gelecek
export default function DashboardScreen() {
    const { user, signOut } = useAuth();

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={['#0A0A0F', '#0D0A18']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Merhaba 👋</Text>
                    <Text style={styles.username}>
                        {user?.user_metadata?.display_name ?? user?.email}
                    </Text>
                </View>
                <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>Çıkış</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.placeholder}>
                <LinearGradient
                    colors={Brand.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                >
                    <Text style={styles.icon}>✦</Text>
                </LinearGradient>
                <Text style={styles.placeholderTitle}>Dashboard Hazırlanıyor</Text>
                <Text style={styles.placeholderSub}>
                    Analiz arayüzü bir sonraki adımda buraya gelecek.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0A0A0F' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 24,
    },
    greeting:  { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
    username:  { fontSize: 18, fontWeight: '700', color: '#ffffff', marginTop: 2 },
    signOutBtn: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 10, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14, paddingVertical: 8,
    },
    signOutText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

    placeholder: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
    },
    iconGradient: {
        width: 72, height: 72, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: Brand.primary, shadowOpacity: 0.5,
        shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    },
    icon:             { fontSize: 32, color: '#fff' },
    placeholderTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    placeholderSub:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 40 },
});
