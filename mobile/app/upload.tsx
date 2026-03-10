import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  RadioButton,
  Chip,
  ProgressBar,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../lib/api";
import * as FileSystem from "expo-file-system";

interface Store {
  id: string;
  name: string;
  chainName: string | null;
  address: string | null;
}

type SourceType = "photo" | "flyer" | "instagram" | "receipt";

interface UploadedImage {
  id: string;
  imageUrl: string;
  sourceType: string;
  status: string;
}

interface UploadResponse {
  uploaded: UploadedImage[];
  errors: { name: string; error: string }[];
  summary: { total: number; success: number; failed: number };
}

const SOURCE_TYPES: { value: SourceType; label: string; icon: string }[] = [
  { value: "photo", label: "店頭写真", icon: "store" },
  { value: "flyer", label: "チラシ", icon: "newspaper" },
  { value: "receipt", label: "レシート", icon: "receipt" },
  { value: "instagram", label: "Instagram", icon: "instagram" },
];

export default function UploadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ images: string }>();

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [sourceType, setSourceType] = useState<SourceType>("photo");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (params.images) {
      try {
        const parsed = JSON.parse(decodeURIComponent(params.images));
        setImageUris(Array.isArray(parsed) ? parsed : []);
      } catch {
        setImageUris([]);
      }
    }
  }, [params.images]);

  useEffect(() => {
    async function loadStores() {
      try {
        const data = await api.get<Store[]>("/api/stores");
        setStores(data);
        if (data.length > 0) {
          setSelectedStoreId(data[0].id);
        }
      } catch {
        Alert.alert("エラー", "店舗の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }
    loadStores();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedStoreId) {
      Alert.alert("エラー", "店舗を選択してください");
      return;
    }
    if (imageUris.length === 0) {
      Alert.alert("エラー", "画像がありません");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("sourceType", sourceType);
      formData.append("storeId", selectedStoreId);

      for (const uri of imageUris) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) continue;

        const fileName = uri.split("/").pop() || "photo.jpg";
        formData.append("files", {
          uri,
          type: "image/jpeg",
          name: fileName,
        } as unknown as Blob);
      }

      setUploadProgress(0.3);

      const uploadResult = await api.upload<UploadResponse>(
        "/api/images/upload",
        formData,
      );

      setUploadProgress(0.5);

      if (uploadResult.uploaded.length === 0) {
        Alert.alert("エラー", "アップロードに失敗しました");
        setUploading(false);
        return;
      }

      // Run OCR on each uploaded image
      const ocrResults = [];
      for (let i = 0; i < uploadResult.uploaded.length; i++) {
        const img = uploadResult.uploaded[i];
        setUploadProgress(0.5 + ((i + 1) / uploadResult.uploaded.length) * 0.4);

        try {
          const ocrResult = await api.post<{
            id: string;
            status: string;
            ocrResult: { items: OcrItem[] };
            itemCount: number;
          }>(`/api/images/${img.id}/analyze`);

          ocrResults.push({
            imageId: img.id,
            items: ocrResult.ocrResult?.items || [],
          });
        } catch (err) {
          console.warn(`OCR failed for image ${img.id}:`, err);
          ocrResults.push({ imageId: img.id, items: [] });
        }
      }

      setUploadProgress(1);

      // Navigate to OCR results screen
      router.replace(
        `/ocr-results?data=${encodeURIComponent(
          JSON.stringify({
            storeId: selectedStoreId,
            sourceType,
            imageIds: uploadResult.uploaded.map((u) => u.id),
            ocrResults,
          }),
        )}`,
      );
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("エラー", "アップロード中にエラーが発生しました");
      setUploading(false);
    }
  }, [selectedStoreId, sourceType, imageUris, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (uploading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="titleMedium" style={styles.uploadingText}>
          {uploadProgress < 0.5
            ? "アップロード中..."
            : uploadProgress < 0.9
              ? "AI解析中..."
              : "完了処理中..."}
        </Text>
        <ProgressBar
          progress={uploadProgress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
        <Text variant="bodySmall" style={styles.uploadingHint}>
          {Math.round(uploadProgress * 100)}%
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Image preview */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        選択した画像（{imageUris.length}枚）
      </Text>
      <FlatList
        data={imageUris}
        horizontal
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageRow}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={styles.previewImage} />
        )}
      />

      {/* Source type */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        ソースタイプ
      </Text>
      <View style={styles.chipRow}>
        {SOURCE_TYPES.map((st) => (
          <Chip
            key={st.value}
            icon={st.icon}
            selected={sourceType === st.value}
            onPress={() => setSourceType(st.value)}
            style={styles.chip}
          >
            {st.label}
          </Chip>
        ))}
      </View>

      {/* Store selection */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        店舗を選択
      </Text>
      {stores.length === 0 ? (
        <Text variant="bodyMedium" style={styles.noStores}>
          店舗が登録されていません。設定画面から店舗を追加してください。
        </Text>
      ) : (
        <RadioButton.Group
          value={selectedStoreId}
          onValueChange={setSelectedStoreId}
        >
          {stores.map((store) => (
            <RadioButton.Item
              key={store.id}
              label={
                store.chainName
                  ? `${store.chainName} ${store.name}`
                  : store.name
              }
              value={store.id}
              style={styles.radioItem}
              labelStyle={styles.radioLabel}
            />
          ))}
        </RadioButton.Group>
      )}

      {/* Upload button */}
      <Button
        mode="contained"
        icon="cloud-upload"
        style={styles.uploadButton}
        contentStyle={styles.uploadButtonContent}
        onPress={handleUpload}
        disabled={!selectedStoreId || imageUris.length === 0}
      >
        アップロード＆解析
      </Button>
    </ScrollView>
  );
}

// Type used in OCR results
interface OcrItem {
  name: string;
  price: number;
  unit?: string;
  volume?: string;
  category_hint?: string;
  confidence?: number;
  is_tax_included?: boolean;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f8fafc",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  imageRow: {
    gap: 8,
    paddingBottom: 8,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginBottom: 4,
  },
  noStores: {
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 16,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioLabel: {
    fontSize: 14,
  },
  uploadButton: {
    marginTop: 24,
    borderRadius: 12,
  },
  uploadButtonContent: {
    paddingVertical: 8,
  },
  uploadingText: {
    marginTop: 16,
    fontWeight: "bold",
  },
  progressBar: {
    width: 240,
    height: 8,
    borderRadius: 4,
    marginTop: 12,
  },
  uploadingHint: {
    marginTop: 8,
    color: "#64748b",
  },
});
