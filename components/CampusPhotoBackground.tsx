import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const campusPhoto = require('../assets/images/cctc-campus.jpg');

export default function CampusPhotoBackground({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={campusPhoto}
        resizeMode="cover"
        style={styles.fill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFF0F8',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }],
  },
});
