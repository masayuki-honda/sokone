import { View, StyleSheet } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function CameraScreen() {
  const theme = useTheme();

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
        onPress={() => {
          // Sprint 15 で実装
        }}
      >
        カメラで撮影
      </Button>

      <Button
        mode="outlined"
        icon="image"
        style={styles.button}
        contentStyle={styles.buttonContent}
        onPress={() => {
          // Sprint 15 で実装
        }}
      >
        ライブラリから選択
      </Button>
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
});
