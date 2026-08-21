/**
 * SentilyzeIcon — SVG tabanlı marka ikonu
 *
 * 4-noktalı sparkle / yıldız, gradient fill, temiz geometri.
 * size prop ile her yerden kolayca kullanılır.
 */

import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

interface SentilyzeIconProps {
    size?: number;
    color1?: string;
    color2?: string;
}

export default function SentilyzeIcon({
    size    = 32,
    color1  = '#7C3AED',
    color2  = '#2563EB',
}: SentilyzeIconProps) {
    const id = 'sg';
    return (
        <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
            <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <Stop offset="0%" stopColor={color1} />
                    <Stop offset="100%" stopColor={color2} />
                </LinearGradient>
            </Defs>
            {/* Büyük 4-noktalı yıldız (ana şekil) */}
            <Path
                d="M16 2 C16 2 17.2 9.5 20 12 C22.8 14.5 30 16 30 16 C30 16 22.8 17.5 20 20 C17.2 22.5 16 30 16 30 C16 30 14.8 22.5 12 20 C9.2 17.5 2 16 2 16 C2 16 9.2 14.5 12 12 C14.8 9.5 16 2 16 2 Z"
                fill={`url(#${id})`}
            />
            {/* İç küçük parlama noktası */}
            <Path
                d="M16 11 C16 11 16.6 13.8 18 15 C19.4 16.2 22 16 22 16 C22 16 19.4 15.8 18 17 C16.6 18.2 16 21 16 21 C16 21 15.4 18.2 14 17 C12.6 15.8 10 16 10 16 C10 16 12.6 16.2 14 15 C15.4 13.8 16 11 16 11 Z"
                fill="rgba(255,255,255,0.45)"
            />
        </Svg>
    );
}
