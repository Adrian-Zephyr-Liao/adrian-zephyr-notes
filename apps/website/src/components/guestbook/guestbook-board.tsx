"use client";

import { GuestbookForm } from "./guestbook-form";
import { GuestbookHero } from "./guestbook-hero";
import { GuestbookMessageList } from "./guestbook-message-list";
import { useGuestbookBoard } from "./use-guestbook-board";

function GuestbookBoard() {
  const guestbook = useGuestbookBoard();

  return (
    <main className="flex-1 overflow-hidden px-3 pb-14 sm:px-4">
      <section className="mx-auto grid w-full max-w-5xl gap-8 pt-8 sm:pt-12">
        <GuestbookHero
          latestMessage={guestbook.latestMessage}
          totalMessages={guestbook.totalMessages}
          user={guestbook.user}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <GuestbookMessageList
            canLoadMore={guestbook.canLoadMore}
            isLoadingMore={guestbook.isLoadingMore}
            likingMessageIds={guestbook.likingMessageIds}
            messages={guestbook.messages}
            onLoadMore={guestbook.loadMore}
            onToggleLike={guestbook.toggleLike}
            totalItems={guestbook.pagination?.totalItems ?? null}
          />

          <GuestbookForm
            body={guestbook.body}
            errorMessage={guestbook.errorMessage}
            guestNickname={guestbook.guestNickname}
            isSubmitting={guestbook.isSubmitting}
            loginUrl={guestbook.loginUrl}
            onBodyChange={guestbook.setBody}
            onGuestNicknameChange={guestbook.setGuestNickname}
            onLogout={guestbook.logout}
            onSubmit={guestbook.submitMessage}
            onWebsiteChange={guestbook.setWebsite}
            user={guestbook.user}
            website={guestbook.website}
          />
        </div>
      </section>
    </main>
  );
}

export { GuestbookBoard };
