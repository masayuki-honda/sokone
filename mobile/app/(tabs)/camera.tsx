import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Alert,
} from "react-native";
import { Text, Button, useTheme, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from "expo-image-picker";
import { manipulateAsync } from "expo-image-manipulator";

const MAX_IMAGES = 10;
const MAX_LONG_SIDE = 1600;

interface SelectedImage {
  uri: string;
  width: number;
  height: number;
}

async function resizeImage(uri: string, width: number, height: number): Promise<SelectedImage> {
  const longSide = Math.max(width, height);
  if (longSide <= MAX_LONG_SIDE) {
    return { uri, width, height };
  }

  const scale = MAX_LONG_SIDE / longSide;
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }],
    { compress: 0.8, format: "jpeg" },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

export default function CameraScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [images, setImages] = useState<SelectedImage[]>([]);

  const handleCamera = useCallback(async () => {
    const { granted } = await requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("権限エラー", "カメラの使用を許可してください");
      return;
    }

    const result = await launchCameraAsync({
      quality: 0.9,
      exif: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const resized = await resizeImage(asset.uri, asset.width, asset.height);
    setImages((prev) => [...prev, resized].slice(0, MAX_IMAGES));
  }, []);

  const handleLibrary = useCallback(async () => {
    const { granted } = await requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("権限エラー", "写真ライブラリへのアクセスを許可してください");
      return;
    }

    const result = await launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
      exif: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const remaining = MAX_IMAGES - images.length;
    const selected = result.assets.slice(0, remaining);
    const resized = await Promise.all(
      selected.map((a) => resizeImage(a.uri, a.width, a.height)),
    );
    setImages((prev) => [...prev, ...resized].slice(0, MAX_IMAGES));
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleNext = useCallback(() => {
    if (images.length === 0) return;
    // Pass image URIs via router params (JSON serialized)
    router.push(`/upload?images=${encodeURIComponent(JSON.stringify(images.map((i) => i.uri)))}`);
  }, [images, router]);

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <MaterialCommunityIcons
          name="camera-plus"
          size={64}
          color={theme.colors.primary}
          style={styles.icon}
        />
        <Text variant="headlineSmall" style={styles.title}>
          価格を撮影
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          チラシや店頭の値札を撮影して{"\n"}
          商品の価格を自動で読み取ります
        </Text>

        <Button
          mode="contained"
          icon="camera"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={handleCamera}
        >
          カメラで撮影
        </Button>

        <Button
          mode="outlined"
          icon="image"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={handleLibrary}
        >
          ライブラリから選択
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.containerWithImages}>
      <Text variant="titleMedium" style={styles.imageCount}>
        {images.length} / {MAX_IMAGES} 枚選択中
      </Text>

      <FlatList
        data={images}
        numColumns={2}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.imageGrid}
        renderItem={({ item, index }) => (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            <IconButton
              icon="close-circle"
              size={24}
              iconColor="#fff"
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            />
          </View>
        )}
      />

      <View style={styles.bottomActions}>
        {images.length < MAX_IMAGES && (
          <View style={styles.addButtons}>
            <Button
              mode="outlined"
              icon="camera"
              compact
              onPress={handleCamera}
              style={styles.addButton}
            >
              追加撮影
            </Button>
            <Button
              mode="outlined"
              icon="image"
              compact
              onPress={handleLibrary}
              style={styles.addButton}
            >
              追加選択
            </Button>
          </View>
        )}

        <Button
          mode="contained"
          icon="arrow-right"
          contentStyle={styles.nextButtonContent}
          style={styles.nextButton}
          onPress={handleNext}
        >
          次へ（店舗選択）
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  containerWithImages: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    width: "100%",
    marginBottom: 12,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  imageCount: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "bold",
  },
  imageGrid: {
    paddingBottom: 16,
  },
  imageWrapper: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    maxWidth: "50%",
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "rgba(0,0,0,0.5)",
    margin: 0,
  },
  bottomActions: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  addButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  addButton: {
    flex: 1,
    borderRadius: 8,
  },
  nextButton: {
    borderRadius: 12,
  },
  nextButtonContent: {
    paddingVertical: 8,
    flexDirection: "row-reverse",
  },
});
