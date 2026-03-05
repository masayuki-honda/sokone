import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ProductsLoading() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header + search bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-6 w-16 ml-auto" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
