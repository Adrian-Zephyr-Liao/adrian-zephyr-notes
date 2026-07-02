"use client";

import { GuestbookForm } from "./guestbook-form";
import { GuestbookHero } from "./guestbook-hero";
import { GuestbookMessageList } from "./guestbook-message-list";
import { GuestbookMeteorShower } from "./guestbook-meteor-shower";
import { GuestbookPostOffice } from "./guestbook-post-office";
import { useGuestbookBoard } from "./use-guestbook-board";

function GuestbookBoard() {
  const guestbook = useGuestbookBoard();

  return (
    <main className="relative flex-1 overflow-hidden px-3 pb-14 sm:px-4">
      <GuestbookMeteorShower />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-36 bottom-12 left-1/2 z-10 hidden w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,color-mix(in_oklch,var(--primary),transparent_40%)_0_0.75rem,transparent_0.75rem_1.5rem)] opacity-35 lg:block"
      />
      <section className="relative z-20 mx-auto grid w-full max-w-5xl gap-6 pt-8 sm:gap-8 sm:pt-12">
        <GuestbookHero
          latestMessage={guestbook.latestMessage}
          totalMessages={guestbook.totalMessages}
          user={guestbook.user}
        />

        <GuestbookPostOffice
          bodyLength={guestbook.body.trim().length}
          guestNickname={guestbook.guestNickname}
          isSubmitting={guestbook.isSubmitting}
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
