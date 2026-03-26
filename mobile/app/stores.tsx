import { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import {
  Text,
  Card,
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  IconButton,
  useTheme,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Store {
  id: string;
  name: string;
  address: string | null;
  chain: string | null;
}

interface StoreFormData {
  name: string;
  address: string;
  chain: string;
}

const emptyForm: StoreFormData = { name: "", address: "", chain: "" };

export default function StoresScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreFormData>(emptyForm);

  const { data: stores, isLoading, refetch } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get<Store[]>("/api/stores"),
  });

  const createMutation = useMutation({
    mutationFn: (data: StoreFormData) => api.post("/api/stores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoreFormData }) =>
      api.put(`/api/stores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/stores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const openCreateModal = useCallback(() => {
    setEditingStore(null);
    setForm(emptyForm);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((store: Store) => {
    setEditingStore(store);
    setForm({
      name: store.name,
      address: store.address ?? "",
      chain: store.chain ?? "",
    });
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingStore(null);
    setForm(emptyForm);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) return;
    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }, [form, editingStore, createMutation, updateMutation]);

  const handleDelete = useCallback(
    (store: Store) => {
      Alert.alert(
        "店舗を削除",
        `「${store.name}」を削除しますか？関連する価格データも影響を受ける可能性があります。`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "削除",
            style: "destructive",
            onPress: () => deleteMutation.mutate(store.id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const renderStore = ({ item }: { item: Store }) => (
    <Card style={styles.storeCard} onPress={() => openEditModal(item)}>
      <Card.Content>
        <View style={styles.storeRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">{item.name}</Text>
            {item.chain && (
              <Text variant="bodySmall" style={{ color: "#64748b" }}>
                {item.chain}
              </Text>
            )}
            {item.address && (
              <Text variant="bodySmall" style={{ color: "#94a3b8" }}>
                {item.address}
              </Text>
            )}
          </View>
          <IconButton
            icon="delete-outline"
            iconColor="#ef4444"
            size={20}
            onPress={() => handleDelete(item)}
          />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <>
      <Stack.Screen options={{ title: "店舗管理", headerShown: true }} />
      <View style={styles.container}>
        <FlatList
          data={stores ?? []}
          renderItem={renderStore}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>
                店舗がまだ登録されていません{"\n"}
                右下の＋ボタンから追加してください
              </Text>
            ) : null
          }
        />

        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#ffffff"
          onPress={openCreateModal}
        />

        <Portal>
          <Modal
            visible={modalVisible}
            onDismiss={closeModal}
            contentContainerStyle={styles.modal}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingStore ? "店舗を編集" : "店舗を追加"}
            </Text>

            <TextInput
              label="店舗名 *"
              value={form.name}
              onChangeText={(text) => setForm((f) => ({ ...f, name: text }))}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="チェーン名"
              value={form.chain}
              onChangeText={(text) => setForm((f) => ({ ...f, chain: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="例: イオン、西友"
            />

            <TextInput
              label="住所"
              value={form.address}
              onChangeText={(text) => setForm((f) => ({ ...f, address: text }))}
              mode="outlined"
              style={styles.input}
              multiline
            />

            <View style={styles.modalActions}>
              <Button mode="text" onPress={closeModal}>
                キャンセル
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
                disabled={!form.name.trim()}
              >
                {editingStore ? "更新" : "追加"}
              </Button>
            </View>
          </Modal>
        </Portal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  storeCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
  modal: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 48,
    lineHeight: 24,
  },
});
