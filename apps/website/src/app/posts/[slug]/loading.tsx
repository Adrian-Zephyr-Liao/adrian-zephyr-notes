function Loading() {
  return (
    <main className="mx-auto grid w-[min(1180px,calc(100%-1rem))] flex-1 gap-5 py-8">
      <div className="h-64 animate-pulse rounded-3xl border border-(--glass-border) bg-(--glass-surface)" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="h-[42rem] animate-pulse rounded-3xl border border-(--glass-border) bg-(--glass-surface)" />
        <div className="hidden h-72 animate-pulse rounded-3xl border border-(--glass-border) bg-(--glass-surface) lg:block" />
      </div>
    </main>
  );
}

export default Loading;
