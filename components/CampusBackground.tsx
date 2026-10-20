import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import CampusPhotoBackground from './CampusPhotoBackground';

type Props = { children: ReactNode };

export default function CampusBackground({ children }: Props) {
  return (
    <CampusPhotoBackground>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255, 248, 252, 0.38)', 'rgba(255, 240, 248, 0.52)']}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </CampusPhotoBackground>
  );
}
