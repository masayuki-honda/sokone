"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  X,
  Check,
  FolderTree,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
  displayOrder: number;
  parentId: string | null;
  _count: { products: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setError("カテゴリの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "カテゴリの追加に失敗しました");
        return;
      }

      setNewName("");
      setShowAddForm(false);
      await fetchCategories();
    } catch {
      setError("カテゴリの追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setIsEditing(true);
    setError(null);

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "カテゴリの更新に失敗しました");
        return;
      }

      setEditingId(null);
      setEditName("");
      await fetchCategories();
    } catch {
      setError("カテゴリの更新に失敗しました");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "カテゴリの削除に失敗しました");
        return;
      }

      setDeleteTarget(null);
      await fetchCategories();
    } catch {
      setError("カテゴリの削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <FolderTree className="h-6 w-6" />
              カテゴリ管理
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              商品のカテゴリを追加・編集・削除します
            </p>
          </div>
          <Button
            onClick={() => {
              setShowAddForm(true);
              setError(null);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="新しいカテゴリ名"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") {
                      setShowAddForm(false);
                      setNewName("");
                    }
                  }}
                  autoFocus
                  maxLength={50}
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={isAdding || !newName.trim()}
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-8 text-center text-zinc-500">
            <FolderTree className="mx-auto h-12 w-12 text-zinc-300" />
            <p className="mt-2">カテゴリがまだありません</p>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {categories.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="py-3 px-4">
                  {editingId === cat.id ? (
                    /* Edit mode */
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEdit(cat.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        maxLength={50}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleEdit(cat.id)}
                        disabled={isEditing || !editName.trim()}
                      >
                        {isEditing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{cat.name}</span>
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Package className="h-3 w-3" />
                          {cat._count.products}件
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(cat)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(cat)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          disabled={cat._count.products > 0}
                          title={
                            cat._count.products > 0
                              ? "商品が登録されているカテゴリは削除できません"
                              : "削除"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>カテゴリの削除</DialogTitle>
              <DialogDescription>
                「{deleteTarget?.name}」を削除しますか？この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
