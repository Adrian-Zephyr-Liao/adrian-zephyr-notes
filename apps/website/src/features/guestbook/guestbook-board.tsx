"use client";

import { GuestbookForm } from "./guestbook-form";
import { GuestbookHero } from "./guestbook-hero";
import { GuestbookMessageList } from "./guestbook-message-list";
import { useGuestbookBoard } from "./use-guestbook-board";

function GuestbookBoard() {
  const guestbook = useGuestbookBoard();
  return (
    <main className="flex-1 px-5 pt-8 pb-12 min-[601px]:px-8 min-[601px]:pt-14 min-[601px]:pb-20 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-primary [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-primary">
      <div className="mx-auto max-w-[1320px]">
        <GuestbookHero
          latestMessage={guestbook.latestMessage}
          totalMessages={guestbook.totalMessages}
          user={guestbook.user}
        />
        <div className="grid grid-cols-1 items-start gap-12 pt-8 min-[601px]:pt-12 min-[801px]:grid-cols-[minmax(0,1fr)_300px] min-[801px]:gap-10 min-[1051px]:grid-cols-[minmax(0,1fr)_340px] min-[1051px]:gap-20">
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
      </div>
    </main>
  );
}
export { GuestbookBoard };
